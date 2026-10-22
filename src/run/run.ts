import { isCircleSector } from "../content/missions";
import type { ContentPack, TowerId } from "../core/types";
import { pageOf } from "../ui/tower-pages";
import { RELIC_IDS, type RelicId } from "./relics";
import { draw, streamOf } from "./rng";
/**
 * A Run: `RUN_LENGTH` generated missions in a row. The player starts with a pack of three towers, picks every next
 * map from two route offers and drafts a tower (sometimes a relic too) after each win; a loss ends the run.
 * Everything here is pure: every offer is drawn from the seed and the step, so a run state always replays alike.
 */
export const RUN_LENGTH = 5;
export type NodeKind = "normal" | "elite" | "boss";
export interface RouteNode {
  /** The campaign mission whose map, credits and enemy pool the generated mission uses. */
  mission: string;
  kind: NodeKind;
}
export type RunPhase = "starter" | "route" | "mission" | "reward" | "won" | "lost";
export interface RunOffers {
  starters?: TowerId[][];
  routes?: RouteNode[];
  towers?: TowerId[];
  relics?: RelicId[];
}
export interface RunState {
  v: 1;
  seed: number;
  /** The mission being played or chosen next, 0-based. */
  step: number;
  phase: RunPhase;
  roster: TowerId[];
  relics: RelicId[];
  offers: RunOffers;
  /** The node being played (phase "mission") or just won (phase "reward"). */
  node?: RouteNode;
  history: { mission: string; kind: NodeKind; won: boolean }[];
}
/** Starter packs: one tower that hits flyers, one with area damage (it also hits buried units) and one controller. */
const STARTERS: readonly (readonly TowerId[])[] = [
  ["pulse", "tesla", "lance", "shrapnel", "inferno"],
  ["blast", "mortar", "plasma"],
  ["frost", "acid", "stasis"],
];
/** Draft weight per build-menu tab: Attack, Control, Traps, Support. */
const DRAFT_WEIGHT = [3, 2, 1.2, 1];
export const OFFERED_TOWERS = 3,
  OFFERED_RELICS = 3;
export function newRun(seed: number): RunState {
  const r = streamOf(seed, "starters"),
    columns = STARTERS.map((list) => draw(r, list, 3));
  return {
    v: 1,
    seed,
    step: 0,
    phase: "starter",
    roster: [],
    relics: [],
    offers: { starters: [0, 1, 2].map((i) => columns.map((c) => c[i])) },
    history: [],
  };
}
/** The campaign missions in order; a Run never visits the Circuit. */
const campaignMissions = (content: ContentPack) => (content.sectors ?? []).filter((s) => !isCircleSector(s)).flatMap((s) => s.missions);
/**
 * Overlapping windows over the campaign, as shares of its length: the first mission comes from the opening sector,
 * the boss node from the last sectors.
 */
const BANDS: readonly (readonly [number, number])[] = [[0, 0.12], [0.08, 0.3], [0.25, 0.53], [0.47, 0.77], [0.7, 1]];
/** Two maps from the band of the step, never one already played; the last step offers two boss nodes. */
export function routeOffers(run: RunState, content: ContentPack): RouteNode[] {
  const missions = campaignMissions(content),
    [lo, hi] = BANDS[Math.min(run.step, BANDS.length - 1)],
    played = new Set(run.history.map((h) => h.mission)),
    candidates = missions.slice(Math.floor(lo * missions.length), Math.max(2, Math.ceil(hi * missions.length))).filter((m) => !played.has(m.id)),
    r = streamOf(run.seed, "routes", run.step),
    picks = draw(r, candidates, 2);
  if (run.step === RUN_LENGTH - 1) return picks.map((m) => ({ mission: m.id, kind: "boss" }));
  // The first offer is always a normal node; the second is an elite (tougher, but pays a relic) half of the time.
  return picks.map((m, i) => ({ mission: m.id, kind: i === 1 && r() < 0.5 ? "elite" : "normal" }));
}
export function chooseStarter(run: RunState, index: number, content: ContentPack): RunState {
  const pack = run.offers.starters?.[index];
  if (run.phase !== "starter" || !pack) return run;
  const next: RunState = { ...run, roster: [...pack], phase: "route", offers: {} };
  return { ...next, offers: { routes: routeOffers(next, content) } };
}
export function chooseRoute(run: RunState, index: number): RunState {
  const node = run.offers.routes?.[index];
  if (run.phase !== "route" || !node) return run;
  return { ...run, phase: "mission", node, offers: {} };
}
/** Three towers outside the roster, drawn by tab weight. */
export function towerOffers(run: RunState, content: ContentPack): TowerId[] {
  const left = (Object.keys(content.towers) as TowerId[]).filter((id) => !run.roster.includes(id));
  return draw(streamOf(run.seed, "towers", run.step), left, OFFERED_TOWERS, (id) => DRAFT_WEIGHT[pageOf(content.towers[id])]);
}
export const relicOffers = (run: RunState): RelicId[] =>
  draw(streamOf(run.seed, "relics", run.step), RELIC_IDS.filter((id) => !run.relics.includes(id)), OFFERED_RELICS);
/** After an elite node and after every second mission the reward includes a relic. */
export const paysRelic = (run: RunState) => run.node?.kind === "elite" || run.step % 2 === 1;
/** The end of the node's mission: a loss ends the run, the last win completes it, any other win opens the reward. */
export function finishMission(run: RunState, won: boolean, content: ContentPack): RunState {
  if (run.phase !== "mission" || !run.node) return run;
  const history = [...run.history, { mission: run.node.mission, kind: run.node.kind, won }];
  if (!won) return { ...run, phase: "lost", history };
  if (run.step === RUN_LENGTH - 1) return { ...run, phase: "won", history, step: RUN_LENGTH };
  const done: RunState = { ...run, history };
  return {
    ...done,
    phase: "reward",
    offers: { towers: towerOffers(done, content), relics: paysRelic(done) ? relicOffers(done) : undefined },
  };
}
/** Once both picks are made (or skipped), the run moves on to the next route choice. */
function settleReward(run: RunState, content: ContentPack): RunState {
  if (run.offers.towers || run.offers.relics) return run;
  const next: RunState = { ...run, step: run.step + 1, phase: "route", node: undefined };
  return { ...next, offers: { routes: routeOffers(next, content) } };
}
/** Takes one of the offered towers into the roster; `null` skips the draft. */
export function pickTower(run: RunState, id: TowerId | null, content: ContentPack): RunState {
  if (run.phase !== "reward" || !run.offers.towers || (id !== null && !run.offers.towers.includes(id))) return run;
  const roster = id ? [...run.roster, id] : run.roster;
  return settleReward({ ...run, roster, offers: { ...run.offers, towers: undefined } }, content);
}
export function pickRelic(run: RunState, id: RelicId | null, content: ContentPack): RunState {
  if (run.phase !== "reward" || !run.offers.relics || (id !== null && !run.offers.relics.includes(id))) return run;
  const relics = id ? [...run.relics, id] : run.relics;
  return settleReward({ ...run, relics, offers: { ...run.offers, relics: undefined } }, content);
}
/** Missions won so far. */
export const runDepth = (run: RunState) => run.history.filter((h) => h.won).length;
