import type { BassStyle, LeadMotif } from "./drones";
import type { Color, Groove } from "./harmony";
// The soundtrack's patterns, 16 steps per bar: the drum machine ("x" = hit), the bass lines ("0" root, "1" octave),
// the arpeggio's path through the chord and the lead's 4-bar motifs.

/** Pattern parts, plus the escalation's phrase marks (crash, riser, fill), which `schedule` places itself. */
export type Drum = "kick" | "snare" | "hat" | "hat16" | "stomp" | "crash" | "riser" | "fill";
const GROOVES: Record<Exclude<Groove, "none">, Record<"kick" | "snare", string>> = {
  straight: { kick: "x.......x.......", snare: "....x.......x..." },
  half: { kick: "x.........x.....", snare: "........x......." },
  broken: { kick: "x..x......x.....", snare: "....x.......x..x" },
};
/** Parts every groove shares: offbeat hats, 16th hats when escalated, and a heavy enemy's tom answering the kick. */
const SHARED: Partial<Record<Drum, string>> = {
  hat: "..x...x...x...x.",
  hat16: "x.x.x.x.x.x.x.x.",
  stomp: "......x.......x.",
};
/** Threat from which the music escalates, and below which an escalation ends (hysteresis, so a riser never leads into nothing). */
export const ESCALATE = 0.85,
  CALM_DOWN = 0.75;
/** No drums at low threat; then the kick, a backbeat, and at the top hats; heavy enemies add a tom. */
export function layersFor(threat: number, heavies: number, escalate = false): Drum[] {
  // Escalated (high threat or a boss), the full groove plays whatever the measured threat.
  const t = escalate ? Math.max(threat, ESCALATE) : threat,
    parts: Drum[] = [];
  if (t >= 0.25) parts.push("kick");
  if (t >= 0.5) parts.push("snare");
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

/** Bass lines: held whole notes between waves, the theme's style in a fight, 16ths at the top. */
export type BassLine = "whole" | "eighths" | BassStyle | "drive";
const BASS: Record<BassLine, string> = {
  whole: "0...............",
  eighths: "0.0.0.0.0.0.0.0.",
  pulse: "0.0.0.0.0.0.0.0.",
  octave: "0.1.0.1.0.1.0.1.",
  offbeat: "..0.1.0...0.1.0.",
  drive: "0010001000100010",
};
/** Between waves the bass holds the root; in a fight it pulses, from threat 0.5 in the theme's style, escalated in 16ths. */
export function bassFor(fighting: boolean, threat: number, style: BassStyle, escalate: boolean): BassLine {
  if (!fighting) return "whole";
  if (escalate) return "drive";
  return threat >= 0.5 ? style : "eighths";
}
/** The bass note at a step: 0 root, 1 octave, or null for a rest. */
export function bassAt(line: BassLine, step: number): 0 | 1 | null {
  const c = BASS[line][((step % 16) + 16) % 16];
  return c === "." ? null : c === "1" ? 1 : 0;
}
/** Chord-tone index per step through a chord of `n` tones: rising when the field is safe, falling in danger, up and down in between. */
export function arpIndex(step: number, color: Color, n: number) {
  const s = Math.abs(step);
  if (color === "bright") return s % n;
  if (color === "dark") return n - 1 - (s % n);
  const period = 2 * n - 2,
    p = s % period;
  return p < n ? p : period - p;
}
/** Semitones above the chord root per 1/16 step for the bass: a tritone from threat 0.5, minor seconds and more tritones from 0.75. */
const TENSION = [0, 0, 0, 0, 0, 0, 6, 0, 0, 0, 1, 0, 6, 0, 1, 0];
export function tensionOffset(step: number, threat: number) {
  const i = ((step % 16) + 16) % 16;
  if (threat < 0.5) return 0;
  return threat < 0.75 ? (i === 6 ? 6 : 0) : TENSION[i];
}
/** A lead note: [start in 8ths within the 4-bar phrase, chord-tone index, length in 8ths]. */
export type MotifNote = readonly [number, number, number];
export const MOTIFS: Record<LeadMotif, readonly MotifNote[]> = {
  rise: [[0, 2, 3], [3, 1, 1], [4, 0, 4], [8, 2, 3], [11, 3, 1], [12, 2, 4], [16, 4, 3], [19, 3, 1], [20, 2, 4], [24, 1, 2], [26, 2, 2], [28, 0, 4]],
  call: [[0, 0, 2], [2, 2, 2], [4, 3, 4], [8, 2, 6], [14, 1, 2], [16, 0, 2], [18, 2, 2], [20, 4, 4], [24, 3, 8]],
  fall: [[0, 4, 4], [4, 3, 2], [6, 2, 2], [8, 1, 8], [16, 3, 4], [20, 2, 2], [22, 1, 2], [24, 0, 8]],
  pulse: [[0, 2, 1], [2, 2, 1], [3, 3, 1], [4, 2, 2], [6, 1, 2], [8, 2, 1], [10, 2, 1], [11, 3, 1], [12, 4, 4], [16, 2, 1], [18, 2, 1], [19, 3, 1], [20, 2, 2], [22, 1, 2], [24, 0, 8]],
};
/** The motif's note starting at an 8th of the phrase (0–31), if any. */
export const motifAt = (motif: LeadMotif, eighth: number) => MOTIFS[motif].find(([start]) => start === eighth) ?? null;
