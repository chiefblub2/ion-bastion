import { campaignLocks } from "../campaign/campaign-unlock";
import { fnv, stable } from "../core/hash";
import { dailyDate } from "../run/daily";
import { campaignRecord } from "./progress";
import { affordable, type Arsenal, type Bounty, campaignTowers, EMPTY_ARSENAL } from "../campaign/arsenal";
import { type ArsenalV1, migrateV1 } from "../campaign/migrate";
import type { CampaignRecord } from "../campaign/record";
import { CATALOGUE, CORE_KIT } from "../content/arsenal";
import { DEFAULT_CONTENT } from "../content/index";
import { missionById, MISSIONS } from "../content/missions";
import { availableTowers } from "../core/game";
import { hasStealth } from "../core/mission-checks";
import type { MissionSector, TowerId } from "../core/types";
// The campaign Arsenal in localStorage (`ion-bastion:arsenal`, `{ v: 2, salvage, researched, xp, gear, loadout,
// bounty }`); unknown tower ids and bad numbers are dropped. v1 data is migrated once with back pay
// (`campaign/migrate.ts`) and saved at once; data from a newer build is never overwritten.
const KEY = "ion-bastion:arsenal";
export const ARSENAL_VERSION = 2;
const isTower = (id: unknown): id is TowerId => typeof id === "string" && id in DEFAULT_CONTENT.towers;
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
function counts(raw: unknown): Partial<Record<TowerId, number>> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, v]) => isTower(id) && count(v) > 0).map(([id, v]) => [id, count(v)]));
}
const towers = (raw: unknown): TowerId[] => (Array.isArray(raw) ? [...new Set((raw as unknown[]).filter(isTower))] : []);
function bountyOf(raw: unknown): Bounty | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  return typeof b.day === "string" && typeof b.id === "string" ? { day: b.day, id: b.id, paid: b.paid === true } : null;
}
/** The fields every version shares (v1's whole shape). */
const v1Fields = (d: Record<string, unknown>): ArsenalV1 => ({ salvage: count(d.salvage), researched: towers(d.researched), xp: counts(d.xp), gear: counts(d.gear) });

export interface StoredArsenal {
  arsenal: Arsenal;
  /**
   * `empty`: nothing usable stored; `current`: this build's version; `migrated`: v1 data brought up to date (save it);
   * `newer`: written by a newer build, read as empty and never overwritten.
   */
  status: "empty" | "current" | "migrated" | "newer";
  /** Salvage the migration added. */
  backPay: number;
}
/** Parses the stored text; v1 is migrated against `record` (pure, so a failed save just repeats it). */
export function readArsenal(raw: string | null, record: CampaignRecord, sectors: readonly MissionSector[] = DEFAULT_CONTENT.sectors ?? []): StoredArsenal {
  const empty = (status: StoredArsenal["status"]): StoredArsenal => ({ arsenal: EMPTY_ARSENAL, status, backPay: 0 });
  try {
    const d: unknown = raw ? JSON.parse(raw) : undefined;
    if (!d || typeof d !== "object" || Array.isArray(d)) return empty("empty");
    const data = d as Record<string, unknown>,
      v = data.v;
    if (typeof v === "number" && v > ARSENAL_VERSION) return empty("newer");
    if (v === 1) {
      const { arsenal, backPay } = migrateV1(v1Fields(data), record, sectors);
      return { arsenal, status: "migrated", backPay };
    }
    if (v !== ARSENAL_VERSION) return empty("empty");
    return { arsenal: { ...v1Fields(data), loadout: towers(data.loadout), bounty: bountyOf(data.bounty) }, status: "current", backPay: 0 };
  } catch {
    return empty("empty");
  }
}
/** Parses stored text of this build's version (older data reads with an empty record, newer as empty). */
export const parseArsenal = (raw: string | null): Arsenal => readArsenal(raw, {}).arsenal;

function storedText(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
/** The stored version is newer than this build's: saving is refused so its data is kept. */
function blocked(raw = storedText()) {
  try {
    const v = raw ? (JSON.parse(raw) as { v?: unknown }).v : undefined;
    return typeof v === "number" && v > ARSENAL_VERSION;
  } catch {
    return false;
  }
}
/** The stored Arsenal; migrates v1 data and saves the result at once. */
export function loadArsenal(): Arsenal {
  const raw = storedText(),
    read = readArsenal(raw, raw ? campaignRecord() : {});
  if (read.status === "migrated") saveArsenal(read.arsenal);
  return read.arsenal;
}
/** Saves the Arsenal; false when storage failed or a newer build's data is stored (never overwritten). */
export function saveArsenal(a: Arsenal): boolean {
  if (blocked()) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: ARSENAL_VERSION, ...a }));
    return true;
  } catch {
    // Not saved; the next visit starts from the last stored arsenal.
    return false;
  }
}
/** Load, apply, save: the stored Arsenal after `fn`, or the loaded one unchanged when it could not be saved. */
export function updateArsenal(fn: (a: Arsenal) => Arsenal): Arsenal {
  const a = loadArsenal(),
    next = fn(a);
  if (next === a) return a;
  return saveArsenal(next) ? next : a;
}

/** Campaign missions only (no Circuit, Training or Run); undefined offers every tower. */
export function arsenalTowers(id: string, a = loadArsenal()): TowerId[] | undefined {
  const m = missionById(id);
  if (!m || m.circle || !MISSIONS.includes(m)) return undefined;
  return campaignTowers(availableTowers(m, DEFAULT_CONTENT), a, hasStealth(m));
}

/** The day's pick: one open campaign mission by date seed, or undefined when none is open. */
export function pickBounty(day: string, record: CampaignRecord): string | undefined {
  const sectors = DEFAULT_CONTENT.sectors ?? [],
    locks = campaignLocks(sectors, record),
    open = MISSIONS.filter((m) => !m.circle && !locks.has(m.id));
  return open.length ? open[fnv(stable(["bounty", day])) % open.length].id : undefined;
}
/**
 * Today's bounty (UTC day): picked once a day from the open campaign missions and stored, so it does not move when a
 * win opens or closes missions; it pays double waves and win once (`paid`).
 */
export function bountyToday(now = new Date(), record = campaignRecord()): Bounty | undefined {
  const day = dailyDate(now),
    stored = loadArsenal().bounty;
  if (stored?.day === day) return stored;
  const id = pickBounty(day, record);
  if (!id) return undefined;
  const bounty: Bounty = { day, id, paid: false };
  updateArsenal((a) => ({ ...a, bounty }));
  return bounty;
}
/** Today's bounty mission id (the Arsenal page's line). */
export const bountyMission = (now = new Date(), record = campaignRecord()): string | undefined => bountyToday(now, record)?.id;
/** Salvage on hand and how many research or forge purchases it covers now: the campaign's Arsenal buttons. */
export function arsenalSummary(a = loadArsenal()) {
  const ids = [...CORE_KIT, ...(Object.keys(CATALOGUE) as TowerId[])].filter(isTower),
    { research, forge } = affordable(a, ids);
  return { salvage: a.salvage, ready: research + forge };
}
