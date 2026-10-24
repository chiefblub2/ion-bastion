import type { MissionDefinition, MissionSector } from "../core/types";
import { isCircleSector } from "../content/missions";
import type { CampaignRecord } from "./progress";
/**
 * Campaign progress gates, derived from the campaign record alone (nothing new is stored):
 * - the first mission of the first campaign sector is always open;
 * - in an open sector a mission opens once one of the two missions before it is won, so a single hard mission can be
 *   skipped;
 * - a sector opens once `sectorGate` missions of the sector before it are won;
 * - a won mission, and every sector holding one, stays open, so older records (played in any order) lose nothing.
 * Circuit sectors and missions outside the sectors are never locked. The lock lives in the menu only: the simulation,
 * `?mission=` links, the multiplayer lobby, Training, the editor and the Run mode never see it.
 */
export type Lock =
  /** The sector is closed: `need` more wins in `sector` (the one before it) open it. */
  | { kind: "sector"; sector: MissionSector; need: number }
  /** The sector is open, but the mission before (`after`) has to be won first. */
  | { kind: "mission"; after: MissionDefinition };
/** Wins in a sector that open the next one: all but one, so one hard mission never blocks the campaign. */
export const sectorGate = (sector: MissionSector) => Math.max(1, sector.missions.length - 1);
/** The locked missions of the campaign by id, each with what opens it; every other mission is playable. */
export function campaignLocks(sectors: readonly MissionSector[], record: CampaignRecord): ReadonlyMap<string, Lock> {
  const locks = new Map<string, Lock>(),
    won = (m: MissionDefinition) => !!record[m.id];
  let before: MissionSector | undefined,
    beforeOpen = true;
  for (const sector of sectors) {
    if (isCircleSector(sector)) continue;
    const list = sector.missions,
      wins = before ? before.missions.filter(won).length : 0,
      open: boolean = !before || list.some(won) || (beforeOpen && wins >= sectorGate(before));
    list.forEach((m, i) => {
      if (won(m)) return;
      if (!open) locks.set(m.id, { kind: "sector", sector: before!, need: Math.max(1, sectorGate(before!) - wins) });
      else if (i > 0 && !won(list[i - 1]) && !(i > 1 && won(list[i - 2]))) locks.set(m.id, { kind: "mission", after: list[i - 1] });
    });
    before = sector;
    beforeOpen = open;
  }
  return locks;
}
/** A sector is locked while every one of its missions is. */
export const sectorLocked = (sector: MissionSector, locks: ReadonlyMap<string, Lock>) => sector.missions.every((m) => locks.has(m.id));
/** What a win opened: whole sectors, and missions in sectors that were already open. */
export interface Unlocked {
  sectors: readonly MissionSector[];
  missions: readonly MissionDefinition[];
}
export function newlyUnlocked(sectors: readonly MissionSector[], before: ReadonlyMap<string, Lock>, after: ReadonlyMap<string, Lock>): Unlocked {
  const opened = sectors.filter((s) => sectorLocked(s, before) && !sectorLocked(s, after));
  return {
    sectors: opened,
    missions: sectors
      .filter((s) => !opened.includes(s))
      .flatMap((s) => s.missions)
      .filter((m) => before.has(m.id) && !after.has(m.id)),
  };
}
