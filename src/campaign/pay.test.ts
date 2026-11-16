import { describe, expect, it } from "vitest";
import { LOADOUT, RANK_BONUS, SALVAGE, VETERANCY_XP } from "../content/arsenal";
import { MISSIONS, SECTORS } from "../content/missions";
import { EMPTY_ARSENAL } from "./arsenal";
import { cachePay, campaignComplete, isFinale, securedOf } from "./finale";
import { payOf, payPreview, rankGains, salvageOf } from "./pay";

const sum = (kind: string, lines: ReturnType<typeof payOf>) => lines.find((l) => l.kind === kind)?.amount ?? 0,
  win = { won: true, waves: 10, sector: 2, firstWin: false, bounty: false };

describe("pay", () => {
  it("stars pay only when new", () => {
    expect(sum("stars", payOf({ ...win, stars: 3, best: 3 }))).toBe(0);
    expect(payOf({ ...win, stars: 3, best: 1 }).find((l) => l.kind === "stars")).toEqual({ kind: "stars", amount: 2 * SALVAGE.star * 3, count: 2 });
    expect(sum("stars", payOf({ ...win, stars: 1, best: 2 }))).toBe(0);
  });

  it("the cache pays only on a finale's first win", () => {
    expect(sum("cache", payOf({ ...win, finale: true, firstWin: true }))).toBe(cachePay(2));
    expect(sum("cache", payOf({ ...win, finale: true }))).toBe(0);
    expect(sum("cache", payOf({ ...win, firstWin: true }))).toBe(0);
  });

  it("a loss pays a share of its cleared waves and nothing else", () => {
    const lines = payOf({ ...win, won: false, firstWin: true, bounty: true, stars: 3, finale: true });
    expect(lines.map((l) => l.kind)).toEqual(["waves"]);
    expect(salvageOf({ ...win, won: false })).toBe(Math.floor(10 * (SALVAGE.perWave + 2) * SALVAGE.lossShare));
    expect(payOf({ ...win, won: false, waves: 0 })).toEqual([]);
  });

  it("the bounty doubles waves and win only", () => {
    const plain = payOf({ ...win, firstWin: true }),
      bounty = payOf({ ...win, firstWin: true, bounty: true });
    expect(sum("bounty", bounty)).toBe((SALVAGE.bounty - 1) * (sum("waves", plain) + sum("win", plain)));
    expect(salvageOf({ ...win, firstWin: true, bounty: true }) - salvageOf({ ...win, firstWin: true })).toBe(sum("bounty", bounty));
  });

  it("the preview names first-win pay, unpaid stars and a due cache", () => {
    const finale = SECTORS[0].missions.at(-1)!,
      fresh = payPreview(finale, SECTORS, {}, false);
    expect(fresh).toMatchObject({ sector: 1, first: true, starsUnpaid: 3, cache: cachePay(1) });
    expect(fresh.win).toBe(salvageOf({ won: true, waves: finale.waves.length, sector: 1, firstWin: true, bounty: false }));
    expect(payPreview(finale, SECTORS, { [finale.id]: 2 }, false)).toMatchObject({ first: false, starsUnpaid: 1, cache: 0 });
  });
});

describe("rank gains", () => {
  it("names the ranks crossed and their bonus", () => {
    const [gain] = rankGains({ ...EMPTY_ARSENAL, xp: { pulse: VETERANCY_XP[0] - 1 } }, { pulse: VETERANCY_XP[1] });
    expect(gain).toMatchObject({ id: "pulse", rankBefore: 0, rankAfter: 2, bonus: RANK_BONUS[0] + RANK_BONUS[1] });
    expect(rankGains(EMPTY_ARSENAL, { pulse: 1, lance: 0 })).toEqual([{ id: "pulse", xpBefore: 0, xpAfter: 1, rankBefore: 0, rankAfter: 0, bonus: 0 }]);
  });
});

describe("finales", () => {
  it("secures a sector on its finale's first win only", () => {
    const finale = SECTORS[0].missions.at(-1)!,
      none = { sectors: [], missions: [] },
      after = { [finale.id]: 3 as const };
    expect(isFinale(finale, SECTORS)).toBe(true);
    expect(isFinale(SECTORS[0].missions[0], SECTORS)).toBe(false);
    expect(isFinale(MISSIONS.filter((m) => m.circle).at(-1)!, SECTORS)).toBe(false);
    expect(securedOf(finale, SECTORS, {}, after, none)).toMatchObject({ index: 0, stars: 3, max: 3 * SECTORS[0].missions.length, cache: cachePay(1), slot: (LOADOUT.finales as readonly number[]).includes(0) });
    expect(securedOf(finale, SECTORS, after, after, none)).toBeUndefined();
    const last = MISSIONS.filter((m) => !m.circle).at(-1)!;
    expect(campaignComplete({}, SECTORS)).toBe(false);
    expect(campaignComplete({ [last.id]: 1 }, SECTORS)).toBe(true);
  });
});
