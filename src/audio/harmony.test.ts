import { describe, expect, it } from "vitest";
import { chordOf, extentFor, hz, MUSIC, padChord, padVoicing, snap } from "./harmony";

describe("harmony", () => {
  it("builds the bar's chord from the theme's scale, as wide as the defense allows", () => {
    expect(chordOf(MUSIC.outpost, 0)).toEqual([33, 36, 40]); // A minor
    expect(chordOf(MUSIC.outpost, 0, 4)).toEqual([33, 36, 40, 43]); // + 7th
    expect(chordOf(MUSIC.outpost, 0, 5)).toEqual([33, 36, 40, 43, 47]); // + 9th
    expect(chordOf(MUSIC.outpost, 1)).toEqual([41, 45, 48]); // F major
    expect(chordOf(MUSIC.outpost, -1)).toEqual(chordOf(MUSIC.outpost, 3));
    expect([0.1, 0.3, 0.6].map(extentFor)).toEqual([3, 4, 5]);
  });
  it("adds a tension note to the pad only in a dark mood", () => {
    expect(padChord([33, 36, 40], "dark")).toEqual([33, 36, 40, 46]);
    expect(padChord([33, 36, 40], "bright")).toEqual([33, 36, 40]);
  });
  it("voices the bass on the root and the pad from the top of the chord down", () => {
    expect(padVoicing([33, 36, 40], 4)).toEqual([33, 52, 48, 45]);
  });
  it("snaps to a chord tone in the octave nearest the target", () => {
    expect(hz(69)).toBe(440);
    expect(snap(440, [33, 36, 40], 0)).toBeCloseTo(440);
    expect(snap(500, [33, 36, 40], 1)).toBeCloseTo(523.25, 1);
  });
  it("gives every theme a playable tempo", () => {
    for (const [id, m] of Object.entries(MUSIC)) {
      expect(m.bpm, id).toBeGreaterThanOrEqual(80);
      expect(m.bpm, id).toBeLessThanOrEqual(130);
    }
  });
});
