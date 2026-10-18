import { describe, expect, it } from "vitest";
import { chordOf, MUSIC, padChord } from "./harmony";
import { schedule, Sequencer, stepsIn, type Parts } from "./sequencer";

const clock = { origin: 0, bpm: 120 }; // 1/16 = 0.125 s
const parts: Parts = { drums: ["kick"], bass: null, arp: 0, lead: null, extent: 3, color: "drive", escalate: false, threat: 0 };
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
      { kind: "hit", drum: "kick", at: 0, step: 0 },
    ]);
  });
  it("plays the arpeggio through a widened, darkened chord", () => {
    expect(schedule(clock, MUSIC.outpost, { ...parts, drums: [], arp: 3, extent: 4, color: "dark" }, 0, 0.25)).toEqual([
      { kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0, 4), true), at: 0 },
      { kind: "arp", voice: 3, at: 0 },
    ]);
  });
  it("plays the bass line with its tension notes", () => {
    const bass = schedule(clock, MUSIC.outpost, { ...parts, drums: [], bass: "octave", threat: 0.6 }, 0, 1).filter((b) => b.kind === "bass");
    expect(bass.map((b) => b.kind === "bass" && [b.octave, b.offset])).toEqual([
      [0, 0],
      [1, 0],
      [0, 0],
      [1, 6],
    ]);
  });
  it("plays the lead's motif on the phrase's 8ths", () => {
    const lead = schedule(clock, MUSIC.outpost, { ...parts, drums: [], lead: "rise" }, 0, 1).filter((b) => b.kind === "lead");
    expect(lead).toEqual([
      { kind: "lead", voice: 2, eighths: 3, at: 0 },
      { kind: "lead", voice: 1, eighths: 1, at: 0.75 },
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
      [0, 0.2],
      [0.2, 0.25],
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
  it("adds the pad's tension note only when losing or escalated", () => {
    const pad = (p: Partial<Parts>) => schedule(clock, MUSIC.outpost, { ...parts, drums: [], ...p }, 0, 0.1)[0];
    expect(pad({ threat: 0.7, color: "bright" })).toEqual({ kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0), false), at: 0 });
    expect(pad({ escalate: true })).toEqual({ kind: "chord", notes: padChord(chordOf(MUSIC.outpost, 0), true), at: 0 });
  });
  it("plays the arpeggio in dotted 8ths against the 8th-note layers", () => {
    const arp = schedule(clock, MUSIC.outpost, { ...parts, drums: [], arp: 3 }, 0, 0.5).filter((b) => b.kind === "arp");
    expect(arp.map((b) => b.at)).toEqual([0, 0.375]);
  });
  it("clears kick and stomp in the second half of an escalated phrase's last bar", () => {
    const drums = (from: number, to: number) =>
      schedule(clock, MUSIC.outpost, { ...parts, drums: ["kick", "stomp"], escalate: true }, from, to).flatMap((b) => (b.kind === "hit" ? [b.drum] : []));
    expect(drums(6, 7)).toContain("kick");
    expect(drums(7, 8).filter((d) => d === "kick" || d === "stomp")).toEqual([]);
  });
});
