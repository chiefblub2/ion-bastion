import { describe, expect, it } from "vitest";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, SALVAGE, TIER_PRICE, VETERANCY_XP, XP_BUILT, XP_FIELDED } from "../content/arsenal";
import { DEFAULT_CONTENT } from "../content/index";
import type { TowerId } from "../core/types";
import { EMPTY_ARSENAL, affordable, campaignTowers, forge, rankProgress, research, settle, standingOf, xpOf } from "./arsenal";
import { salvageOf } from "./pay";

describe("campaign arsenal", () => {
  it("catalogue and core kit cover every tower exactly once", () => {
    const all = Object.keys(DEFAULT_CONTENT.towers).sort();
    expect([...CORE_KIT, ...Object.keys(CATALOGUE)].sort()).toEqual(all);
  });

  it("a loss pays half the waves, a win adds bonuses, the bounty doubles", () => {
    const base = { waves: 10, sector: 1, firstWin: false, bounty: false };
    const waves = 10 * (SALVAGE.perWave + 1);
    expect(salvageOf({ ...base, won: false })).toBe(Math.floor(waves / 2));
    expect(salvageOf({ ...base, won: true })).toBe(waves + SALVAGE.win);
    expect(salvageOf({ ...base, won: true, firstWin: true })).toBeGreaterThan(waves + SALVAGE.win);
    expect(salvageOf({ ...base, won: true, bounty: true })).toBe(2 * (waves + SALVAGE.win));
  });

  it("rank progress spans the gap to the next threshold", () => {
    expect(rankProgress(0)).toEqual({ rank: 0, into: 0, span: VETERANCY_XP[0] });
    expect(rankProgress(VETERANCY_XP[0] + 5)).toEqual({ rank: 1, into: 5, span: VETERANCY_XP[1] - VETERANCY_XP[0] });
    expect(rankProgress(1e9).span).toBeUndefined();
    expect(standingOf({ ...EMPTY_ARSENAL, xp: { pulse: VETERANCY_XP[1] }, gear: { pulse: 2 } }, "pulse")).toEqual({ rank: 2, mark: 2 });
  });

  it("XP counts kills, builds and once per type fielded", () => {
    const mission = { map: { path: [] } } as never,
      one = xpOf({ towers: [{ type: "pulse", kills: 3 }] as never }, mission, DEFAULT_CONTENT).pulse!,
      two = xpOf({ towers: [{ type: "pulse", kills: 3 }, { type: "pulse", kills: 0 }] as never }, mission, DEFAULT_CONTENT).pulse!;
    expect(two - one).toBe(XP_BUILT);
    expect(one).toBe(3 + XP_BUILT + XP_FIELDED);
  });

  it("research costs Salvage only and is permanent", () => {
    const id = "orbital" as TowerId,
      price = TIER_PRICE[CATALOGUE[id]!];
    expect(research({ ...EMPTY_ARSENAL, salvage: price - 1 }, id).researched).toEqual([]);
    const a = research({ ...EMPTY_ARSENAL, salvage: price }, id);
    expect(a).toMatchObject({ salvage: 0, researched: [id] });
    expect(research({ ...a, salvage: 1e4 }, id).salvage).toBe(1e4);
  });

  it("gear needs ownership, the matching rank and Salvage", () => {
    const rich = settle({ ...EMPTY_ARSENAL, salvage: 1e4 }, 0, {}),
      id = "pulse" as TowerId;
    expect(forge(rich, id).gear[id]).toBeUndefined();
    const ranked = settle(rich, 0, { [id]: VETERANCY_XP[0] });
    expect(forge(ranked, id)).toMatchObject({ gear: { [id]: 1 }, salvage: 1e4 - GEAR_PRICE[0] });
    expect(forge(forge(ranked, id), id).gear[id]).toBe(1);
    expect(forge(settle(ranked, 0, { lance: 1e4 }), "lance").gear.lance).toBeUndefined();
  });

  it("the Detector is issued on stealth missions; restrictions still hold", () => {
    const offered = ["pulse", "detector", "lance"] as TowerId[];
    expect(campaignTowers(offered, EMPTY_ARSENAL, false)).toEqual(["pulse"]);
    expect(campaignTowers(offered, EMPTY_ARSENAL, true)).toEqual(["pulse", "detector"]);
    expect(campaignTowers(["pulse"], EMPTY_ARSENAL, true)).toEqual(["pulse"]);
  });

  it("affordable counts what research and forging could buy now", () => {
    const id = "orbital" as TowerId,
      price = TIER_PRICE[CATALOGUE[id]!];
    expect(affordable(EMPTY_ARSENAL, [id, "pulse"])).toEqual({ research: 0, forge: 0 });
    const a = settle({ ...EMPTY_ARSENAL, salvage: Math.max(price, GEAR_PRICE[0]) }, 0, { pulse: VETERANCY_XP[0] });
    expect(affordable(a, [id, "pulse"])).toEqual({ research: 1, forge: 1 });
  });
});
