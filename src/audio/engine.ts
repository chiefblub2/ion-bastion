import { Ambience } from "./ambience";
import { addDuck, type Span } from "./duck";
import { impulse, INSTRUMENTS, type Instrument, type Kit } from "./instruments";
import { admit, type Voice } from "./mixer";
import { RECIPES, SHOT_CUES, TIMING, type CueId } from "./recipes";
import type { Note } from "./score";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: the soundtrack's layers → music → duck → master; effects (shots through their own shaded, gently compressed
// sub-bus) and ui → master. Pad and bass pump with the kick; arpeggio and lead feed a ping-pong delay; music and
// effects share one reverb. master → gentle compressor → limiter → speakers. Works on an OfflineAudioContext too
// (scripts/render-music.ts).

/** Bus gain scale, so full sliders leave headroom. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6,
  /** Pad and bass level on a kick, recovering over about an 8th note. */
  PUMP_DEPTH = 0.55,
  /** A layer note this late (the timer stalled behind a busy frame) is dropped rather than played out of time. */
  LATE = 0.03,
  /** Cut of the shots' high shelf at full density (dB), and the shots per second that count as full. */
  SHELF_CUT = -6,
  DENSE = 40;
/** Notes one instrument may sound at once. */
export const POLYPHONY = 6;
/** Notes all instruments together may sound at once. */
export const MUSIC_VOICES = 32;
/** Where an instrument note plays: one of the soundtrack's layers, or the effects bus (stingers). */
export type Layer = "pad" | "bass" | "drums" | "keys" | "sfx";
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui" } as const;
const SHOTS = new Set<CueId>(SHOT_CUES);
type Playing = Voice & { source: AudioBufferSourceNode };

export class AudioEngine {
  readonly ambience: Ambience;
  private master: GainNode;
  private bus: Record<"sfx" | "ui" | "music", GainNode>;
  private duckGain: GainNode;
  private energyGain: GainNode;
  private pumpGain: GainNode;
  private layers: Record<Exclude<Layer, "sfx">, GainNode>;
  private shots: GainNode;
  private shelf: BiquadFilterNode;
  private echoes: DelayNode[];
  private kit: Kit;
  private buffers = new Map<CueId, AudioBuffer>();
  private voices: Playing[] = [];
  private last = new Map<CueId, number>();
  private ducks: Span[] = [];
  private notes = new Map<Instrument, number[]>();
  private sounding: number[] = [];
  private panners = new Map<AudioNode, Map<number, StereoPannerNode>>();
  constructor(readonly ctx: BaseAudioContext) {
    const compressor = ctx.createDynamicsCompressor(),
      limiter = ctx.createDynamicsCompressor(),
      reverb = ctx.createConvolver(),
      wet = ctx.createGain();
    compressor.threshold.value = -20;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    compressor.connect(limiter).connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(compressor);
    // The convolver normalises its impulse, so the return needs real gain; no lows into the reverb, they only blur.
    const lows = ctx.createBiquadFilter();
    lows.type = "highpass";
    lows.frequency.value = 250;
    lows.Q.value = 0.7;
    lows.connect(reverb);
    reverb.buffer = impulse(ctx);
    wet.gain.value = 1.1;
    reverb.connect(wet).connect(this.master);
    this.bus = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    this.bus.sfx.connect(this.master);
    this.bus.ui.connect(this.master);
    this.duckGain = ctx.createGain();
    this.bus.music.connect(this.duckGain).connect(this.master);
    this.layers = { pad: ctx.createGain(), bass: ctx.createGain(), drums: ctx.createGain(), keys: ctx.createGain() };
    this.pumpGain = ctx.createGain();
    this.pumpGain.connect(this.bus.music);
    this.layers.pad.connect(this.pumpGain);
    this.layers.bass.connect(this.pumpGain);
    this.energyGain = ctx.createGain();
    this.layers.drums.connect(this.energyGain).connect(this.bus.music);
    this.layers.keys.connect(this.bus.music);
    this.echoes = this.pingPong(this.layers.keys, this.bus.music);
    // Shots: a high shelf that closes with the density, then a slow, gentle compressor for the peaks.
    this.shots = ctx.createGain();
    this.shelf = ctx.createBiquadFilter();
    this.shelf.type = "highshelf";
    this.shelf.frequency.value = 3000;
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -24;
    glue.knee.value = 12;
    glue.ratio.value = 2;
    glue.attack.value = 0.01;
    glue.release.value = 0.4;
    this.shots.connect(this.shelf).connect(glue).connect(this.bus.sfx);
    const send = (from: AudioNode, amount: number) => {
      const g = ctx.createGain();
      g.gain.value = amount;
      from.connect(g).connect(lows);
    };
    send(this.layers.keys, 0.25);
    send(this.layers.pad, 0.12);
    send(this.layers.drums, 0.1);
    send(this.bus.sfx, 0.1);
    this.kit = { noise: noiseBuffer(ctx) };
    this.ambience = new Ambience(ctx, this.layers.pad);
  }
  volumes(s: SoundSettings) {
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.05);
    for (const b of ["sfx", "ui", "music"] as const) this.bus[b].gain.setTargetAtTime(s[b] * HEADROOM, now, 0.05);
  }
  /** Schedules an effect at its time (never in the past); false when the mixer refused it. */
  play(note: Note) {
    const spec = RECIPES[note.id],
      now = this.ctx.currentTime,
      at = Math.max(now, note.at);
    this.voices = this.voices.filter((v) => v.end > now);
    const a = admit(note.id, spec, this.voices, this.last.get(note.id), at);
    if (!a.play) return false;
    if (a.steal) {
      a.steal.source.stop();
      this.voices = this.voices.filter((v) => v !== a.steal);
    }
    const buffer = this.buffer(note.id),
      source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      // Pitched notes stay in tune; unpitched ones vary a little. Render-side only.
      jitter = TIMING[note.id].pitched ? 0 : (spec.params[1] ?? 0.05);
    source.buffer = buffer;
    source.playbackRate.value = note.rate * (1 + jitter * (Math.random() * 2 - 1));
    gain.gain.value = note.gain;
    source.connect(gain).connect(this.panner(SHOTS.has(note.id) ? this.shots : this.bus[BUS_OF[spec.pool]], note.pan ?? 0));
    source.onended = () => source.disconnect();
    source.start(at);
    this.voices.push({ cue: note.id, pool: spec.pool, priority: spec.priority, start: at, end: at + buffer.duration / source.playbackRate.value, source });
    this.last.set(note.id, at);
    if (spec.duck) this.duck(at);
    return true;
  }
  /**
   * Plays a note on one of the soundtrack's layers or, for stingers, the effects bus; false when it came too late or
   * the instrument (or the whole music) already sounds too many notes at that time.
   */
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number, layer: Layer = "keys", length?: number) {
    // Judged at the note's own time, so an offline render (currentTime stays 0 while scheduling) works the same.
    const now = this.ctx.currentTime;
    if (layer !== "sfx" && at < now - LATE) return false;
    const start = Math.max(now, at),
      sounding = (this.notes.get(name) ?? []).filter((end) => end > start);
    this.sounding = this.sounding.filter((end) => end > start);
    if (sounding.length >= POLYPHONY || this.sounding.length >= MUSIC_VOICES) return false;
    const end = INSTRUMENTS[name](this.ctx, this.panner(layer === "sfx" ? this.bus.sfx : this.layers[layer], pan), start, hz, velocity, this.kit, length);
    sounding.push(end);
    this.sounding.push(end);
    this.notes.set(name, sounding);
    return true;
  }
  /** Drum loudness from the fight's energy (0 calm … 1 climax): about −2 dB to +2.5 dB. */
  energy(level: number) {
    this.energyGain.gain.setTargetAtTime(0.8 + 0.55 * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 0.8);
  }
  /** The sidechain: pad and bass dip on a kick at `at` and recover over about an 8th note of `beat` seconds. */
  pump(at: number, beat: number) {
    const g = this.pumpGain.gain;
    g.setTargetAtTime(PUMP_DEPTH, at, 0.004);
    g.setTargetAtTime(1, at + 0.02, beat / 6);
  }
  /** Times the ping-pong delay to a dotted 8th of the tempo. */
  tempo(bpm: number) {
    const time = (0.75 * 60) / bpm;
    for (const d of this.echoes) d.delayTime.setTargetAtTime(time, this.ctx.currentTime, 0.05);
  }
  /** Shades the shots' highs as the field fires faster (shots per second over all towers). */
  shotDensity(fired: number) {
    this.shelf.gain.setTargetAtTime(SHELF_CUT * Math.min(1, fired / DENSE), this.ctx.currentTime, 0.3);
  }
  /** Rewrites the duck automation from now on: the gain is only known now, never at a future `at`. */
  duck(at: number) {
    const g = this.duckGain.gain,
      now = this.ctx.currentTime;
    this.ducks = addDuck(this.ducks, { start: at, end: at + DUCK_TIME }, now);
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    for (const d of this.ducks) {
      g.setTargetAtTime(DUCK_LEVEL, Math.max(now, d.start), 0.015);
      g.setTargetAtTime(1, d.end, 0.3);
    }
  }
  /** One panner per destination and position (rounded), reused by every note there. */
  private panner(to: AudioNode, pan: number) {
    const p = Math.round(pan * 20) / 20,
      at = this.panners.get(to) ?? this.panners.set(to, new Map()).get(to)!;
    let node = at.get(p);
    if (!node) {
      node = this.ctx.createStereoPanner();
      node.pan.value = p;
      node.connect(to);
      at.set(p, node);
    }
    return node;
  }
  /** Ping-pong: the input enters the left delay, each side feeds the other through a low-pass; returns both delays. */
  private pingPong(from: AudioNode, to: AudioNode) {
    const ctx = this.ctx,
      send = ctx.createGain(),
      left = ctx.createDelay(1),
      right = ctx.createDelay(1),
      merger = ctx.createChannelMerger(2),
      wet = ctx.createGain();
    send.gain.value = 0.3;
    wet.gain.value = 0.55;
    from.connect(send).connect(left);
    for (const [a, b] of [
      [left, right],
      [right, left],
    ]) {
      const tone = ctx.createBiquadFilter(),
        feedback = ctx.createGain();
      tone.type = "lowpass";
      tone.frequency.value = 3000;
      feedback.gain.value = 0.35;
      a.connect(tone).connect(feedback).connect(b);
    }
    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    merger.connect(wet).connect(to);
    return [left, right];
  }
  private buffer(id: CueId) {
    let b = this.buffers.get(id);
    if (!b) {
      const samples = buildSamples(RECIPES[id].params, this.ctx.sampleRate);
      b = this.ctx.createBuffer(1, Math.max(1, samples.length), this.ctx.sampleRate);
      b.getChannelData(0).set(samples);
      this.buffers.set(id, b);
    }
    return b;
  }
}
/** Two seconds of white noise from xorshift32, the same on every load. */
function noiseBuffer(ctx: BaseAudioContext) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
    data = b.getChannelData(0);
  let x = 0x9e3779b9;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    data[i] = (x >>> 0) / 0xffffffff - 0.5;
  }
  return b;
}
