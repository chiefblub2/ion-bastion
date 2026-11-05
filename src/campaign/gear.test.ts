import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content/index";
import { gearPack } from "./gear";

const base = DEFAULT_CONTENT;
describe("campaign gear", () => {
  it("no gear is the base pack", () => {
    expect(gearPack(base, { gear: {} })).toBe(base);
  });

  it("marks raise the geared tower only; trap marks never touch the trigger radius", () => {
    const p = gearPack(base, { gear: { pulse: 2, mine: 4 } });
    expect(p.towers.pulse.damage).toBeGreaterThan(base.towers.pulse.damage);
    expect(p.towers.pulse.range).toBeCloseTo(base.towers.pulse.range * 1.05);
    expect(p.towers.lance).toBe(base.towers.lance);
    expect(p.towers.mine.range).toBe(base.towers.mine.range);
    expect(p.towers.mine.cost).toBeLessThan(base.towers.mine.cost);
  });

  it("Mk V adds the signature mod, or the stand-in", () => {
    const p = gearPack(base, { gear: { pulse: 5, refinery: 5, orbital: 5 } });
    expect(p.towers.pulse.signature?.kind).toBe("vulnerable");
    expect(base.towers.pulse.signature).toBeUndefined();
    const amount = (t: typeof p.towers.refinery) => (t.attack as unknown as { amount: number }).amount;
    expect(amount(p.towers.refinery)).toBeGreaterThan(amount(base.towers.refinery));
    expect(p.towers.orbital.damage).toBeGreaterThan(gearPack(base, { gear: { orbital: 4 } }).towers.orbital.damage);
  });
});
