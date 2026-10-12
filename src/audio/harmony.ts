import { fnv } from "../core/hash";
import type { DroneId } from "./mood";
// Key, tempo and a 4-bar chord loop per theme. The defense widens the chords; a dark mood adds a tension note.

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
} as const;
export type Mode = keyof typeof MODES;
export type Groove = "none" | "straight" | "half" | "broken";
/** The mood from the balance between threat and defense. */
export type Color = "bright" | "drive" | "dark";
/** Chord size: triad, 7th or 9th. */
export type Extent = 3 | 4 | 5;
export interface ThemeMusic {
  bpm: number;
  /** MIDI note of the key's root (the drone's root). */
  root: number;
  mode: Mode;
  /** Scale degree (0 = tonic) of the chord in each of the four bars. */
  progression: readonly [number, number, number, number];
  groove: Groove;
}
const m = (bpm: number, root: number, mode: Mode, progression: [number, number, number, number], groove: Groove): ThemeMusic => ({ bpm, root, mode, progression, groove });

export const MUSIC: Record<DroneId, ThemeMusic> = {
  menu: m(84, 33, "aeolian", [0, 5, 2, 6], "none"),
  outpost: m(96, 33, "aeolian", [0, 5, 2, 6], "straight"),
  lock: m(92, 34, "dorian", [0, 3, 0, 6], "straight"),
  shard: m(100, 35, "dorian", [0, 3, 4, 0], "broken"),
  ember: m(98, 31, "phrygian", [0, 1, 0, 6], "broken"),
  core: m(96, 33, "harmonic", [0, 5, 3, 4], "straight"),
  frost: m(88, 36, "dorian", [0, 3, 6, 4], "half"),
  toxic: m(94, 32, "phrygian", [0, 1, 6, 0], "broken"),
  orbit: m(86, 38, "aeolian", [0, 5, 6, 4], "half"),
  ruin: m(90, 30, "aeolian", [0, 3, 5, 4], "half"),
  rift: m(102, 28, "phrygian", [0, 1, 3, 1], "broken"),
  dune: m(94, 33, "dorian", [0, 6, 3, 0], "straight"),
  abyss: m(84, 26, "aeolian", [0, 5, 6, 0], "half"),
  storm: m(104, 31, "aeolian", [0, 6, 5, 4], "broken"),
  jungle: m(98, 35, "dorian", [0, 6, 3, 0], "straight"),
  volcano: m(100, 29, "harmonic", [0, 5, 1, 4], "straight"),
  geode: m(90, 37, "aeolian", [0, 3, 6, 4], "half"),
  gear: m(100, 34, "dorian", [0, 6, 3, 4], "straight"),
  tide: m(88, 32, "aeolian", [0, 5, 3, 4], "half"),
};

/** MIDI notes of the bar's chord, stacked in thirds from its degree: triad, + 7th, + 9th. */
export function chordOf(music: ThemeMusic, bar: number, extent: Extent = 3): number[] {
  const scale = MODES[music.mode],
    degree = music.progression[((bar % 4) + 4) % 4];
  return [0, 2, 4, 6, 8].slice(0, extent).map((s) => {
    const i = degree + s;
    return music.root + scale[i % 7] + 12 * Math.floor(i / 7);
  });
}
/** The defense builds the harmony: triads, then 7ths from a quarter, 9ths from half. */
export const extentFor = (defense: number): Extent => (defense >= 0.5 ? 5 : defense >= 0.25 ? 4 : 3);
/** The pad's chord; under tension the minor ninth replaces the 9th (or, without one, the 5th), never clustering next to it. */
export function padChord(chord: readonly number[], tense: boolean) {
  if (!tense) return [...chord];
  const out = [...chord];
  out[chord.length >= 5 ? 4 : 2] = chord[0] + 13;
  return out;
}
/** MIDI note per drone voice: the bass on the root, then the chord's colour first (3rd, 7th or 5th, 9th, 5th), an octave up. */
export function padVoicing(chord: readonly number[], voices: number) {
  const upper = [1, 3, 4, 2].filter((i) => i < chord.length);
  return Array.from({ length: voices }, (_, k) => (k === 0 ? chord[0] : chord[upper[(k - 1) % upper.length]] + 12));
}
export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** Chord tone `index` (wrapping) in the octave whose pitch lies nearest `targetHz`. */
export function snap(targetHz: number, chord: readonly number[], index: number) {
  const note = chord[((index % chord.length) + chord.length) % chord.length],
    target = 69 + 12 * Math.log2(targetHz / 440);
  return hz(note + 12 * Math.round((target - note) / 12));
}
/**
 * Chord tone `index` (wrapping) with the whole chord in the octave around `targetHz`, so stepping through the indices
 * keeps its direction (arpeggio, kills); `snap` instead folds each tone to the nearest octave.
 */
export function climb(targetHz: number, chord: readonly number[], index: number) {
  const n = chord.length,
    centre = (chord[0] + chord[n - 1]) / 2,
    target = 69 + 12 * Math.log2(targetHz / 440);
  return hz(chord[((index % n) + n) % n] + 12 * Math.round((target - centre) / 12));
}
/** Like `climb`, but centred on the chord's root, so the bass never flips an octave when the chord widens. */
export function rooted(targetHz: number, chord: readonly number[], index: number) {
  const n = chord.length,
    target = 69 + 12 * Math.log2(targetHz / 440);
  return hz(chord[((index % n) + n) % n] + 12 * Math.round((target - chord[0]) / 12));
}
/** A stable chord-tone index per tower, so each tower keeps its own voice. */
export const voiceOf = (tower: string) => fnv(`voice:${tower}`) % 4;
