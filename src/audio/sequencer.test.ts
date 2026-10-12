import { describe, expect, it } from "vitest";
import { chordOf, MUSIC, padChord } from "./harmony";
import { schedule, Sequencer, stepsIn, type Parts } from "./sequencer";

const clock = { origin: 0, bpm: 120 }; // 1/16 = 0.125 s
const parts: Parts = { drums: ["hat", "kick"], arp: false, extent: 3, color: "drive" };
describe("stepsIn", () => {
  it("lists the 1/16 steps inside the half-open window", () => {
    expect(stepsIn(clock, 0.1, 0.375)).toEqual([
      { time: 0.125, step: 1 },
      { time: 0.25, step: 2 },
    ]);
  });
});
describe("schedule", () => {
  it("changes the chord on the bar line and plays the groove's hits", () => {
    expect(schedule(clock, MUSIC.outpost, parts, 0, 0.25)).toEqual([
      { kind: "chord", notes: chordOf(MUSIC.outpost, 0), at: 0 },
      { kind: "hit", drum: "kick", at: 0 },
    ]);
  });
  it("widens and darkens the pad chord and adds the arpeggio", () => {
    const beats = schedule(clock, MUSIC.outpost, { drums: [], arp: true, extent: 4, color: "dark" }, 0, 0.25);
    expect(beats).toEqual([
      { kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0, 4), "dark"), at: 0 },
      { kind: "arp", voice: 3, at: 0 },
      { kind: "arp", voice: 2, at: 0.125 },
    ]);
  });
});
describe("Sequencer", () => {
  it("schedules each moment once and nothing while the audio clock stands still", () => {
    let now = 0;
    const windows: [number, number][] = [];
    const seq = new Sequencer(() => now, (from, to) => windows.push([from, to]));
    seq.tick();
    now = 0.05;
    seq.tick();
    seq.tick();
    expect(windows).toHaveLength(2);
    [[0, 0.1], [0.1, 0.15]].forEach(([from, to], i) => {
      expect(windows[i][0]).toBeCloseTo(from);
      expect(windows[i][1]).toBeCloseTo(to);
    });
  });
});
