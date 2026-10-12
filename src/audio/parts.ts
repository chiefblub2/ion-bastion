import type { Family } from "./families";
// One composed 16-step part per tower family. A digit is the activity rank a step needs (1 plays as soon as the
// family is active, 4 only at full activity); `voices` gives the chord tone per step.

interface Part {
  steps: string;
  voices: readonly number[];
}
const tones = (s: string) => [...s].map(Number);
export const PARTS: Record<Family, Part> = {
  rapid: { steps: "1.3.1.3.1.3.1.4.", voices: tones("0020102000201030") },
  heavy: { steps: "1.......2.......", voices: tones("0000000000000000") },
  electric: { steps: "..2...1...2...1.", voices: tones("0020001000300020") },
  control: { steps: "1...............", voices: tones("0000000000000000") },
  fire: { steps: ".3.1.3.1.3.1.3.1", voices: tones("0000000000000000") },
  traps: { steps: "...1..2....1..2.", voices: tones("0000000000000000") },
};
/** Activity each rank needs. */
const NEED = [0.02, 0.3, 0.55, 0.8];
/** The family's note at a 1/16 step, or null when the step rests at this activity. */
export function partNote(family: Family, step: number, level: number): { voice: number; velocity: number } | null {
  const i = ((step % 16) + 16) % 16,
    rank = PARTS[family].steps[i];
  if (rank === "." || level < NEED[Number(rank) - 1]) return null;
  return { voice: PARTS[family].voices[i], velocity: 0.4 + 0.6 * level };
}
