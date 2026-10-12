import { describe, expect, it } from "vitest";
import { arpIndex, hitsAt, layersFor } from "./grooves";

describe("grooves", () => {
  it("adds parts as the threat rises, and a stomp for heavy enemies", () => {
    expect(layersFor(0, 0)).toEqual(["hat"]);
    expect(layersFor(0.3, 0)).toEqual(["hat", "kick"]);
    expect(layersFor(0.6, 0)).toEqual(["hat", "kick", "snare"]);
    expect(layersFor(0.8, 2)).toEqual(["hat", "kick", "snare", "hat16", "bass", "stomp"]);
  });
  it("hits only the playing parts on their steps", () => {
    expect(hitsAt("straight", 4, ["hat", "kick", "snare"])).toEqual(["kick", "snare"]);
    expect(hitsAt("straight", 8, ["stomp", "bass"])).toEqual(["stomp", "bass"]);
    expect(hitsAt("straight", 20, ["hat"])).toEqual([]);
    expect(hitsAt("none", 0, ["kick"])).toEqual([]);
  });
  it("lets the arpeggio rise when bright and fall when dark", () => {
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "bright", 3))).toEqual([0, 1, 2, 0]);
    expect([0, 1, 2, 3].map((s) => arpIndex(s, "dark", 3))).toEqual([2, 1, 0, 2]);
    expect([0, 1, 2, 3, 4].map((s) => arpIndex(s, "drive", 3))).toEqual([0, 1, 2, 1, 0]);
  });
});
