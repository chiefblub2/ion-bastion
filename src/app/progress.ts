import type { Stars } from "./rating";
// What the browser keeps between visits: the last started mission (for "Continue"), Training and the campaign record.
const KEY = "ion-bastion:last-mission";
/** Storage can be missing or throw (private mode, blocked site data); then there is simply no last mission. */
export function lastMission(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
export function rememberMission(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered; the menu then offers no "Continue".
  }
}
const TRAINING_KEY = "ion-bastion:training-done";
/** Won Training once; until then the home page emphasises it. */
export function trainingDone(): boolean {
  try {
    return localStorage.getItem(TRAINING_KEY) === "1";
  } catch {
    return false;
  }
}
export function markTrainingDone() {
  try {
    localStorage.setItem(TRAINING_KEY, "1");
  } catch {
    // Not remembered; the button simply stays emphasised.
  }
}
const CAMPAIGN_KEY = "ion-bastion:campaign";
/** Best stars per won mission id. */
export type CampaignRecord = Readonly<Record<string, Stars>>;
const isStars = (v: unknown): v is Stars => v === 1 || v === 2 || v === 3;
/** Version of the stored record: `{ v, stars }`. Older builds stored the bare star map, which still reads. */
const RECORD_VERSION = 1;
/** Parses a stored record, dropping anything that is not a star count; corrupt JSON is an empty record. */
export function parseRecord(raw: string | null): CampaignRecord {
  try {
    let data: unknown = raw ? JSON.parse(raw) : {};
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    if ("v" in data) data = (data as { stars?: unknown }).stars;
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([, v]) => isStars(v))) as CampaignRecord;
  } catch {
    return {};
  }
}
/** The stored form of a record. */
export const storedRecord = (record: CampaignRecord) => JSON.stringify({ v: RECORD_VERSION, stars: record });
/** The record with a win added; keeps the better of the old and new stars. */
export const mergeRecord = (record: CampaignRecord, id: string, stars: Stars): CampaignRecord =>
  (record[id] ?? 0) >= stars ? record : { ...record, [id]: stars };
export function campaignRecord(): CampaignRecord {
  try {
    return parseRecord(localStorage.getItem(CAMPAIGN_KEY));
  } catch {
    return {};
  }
}
/** Records a win; true when it beats the stored result (a first win included). */
export function recordWin(id: string, stars: Stars): boolean {
  const before = campaignRecord(),
    after = mergeRecord(before, id, stars);
  if (after === before) return false;
  try {
    localStorage.setItem(CAMPAIGN_KEY, storedRecord(after));
  } catch {
    // Not remembered; the atlas simply shows the mission as not cleared.
  }
  return true;
}
