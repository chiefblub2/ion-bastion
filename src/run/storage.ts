import { missionById } from "../content/missions";
import type { ContentPack, TowerId } from "../core/types";
import { parseJournal, type Journal } from "./journal";
import { isMissionKind, missionsOf, type RunLength } from "./map";
import { isRelic } from "./relics";
import { newRun, runDepth, type RunPhase, type RunState } from "./run";
// The run in progress, its mission journal and the run record, kept between visits like the campaign record.
const RUN_KEY = "ion-bastion:run",
  JOURNAL_KEY = "ion-bastion:run-journal",
  RECORD_KEY = "ion-bastion:run-record";
const PHASES: readonly RunPhase[] = ["starter", "map", "mission", "reward", "camp", "act", "won", "lost"];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const int = (v: unknown) => Number.isInteger(v);
/**
 * A stored run, or undefined when it is missing, corrupt or names content this build does not have (an old run after
 * a tower or mission was removed); the player then simply starts a new one. A version 1 run (five missions, before
 * the acts) continues as a short run.
 */
export function parseRun(raw: string | null, content: ContentPack): RunState | undefined {
  try {
    const d: unknown = raw ? JSON.parse(raw) : undefined;
    if (!isObject(d) || !int(d.seed)) return undefined;
    const tower = (id: unknown): id is TowerId => typeof id === "string" && Object.hasOwn(content.towers, id),
      list = <T>(v: unknown, ok: (x: unknown) => x is T) => Array.isArray(v) && v.every(ok);
    if (d.v === 1) return migrate(d, content, tower);
    if (d.v !== 2 || !PHASES.includes(d.phase as RunPhase) || !["full", "short"].includes(d.length as string)) return undefined;
    if (![d.step, d.act, d.column, d.lane, d.threat, d.scrap, d.reactor, d.reactorMax, d.rerolls].every(int)) return undefined;
    if (!list(d.roster, tower) || !list(d.relics, isRelic) || !Array.isArray(d.log) || !Array.isArray(d.mods)) return undefined;
    if (!list(d.doctrines, (x): x is string => typeof x === "string" && tower(x.split(":")[0]))) return undefined;
    if (!isObject(d.ranks) || !Object.keys(d.ranks).every(tower)) return undefined;
    if (!(d.mods as unknown[]).every((m) => isObject(m) && tower(m.tower) && (m.kind === "drill" || m.kind === "discount"))) return undefined;
    if (d.loan !== undefined && !tower(d.loan)) return undefined;
    const node = d.node;
    if (node !== undefined && (!isObject(node) || (node.mission !== undefined && !missionById(String(node.mission), content.missions)))) return undefined;
    if (isObject(node) && isMissionKind(node.kind as never) && !node.mission) return undefined;
    const offers = isObject(d.offers) ? d.offers : {};
    if (offers.towers !== undefined && !list(offers.towers, tower)) return undefined;
    if (offers.starters !== undefined && !list(offers.starters, (p): p is TowerId[] => list(p, tower))) return undefined;
    for (const key of ["relics", "prize", "legendary"]) if (offers[key] !== undefined && !list(offers[key], isRelic)) return undefined;
    return { ...(d as unknown as RunState), offers: offers as RunState["offers"] };
  } catch {
    return undefined;
  }
}
/** A version 1 run continues as a short run with its roster and relics, at its number of cleared missions. */
function migrate(d: Record<string, unknown>, content: ContentPack, tower: (id: unknown) => id is TowerId): RunState | undefined {
  if (d.phase === "won" || d.phase === "lost" || !Array.isArray(d.roster) || !d.roster.every(tower)) return undefined;
  const fresh = newRun(d.seed as number, { length: "short" }, content);
  if (!d.roster.length) return fresh;
  const won = Array.isArray(d.history) ? d.history.filter((h) => isObject(h) && h.won).length : 0,
    cleared = Math.min(2, won);
  return {
    ...fresh,
    roster: d.roster as TowerId[],
    relics: (Array.isArray(d.relics) ? d.relics : []).filter(isRelic),
    phase: "map",
    step: cleared,
    column: cleared === 0 ? -1 : cleared === 1 ? 0 : 2,
    lane: 1,
    offers: {},
  };
}
export function loadRun(content: ContentPack): RunState | undefined {
  try {
    return parseRun(localStorage.getItem(RUN_KEY), content);
  } catch {
    return undefined;
  }
}
export function saveRun(run: RunState | undefined) {
  try {
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
    else localStorage.removeItem(RUN_KEY);
  } catch {
    // Not kept; the run lasts until the page reloads.
  }
}
export function loadJournal(): Journal | undefined {
  try {
    return parseJournal(localStorage.getItem(JOURNAL_KEY));
  } catch {
    return undefined;
  }
}
export function saveJournal(j: Journal | undefined) {
  try {
    if (j) localStorage.setItem(JOURNAL_KEY, JSON.stringify(j));
    else localStorage.removeItem(JOURNAL_KEY);
  } catch {
    // Not kept: the mission then cannot be resumed after a reload.
  }
}
/** One finished run, for the history list. */
export interface RunSummary {
  seed: number;
  length: RunLength;
  threat: number;
  daily?: string;
  /** Missions won. */
  depth: number;
  won: boolean;
}
/** Results over all runs. `best`/`wins` count full runs; `levels` per threat level; `daily` the depth per date. */
export interface RunRecord {
  v: 2;
  best: number;
  wins: number;
  runs: number;
  shortWins: number;
  levels: Record<number, { best: number; wins: number }>;
  history: RunSummary[];
  daily: Record<string, number>;
}
const EMPTY: RunRecord = { v: 2, best: 0, wins: 0, runs: 0, shortWins: 0, levels: {}, history: [], daily: {} };
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
export function parseRunRecord(raw: string | null): RunRecord {
  try {
    const d: unknown = raw ? JSON.parse(raw) : undefined;
    if (!isObject(d)) return EMPTY;
    // Version 1 counted five-mission runs: a completed one counts as a short win.
    if (d.v !== 2) return { ...EMPTY, runs: count(d.runs), shortWins: count(d.wins) };
    const levels: RunRecord["levels"] = {};
    if (isObject(d.levels)) for (const [k, v] of Object.entries(d.levels)) if (isObject(v)) levels[Number(k)] = { best: count(v.best), wins: count(v.wins) };
    const daily: RunRecord["daily"] = {};
    if (isObject(d.daily)) for (const [k, v] of Object.entries(d.daily)) daily[k] = count(v);
    return {
      v: 2,
      best: Math.min(missionsOf("full"), count(d.best)),
      wins: count(d.wins),
      runs: count(d.runs),
      shortWins: count(d.shortWins),
      levels,
      history: Array.isArray(d.history) ? (d.history.filter((h) => isObject(h) && int(h.seed)) as unknown as RunSummary[]).slice(0, 10) : [],
      daily,
    };
  } catch {
    return EMPTY;
  }
}
/** The record after a run ended. */
export function mergeRunRecord(r: RunRecord, run: RunState): RunRecord {
  const depth = runDepth(run),
    won = run.phase === "won",
    full = run.length === "full",
    level = r.levels[run.threat] ?? { best: 0, wins: 0 },
    summary: RunSummary = { seed: run.seed, length: run.length, threat: run.threat, daily: run.daily, depth, won };
  return {
    ...r,
    best: full ? Math.max(r.best, depth) : r.best,
    wins: r.wins + (full && won ? 1 : 0),
    runs: r.runs + 1,
    shortWins: r.shortWins + (!full && won ? 1 : 0),
    levels: full ? { ...r.levels, [run.threat]: { best: Math.max(level.best, depth), wins: level.wins + (won ? 1 : 0) } } : r.levels,
    history: [summary, ...r.history].slice(0, 10),
    daily: run.daily ? { ...r.daily, [run.daily]: Math.max(r.daily[run.daily] ?? 0, depth) } : r.daily,
  };
}
/** What the record unlocks: full runs and the daily after a first win, threat levels, starter packs. */
export function unlocks(r: RunRecord) {
  let threat = 0;
  while (threat < 10 && (r.levels[threat]?.wins ?? 0) > 0) threat++;
  return {
    full: r.shortWins + r.wins > 0,
    daily: r.shortWins + r.wins > 0,
    threat,
    packs: (threat > 2 ? 4 : 3) as 3 | 4,
    trapPack: threat > 4,
  };
}
export function runRecord(): RunRecord {
  try {
    return parseRunRecord(localStorage.getItem(RECORD_KEY));
  } catch {
    return EMPTY;
  }
}
export function recordRun(run: RunState) {
  const next = mergeRunRecord(runRecord(), run);
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(next));
  } catch {
    // Not kept.
  }
  return next;
}
/** A daily run's date already played. */
export const dailyPlayed = (r: RunRecord, date: string) => Object.hasOwn(r.daily, date);
/** Marks a daily date as attempted when its run starts, so a daily is played once. */
export function markDaily(date: string) {
  const r = runRecord();
  if (dailyPlayed(r, date)) return;
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify({ ...r, daily: { ...r.daily, [date]: 0 } }));
  } catch {
    // Not kept.
  }
}
