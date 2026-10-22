import { missionById } from "../content/missions";
import type { ContentPack, TowerId } from "../core/types";
import { isRelic } from "./relics";
import { RUN_LENGTH, type RouteNode, type RunPhase, type RunState } from "./run";
// The run in progress and the run record, kept between visits like the campaign record (app/progress.ts).
const RUN_KEY = "ion-bastion:run",
  RECORD_KEY = "ion-bastion:run-record";
const PHASES: readonly RunPhase[] = ["starter", "route", "mission", "reward", "won", "lost"];
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/**
 * A stored run, or undefined when it is missing, corrupt or names content this build does not have (an old run after
 * a tower or mission was removed); the player then simply starts a new one.
 */
export function parseRun(raw: string | null, content: ContentPack): RunState | undefined {
  try {
    const d: unknown = raw ? JSON.parse(raw) : undefined;
    if (!isObject(d) || d.v !== 1 || !Number.isInteger(d.seed) || !Number.isInteger(d.step)) return undefined;
    const step = d.step as number;
    if (step < 0 || step > RUN_LENGTH || !PHASES.includes(d.phase as RunPhase)) return undefined;
    const tower = (id: unknown): id is TowerId => typeof id === "string" && Object.hasOwn(content.towers, id),
      node = (n: unknown): n is RouteNode =>
        isObject(n) && typeof n.mission === "string" && !!missionById(n.mission, content.missions) && ["normal", "elite", "boss"].includes(n.kind as string),
      list = <T>(v: unknown, ok: (x: unknown) => x is T) => Array.isArray(v) && v.every(ok);
    const offers = isObject(d.offers) ? d.offers : {};
    if (!list(d.roster, tower) || !list(d.relics, isRelic) || !list(d.history, (h): h is unknown => node(h) && typeof (h as { won?: unknown }).won === "boolean"))
      return undefined;
    if (offers.starters !== undefined && !list(offers.starters, (p): p is TowerId[] => list(p, tower))) return undefined;
    if (offers.routes !== undefined && !list(offers.routes, node)) return undefined;
    if (offers.towers !== undefined && !list(offers.towers, tower)) return undefined;
    if (offers.relics !== undefined && !list(offers.relics, isRelic)) return undefined;
    if (d.node !== undefined && !node(d.node)) return undefined;
    return d as unknown as RunState;
  } catch {
    return undefined;
  }
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
/** Best result over all runs: the most missions won in one run, finished runs and runs played. */
export interface RunRecord {
  best: number;
  wins: number;
  runs: number;
}
const EMPTY: RunRecord = { best: 0, wins: 0, runs: 0 };
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
export function parseRunRecord(raw: string | null): RunRecord {
  try {
    const d: unknown = raw ? JSON.parse(raw) : undefined;
    return isObject(d) ? { best: Math.min(RUN_LENGTH, count(d.best)), wins: count(d.wins), runs: count(d.runs) } : EMPTY;
  } catch {
    return EMPTY;
  }
}
/** The record after a run ended with `depth` missions won. */
export const mergeRunRecord = (r: RunRecord, depth: number): RunRecord => ({
  best: Math.max(r.best, depth),
  wins: r.wins + (depth >= RUN_LENGTH ? 1 : 0),
  runs: r.runs + 1,
});
export function runRecord(): RunRecord {
  try {
    return parseRunRecord(localStorage.getItem(RECORD_KEY));
  } catch {
    return EMPTY;
  }
}
export function recordRun(depth: number) {
  const next = mergeRunRecord(runRecord(), depth);
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(next));
  } catch {
    // Not kept.
  }
  return next;
}
