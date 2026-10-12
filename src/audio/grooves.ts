import type { Color, Groove } from "./harmony";
// The enemies' rhythm section, 16 steps per bar ("x" = hit), and the arpeggio's path through the chord.

export type Drum = "kick" | "snare" | "hat" | "stomp" | "bass";
const GROOVES: Record<Exclude<Groove, "none">, Record<"kick" | "snare", string>> = {
  straight: { kick: "x.......x.......", snare: "....x.......x..." },
  half: { kick: "x.........x.....", snare: "........x......." },
  broken: { kick: "x..x......x.....", snare: "....x.......x..x" },
};
/** Parts every groove shares: 8th hats, a bass pulse, and a heavy enemy's stomp on beats 1 and 3. */
const SHARED: Record<"hat" | "stomp" | "bass", string> = { hat: "x.x.x.x.x.x.x.x.", stomp: "x.......x.......", bass: "x.....x...x....." };
/** No drums at low threat; then the kick, a backbeat, and at the top hats and a bass pulse; heavy enemies stomp. */
export function layersFor(threat: number, heavies: number): Drum[] {
  const parts: Drum[] = [];
  if (threat >= 0.25) parts.push("kick");
  if (threat >= 0.5) parts.push("snare");
  if (threat >= 0.75) parts.push("hat", "bass");
  if (heavies > 0) parts.push("stomp");
  return parts;
}
export function hitsAt(groove: Groove, step: number, layers: readonly Drum[]): Drum[] {
  if (groove === "none") return [];
  const i = ((step % 16) + 16) % 16;
  return layers.filter((d) => (d === "hat" || d === "stomp" || d === "bass" ? SHARED[d] : GROOVES[groove][d])[i] === "x");
}
/** Chord-tone index per step through a chord of `n` tones: rising when the defense is ahead, falling when it is behind, up and down when even. */
export function arpIndex(step: number, color: Color, n: number) {
  const s = Math.abs(step);
  if (color === "bright") return s % n;
  if (color === "dark") return n - 1 - (s % n);
  const period = 2 * n - 2,
    p = s % period;
  return p < n ? p : period - p;
}
