import type { MissionDefinition } from "../core/types";
import type { Lock } from "./campaign-unlock";
import type { CampaignRecord } from "./record";

export interface NextOptions {
  /** Search forward from this mission, wrapping round to skipped ones; it also sets the mode (campaign or Circuit). */
  after?: MissionDefinition;
  /** The mode when there is no `after`: Circuit (true) or campaign (false); absent with no `after` searches the whole list. */
  circle?: boolean;
  /** Locked missions (`campaignLocks`), never offered. */
  locks?: ReadonlyMap<string, Lock>;
}
/**
 * The one "next mission" rule (home page, Sector Atlas, win overlay): the next unwon, unlocked mission of the same
 * mode, searching forward from `after` and wrapping round to skipped ones; it never crosses between the campaign and
 * the Circuit, and never offers `after` itself. Undefined once every open mission of the mode is won.
 */
export function nextMission(missions: readonly MissionDefinition[], record: CampaignRecord, o: NextOptions = {}): MissionDefinition | undefined {
  const circle = o.after ? !!o.after.circle : o.circle,
    mode = circle === undefined ? missions : missions.filter((m) => !!m.circle === circle),
    at = o.after ? mode.findIndex((m) => m.id === o.after!.id) : -1;
  return [...mode.slice(at + 1), ...mode.slice(0, Math.max(0, at))].find((m) => !record[m.id] && !o.locks?.has(m.id));
}
