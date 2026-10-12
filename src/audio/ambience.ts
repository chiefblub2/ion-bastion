import { DRONES } from "./drones";
import type { DroneId, Mood } from "./mood";
// Plays one drone at a time; a theme change crossfades, a level change glides.

const FADE = 3,
  GLIDE = 1.5;
interface Layer {
  id: DroneId;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  level: number;
}
export class Ambience {
  private layer: Layer | null = null;
  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private noise: AudioBuffer,
  ) {}
  set(mood: Mood) {
    const now = this.ctx.currentTime;
    if (this.layer?.id !== mood.drone) {
      if (this.layer) this.fadeOut(this.layer, now);
      this.layer = this.build(mood.drone, now);
    }
    const layer = this.layer;
    if (Math.abs(layer.level - mood.level) < 0.01) return;
    const g = layer.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(mood.level, now, (layer.level < 0 ? FADE : GLIDE) / 3);
    layer.level = mood.level;
  }
  stop() {
    if (this.layer) this.fadeOut(this.layer, this.ctx.currentTime);
    this.layer = null;
  }
  private fadeOut(layer: Layer, now: number) {
    const g = layer.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.setTargetAtTime(0, now, FADE / 3);
    for (const s of layer.sources) s.stop(now + FADE * 2);
  }
  private build(id: DroneId, now: number): Layer {
    const spec = DRONES[id],
      ctx = this.ctx,
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      lfo = ctx.createOscillator(),
      depth = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.connect(this.out);
    filter.type = "lowpass";
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.7;
    filter.connect(gain);
    lfo.frequency.value = spec.lfo;
    depth.gain.value = spec.cutoff * 0.35;
    lfo.connect(depth).connect(filter.frequency);
    const sources: AudioScheduledSourceNode[] = [lfo],
      each = 0.12 / spec.intervals.length;
    for (const semitones of spec.intervals)
      for (const cents of [-spec.detune, spec.detune]) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = spec.wave;
        o.frequency.value = spec.root * 2 ** (semitones / 12);
        o.detune.value = cents;
        g.gain.value = each;
        o.connect(g).connect(filter);
        sources.push(o);
      }
    if (spec.noise > 0) {
      const src = ctx.createBufferSource(),
        band = ctx.createBiquadFilter(),
        g = ctx.createGain();
      src.buffer = this.noise;
      src.loop = true;
      band.type = "bandpass";
      band.frequency.value = spec.cutoff * 2;
      band.Q.value = 0.8;
      g.gain.value = spec.noise;
      src.connect(band).connect(g).connect(gain);
      sources.push(src);
    }
    for (const s of sources) s.start(now);
    return { id, gain, sources, level: -1 };
  }
}
