// The Sector Atlas's pure model: sector cards, progress, the next mission, locks in words, route links, and the options the app passes.
import type { ContentPack, MapDefinition, MissionDefinition, MissionSector } from "../../core/types";
import { isCircleSector, missionNumber } from "../../content/missions";
import { themeAccent } from "../../render/terrain";
import type { CampaignRecord } from "../../campaign/record";
import { type Lock, sectorLocked, type Unlocked } from "../../campaign/campaign-unlock";
import { nextMission } from "../../campaign/next-mission";

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
export const roman = (index: number) => ROMAN[index] ?? String(index + 1);
export const pad = (n: number) => String(n).padStart(2, "0");
export const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
export const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** One card of the gallery; `index` is the position in `content.sectors`, which also numbers the sector. */
export interface AtlasSector {
  index: number;
  numeral: string;
  name: string;
  count: number;
  /** Campaign numbers of the first and last mission. */
  first: number;
  last: number;
  /** The cover art: the sector's first map. */
  cover: MapDefinition;
  accent: string;
  /** Holds the mode's next mission (`atlasNext`). */
  next: boolean;
  /** Won missions and their best stars, from the campaign record. */
  won: number;
  stars: number;
  /** Every mission is locked; `lock` says what opens the sector. */
  locked: boolean;
  lock?: Lock;
}
/** Won missions and best stars among `missions`; at most `3 × missions.length` stars. */
export function progressOf(missions: readonly MissionDefinition[], record: CampaignRecord) {
  const won = missions.filter((m) => record[m.id]);
  return { won: won.length, stars: won.reduce((n, m) => n + record[m.id], 0), count: missions.length };
}
/** The sectors of one mode (Campaign, or Circuit with `circle`), in content order. */
export function atlasGroup(sectors: readonly MissionSector[], circle: boolean) {
  return sectors.filter((sector) => isCircleSector(sector) === circle);
}
export function atlasSectors(content: ContentPack, circle: boolean, record: CampaignRecord = {}, locks: ReadonlyMap<string, Lock> = NO_LOCKS): AtlasSector[] {
  const sectors = content.sectors ?? [],
    group = atlasGroup(sectors, circle),
    next = atlasNext(
      group.flatMap((s) => s.missions),
      record,
      locks,
    );
  return group.map((sector) => {
    const first = missionNumber(sector.missions[0], content.missions),
      { won, stars } = progressOf(sector.missions, record);
    return {
      index: sectors.indexOf(sector),
      numeral: roman(sectors.indexOf(sector)),
      name: sector.name,
      count: sector.missions.length,
      first,
      last: first + sector.missions.length - 1,
      cover: sector.missions[0].map,
      accent: hex(themeAccent(sector.missions[0].map)),
      next: !!next && sector.missions.includes(next),
      won,
      stars,
      locked: sectorLocked(sector, locks),
      lock: locks.get(sector.missions[0].id),
    };
  });
}
export const NO_LOCKS: ReadonlyMap<string, Lock> = new Map();
/** The next mission to play among `missions`: the first one neither won nor locked (`nextMission`), undefined once every open one is won. */
export function atlasNext(missions: readonly MissionDefinition[], record: CampaignRecord, locks: ReadonlyMap<string, Lock> = NO_LOCKS) {
  return nextMission(missions, record, { locks });
}
/** Why a locked mission or sector cannot be started yet, in the player's words. */
export function lockText(lock: Lock, missions: readonly MissionDefinition[], sectors: readonly MissionSector[]) {
  if (lock.kind === "mission") return `Clear Mission ${pad(missionNumber(lock.after, missions))} to unlock`;
  return `Clear ${lock.need} more ${plural(lock.need, "mission")} in Sector ${roman(sectors.indexOf(lock.sector))} to unlock`;
}
/** The win overlay's line about what the win opened, or "" when it opened nothing. */
export function unlockNotice({ sectors: opened, missions: newer }: Unlocked, missions: readonly MissionDefinition[], sectors: readonly MissionSector[]) {
  const names = [
    ...opened.map((s) => `Sector ${roman(sectors.indexOf(s))} · ${s.name}`),
    ...newer.map((m) => `Mission ${pad(missionNumber(m, missions))} · ${m.name}`),
  ];
  return names.length ? `Unlocked: ${names.join(", ")}` : "";
}
/**
 * The mission a sector features: the picked one, else the one being played (`playingId`), else the sector's next
 * unwon one, else its first.
 */
export function atlasPick(
  missions: readonly MissionDefinition[],
  record: CampaignRecord,
  pickedId?: string,
  playingId?: string,
  locks: ReadonlyMap<string, Lock> = NO_LOCKS,
) {
  return missions.find((m) => m.id === pickedId) ?? missions.find((m) => m.id === playingId) ?? atlasNext(missions, record, locks) ?? missions[0];
}
/** Renders a map's terrain to an image URL (`render/terrain-snapshot.ts`); the SVG stays where it fails. */
export type MapImage = (map: MapDefinition) => Promise<string>;
export interface AtlasOptions {
  /** Picking for a multiplayer room: the button chooses instead of starting. */
  lobby: boolean;
  image: MapImage;
  /** Best stars per won mission; absent shows nothing as cleared. */
  record?: CampaignRecord;
  /** A game is under way on the loaded mission, so the atlas opens on it instead of the next mission. */
  playing?: boolean;
  /** Locked campaign missions (`campaignLocks`); absent (multiplayer, `?unlock=all`) locks nothing. */
  locks?: ReadonlyMap<string, Lock>;
  /** Unlocked mission ids shown before; others play their reveal. Absent: nothing is fresh. */
  seen?: ReadonlySet<string>;
  /** Today's unpaid bounty mission (pays double Salvage): its node gets a "×2" tag. */
  bounty?: string;
}
/** The next mission of one mode (Campaign, or Circuit with `circle`). */
export const modeNext = (sectors: readonly MissionSector[], circle: boolean, record: CampaignRecord = {}, locks?: ReadonlyMap<string, Lock>) =>
  atlasNext(
    atlasGroup(sectors, circle).flatMap((s) => s.missions),
    record,
    locks,
  );
/** An unlocked mission the atlas has not shown unlocked before (only once a first visit is stored). */
export const fresh = (m: MissionDefinition, { locks, seen }: AtlasOptions) => !!seen && !locks?.has(m.id) && !seen.has(m.id);
/**
 * The mission that steps aside from its sector's route: the special operation with restricted towers, unless it
 * is the finale.
 */
export function asideOf(missions: readonly MissionDefinition[]) {
  const i = missions.findIndex((m) => m.availableTowers);
  return i >= 0 && i < missions.length - 1 ? i : undefined;
}
/**
 * The links between a sector's missions as index pairs: each to the next and, where campaign unlocks apply (a win
 * opens the next two), a fainter skip link to the one after (`true`).
 */
export function routeLinks(missions: readonly unknown[], skips: boolean): [number, number, boolean][] {
  const links: [number, number, boolean][] = [];
  for (let j = 0; j + 1 < missions.length; j++) {
    links.push([j, j + 1, false]);
    if (skips && j + 2 < missions.length) links.push([j, j + 2, true]);
  }
  return links;
}
/** A small padlock for locked stations and sectors. */
export const LOCK_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="currentColor"/></svg>';
