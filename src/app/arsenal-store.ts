import { type Arsenal, campaignTowers, EMPTY_ARSENAL } from "../campaign/arsenal";
import { DEFAULT_CONTENT } from "../content/index";
import { missionById, MISSIONS } from "../content/missions";
import { availableTowers } from "../core/game";
import { hasStealth } from "../core/mission-checks";
import type { TowerId } from "../core/types";
// The campaign Arsenal in localStorage (`ion-bastion:arsenal`); unknown tower ids and bad numbers are dropped.
const KEY = "ion-bastion:arsenal";
const VERSION = 1;
const isTower = (id: unknown): id is TowerId => typeof id === "string" && id in DEFAULT_CONTENT.towers;
const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
function counts(raw: unknown): Partial<Record<TowerId, number>> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(Object.entries(raw).filter(([id, v]) => isTower(id) && count(v) > 0).map(([id, v]) => [id, count(v)]));
}
export function parseArsenal(raw: string | null): Arsenal {
  try {
    const d = raw ? JSON.parse(raw) : undefined;
    if (!d || d.v !== VERSION) return EMPTY_ARSENAL;
    return { salvage: count(d.salvage), researched: Array.isArray(d.researched) ? [...new Set((d.researched as unknown[]).filter(isTower))] : [], xp: counts(d.xp), gear: counts(d.gear) };
  } catch {
    return EMPTY_ARSENAL;
  }
}
export function loadArsenal(): Arsenal {
  try {
    return parseArsenal(localStorage.getItem(KEY));
  } catch {
    return EMPTY_ARSENAL;
  }
}
export function saveArsenal(a: Arsenal) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ...a }));
  } catch {
    // Not saved; the next visit starts from the last stored arsenal.
  }
}
/** Campaign missions only (no Circuit, Training or Run); undefined offers every tower. */
export function arsenalTowers(id: string, a = loadArsenal()): TowerId[] | undefined {
  const m = missionById(id);
  if (!m || m.circle || !MISSIONS.includes(m)) return undefined;
  return campaignTowers(availableTowers(m, DEFAULT_CONTENT), a, hasStealth(m));
}
