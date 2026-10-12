import { Ambience } from "./ambience";
import { addDuck, type Span } from "./duck";
import { driveCurve, impulse, INSTRUMENTS, type Instrument, type Kit } from "./instruments";
import { admit, type Voice } from "./mixer";
import { RECIPES, TIMING, type CueId } from "./recipes";
import type { Note } from "./score";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: sfx and ui → master; music (drone and instruments) → duck → master; music and sfx also feed one reverb.
// master → gentle compressor → limiter → speakers. Works on an OfflineAudioContext too (scripts/render-music.ts).

/** Bus gain scale, so full sliders leave headroom. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6;
/** Notes one instrument may sound at once. */
export const POLYPHONY = 6;
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui" } as const;
type Playing = Voice & { source: AudioBufferSourceNode };

export class AudioEngine {
  readonly ambience: Ambience;
  private master: GainNode;
  private bus: Record<"sfx" | "ui" | "music", GainNode>;
  private duckGain: GainNode;
  private energyGain: GainNode;
  private kit: Kit;
  private buffers = new Map<CueId, AudioBuffer>();
  private voices: Playing[] = [];
  private last = new Map<CueId, number>();
  private ducks: Span[] = [];
  private notes = new Map<Instrument, number[]>();
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
    wet.gain.value = 1.4;
    reverb.connect(wet).connect(this.master);
    this.bus = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    this.bus.sfx.connect(this.master);
    this.bus.ui.connect(this.master);
    this.duckGain = ctx.createGain();
    this.energyGain = ctx.createGain();
    this.bus.music.connect(this.energyGain).connect(this.duckGain).connect(this.master);
    const send = (from: AudioNode, amount: number) => {
      const g = ctx.createGain();
      g.gain.value = amount;
      from.connect(g).connect(lows);
    };
    send(this.duckGain, 0.35);
    send(this.bus.sfx, 0.12);
    this.kit = { noise: noiseBuffer(ctx), drive: driveCurve() };
    this.ambience = new Ambience(ctx, this.bus.music, this.kit.noise);
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
    source.connect(gain).connect(this.bus[BUS_OF[spec.pool]]);
    source.start(at);
    this.voices.push({ cue: note.id, pool: spec.pool, priority: spec.priority, start: at, end: at + buffer.duration / source.playbackRate.value, source });
    this.last.set(note.id, at);
    if (spec.duck) this.duck(at);
    return true;
  }
  /** Plays a note on the music bus (ducked) or, for stingers, the effects bus; false when the instrument already sounds too many notes at that time. */
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number, bus: "music" | "sfx" = "music") {
    // Judged at the note's own time, so an offline render (currentTime stays 0 while scheduling) works the same.
    const start = Math.max(this.ctx.currentTime, at),
      sounding = (this.notes.get(name) ?? []).filter((end) => end > start);
    if (sounding.length >= POLYPHONY) return false;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.bus[bus]);
    sounding.push(INSTRUMENTS[name](this.ctx, panner, start, hz, velocity, this.kit));
    this.notes.set(name, sounding);
    return true;
  }
  /** Music loudness from the fight's energy (0 calm … 1 climax): about −2 dB to +6 dB; the layers add the rest of the build-up. */
  energy(level: number) {
    this.energyGain.gain.setTargetAtTime(0.8 + 1.2 * Math.max(0, Math.min(1, level)), this.ctx.currentTime, 0.8);
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
