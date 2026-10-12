import type { Color, Groove } from "./harmony";
// The enemies' rhythm section, 16 steps per bar ("x" = hit), and the arpeggio's path through the chord.

/** Pattern parts, plus the escalation's phrase marks (crash, riser, fill), which `schedule` places itself. */
export type Drum = "kick" | "snare" | "hat" | "hat16" | "stomp" | "bass" | "bass8" | "crash" | "riser" | "fill";
const GROOVES: Record<Exclude<Groove, "none">, Record<"kick" | "snare", string>> = {
  straight: { kick: "x.......x.......", snare: "....x.......x..." },
  half: { kick: "x.........x.....", snare: "........x......." },
  broken: { kick: "x..x......x.....", snare: "....x.......x..x" },
};
/** Parts every groove shares: hats, a bass pulse (straight 8ths when escalated), and a heavy enemy's stomp on beats 1 and 3. */
const SHARED: Partial<Record<Drum, string>> = {
  hat: "x.x.x.x.x.x.x.x.",
  hat16: "xxxxxxxxxxxxxxxx",
  stomp: "......x.......x.",
  bass: "x.....x...x...x.",
  bass8: "x.x.x.x.x.x.x.x.",
};
/** Threat from which the music escalates, and below which an escalation ends (hysteresis, so a riser never leads into nothing). */
export const ESCALATE = 0.85,
  CALM_DOWN = 0.75;
/** No drums at low threat; then the kick, a backbeat, and at the top hats and a bass pulse; heavy enemies stomp. */
export function layersFor(threat: number, heavies: number, escalate = false): Drum[] {
  // Escalated (high threat or a boss), the full groove plays whatever the measured threat.
  const t = escalate ? Math.max(threat, ESCALATE) : threat,
    parts: Drum[] = [];
  if (t >= 0.25) parts.push("kick");
  if (t >= 0.5) parts.push("snare", escalate ? "bass8" : "bass");
  if (t >= 0.75) parts.push("hat");
  if (escalate) parts.push("hat16");
  if (heavies > 0) parts.push("stomp");
  return parts;
}
export function hitsAt(groove: Groove, step: number, layers: readonly Drum[]): Drum[] {
  if (groove === "none") return [];
  const i = ((step % 16) + 16) % 16;
  return layers.filter((d) => (SHARED[d] ?? (d === "kick" || d === "snare" ? GROOVES[groove][d] : ""))[i] === "x");
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
/** Semitones above the chord root per 1/16 step for the enemies' bass: a tritone from threat 0.5, minor seconds and more tritones from 0.75. */
const TENSION = [0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0, 6, 0, 1, 0];
export function tensionOffset(step: number, threat: number) {
  const i = ((step % 16) + 16) % 16;
  if (threat < 0.5) return 0;
  return threat < 0.75 ? (i === 6 ? 6 : 0) : TENSION[i];
}
