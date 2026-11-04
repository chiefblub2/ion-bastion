import type { Stars } from "../campaign/rating";
import { type CampaignRecord, mergeRecord, parseRecord, storedRecord } from "../campaign/record";
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
let cached: { raw: string | null; record: CampaignRecord } | undefined;
/** The stored record; parsed again only when the stored text changed, so the HUD can ask every refresh. */
export function campaignRecord(): CampaignRecord {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (cached?.raw !== raw) cached = { raw, record: parseRecord(raw) };
    return cached.record;
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
const SEEN_KEY = "ion-bastion:campaign-seen";
/**
 * Mission ids the atlas has already shown unlocked, so a fresh unlock plays its reveal once. Undefined before the first
 * visit (then nothing counts as fresh); purely cosmetic.
 */
export function seenUnlocks(): ReadonlySet<string> | undefined {
  try {
    const raw = localStorage.getItem(SEEN_KEY),
      data: unknown = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(data) ? new Set(data.filter((id): id is string => typeof id === "string")) : undefined;
  } catch {
    return undefined;
  }
}
export function rememberUnlocks(ids: Iterable<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Not remembered; the reveal simply plays again.
  }
}
