import { describe, expect, it } from "vitest";
import { Activity, HALF_LIFE } from "./activity";

describe("Activity", () => {
  it("adds per shot, halves without shots and saturates", () => {
    const a = new Activity();
    a.update({ rapid: 5 }, 0);
    expect(a.levels.rapid).toBeCloseTo(0.3);
    a.update({}, HALF_LIFE);
    expect(a.levels.rapid).toBeCloseTo(0.15);
    a.update({ rapid: 100 }, HALF_LIFE);
    expect(a.levels.rapid).toBe(1);
    expect(a.levels.heavy).toBe(0);
  });
});
