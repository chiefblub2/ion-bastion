import { describe, expect, it } from "vitest";
import { driveCurve } from "./instruments";

describe("driveCurve", () => {
  it("soft-clips symmetrically to ±1", () => {
    const c = driveCurve(3, 101);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[100]).toBeCloseTo(1);
    expect(c[50]).toBeCloseTo(0);
    expect(c[75]).toBeCloseTo(-c[25]);
    expect(c[75]).toBeGreaterThan(0.5);
  });
});
