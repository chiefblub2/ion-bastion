import { describe, expect, it } from "vitest";
import { DRONES } from "./drones";
import { moodOf } from "./mood";

const game = { view: "game", theme: "frost", status: "wave", paused: false, enemies: 0 } as const;
describe("moodOf", () => {
  it("plays the menu bed in the menu and a quiet bed while paused", () => {
    expect(moodOf({ ...game, view: "menu" })).toEqual({ drone: "menu", level: 0.6 });
    expect(moodOf({ ...game, paused: true })).toEqual({ drone: "frost", level: 0.25 });
    expect(moodOf({ ...game, status: "ready" })).toEqual({ drone: "frost", level: 0.5 });
  });
  it("swells with the number of enemies, up to full", () => {
    expect(moodOf({ ...game, enemies: 15 }).level).toBeCloseTo(0.85);
    expect(moodOf({ ...game, enemies: 300 }).level).toBe(1);
  });
});
describe("DRONES", () => {
  it("keep every pad warm, gently moving and inside the synthwave range", () => {
    for (const [id, d] of Object.entries(DRONES)) {
      expect(d.cutoff, id).toBeGreaterThanOrEqual(1000);
      expect(d.cutoff, id).toBeLessThanOrEqual(3000);
      expect(d.breath, id).toBeLessThanOrEqual(0.1);
      expect(d.spread, id).toBeLessThanOrEqual(20);
      for (const v of [d.chorus, d.sub]) expect(v, id).toBeLessThanOrEqual(1);
    }
  });
});
