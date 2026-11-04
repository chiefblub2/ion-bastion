import type { Stars } from "./rating";
// The campaign record: best stars per won mission id, its stored form and how a win merges into it (storage in app/progress.ts).
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
