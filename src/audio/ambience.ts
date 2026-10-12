import { DRONES } from "./drones";
import { hz, padVoicing } from "./harmony";
import type { DroneId, Mood } from "./mood";
// Plays one drone at a time; a theme change crossfades, a level change glides, a chord change retunes it and the
// tone opens or closes its filter.

const FADE = 3,
  GLIDE = 1.5,
  /** Time constant of the glide to a new chord (settles in about 80 ms). */
  RETUNE = 0.08 / 3,
  /** Time constant of a tone change. */
  TONE = 0.5;
interface Layer {
  id: DroneId;
  gain: GainNode;
  filter: BiquadFilterNode;
  depth: GainNode;
  sources: AudioScheduledSourceNode[];
  /** Two detuned oscillators per voice; voice 0 is the bass. */
  voices: OscillatorNode[][];
  level: number;
  tone: number;
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
  /** Retunes the drone to a chord (MIDI notes): bass on its root, pad from the top of the chord down, from `at`. */
  chord(notes: readonly number[], at: number) {
    const layer = this.layer;
    if (!layer) return;
    const voicing = padVoicing(notes, layer.voices.length);
    layer.voices.forEach((pair, k) => {
      for (const o of pair) o.frequency.setTargetAtTime(hz(voicing[k]), at, RETUNE);
    });
  }
  /** Opens (> 1) or closes (< 1) the pad's filter relative to the theme's own cutoff. */
  tone(factor: number) {
    const layer = this.layer;
    if (!layer || Math.abs(layer.tone - factor) < 0.02) return;
    const now = this.ctx.currentTime,
      cutoff = DRONES[layer.id].cutoff * factor;
    layer.filter.frequency.setTargetAtTime(cutoff, now, TONE);
    layer.depth.gain.setTargetAtTime(cutoff * 0.35, now, TONE);
    layer.tone = factor;
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
      voices: OscillatorNode[][] = [],
      each = 0.12 / spec.intervals.length;
    for (const semitones of spec.intervals) {
      const pair: OscillatorNode[] = [];
      for (const cents of [-spec.detune, spec.detune]) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = spec.wave;
        o.frequency.value = spec.root * 2 ** (semitones / 12);
        o.detune.value = cents;
        g.gain.value = each;
        o.connect(g).connect(filter);
        sources.push(o);
        pair.push(o);
      }
      voices.push(pair);
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
    return { id, gain, filter, depth, sources, voices, level: -1, tone: 1 };
  }
}
