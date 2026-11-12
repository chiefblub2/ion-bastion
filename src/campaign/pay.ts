import { RANK_BONUS, SALVAGE } from "../content/arsenal";
import type { MissionDefinition, MissionSector, TowerId } from "../core/types";
import { type Arsenal, veterancy } from "./arsenal";
import { cachePay, isFinale } from "./finale";
import type { CampaignRecord } from "./record";
// Salvage pay as ledger lines (the debrief counts them up), the briefing's reward preview and the ranks a play reaches.

export interface PlayResult {
  readonly won: boolean;
  /** Waves cleared (all of them on a win). */
  readonly waves: number;
  /** 1-based campaign sector of the mission. */
  readonly sector: number;
  /** The mission had not been won before. */
  readonly firstWin: boolean;
  /** The mission is today's unpaid bounty. */
  readonly bounty: boolean;
}
export interface PayOutcome extends PlayResult {
  /** Stars of this win, and the best stars before it (0 when never won); only the new ones pay. */
  readonly stars?: number;
  readonly best?: number;
  /** The mission is its sector's finale: its first win opens the sector cache. */
  readonly finale?: boolean;
}
export type PayKind = "waves" | "win" | "firstWin" | "stars" | "cache" | "bounty";
export interface PayLine {
  kind: PayKind;
  amount: number;
  /** Waves cleared or stars newly earned, for "12 waves" / "2 new stars". */
  count?: number;
}
const perWave = (sector: number) => SALVAGE.perWave + sector;
export const starPay = (sector: number) => SALVAGE.star * (1 + sector);
export const firstWinPay = (sector: number) => SALVAGE.firstWin + SALVAGE.firstWinPerSector * sector;
/**
 * The Salvage ledger of one play. A loss pays `lossShare` of its cleared waves and nothing else. A win pays every
 * wave, the win bonus, the first-win bonus once, each newly earned star, a finale's cache on its first win, and on
 * the bounty the waves and win once more (× `SALVAGE.bounty`). Lines worth nothing are left out.
 */
export function payOf(r: PayOutcome): PayLine[] {
  const lines: PayLine[] = [],
    add = (kind: PayKind, amount: number, count?: number) => amount > 0 && lines.push(count === undefined ? { kind, amount } : { kind, amount, count });
  if (!r.won) {
    add("waves", Math.floor(r.waves * perWave(r.sector) * SALVAGE.lossShare), r.waves);
    return lines;
  }
  const waves = r.waves * perWave(r.sector),
    fresh = Math.max(0, (r.stars ?? 0) - (r.best ?? 0));
  add("waves", waves, r.waves);
  add("win", SALVAGE.win);
  if (r.firstWin) add("firstWin", firstWinPay(r.sector));
  add("stars", fresh * starPay(r.sector), fresh);
  if (r.firstWin && r.finale) add("cache", cachePay(r.sector));
  if (r.bounty) add("bounty", (waves + SALVAGE.win) * (SALVAGE.bounty - 1));
  return lines;
}
/** Salvage paid for one play: the sum of its ledger. */
export const salvageOf = (r: PayOutcome) => payOf(r).reduce((n, l) => n + l.amount, 0);

export interface PayPreview {
  /** 1-based sector. */
  sector: number;
  /** Not won yet: the first-win bonus (and a finale's cache) is still due. */
  first: boolean;
  /** Waves, win and (first time) the first-win bonus for a win, doubled waves and win on the bounty. */
  win: number;
  /** Salvage per newly earned star, and how many stars are still unpaid. */
  perStar: number;
  starsUnpaid: number;
  /** A finale's cache when its first win is still due, else 0. */
  cache: number;
  bounty: boolean;
}
/** What a win of `mission` would pay now: the briefing's reward block. */
export function payPreview(mission: MissionDefinition, sectors: readonly MissionSector[], record: CampaignRecord, bounty: boolean): PayPreview {
  const sector = Math.max(1, sectors.findIndex((s) => s.missions.some((m) => m.id === mission.id)) + 1),
    best = record[mission.id] ?? 0,
    first = !best,
    finale = isFinale(mission, sectors),
    pay = payOf({ won: true, waves: mission.waves.length, sector, firstWin: first, bounty, finale });
  return {
    sector,
    first,
    win: pay.filter((l) => l.kind !== "cache").reduce((n, l) => n + l.amount, 0),
    perStar: starPay(sector),
    starsUnpaid: 3 - best,
    cache: first && finale ? cachePay(sector) : 0,
    bounty,
  };
}

export interface RankGain {
  id: TowerId;
  xpBefore: number;
  xpAfter: number;
  rankBefore: number;
  rankAfter: number;
  /** `RANK_BONUS` Salvage for every rank crossed. */
  bonus: number;
}
/** The XP a play adds per tower type, with the ranks it crosses and their Salvage bonus. */
export function rankGains(before: Pick<Arsenal, "xp">, xp: Readonly<Partial<Record<TowerId, number>>>): RankGain[] {
  return (Object.entries(xp) as [TowerId, number][])
    .filter(([, v]) => v > 0)
    .map(([id, v]) => {
      const xpBefore = before.xp[id] ?? 0,
        xpAfter = xpBefore + v,
        rankBefore = veterancy(xpBefore),
        rankAfter = veterancy(xpAfter);
      return { id, xpBefore, xpAfter, rankBefore, rankAfter, bonus: RANK_BONUS.slice(rankBefore, rankAfter).reduce((n, b) => n + b, 0) };
    });
}
