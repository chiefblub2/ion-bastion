import type { DroneId } from "./mood";
// The ambient drone per map theme: a few detuned oscillators through a breathing low-pass, plus filtered noise.

export interface DroneSpec {
  /** Hz. */
  root: number;
  /** Semitones above the root. */
  intervals: readonly number[];
  wave: OscillatorType;
  /** Low-pass centre in Hz; an LFO moves it by ±35 %. */
  cutoff: number;
  /** Gain of the band-passed noise layer. */
  noise: number;
  /** LFO rate in Hz. */
  lfo: number;
  /** Cents between the two oscillators of an interval. */
  detune: number;
}
const d = (root: number, intervals: number[], wave: OscillatorType, cutoff: number, noise: number, lfo: number, detune = 6): DroneSpec => ({ root, intervals, wave, cutoff, noise, lfo, detune });

export const DRONES: Record<DroneId, DroneSpec> = {
  menu: d(55, [0, 7, 12, 19], "sine", 900, 0.03, 0.04),
  outpost: d(55, [0, 7, 12], "triangle", 600, 0.05, 0.05),
  lock: d(58.27, [0, 7, 10], "sawtooth", 500, 0.04, 0.07),
  shard: d(61.74, [0, 5, 12, 19], "sine", 1400, 0.03, 0.09),
  ember: d(49, [0, 7, 12], "sawtooth", 450, 0.12, 0.06),
  core: d(55, [0, 12, 19], "triangle", 700, 0.05, 0.1),
  frost: d(65.41, [0, 7, 14, 19], "sine", 1800, 0.08, 0.04),
  toxic: d(51.91, [0, 6, 12], "sawtooth", 520, 0.06, 0.11),
  orbit: d(73.42, [0, 7, 12, 16], "sine", 1200, 0.02, 0.03),
  ruin: d(46.25, [0, 3, 7], "triangle", 400, 0.07, 0.05),
  rift: d(41.2, [0, 1, 7], "sawtooth", 380, 0.05, 0.13),
  dune: d(55, [0, 5, 7], "triangle", 650, 0.1, 0.04),
  abyss: d(36.71, [0, 7, 12], "sine", 300, 0.06, 0.03),
  storm: d(49, [0, 7, 10, 14], "sawtooth", 700, 0.15, 0.12),
  jungle: d(61.74, [0, 4, 7, 11], "triangle", 900, 0.09, 0.06),
  volcano: d(43.65, [0, 7, 12], "sawtooth", 420, 0.14, 0.08),
  geode: d(69.3, [0, 7, 12, 17], "sine", 1600, 0.03, 0.07),
  gear: d(58.27, [0, 7, 12], "square", 500, 0.05, 0.15),
  tide: d(51.91, [0, 5, 9, 12], "sine", 800, 0.12, 0.05),
};
