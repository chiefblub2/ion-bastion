import { campaignLocks } from "../campaign/campaign-unlock";
import { fnv, stable } from "../core/hash";
import { dailyDate } from "../run/daily";
import { campaignRecord } from "./progress";
import { type Arsenal, campaignTowers, EMPTY_ARSENAL, salvageOf, settle, veterancy } from "../campaign/arsenal";
import { XP_BUILT } from "../content/arsenal";
import { assistsOf } from "../run/xp";
import { DEFAULT_CONTENT } from "../content/index";
import { missionById, MISSIONS } from "../content/missions";
import { availableTowers, type Game } from "../core/game";
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

/** Tower XP of one play: kills, `XP_BUILT` per tower built and Run-style assists, per type. */
export function playXp(game: Game): Partial<Record<TowerId, number>> {
  const xp: Partial<Record<TowerId, number>> = { ...assistsOf(game.state, game.mission, game.content) };
  for (const t of game.state.towers) xp[t.type] = (xp[t.type] ?? 0) + t.kills + XP_BUILT;
  return xp;
}
/** Pays a finished campaign mission into the stored arsenal; returns the overlay line. */
export function settleCampaign(game: Game, won: boolean, firstWin: boolean): string {
  const sectors = game.content.sectors ?? [],
    sector = sectors.findIndex((s) => s.missions.includes(game.mission)) + 1,
    waves = won ? game.waves.length : game.state.wave,
    salvage = salvageOf({ won, waves, sector: Math.max(1, sector), firstWin, bounty: bountyMission() === game.mission.id }),
    before = loadArsenal(),
    after = settle(before, salvage, playXp(game));
  saveArsenal(after);
  const ranks = (Object.keys(after.xp) as TowerId[]).filter((id) => veterancy(after.xp[id]) > veterancy(before.xp[id]));
  const names = ranks.map((id) => `${game.content.towers[id].name} ${veterancy(after.xp[id])}`);
  return `+${salvage} Salvage${names.length ? ` · Rank up: ${names.join(", ")}` : ""}`;
}

/** Today's bounty: one open campaign mission per UTC day (date seed), paying double Salvage. */
export function bountyMission(now = new Date(), record = campaignRecord()): string | undefined {
  const sectors = DEFAULT_CONTENT.sectors ?? [],
    locks = campaignLocks(sectors, record),
    open = MISSIONS.filter((m) => !m.circle && !locks.has(m.id));
  return open.length ? open[fnv(stable(["bounty", dailyDate(now)])) % open.length].id : undefined;
}
