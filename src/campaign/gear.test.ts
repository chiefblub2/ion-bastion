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

  it("Mk V adds the signature mod", () => {
    const p = gearPack(base, { gear: { pulse: 5, refinery: 5, orbital: 5 } });
    expect(p.towers.pulse.signature?.kind).toBe("vulnerable");
    expect(base.towers.pulse.signature).toBeUndefined();
    const amount = (t: typeof p.towers.refinery) => (t.attack as unknown as { amount: number }).amount;
    expect(amount(p.towers.refinery)).toBeGreaterThan(amount(base.towers.refinery));
    const delay = (t: typeof p.towers.orbital) => (t.attack as unknown as { delay: number }).delay;
    expect(delay(p.towers.orbital)).toBeLessThan(delay(base.towers.orbital));
  });
});

describe("signature mods", () => {
  it("every tower has one, and every param mod changes a real attack value", async () => {
    const { SIGNATURES } = await import("../content/arsenal");
    for (const id of Object.keys(base.towers) as (keyof typeof base.towers)[]) {
      const sig = SIGNATURES[id];
      expect(sig, id).toBeDefined();
      if (!sig || !("param" in sig)) continue;
      const before = (base.towers[id].attack as unknown as Record<string, number>)[sig.param],
        after = (gearPack(base, { gear: { [id]: 5 } }).towers[id].attack as unknown as Record<string, number>)[sig.param];
      expect(typeof before, `${id}.${sig.param}`).toBe("number");
      expect(after, `${id}.${sig.param}`).not.toBe(before);
    }
  });

  it("Reaper's Due adds a credit per kill", () => {
    expect(gearPack(base, { gear: { executioner: 5 } }).towers.executioner.signatureBounty).toBe(1);
  });
});
