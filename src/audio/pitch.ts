// Chord tones as frequencies: MIDI notes placed in the octave around an instrument's register or a recipe's pitch.

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
