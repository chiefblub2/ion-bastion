import { describe, expect, it } from "vitest";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, SALVAGE, TIER_PRICE, VETERANCY_XP } from "../content/arsenal";
import { DEFAULT_CONTENT } from "../content/index";
import type { TowerId } from "../core/types";
import { EMPTY_ARSENAL, campaignTowers, forge, research, salvageOf, settle } from "./arsenal";

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
});
