import { DRONES } from "./drones";
import { hz, padVoicing } from "./harmony";
import type { DroneId, Mood } from "./mood";
// The synthwave pad: four voices of two detuned saws through one gentle low-pass and a stereo chorus, plus a sub sine
// on the root. No noise. A theme change crossfades, a level change glides, a chord change glides the voices and
// re-strikes the filter, and the tone opens or closes it.

const FADE = 3,
  GLIDE = 1.5,
  /** Time constant of the glide to a new chord (settles in about 150 ms). */
  RETUNE = 0.03,
  /** Time constant of a tone change. */
  TONE = 0.5,
  /** Filter lift on a chord change, in cents, and how fast it settles. */
  STRIKE = 700,
  STRIKE_DECAY = 0.35,
  /** Gain of one saw and of the sub at full `sub`. */
  SAW = 0.022,
  SUB = 0.11;
interface Layer {
  id: DroneId;
  gain: GainNode;
  filter: BiquadFilterNode;
  depth: GainNode;
  sources: AudioScheduledSourceNode[];
  /** Voice 0 is the sub (one sine), the others two detuned saws each. */
  voices: OscillatorNode[][];
  level: number;
  tone: number;
}
export class Ambience {
  private layer: Layer | null = null;
  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
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
  /** Glides the pad to a chord (MIDI notes) from `at` and re-strikes its filter. */
  chord(notes: readonly number[], at: number) {
    const layer = this.layer;
    if (!layer) return;
    const voicing = padVoicing(notes);
    layer.voices.forEach((oscillators, k) => {
      for (const o of oscillators) o.frequency.setTargetAtTime(hz(voicing[k]), at, RETUNE);
    });
    const d = layer.filter.detune;
    d.setTargetAtTime(STRIKE, at, 0.01);
    d.setTargetAtTime(0, at + 0.04, STRIKE_DECAY);
  }
  /** Opens (> 1) or closes (< 1) the pad's filter relative to the theme's own cutoff. */
  tone(factor: number) {
    const layer = this.layer;
    if (!layer || Math.abs(layer.tone - factor) < 0.02) return;
    const now = this.ctx.currentTime,
      spec = DRONES[layer.id],
      cutoff = spec.cutoff * factor;
    layer.filter.frequency.setTargetAtTime(cutoff, now, TONE);
    layer.depth.gain.setTargetAtTime(cutoff * spec.breath, now, TONE);
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
    layer.sources[0].onended = () => layer.gain.disconnect();
  }
  private build(id: DroneId, now: number): Layer {
    const spec = DRONES[id],
      ctx = this.ctx,
      gain = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      lfo = ctx.createOscillator(),
      depth = ctx.createGain(),
      merger = ctx.createChannelMerger(2),
      sources: AudioScheduledSourceNode[] = [lfo];
    gain.gain.setValueAtTime(0, now);
    merger.connect(gain).connect(this.out);
    filter.type = "lowpass";
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.5;
    lfo.frequency.value = spec.lfo;
    depth.gain.value = spec.cutoff * spec.breath;
    lfo.connect(depth).connect(filter.frequency);
    // Chorus: the dry pad in the middle, two slowly modulated short delays to the left and right.
    filter.connect(merger, 0, 0);
    filter.connect(merger, 0, 1);
    [
      [0.007, 0.31, 0],
      [0.011, 0.43, 1],
    ].forEach(([base, rate, side]) => {
      const delay = ctx.createDelay(0.05),
        mod = ctx.createOscillator(),
        amount = ctx.createGain(),
        wet = ctx.createGain();
      delay.delayTime.value = base;
      mod.frequency.value = rate;
      amount.gain.value = 0.0025 * spec.chorus;
      wet.gain.value = 0.7 * spec.chorus;
      mod.connect(amount).connect(delay.delayTime);
      filter.connect(delay).connect(wet).connect(merger, 0, side);
      sources.push(mod);
    });
    const voicing = padVoicing([45, 48, 52]),
      sub = ctx.createOscillator(),
      subGain = ctx.createGain();
    sub.frequency.value = hz(voicing[0]);
    subGain.gain.value = SUB * spec.sub;
    // The sub stays mono and out of the chorus.
    sub.connect(subGain).connect(gain);
    sources.push(sub);
    const voices: OscillatorNode[][] = [[sub]];
    for (const note of voicing.slice(1)) {
      const pair: OscillatorNode[] = [];
      for (const cents of [-spec.spread / 2, spec.spread / 2]) {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.value = hz(note);
        o.detune.value = cents;
        g.gain.value = SAW;
        o.connect(g).connect(filter);
        sources.push(o);
        pair.push(o);
      }
      voices.push(pair);
    }
    for (const s of sources) s.start(now);
    return { id, gain, filter, depth, sources, voices, level: -1, tone: 1 };
  }
}
