import { describe, expect, it } from "vitest";
import { MUZZLES, muzzleHeading, muzzleTips } from "./muzzles";

describe("muzzle tips", () => {
  it("project a tilted barrel (Pulse) onto its raised, foreshortened tip", () => {
    const { tilt, reach } = MUZZLES.barrel!,
      d = reach(3);
    expect(muzzleTips("barrel", 3, 100, 100, 0)[0]).toEqual({ x: 100 + d, y: 100 + tilt!.drop - tilt!.height });
    const south = muzzleTips("barrel", 3, 100, 100, Math.PI / 2)[0];
    expect(south.x).toBeCloseTo(100);
    expect(south.y).toBeCloseTo(100 + tilt!.drop + d * tilt!.squash - tilt!.height);
    // The flash follows the barrel on screen, flatter than the aim.
    expect(muzzleHeading("barrel", Math.PI / 4)).toBeLessThan(Math.PI / 4);
  });

  it("keep flat barrels on the aim", () => {
    const [tip] = muzzleTips("heavy", 1, 0, 0, Math.PI / 2);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.y).toBeCloseTo(MUZZLES.heavy!.reach(1));
    expect(muzzleHeading("heavy", 1)).toBe(1);
  });
});
