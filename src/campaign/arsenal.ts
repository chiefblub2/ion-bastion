import { CATALOGUE, CORE_KIT, GEAR_PRICE, type GearClass, MAX_MARK, TIER_PRICE, VETERANCY_XP, XP_BUILT, XP_FIELDED } from "../content/arsenal";
import { pageOf } from "../core/tower-pages";
import type { ContentPack, GameState, MissionDefinition, TowerDefinition, TowerId } from "../core/types";
import { assistsOf } from "../run/xp";
// Pure Campaign Arsenal logic: Salvage, research, veterancy and gear. Storage and UI live elsewhere.

export interface Arsenal {
  readonly salvage: number;
  readonly researched: readonly TowerId[];
  /** Tower XP per type, never spent. */
  readonly xp: Readonly<Partial<Record<TowerId, number>>>;
  /** Gear mark (0–5) per type. */
  readonly gear: Readonly<Partial<Record<TowerId, number>>>;
  /** The last loadout picked for a campaign mission (`campaign/loadout.ts`); empty before the first. */
  readonly loadout: readonly TowerId[];
  /** Today's bounty pick, kept so it does not move when a win changes the open missions; null before the first. */
  readonly bounty: Bounty | null;
}
/** A day's bounty: the UTC day (`YYYY-MM-DD`), the mission id and whether it has paid (once per day). */
export interface Bounty {
  readonly day: string;
  readonly id: string;
  readonly paid: boolean;
}
export const EMPTY_ARSENAL: Arsenal = { salvage: 0, researched: [], xp: {}, gear: {}, loadout: [], bounty: null };

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
/**
 * Progress towards the next rank: `into` XP since the current rank's threshold and the `span` to the next one
 * (undefined at the top rank). An XP bar fills `into / span`; "n XP to Rank k" is `span - into` to `rank + 1`.
 */
export function rankProgress(xp = 0): { rank: number; into: number; span: number | undefined } {
  const rank = veterancy(xp),
    from = rank ? VETERANCY_XP[rank - 1] : 0,
    to = VETERANCY_XP[rank] as number | undefined;
  return { rank, into: xp - from, span: to === undefined ? undefined : to - from };
}
export const markOf = (a: Arsenal, id: TowerId) => a.gear[id] ?? 0;
/** A tower's veterancy rank and forged mark. */
export const standingOf = (a: Arsenal, id: TowerId) => ({ rank: veterancy(a.xp[id]), mark: markOf(a, id) });
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

/** A tower's gear class (`GEAR_MARKS`, `XP_FIELDED`): Attack and Control, traps, Support with an area, Support without. */
export function gearClassOf(t: Readonly<TowerDefinition>): GearClass {
  const page = pageOf(t);
  return page <= 1 ? "armed" : page === 2 ? "trap" : t.range > 0 ? "support" : "field";
}

/**
 * Tower XP of one play, per type: kills, `XP_BUILT` per tower built, Run-style assists (`run/xp.ts`) and `XP_FIELDED`
 * (by gear class) once per type built at all. Read from the finished state only.
 */
export function xpOf(state: Pick<GameState, "towers">, mission: Pick<MissionDefinition, "map">, content: ContentPack): Partial<Record<TowerId, number>> {
  const xp: Partial<Record<TowerId, number>> = { ...assistsOf(state, mission, content) },
    fielded = new Set<TowerId>();
  for (const t of state.towers) {
    xp[t.type] = (xp[t.type] ?? 0) + t.kills + XP_BUILT + (fielded.has(t.type) ? 0 : XP_FIELDED[gearClassOf(content.towers[t.type])]);
    fielded.add(t.type);
  }
  return xp;
}

/**
 * Towers a campaign mission offers: core, researched and (on missions with invisible enemies) the Detector, within the
 * mission's own restriction (`offered`, the mission's available towers).
 */
export const campaignTowers = (offered: readonly TowerId[], a: Arsenal, stealth: boolean): TowerId[] =>
  offered.filter((id) => owns(a, id) || (stealth && id === "detector"));

/** How many of `ids` the arsenal could research or forge right now: the menus' "ready" hint. */
export function affordable(a: Arsenal, ids: readonly TowerId[]): { research: number; forge: number } {
  return { research: ids.filter((id) => canResearch(a, id)).length, forge: ids.filter((id) => canForge(a, id)).length };
}
