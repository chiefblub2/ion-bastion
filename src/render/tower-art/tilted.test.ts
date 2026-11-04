import { describe, expect, it } from "vitest";
import { MUZZLES, TILTS } from "../muzzles";
import { MODELS } from "./models";

describe("tilted models", () => {
  it("draw with the projection and barrel that TILTS and MUZZLES give shots, flashes and the cache", () => {
    for (const [style, model] of Object.entries(MODELS) as [keyof typeof MODELS, (typeof MODELS)[keyof typeof MODELS]][]) {
      expect(TILTS[style], style).toEqual(model.tilt);
      const spec = MUZZLES[style];
      if (!model.reach) continue;
      for (const level of [1, 5, 8]) expect(spec?.reach(level), `${style} L${level}`).toBeCloseTo(model.reach(level));
      expect(spec?.recoil, style).toBe(model.recoil ?? 0);
      expect(spec?.sides, style).toEqual(model.sides);
    }
  });
});
