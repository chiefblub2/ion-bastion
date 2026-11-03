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

  it("raise a pitched barrel (Nova) by its elevation and shorten it on the ground", () => {
    const { tilt, reach } = MUZZLES.heavy!,
      d = reach(1),
      p = tilt!.pitch!;
    expect(muzzleTips("heavy", 1, 0, 0, 0)[0].x).toBeCloseTo(d * Math.cos(p));
    expect(muzzleTips("heavy", 1, 0, 0, 0)[0].y).toBeCloseTo(tilt!.drop - tilt!.height - d * Math.sin(p));
    // Aimed sideways, the flash still points up along the barrel.
    expect(muzzleHeading("heavy", 0)).toBeLessThan(0);
  });

  it("keep flat barrels on the aim", () => {
    const [tip] = muzzleTips("rail", 1, 0, 0, Math.PI / 2);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.y).toBeCloseTo(MUZZLES.rail!.reach(1));
    expect(muzzleHeading("rail", 1)).toBe(1);
  });
});
