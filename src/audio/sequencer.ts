import { nextSlot, stepLength, type Clock } from "./clock";
import type { LeadMotif } from "./drones";
import { arpIndex, bassAt, hitsAt, motifAt, tensionOffset, type BassLine, type Drum } from "./grooves";
import { chordOf, padChord, type Color, type Extent, type ThemeMusic } from "./harmony";
// Lookahead scheduling after Chris Wilson's "A Tale of Two Clocks": a coarse timer schedules everything due in the
// next window on the precise audio clock.

/** The timer may stall behind a busy frame; this much lookahead keeps the music going through a hitch. */
const TICK_MS = 25,
  AHEAD = 0.2;
/** What the soundtrack plays right now: drums, bass, arpeggio and lead, chord size and mood. */
export interface Parts {
  drums: readonly Drum[];
  bass: BassLine | null;
  /** 1/16 steps between two arpeggio notes; 0 plays none. */
  arp: 0 | 2 | 3 | 4;
  lead: LeadMotif | null;
  extent: Extent;
  color: Color;
  /** The top of a fight: phrase marks every 4 bars (riser, fill, crash). */
  escalate: boolean;
  /** The enemies' threat, 0–1: the bass's tension notes from 0.5. */
  threat: number;
}
export type Beat =
  | { kind: "chord"; notes: number[]; at: number }
  | { kind: "hit"; drum: Drum; at: number; step: number }
  | { kind: "bass"; octave: 0 | 1; offset: number; at: number }
  | { kind: "arp"; voice: number; at: number }
  | { kind: "lead"; voice: number; eighths: number; at: number };

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
/** Pad chords on bar lines, drum hits, bass, arpeggio and lead notes in the window. */
export function schedule(c: Clock, music: ThemeMusic, parts: Parts, from: number, to: number): Beat[] {
  const out: Beat[] = [];
  for (const { time, step } of stepsIn(c, from, to)) {
    const i = ((step % 16) + 16) % 16,
      bar = Math.floor(step / 16),
      phrase = ((bar % 4) + 4) % 4,
      // Before an escalated phrase's crash, kick and stomp drop out so riser and fill play into a hole.
      cleared = parts.escalate && phrase === 3 && i >= 8;
    if (i === 0) out.push({ kind: "chord", notes: padChord(chordOf(music, bar, parts.extent), parts.color === "dark" || parts.escalate), at: time });
    for (const drum of hitsAt(music.groove, step, parts.drums)) if (!(cleared && (drum === "kick" || drum === "stomp"))) out.push({ kind: "hit", drum, at: time, step });
    if (parts.escalate) {
      if (phrase === 0 && i === 0) out.push({ kind: "hit", drum: "crash", at: time, step });
      if (phrase === 3 && i === 8) out.push({ kind: "hit", drum: "riser", at: time, step });
      if (phrase === 3 && i >= 12) out.push({ kind: "hit", drum: "fill", at: time, step });
    }
    const octave = parts.bass ? bassAt(parts.bass, step) : null;
    if (octave !== null) out.push({ kind: "bass", octave, offset: tensionOffset(step, parts.threat), at: time });
    // Dotted 8ths by default: a 3-against-4 cycle gives motion without fusing with the 8th-note bass.
    if (parts.arp && i % parts.arp === 0) out.push({ kind: "arp", voice: arpIndex(bar * Math.ceil(16 / parts.arp) + i / parts.arp, parts.color, parts.extent), at: time });
    const note = parts.lead && i % 2 === 0 ? motifAt(parts.lead, phrase * 8 + i / 2) : null;
    if (note) out.push({ kind: "lead", voice: note[1], eighths: note[2], at: time });
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
