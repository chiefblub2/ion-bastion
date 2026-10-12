import { describe, expect, it } from "vitest";
import { buildSamples } from "./zzfx";
import { COMBAT_CUES, FLOW_CUES, RECIPES, TIMING, UI_CUES } from "./recipes";

describe("cue recipes", () => {
  it("cover every cue with a short, non-empty sound in the right pool", () => {
    const pools = { combat: COMBAT_CUES, flow: FLOW_CUES, ui: UI_CUES } as const;
    for (const [pool, ids] of Object.entries(pools))
      for (const id of ids) {
        const r = RECIPES[id];
        expect(r.pool, id).toBe(pool);
        expect(r.cap, id).toBeGreaterThanOrEqual(1);
        const n = buildSamples(r.params, 8000).length;
        expect(n, id).toBeGreaterThan(0);
        expect(n, id).toBeLessThan(3 * 8000);
      }
  });
  it("keeps interface feedback instant and thins kills and blasts to about one per beat", () => {
    for (const id of ["reject", "click", "hover"] as const) expect(TIMING[id].grid, id).toBe(0);
    expect(RECIPES.kill.gap).toBeGreaterThanOrEqual(0.5);
    expect(RECIPES.blast.gap).toBeGreaterThanOrEqual(0.5);
  });
});
