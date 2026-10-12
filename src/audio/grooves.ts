import type { Color, Groove } from "./harmony";
// Drum parts from the enemies' threat, 16 steps per bar ("x" = hit), and the arpeggio's path through the chord.

export type Drum = "kick" | "snare" | "hat" | "hat16" | "stomp" | "bass";
const GROOVES: Record<Exclude<Groove, "none">, Record<"kick" | "snare" | "hat", string>> = {
  straight: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "..x...x...x...x." },
  half: { kick: "x.........x.....", snare: "........x.......", hat: "x.x.x.x.x.x.x.x." },
  broken: { kick: "x..x..x...x..x..", snare: "....x..x....x...", hat: "x.xxx.x.x.xxx.x." },
};
/** Parts every groove shares: 16th hats and an 8th-note bass at high threat, a heavy enemy's stomp on beats 1 and 3. */
const SHARED: Record<"hat16" | "stomp" | "bass", string> = { hat16: "xxxxxxxxxxxxxxxx", stomp: "x.......x.......", bass: "x.x.x.x.x.x.x.x." };
export function layersFor(threat: number, heavies: number): Drum[] {
  const parts: Drum[] = ["hat"];
  if (threat >= 0.25) parts.push("kick");
  if (threat >= 0.5) parts.push("snare");
  if (threat >= 0.75) parts.push("hat16", "bass");
  if (heavies > 0) parts.push("stomp");
  return parts;
}
export function hitsAt(groove: Groove, step: number, layers: readonly Drum[]): Drum[] {
  if (groove === "none") return [];
  const i = ((step % 16) + 16) % 16;
  return layers.filter((d) => (d === "hat16" || d === "stomp" || d === "bass" ? SHARED[d] : GROOVES[groove][d])[i] === "x");
}
/** Chord-tone index per 1/16 step through a chord of `n` tones: rising when the defense is ahead, falling when it is behind, up and down when even. */
export function arpIndex(step: number, color: Color, n: number) {
  const s = Math.abs(step);
  if (color === "bright") return s % n;
  if (color === "dark") return n - 1 - (s % n);
  const period = 2 * n - 2,
    p = s % period;
  return p < n ? p : period - p;
}
