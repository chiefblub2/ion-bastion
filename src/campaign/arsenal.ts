import { CATALOGUE, CORE_KIT, GEAR_PRICE, MAX_MARK, SALVAGE, TIER_PRICE, VETERANCY_XP } from "../content/arsenal";
import type { TowerId } from "../core/types";
// Pure Campaign Arsenal logic: Salvage, research, veterancy and gear. Storage and UI live elsewhere.

export interface Arsenal {
  readonly salvage: number;
  readonly researched: readonly TowerId[];
  /** Tower XP per type, never spent. */
  readonly xp: Readonly<Partial<Record<TowerId, number>>>;
  /** Gear mark (0–5) per type. */
  readonly gear: Readonly<Partial<Record<TowerId, number>>>;
}
export const EMPTY_ARSENAL: Arsenal = { salvage: 0, researched: [], xp: {}, gear: {} };

export interface PlayResult {
  readonly won: boolean;
  /** Waves cleared (all of them on a win). */
  readonly waves: number;
  /** 1-based campaign sector of the mission. */
  readonly sector: number;
  /** The mission had not been won before. */
  readonly firstWin: boolean;
  /** The mission is today's bounty. */
  readonly bounty: boolean;
}

/** Salvage paid for one play: waves (half on a loss), win bonuses, the daily bounty doubling all of it. */
export function salvageOf(r: PlayResult): number {
  const waves = r.waves * (SALVAGE.perWave + r.sector);
  const pay = r.won ? waves + SALVAGE.win + (r.firstWin ? SALVAGE.firstWin + SALVAGE.firstWinPerSector * r.sector : 0) : Math.floor(waves * SALVAGE.lossShare);
  return r.bounty ? pay * SALVAGE.bounty : pay;
}

export const owns = (a: Arsenal, id: TowerId) => CORE_KIT.includes(id) || a.researched.includes(id);
/** Research price of a tower, or undefined when it is not in the catalogue (core towers). */
export const researchPrice = (id: TowerId): number | undefined => (CATALOGUE[id] === undefined ? undefined : TIER_PRICE[CATALOGUE[id]!]);
export const canResearch = (a: Arsenal, id: TowerId) => {
  const p = researchPrice(id);
  return p !== undefined && !owns(a, id) && a.salvage >= p;
};
/** Research is permanent (no refunds); an impossible purchase returns the arsenal unchanged. */
export const research = (a: Arsenal, id: TowerId): Arsenal =>
  canResearch(a, id) ? { ...a, salvage: a.salvage - researchPrice(id)!, researched: [...a.researched, id] } : a;

export const veterancy = (xp = 0) => VETERANCY_XP.filter((t) => xp >= t).length;
export const markOf = (a: Arsenal, id: TowerId) => a.gear[id] ?? 0;
/** The next mark needs ownership, the matching veterancy rank and its price. */
export function canForge(a: Arsenal, id: TowerId) {
  const mark = markOf(a, id);
  return owns(a, id) && mark < MAX_MARK && veterancy(a.xp[id]) > mark && a.salvage >= GEAR_PRICE[mark];
}
export const forge = (a: Arsenal, id: TowerId): Arsenal =>
  canForge(a, id) ? { ...a, salvage: a.salvage - GEAR_PRICE[markOf(a, id)], gear: { ...a.gear, [id]: markOf(a, id) + 1 } } : a;

/** Adds a play's Salvage and XP. */
export function settle(a: Arsenal, salvage: number, xp: Readonly<Partial<Record<TowerId, number>>>): Arsenal {
  const next = { ...a.xp };
  for (const [id, v] of Object.entries(xp) as [TowerId, number][]) next[id] = (next[id] ?? 0) + v;
  return { ...a, salvage: a.salvage + salvage, xp: next };
}

/**
 * Towers a campaign mission offers: core, researched and (on missions with invisible enemies) the Detector, within the
 * mission's own restriction (`offered`, the mission's available towers).
 */
export const campaignTowers = (offered: readonly TowerId[], a: Arsenal, stealth: boolean): TowerId[] =>
  offered.filter((id) => owns(a, id) || (stealth && id === "detector"));
