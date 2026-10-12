import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerId } from "../core/types";
import { stepLength } from "./clock";
import { Conductor, type Voices } from "./conductor";
import type { Instrument } from "./instruments";

const rapid = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "direct" && !d.placement)!.id as TowerId;
const at = { x: 0, y: 0 };
class Recorder implements Voices {
  notes: { name: Instrument; at: number }[] = [];
  effects = 0;
  ducks = 0;
  ambience = { chord: () => {}, tone: () => {} };
  play() {
    this.effects++;
    return true;
  }
  instrument(name: Instrument, _hz: number, at: number) {
    this.notes.push({ name, at });
    return true;
  }
  duck() {
    this.ducks++;
  }
}
/** Drives a conductor through `bars` bars of rapid fire at `rate` shots per second, frame by frame like the game. */
function run(rate: number, bars: number) {
  const r = new Recorder(),
    c = new Conductor(r),
    frame = 1 / 30;
  c.theme("outpost", 0);
  const end = bars * stepLength(c.score.clock, 1);
  let owed = 0,
    first = -1;
  for (let t = 0; t < end; t += frame) {
    const events: GameEvent[] = [];
    for (owed += rate * frame; owed >= 1; owed--) events.push({ type: "shot", tower: rapid, from: at, to: at, color: 0 });
    if (events.length && first < 0) first = t;
    c.shots(events, DEFAULT_CONTENT, t);
    c.measure({ threat: 0, defense: 0, clear: 5, heavies: 0, drums: true, playing: true });
    c.window(t, t + frame);
  }
  return { r, first, end, beat: stepLength(c.score.clock, 4) };
}
/** Plucks inside the run (its last frame may reach into the next bar). */
const plucks = ({ r, end }: ReturnType<typeof run>) => r.notes.filter((n) => n.name === "pluck" && n.at < end).length;

describe("Conductor", () => {
  it("keeps the note count set by the composition, however fast the towers fire", () => {
    const slow = plucks(run(1, 4)),
      fast = plucks(run(80, 4));
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(4 * 8);
  });
  it("answers a family's first shot within a beat", () => {
    const { r, first, beat } = run(2, 2);
    expect(r.notes.find((n) => n.name === "pluck")!.at - first).toBeLessThanOrEqual(beat + 1e-6);
  });
  it("plays no drums at low threat", () => {
    expect(run(10, 2).r.notes.some((n) => ["kick", "snare", "hat"].includes(n.name))).toBe(false);
  });
  it("plays stingers on instruments and alerts as effects", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.cue("won", 0.1);
    expect(r.notes.length).toBeGreaterThan(1);
    expect(r.ducks).toBe(1);
    expect(r.effects).toBe(0);
    c.cue("reject", 0.1);
    expect(r.effects).toBe(1);
  });
});
