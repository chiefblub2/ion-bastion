import { describe, expect, it } from "vitest";
import { barAt, nextSlot, rebase, stepAt } from "./clock";

const c = { origin: 10, bpm: 120 };
describe("clock", () => {
  it("finds the next slot of each grid", () => {
    expect(nextSlot(c, 10.01, 16)).toBeCloseTo(10.125);
    expect(nextSlot(c, 10.125, 16)).toBeCloseTo(10.125);
    expect(nextSlot(c, 10.01, 32)).toBeCloseTo(10.0625);
    expect(nextSlot(c, 10.3, 4)).toBeCloseTo(10.5);
    expect(nextSlot(c, 10.5, 1)).toBeCloseTo(12);
    expect(nextSlot(c, 10.37, 0)).toBe(10.37);
  });
  it("places a late cue on the next slot after now, never in the past", () => {
    const at = nextSlot(c, 37.3, 8);
    expect(at).toBeGreaterThanOrEqual(37.3);
    expect(at - 37.3).toBeLessThan(0.25);
  });
  it("counts bars and 1/16 steps", () => {
    expect(barAt(c, 15)).toBe(2);
    expect(stepAt(c, 10.25)).toBe(2);
  });
  it("starts a new tempo on the next bar line", () => {
    expect(rebase(c, 10.5, 90)).toEqual({ origin: 12, bpm: 90 });
  });
});
