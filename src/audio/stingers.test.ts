import { describe, expect, it } from "vitest";
import { STINGERS } from "./stingers";

describe("stingers", () => {
  it("re-voice the musical flow cues within one bar", () => {
    expect(Object.keys(STINGERS).sort()).toEqual(["boss", "build", "lost", "sell", "upgrade", "waveEnd", "waveStart", "won"]);
    for (const [id, s] of Object.entries(STINGERS))
      for (const [, , offset, velocity] of s!.notes) {
        expect(offset, id).toBeGreaterThanOrEqual(0);
        expect(offset, id).toBeLessThan(16);
        expect(velocity, id).toBeGreaterThan(0);
        expect(velocity, id).toBeLessThanOrEqual(1);
      }
  });
});
