import { Ambience } from "./ambience";
import { admit, type Voice } from "./mixer";
import { RECIPES, TIMING, type CueId } from "./recipes";
import type { Note } from "./score";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: sfx and ui → master; music (drone, drums, arpeggio) → duck → master; master → compressor → speakers.

/** Bus gain scale, so full sliders leave headroom for bursts. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6;
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui", drums: "music" } as const;
type Playing = Voice & { source: AudioBufferSourceNode };

export class AudioEngine {
  readonly ambience: Ambience;
  private master: GainNode;
  private bus: Record<"sfx" | "ui" | "music", GainNode>;
  private duckGain: GainNode;
  private buffers = new Map<CueId, AudioBuffer>();
  private voices: Playing[] = [];
  private last = new Map<CueId, number>();
  constructor(readonly ctx: AudioContext) {
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(compressor);
    this.bus = { sfx: ctx.createGain(), ui: ctx.createGain(), music: ctx.createGain() };
    this.bus.sfx.connect(this.master);
    this.bus.ui.connect(this.master);
    this.duckGain = ctx.createGain();
    this.bus.music.connect(this.duckGain).connect(this.master);
    this.ambience = new Ambience(ctx, this.bus.music, noiseBuffer(ctx));
  }
  volumes(s: SoundSettings) {
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, now, 0.05);
    for (const b of ["sfx", "ui", "music"] as const) this.bus[b].gain.setTargetAtTime(s[b] * HEADROOM, now, 0.05);
  }
  /** Schedules a note at its time (never in the past); false when the mixer refused it. */
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
  private duck(at: number) {
    const g = this.duckGain.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(DUCK_LEVEL, at + 0.05);
    g.setTargetAtTime(1, at + DUCK_TIME, 0.3);
  }
}
/** Two seconds of white noise from xorshift32, the same on every load. */
function noiseBuffer(ctx: AudioContext) {
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
