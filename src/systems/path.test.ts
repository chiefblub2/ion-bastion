import { describe, expect, it } from "vitest";
import { headingOnPath } from "./path";

// A 2×2 ring: right, down, left, up.
const ring = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

describe("headingOnPath", () => {
  it("wraps a pushed-back distance on a ring", () => {
    expect(headingOnPath(ring, -0.5, true)).toBe(headingOnPath(ring, 3.5, true));
    expect(headingOnPath(ring, -4.5, true)).toBe(headingOnPath(ring, 3.5, true));
    expect(headingOnPath(ring, 4.2, true)).toBe(0);
  });
  it("clamps to the first and last segment on a reactor path", () => {
    expect(headingOnPath(ring, -0.5)).toBe(0);
    expect(headingOnPath(ring, 9)).toBe(Math.PI);
  });
});
