import type { Levels } from "./activity";
import { nextSlot, stepLength, type Clock } from "./clock";
import { FAMILIES, type Family } from "./families";
import { arpIndex, hitsAt, type Drum } from "./grooves";
import { chordOf, padChord, type Color, type Extent, type ThemeMusic } from "./harmony";
import { partNote } from "./parts";
// Lookahead scheduling after Chris Wilson's "A Tale of Two Clocks": a coarse timer schedules everything due in the
// next window on the precise audio clock.

const TICK_MS = 25,
  AHEAD = 0.1;
/** What the music plays right now: the enemies' drums, the towers' parts and harmony, the mood. */
export interface Parts {
  drums: readonly Drum[];
  arp: boolean;
  extent: Extent;
  color: Color;
  activity: Readonly<Levels>;
}
export type Beat =
  | { kind: "chord"; notes: number[]; at: number }
  | { kind: "hit"; drum: Drum; at: number }
  | { kind: "arp"; voice: number; at: number }
  | { kind: "part"; family: Family; voice: number; velocity: number; at: number };

/** The 1/16 steps with `from <= time < to`. */
export function stepsIn(c: Clock, from: number, to: number) {
  const len = stepLength(c, 16),
    out: { time: number; step: number }[] = [];
  for (let step = Math.round((nextSlot(c, from, 16) - c.origin) / len); ; step++) {
    const time = c.origin + step * len;
    if (time >= to - 1e-9) return out;
    out.push({ time, step });
  }
}
/** Pad chords on bar lines, drum hits, the families' parts and the 8th-note arpeggio in the window. */
export function schedule(c: Clock, music: ThemeMusic, parts: Parts, from: number, to: number): Beat[] {
  const out: Beat[] = [];
  for (const { time, step } of stepsIn(c, from, to)) {
    if (((step % 16) + 16) % 16 === 0)
      out.push({ kind: "chord", notes: padChord(chordOf(music, Math.floor(step / 16), parts.extent), parts.color), at: time });
    for (const drum of hitsAt(music.groove, step, parts.drums)) out.push({ kind: "hit", drum, at: time });
    for (const family of FAMILIES) {
      const note = partNote(family, step, parts.activity[family]);
      if (note) out.push({ kind: "part", family, ...note, at: time });
    }
    if (parts.arp && step % 2 === 0) out.push({ kind: "arp", voice: arpIndex(step / 2, parts.color, parts.extent), at: time });
  }
  return out;
}
export class Sequencer {
  private until = -Infinity;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    private now: () => number,
    private window: (from: number, to: number) => void,
  ) {}
  start() {
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  /** Hands out the part of the next window not scheduled yet; a frozen clock (suspended context) yields nothing. */
  tick() {
    const now = this.now(),
      from = Math.max(this.until, now),
      to = now + AHEAD;
    if (to <= from) return;
    this.window(from, to);
    this.until = to;
  }
}
