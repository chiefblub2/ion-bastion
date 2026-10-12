import { describe, expect, it } from "vitest";
import { silent } from "./activity";
import { chordOf, MUSIC, padChord } from "./harmony";
import { schedule, Sequencer, stepsIn, type Parts } from "./sequencer";

const clock = { origin: 0, bpm: 120 }; // 1/16 = 0.125 s
const parts: Parts = { drums: ["kick"], arp: false, extent: 3, color: "drive", activity: silent(), escalate: false };
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
  it("plays the arpeggio in 8ths through a widened, darkened chord", () => {
    expect(schedule(clock, MUSIC.outpost, { ...parts, drums: [], arp: true, extent: 4, color: "dark" }, 0, 0.25)).toEqual([
      { kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0, 4), "dark"), at: 0 },
      { kind: "arp", voice: 3, at: 0 },
    ]);
  });
  it("plays an active family's part", () => {
    expect(schedule(clock, MUSIC.outpost, { ...parts, drums: [], activity: { ...silent(), rapid: 1 } }, 0, 0.25)).toEqual([
      { kind: "chord", notes: chordOf(MUSIC.outpost, 0), at: 0 },
      { kind: "part", family: "rapid", voice: 0, velocity: 1, at: 0 },
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
    [
      [0, 0.1],
      [0.1, 0.15],
    ].forEach(([from, to], i) => {
      expect(windows[i][0]).toBeCloseTo(from);
      expect(windows[i][1]).toBeCloseTo(to);
    });
  });
  it("marks phrases when escalated: riser into the 4th bar's second half, tom fill, crash on the next phrase", () => {
    const hits = (from: number, to: number) =>
      schedule(clock, MUSIC.outpost, { ...parts, drums: [], escalate: true }, from, to).flatMap((b) => (b.kind === "hit" ? [b.drum] : []));
    // At 120 BPM a bar is 2 s: bar 3 starts at 6 s, its step 8 at 7 s, step 12 at 7.5 s; bar 4 (a new phrase) at 8 s.
    expect(hits(7, 7.1)).toEqual(["riser"]);
    expect(hits(7.5, 8)).toEqual(["fill", "fill", "fill", "fill"]);
    expect(hits(8, 8.1)).toEqual(["crash"]);
    expect(hits(0.1, 6)).toEqual([]);
  });
});
