import { Ambience } from "./ambience";
import type { Cue } from "./cues";
import { admit, type Voice } from "./mixer";
import { RECIPES, type CueId } from "./recipes";
import type { SoundSettings } from "./settings";
import { buildSamples } from "./zzfx";
// Buses: sfx and ui → master; music → duck → master; master → compressor → speakers.

/** Bus gain scale, so full sliders leave headroom for bursts. */
const HEADROOM = 0.5,
  DUCK_LEVEL = 0.4,
  DUCK_TIME = 0.6;
const BUS_OF = { combat: "sfx", flow: "sfx", ui: "ui" } as const;
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
  /** False when the mixer refused the cue (gap, cap or a full pool). */
  play(cue: Cue) {
    const spec = RECIPES[cue.id],
      now = this.ctx.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    const a = admit(cue.id, spec, this.voices, this.last.get(cue.id), now);
    if (!a.play) return false;
    if (a.steal) {
      a.steal.source.stop();
      this.voices = this.voices.filter((v) => v !== a.steal);
    }
    const buffer = this.buffer(cue.id),
      source = this.ctx.createBufferSource(),
      gain = this.ctx.createGain(),
      jitter = spec.params[1] ?? 0.05;
    source.buffer = buffer;
    // Audio jitter is render-side only; the simulation never sees it.
    source.playbackRate.value = cue.pitch * (1 + jitter * (Math.random() * 2 - 1));
    gain.gain.value = cue.gain;
    source.connect(gain).connect(this.bus[BUS_OF[spec.pool]]);
    source.start(now);
    this.voices.push({ cue: cue.id, pool: spec.pool, priority: spec.priority, start: now, end: now + buffer.duration / source.playbackRate.value, source });
    this.last.set(cue.id, now);
    if (spec.duck) this.duck(now);
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
  private duck(now: number) {
    const g = this.duckGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(DUCK_LEVEL, now + 0.05);
    g.setTargetAtTime(1, now + DUCK_TIME, 0.3);
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
