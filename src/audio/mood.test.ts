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
  it("keep every drone low, filtered and quiet", () => {
    for (const [id, d] of Object.entries(DRONES)) {
      expect(d.root, id).toBeGreaterThan(30);
      expect(d.root, id).toBeLessThan(120);
      expect(d.cutoff, id).toBeGreaterThan(d.root * 2);
      expect(d.noise, id).toBeLessThanOrEqual(0.2);
    }
  });
});
