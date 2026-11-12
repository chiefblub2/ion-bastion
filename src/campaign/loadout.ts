import { CORE_KIT, LOADOUT } from "../content/arsenal";
import { SECTORS } from "../content/missions";
import { availableTowers } from "../core/game";
import { hasStealth } from "../core/mission-checks";
import { pageOf } from "../core/tower-pages";
import type { ContentPack, MissionDefinition, MissionSector, TowerId } from "../core/types";
import { answers, missionNeeds, type Need } from "../run/threats";
import { type Arsenal, owns } from "./arsenal";
import type { CampaignRecord } from "./record";
// Campaign loadouts: how many tower types a solo campaign mission fields, which ones may be picked, and an auto-fill.
// The `mission` command's `towers` carries the result; the simulation never learns about loadouts.

const finaleOf = (sector: MissionSector | undefined) => sector?.missions.at(-1);
/** Loadout slots from the record: `LOADOUT.base` plus one per won finale of a `LOADOUT.finales` sector, at most `max`. */
export function slotsOf(record: CampaignRecord, sectors: readonly MissionSector[] = SECTORS) {
  const won = LOADOUT.finales.filter((i) => {
    const finale = finaleOf(sectors[i]);
    return !!finale && !!record[finale.id];
  }).length;
  return Math.min(LOADOUT.max, LOADOUT.base + won);
}
/** The next finale that grants a slot, or undefined when every one is won (or the slots are full). */
export function nextSlot(record: CampaignRecord, sectors: readonly MissionSector[] = SECTORS): { index: number; sector: MissionSector; mission: MissionDefinition } | undefined {
  if (slotsOf(record, sectors) >= LOADOUT.max) return undefined;
  for (const index of LOADOUT.finales) {
    const sector = sectors[index],
      mission = finaleOf(sector);
    if (sector && mission && !record[mission.id]) return { index, sector, mission };
  }
  return undefined;
}

export interface Kit {
  /** The towers a loadout picks from, in content order: owned ∩ allowed (a special op: its whole list). */
  pool: TowerId[];
  /** Fielded without a pick or a slot: the Detector on missions with invisible enemies. */
  issued: TowerId[];
  slots: number;
  /** A special operation (the mission restricts its towers): it lends its whole list, owned or not. */
  special: boolean;
}
/** The pool, the issued towers and the slots of a solo campaign mission. */
export function kitOf(mission: MissionDefinition, arsenal: Arsenal, record: CampaignRecord, content: ContentPack): Kit {
  const allowed = availableTowers(mission, content),
    special = !!mission.availableTowers,
    issued: TowerId[] = hasStealth(mission, content) && allowed.includes("detector") ? ["detector"] : [];
  return {
    pool: allowed.filter((id) => !issued.includes(id) && (special || owns(arsenal, id))),
    issued,
    slots: slotsOf(record, content.sectors ?? SECTORS),
    special,
  };
}
/** The pool fits the slots: everything is fielded and nothing needs picking. */
export const fitsAll = (kit: Kit) => kit.pool.length <= kit.slots;
/** Picks are distinct pool towers, no more than the slots. */
export const validLoadout = (kit: Kit, picks: readonly TowerId[]) =>
  picks.length <= kit.slots && new Set(picks).size === picks.length && picks.every((id) => kit.pool.includes(id));
/**
 * What the `mission` command's `towers` gets: the picks (the whole pool when it fits the slots) plus the issued
 * towers, in the build menu's order (by page, content order within one). Invalid or surplus picks are dropped.
 */
export function fieldedTowers(kit: Kit, picks: readonly TowerId[], content: ContentPack): TowerId[] {
  const chosen = new Set(fitsAll(kit) ? kit.pool : picks.filter((id) => kit.pool.includes(id)).slice(0, kit.slots));
  for (const id of kit.issued) chosen.add(id);
  return (Object.keys(content.towers) as TowerId[]).filter((id) => chosen.has(id)).sort((a, b) => pageOf(content.towers[a]) - pageOf(content.towers[b]));
}
/**
 * A loadout chosen for the player: the valid towers of `keep` first, then a tower for each need the mission brings
 * that nothing fielded answers yet, then the most experienced towers (core kit order breaking ties). Never more than
 * the slots; the whole pool when it fits.
 */
export function autoLoadout(kit: Kit, mission: MissionDefinition, arsenal: Arsenal, content: ContentPack, keep: readonly TowerId[] = []): TowerId[] {
  if (fitsAll(kit)) return [...kit.pool];
  const core = (id: TowerId) => (CORE_KIT.includes(id) ? CORE_KIT.indexOf(id) : CORE_KIT.length),
    ranked = [...kit.pool].sort((a, b) => (arsenal.xp[b] ?? 0) - (arsenal.xp[a] ?? 0) || core(a) - core(b) || kit.pool.indexOf(a) - kit.pool.indexOf(b)),
    picks: TowerId[] = [];
  const add = (id: TowerId) => picks.length < kit.slots && !picks.includes(id) && picks.push(id);
  for (const id of keep) if (kit.pool.includes(id)) add(id);
  for (const need of missionNeeds(mission, content)) {
    if (answers([...picks, ...kit.issued], content)[need].length) continue;
    const by = answers(ranked, content)[need][0];
    if (by) add(by);
  }
  for (const id of ranked) add(id);
  return picks;
}

const NEED_LABEL: Record<Need, string> = { air: "Air", detect: "Stealth", under: "Burrowers" };
export interface NeedChip {
  need: Need;
  label: string;
  /** Fielded towers that answer it; empty is an uncovered need. */
  by: TowerId[];
}
/** The briefing's need chips: every need the mission brings and the fielded towers that answer it. */
export function needChips(mission: MissionDefinition, fielded: readonly TowerId[], content: ContentPack): NeedChip[] {
  const a = answers(fielded, content);
  return missionNeeds(mission, content).map((need) => ({ need, label: NEED_LABEL[need], by: a[need] }));
}
