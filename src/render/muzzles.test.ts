import { describe, expect, it } from "vitest";
import { MUZZLES, TILTS, muzzleHeading, muzzleTips } from "./muzzles";

describe("muzzle tips", () => {
  it("project a tilted barrel (Pulse) onto its raised, foreshortened tip", () => {
    const { reach } = MUZZLES.barrel!,
      tilt = TILTS.barrel,
      d = reach(3);
    expect(muzzleTips("barrel", 3, 100, 100, 0)[0]).toEqual({ x: 100 + d, y: 100 + tilt!.drop - tilt!.height });
    const south = muzzleTips("barrel", 3, 100, 100, Math.PI / 2)[0];
    expect(south.x).toBeCloseTo(100);
    expect(south.y).toBeCloseTo(100 + tilt!.drop + d * tilt!.squash - tilt!.height);
    // The flash follows the barrel on screen, flatter than the aim.
    expect(muzzleHeading("barrel", Math.PI / 4)).toBeLessThan(Math.PI / 4);
  });

  it("raise a pitched barrel (Nova) by its elevation and shorten it on the ground", () => {
    const { reach } = MUZZLES.heavy!,
      tilt = TILTS.heavy,
      d = reach(1),
      p = tilt!.pitch!;
    expect(muzzleTips("heavy", 1, 0, 0, 0)[0].x).toBeCloseTo(d * Math.cos(p));
    expect(muzzleTips("heavy", 1, 0, 0, 0)[0].y).toBeCloseTo(tilt!.drop - tilt!.height - d * Math.sin(p));
    // Aimed sideways, the flash still points up along the barrel.
    expect(muzzleHeading("heavy", 0)).toBeLessThan(0);
  });

  it("lay parallel barrels of a tilted turret across the aim on the ground plane", () => {
    const tilt = TILTS.barrel!,
      saved = MUZZLES.barrel!.sides;
    MUZZLES.barrel!.sides = [-4, 4];
    try {
      // Aimed east, the offsets run north-south: squashed on the screen, both at barrel height.
      const [a, b] = muzzleTips("barrel", 1, 0, 0, 0);
      expect(a.x).toBeCloseTo(b.x);
      expect(b.y - a.y).toBeCloseTo(8 * tilt.squash);
      // Aimed south, they run east-west at full width.
      const [c, e] = muzzleTips("barrel", 1, 0, 0, Math.PI / 2);
      expect(c.x - e.x).toBeCloseTo(8);
    } finally {
      MUZZLES.barrel!.sides = saved;
    }
  });

  it("send shots of a tilted turret without a barrel from its emit point", () => {
    TILTS.coil = { drop: 4, squash: 0.65, height: 0, deck: 3, emit: 30 };
    try {
      expect(muzzleTips("coil", 1, 10, 10, 1)).toEqual([{ x: 10, y: 10 + 4 - 30 }]);
    } finally {
      delete TILTS.coil;
    }
    expect(muzzleTips("coil", 1, 10, 10, 1)).toEqual([]);
  });

  it("keep flat barrels on the aim", () => {
    const [tip] = muzzleTips("rail", 1, 0, 0, Math.PI / 2);
    expect(tip.x).toBeCloseTo(0);
    expect(tip.y).toBeCloseTo(MUZZLES.rail!.reach(1));
    expect(muzzleHeading("rail", 1)).toBe(1);
  });
});
