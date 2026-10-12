import { describe, expect, it } from "vitest";
import { arpIndex, hitsAt, layersFor, tensionOffset } from "./grooves";

describe("grooves", () => {
  it("plays no drums at low threat, then kick, backbeat, hats and bass, and a stomp for heavy enemies", () => {
    expect(layersFor(0.1, 0)).toEqual([]);
    expect(layersFor(0.3, 0)).toEqual(["kick"]);
    expect(layersFor(0.6, 0)).toEqual(["kick", "snare", "bass"]);
    expect(layersFor(0.8, 2)).toEqual(["kick", "snare", "bass", "hat", "stomp"]);
  });
  it("hits only the playing parts on their steps", () => {
    expect(hitsAt("straight", 4, ["kick", "snare", "hat"])).toEqual(["snare", "hat"]);
    expect(hitsAt("straight", 8, ["stomp", "bass"])).toEqual(["stomp"]);
    expect(hitsAt("none", 0, ["kick"])).toEqual([]);
  });
  it("lets the arpeggio rise when bright and fall when dark", () => {
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "bright", 3))).toEqual([0, 1, 2, 0]);
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "dark", 3))).toEqual([2, 1, 0, 2]);
    expect([0, 1, 2, 3, 4].map((s) => arpIndex(s, "drive", 3))).toEqual([0, 1, 2, 1, 0]);
  });
  it("escalates at the top with 16th hats and a straight 8th-note bass", () => {
    expect(layersFor(0.9, 0, true)).toEqual(["kick", "snare", "bass8", "hat", "hat16"]);
    expect(layersFor(0.1, 0, true)).toEqual(layersFor(0.9, 0, true));
    expect(hitsAt("straight", 2, ["bass8"])).toEqual(["bass8"]);
  });
  it("grows the bass's dissonance with the threat", () => {
    expect(tensionOffset(6, 0.3)).toBe(0);
    expect(tensionOffset(6, 0.6)).toBe(6);
    expect(tensionOffset(10, 0.6)).toBe(0);
    expect(tensionOffset(10, 0.9)).toBe(1);
    expect(tensionOffset(22, 0.9)).toBe(6);
  });
});
