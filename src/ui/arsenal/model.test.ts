import { describe, expect, it } from "vitest";
import { affordable, EMPTY_ARSENAL, researchPrice } from "../../campaign/arsenal";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, MAX_MARK, VETERANCY_XP } from "../../content/arsenal";
import { DEFAULT_CONTENT } from "../../content/index";
import type { TowerId } from "../../core/types";
import { arsenalStatus, arsenalTiles, branchCounts, defaultTile, forgeBlock, gearNodes, matchesFilter, researchBlock } from "./model";

const content = DEFAULT_CONTENT;
const locked = (Object.keys(CATALOGUE) as TowerId[])[0];
const price = researchPrice(locked)!;
const core = CORE_KIT[0];
const tile = (a: typeof EMPTY_ARSENAL, id: TowerId) => arsenalTiles(a, content).find((t) => t.id === id)!;

describe("arsenal tiles", () => {
  it("mark a research as ready exactly at its price", () => {
    expect(tile({ ...EMPTY_ARSENAL, salvage: price - 1 }, locked).status).toEqual({ kind: "research", price, affordable: false });
    const at = tile({ ...EMPTY_ARSENAL, salvage: price }, locked);
    expect(at.status).toEqual({ kind: "research", price, affordable: true });
    expect(at.ready).toBe(true);
  });
  it("put the core kit first in its branch and filter by ownership and readiness", () => {
    const tiles = arsenalTiles(EMPTY_ARSENAL, content),
      first = tiles.filter((t) => t.page === tiles.find((x) => x.id === core)!.page)[0];
    expect(first.core).toBe(true);
    expect(tiles.filter((t) => matchesFilter(t, "owned")).map((t) => t.id).sort()).toEqual([...CORE_KIT].sort());
    expect(tiles.filter((t) => matchesFilter(t, "ready"))).toEqual([]);
    expect(defaultTile(tiles)!.owned).toBe(true);
  });
  it("count ready purchases per branch as `affordable` does", () => {
    const a = { ...EMPTY_ARSENAL, salvage: 300, xp: { [core]: VETERANCY_XP[0] } },
      tiles = arsenalTiles(a, content);
    for (const b of branchCounts(tiles)) {
      const ids = tiles.filter((t) => t.page === b.page).map((t) => t.id),
        n = affordable(a, ids);
      expect(b.ready).toBe(n.research + n.forge);
    }
    expect(defaultTile(tiles)!.ready).toBe(true);
  });
});

describe("research block", () => {
  it("reports the Salvage still missing", () => {
    expect(researchBlock({ ...EMPTY_ARSENAL, salvage: price - 7 }, locked)).toMatchObject({ price, missing: 7, reason: "Needs 7 more Salvage" });
    expect(researchBlock({ ...EMPTY_ARSENAL, salvage: price }, locked)!.missing).toBe(0);
    expect(researchBlock(EMPTY_ARSENAL, core)).toBeUndefined();
  });
});

describe("gear nodes", () => {
  it("name the rank before the Salvage and report what is missing", () => {
    const a = { ...EMPTY_ARSENAL, salvage: GEAR_PRICE[0] - 5, xp: { [core]: VETERANCY_XP[0] - 20 } },
      nodes = gearNodes(a, core, content);
    expect(nodes.map((n) => n.state)).toEqual(["rank", "later", "later", "later", "later"]);
    expect(nodes[0].missing).toEqual({ xp: 20, salvage: 5 });
    expect(forgeBlock(a, core, content)!.reason).toBe("Needs Rank 1 (20 more XP) and 5 more Salvage");
  });
  it("move from Salvage to ready and on to forged", () => {
    const ranked = { ...EMPTY_ARSENAL, salvage: GEAR_PRICE[0] - 5, xp: { [core]: VETERANCY_XP[0] } };
    expect(gearNodes(ranked, core, content)[0].state).toBe("salvage");
    expect(forgeBlock(ranked, core, content)!.reason).toBe("Needs 5 more Salvage");
    const rich = { ...ranked, salvage: GEAR_PRICE[0] };
    expect(gearNodes(rich, core, content)[0].state).toBe("ready");
    const done = { ...rich, gear: { [core]: MAX_MARK } };
    expect(gearNodes(done, core, content).every((n) => n.state === "forged")).toBe(true);
    expect(forgeBlock(done, core, content)).toBeUndefined();
    expect(gearNodes(done, core, content)[MAX_MARK - 1].signature).toBeTruthy();
  });
});

describe("arsenal status", () => {
  it("reads core, rank and mark, or the research price", () => {
    expect(arsenalStatus(core, { ...EMPTY_ARSENAL, xp: { [core]: VETERANCY_XP[2] }, gear: { [core]: 2 } })).toBe("Core · Rank 3 · Mk II");
    expect(arsenalStatus(core, EMPTY_ARSENAL)).toBe("Core");
    expect(arsenalStatus(locked, EMPTY_ARSENAL)).toBe(`Locked · ${price} Salvage`);
    expect(arsenalStatus(locked, { ...EMPTY_ARSENAL, researched: [locked] })).toBe("Researched");
  });
});
