import { describe, expect, it } from "vitest";
import { admit, POOL_CAP, type Voice } from "./mixer";

const spec = { pool: "combat", cap: 2, gap: 0.05, priority: 1 } as const;
const voice = (cue: Voice["cue"], priority = 1, start = 0, end = 10): Voice => ({ cue, pool: "combat", priority, start, end });

describe("admit", () => {
  it("respects the gap and the per-cue cap", () => {
    expect(admit("bolt", spec, [], 0.98, 1)).toEqual({ play: false });
    expect(admit("bolt", spec, [voice("bolt"), voice("bolt")], undefined, 1)).toEqual({ play: false });
    expect(admit("bolt", spec, [voice("bolt"), voice("bolt", 1, 0, 0.5)], undefined, 1)).toEqual({ play: true });
  });
  it("steals the oldest lowest-priority voice from a full pool, never an equal one", () => {
    const full = Array.from({ length: POOL_CAP.combat }, (_, i) => voice("impact", 0, i));
    expect(admit("kill", { ...spec, priority: 2 }, full, undefined, 30)).toEqual({ play: true }); // all ended at 10, so the pool is free
    const alive = full.map((v) => ({ ...v, end: 99 }));
    expect(admit("kill", { ...spec, priority: 2 }, alive, undefined, 30)).toEqual({ play: true, steal: alive[0] });
    expect(admit("impact", { ...spec, priority: 0, cap: 99 }, alive, undefined, 30)).toEqual({ play: false });
  });
  it("keeps the drums playing when the combat pool is full", () => {
    const busy = Array.from({ length: POOL_CAP.combat }, (_, i) => voice("bolt", 3, i, 99));
    expect(admit("kick", { pool: "drums", cap: 2, gap: 0.03, priority: 1 }, busy, undefined, 30)).toEqual({ play: true });
  });
});
