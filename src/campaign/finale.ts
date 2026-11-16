import { CATALOGUE, CORE_KIT, LOADOUT, MAX_MARK, SALVAGE, VETERANCY_XP } from "../content/arsenal";
import { isCircleSector } from "../content/missions";
import type { MissionDefinition, MissionSector, TowerId } from "../core/types";
import { type Arsenal, markOf, owns, veterancy } from "./arsenal";
import type { Unlocked } from "./campaign-unlock";
import type { CampaignRecord } from "./record";
// Sector finales and the end of the campaign: the debrief's "Sector secured" block and the victory page's totals.

/** The cache a finale's first win pays (sector 1-based). */
export const cachePay = (sector: number) => SALVAGE.cache + SALVAGE.cachePerSector * sector;
const campaignOf = (sectors: readonly MissionSector[]) => sectors.filter((s) => !isCircleSector(s));
const sectorIndex = (mission: MissionDefinition, sectors: readonly MissionSector[]) => sectors.findIndex((s) => s.missions.some((m) => m.id === mission.id));
/** The last mission of a campaign sector (never a Circuit one). */
export function isFinale(mission: MissionDefinition, sectors: readonly MissionSector[]) {
  const sector = sectors[sectorIndex(mission, sectors)];
  return !!sector && !isCircleSector(sector) && sector.missions.at(-1)?.id === mission.id;
}

export interface Secured {
  sector: MissionSector;
  /** Index in `sectors`; the sector number is `index + 1`. */
  index: number;
  /** Best stars in the sector after the win, of `max` (3 per mission). */
  stars: number;
  max: number;
  /** The sector cache paid by this first win (`cachePay`). */
  cache: number;
  /** The win added a loadout slot (`LOADOUT.finales`). */
  slot: boolean;
  /** What the win opened (`newlyUnlocked`). */
  unlocked: Unlocked;
}
/** The "Sector secured" block: only for a finale's first win, else undefined. */
export function securedOf(
  mission: MissionDefinition,
  sectors: readonly MissionSector[],
  before: CampaignRecord,
  after: CampaignRecord,
  unlocked: Unlocked,
): Secured | undefined {
  if (!isFinale(mission, sectors) || before[mission.id] || !after[mission.id]) return undefined;
  const index = sectorIndex(mission, sectors),
    sector = sectors[index];
  return {
    sector,
    index,
    stars: sector.missions.reduce((n, m) => n + (after[m.id] ?? 0), 0),
    max: 3 * sector.missions.length,
    cache: cachePay(index + 1),
    slot: (LOADOUT.finales as readonly number[]).includes(index),
    unlocked,
  };
}
/** The campaign's last mission is won. */
export function campaignComplete(record: CampaignRecord, sectors: readonly MissionSector[]) {
  const last = campaignOf(sectors).at(-1)?.missions.at(-1);
  return !!last && !!record[last.id];
}
export interface CampaignTotals {
  won: number;
  missions: number;
  stars: number;
  maxStars: number;
  /** Towers owned of all towers. */
  owned: number;
  towers: number;
  /** Veterancy ranks and gear marks summed over every tower, with their maxima. */
  ranks: number;
  maxRanks: number;
  marks: number;
  maxMarks: number;
}
/** The victory page's totals over the campaign sectors and the Arsenal. */
export function campaignTotals(record: CampaignRecord, arsenal: Arsenal, sectors: readonly MissionSector[]): CampaignTotals {
  const missions = campaignOf(sectors).flatMap((s) => s.missions),
    towers = [...CORE_KIT, ...(Object.keys(CATALOGUE) as TowerId[])],
    ranks = towers.reduce((n, id) => n + veterancy(arsenal.xp[id]), 0);
  return {
    won: missions.filter((m) => record[m.id]).length,
    missions: missions.length,
    stars: missions.reduce((n, m) => n + (record[m.id] ?? 0), 0),
    maxStars: 3 * missions.length,
    owned: towers.filter((id) => owns(arsenal, id)).length,
    towers: towers.length,
    ranks,
    maxRanks: VETERANCY_XP.length * towers.length,
    marks: towers.reduce((n, id) => n + markOf(arsenal, id), 0),
    maxMarks: MAX_MARK * towers.length,
  };
}
