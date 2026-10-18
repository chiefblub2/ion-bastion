import { describe, expect, it } from "vitest";
import { arpIndex, bassAt, bassFor, hitsAt, layersFor, motifAt, MOTIFS, tensionOffset } from "./grooves";

describe("grooves", () => {
  it("plays no drums at low threat, then kick, backbeat and hats, and a tom for heavy enemies", () => {
    expect(layersFor(0.1, 0)).toEqual([]);
    expect(layersFor(0.3, 0)).toEqual(["kick"]);
    expect(layersFor(0.6, 0)).toEqual(["kick", "snare"]);
    expect(layersFor(0.8, 2)).toEqual(["kick", "snare", "hat", "stomp"]);
  });
  it("hits only the playing parts on their steps", () => {
    expect(hitsAt("straight", 4, ["kick", "snare", "hat"])).toEqual(["snare"]);
    expect(hitsAt("straight", 6, ["stomp", "hat"])).toEqual(["stomp", "hat"]);
    // Heavy enemies answer the kick instead of doubling it.
    expect(hitsAt("straight", 0, ["stomp"])).toEqual([]);
    expect(hitsAt("none", 0, ["kick"])).toEqual([]);
  });
  it("lets the arpeggio rise when bright and fall when dark", () => {
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "bright", 3))).toEqual([0, 1, 2, 0]);
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "dark", 3))).toEqual([2, 1, 0, 2]);
    expect([0, 1, 2, 3, 4].map((s) => arpIndex(s, "drive", 3))).toEqual([0, 1, 2, 1, 0]);
  });
  it("escalates at the top with 8th hats on top of the offbeats", () => {
    expect(layersFor(0.9, 0, true)).toEqual(["kick", "snare", "hat", "hat16"]);
    expect(layersFor(0.1, 0, true)).toEqual(layersFor(0.9, 0, true));
  });
  it("holds the bass between waves, pulses it in a fight and plays the theme's line from threat 0.5", () => {
    expect(bassFor(false, 0.9, "octave", false)).toBe("whole");
    expect(bassFor(true, 0.3, "octave", false)).toBe("eighths");
    expect(bassFor(true, 0.6, "octave", false)).toBe("octave");
    expect(bassFor(true, 0.6, "octave", true)).toBe("drive");
    expect([0, 1, 2, 3, 4].map((s) => bassAt("whole", s))).toEqual([0, null, null, null, null]);
    expect([0, 1, 2].map((s) => bassAt("octave", s))).toEqual([0, null, 1]);
  });
  it("fits every lead motif into its 4-bar phrase without overlaps", () => {
    for (const [id, notes] of Object.entries(MOTIFS)) {
      notes.forEach(([start, , length], i) => {
        expect(start + length, id).toBeLessThanOrEqual(32);
        if (i > 0) expect(start, id).toBeGreaterThanOrEqual(notes[i - 1][0] + notes[i - 1][2]);
      });
      expect(motifAt(id as keyof typeof MOTIFS, notes[0][0]), id).toBe(notes[0]);
    }
  });
  it("grows the bass's dissonance with the threat", () => {
    expect(tensionOffset(6, 0.3)).toBe(0);
    expect(tensionOffset(6, 0.6)).toBe(6);
    expect(tensionOffset(10, 0.6)).toBe(0);
    expect(tensionOffset(10, 0.9)).toBe(1);
    expect(tensionOffset(22, 0.9)).toBe(6);
  });
});
