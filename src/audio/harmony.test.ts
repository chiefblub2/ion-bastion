import { describe, expect, it } from "vitest";
import { chordOf, climb, extentFor, rooted, hz, MUSIC, padChord, padVoicing, snap, type Extent } from "./harmony";

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
    expect(padChord([33, 36, 40], true)).toEqual([33, 36, 40, 46]);
    expect(padChord([33, 36, 40], false)).toEqual([33, 36, 40]);
  });
  it("voices the bass on the root and the pad from the top of the chord down", () => {
    expect(padVoicing([33, 36, 40], 4)).toEqual([33, 52, 48, 45]);
  });
  it("snaps to a chord tone in the octave nearest the target", () => {
    expect(hz(69)).toBe(440);
    expect(snap(440, [33, 36, 40], 0)).toBeCloseTo(440);
    expect(snap(500, [33, 36, 40], 1)).toBeCloseTo(523.25, 1);
  });
  it("keeps every theme calm (84–104 BPM)", () => {
    for (const [id, m] of Object.entries(MUSIC)) {
      expect(m.bpm, id).toBeGreaterThanOrEqual(84);
      expect(m.bpm, id).toBeLessThanOrEqual(104);
    }
  });
  it("walks an arpeggio through the chord in one direction, one octave around the target", () => {
    for (const music of Object.values(MUSIC))
      for (const extent of [3, 4, 5] as Extent[])
        for (let bar = 0; bar < 4; bar++)
          for (const base of [880, 1320]) {
            const chord = chordOf(music, bar, extent),
              up = chord.map((_, i) => climb(base, chord, i));
            expect(up).toEqual([...up].sort((a, b) => a - b));
            expect(climb(base, chord, chord.length)).toBe(up[0]);
            for (const f of up) {
              expect(f / base).toBeGreaterThanOrEqual(0.45);
              expect(f / base).toBeLessThanOrEqual(2.2);
            }
          }
  });
  it("keeps the bass on its root's octave however wide the chord gets", () => {
    for (const music of Object.values(MUSIC))
      for (let bar = 0; bar < 4; bar++) {
        const triad = rooted(82, chordOf(music, bar, 3), 0),
          ninth = rooted(82, chordOf(music, bar, 5), 0);
        expect(ninth).toBe(triad);
        expect(triad).toBeGreaterThanOrEqual(57);
        expect(triad).toBeLessThanOrEqual(117);
      }
  });
});
