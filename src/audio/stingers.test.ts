import { describe, expect, it } from "vitest";
import { STINGERS } from "./stingers";

describe("stingers", () => {
  it("re-voice the game's turning points within one bar, never the tower actions", () => {
    expect(Object.keys(STINGERS).sort()).toEqual(["boss", "lost", "waveEnd", "waveStart", "won"]);
    for (const [id, s] of Object.entries(STINGERS))
      for (const [, , offset, velocity] of s!.notes) {
        expect(offset, id).toBeGreaterThanOrEqual(0);
        expect(offset, id).toBeLessThan(16);
        expect(velocity, id).toBeGreaterThan(0);
        expect(velocity, id).toBeLessThanOrEqual(1);
      }
  });
});
