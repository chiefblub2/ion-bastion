import type { ContentPack, TowerId } from "../core/types";
import { threatRules } from "./ascension";
import { eventOf, pickEvent } from "./events";
import { runMission } from "./generate";
import { actsOf, isMissionKind, missionsOf, nextNodes, type MissionKind, type RunLength, type RunNode } from "./map";
import { rankOf } from "./ranks";
import { hasFlag, relicOf, type RelicId } from "./relics";
import { draw, streamOf } from "./rng";
import { withSteps } from "./rewards";
import { shopStock } from "./shop";
import {
  actMapOf,
  addTower,
  changeReactor,
  cursedRelic,
  doctrineCandidates,
  doctrinePaths,
  gainRelic,
  legendaryOffers,
  prizeOffers,
  relicOffers,
  removeTower,
  runDepth,
  towerOffers,
  type MissionLog,
  type RunOffers,
  type RunState,
} from "./state";
import { hazardPay, threatsOf } from "./threats";
import { FIELD_REPAIR, REINFORCE_NODE, REPAIR_NODE, RETIRE, REROLL, REROLL_STEP, SCRAP_BASE, SCRAP_FORMAT, SCRAP_STAR, SKIP_RELIC, SKIP_TOWER, XP_BUILT } from "./tuning";
export * from "./state";
/**
 * A Run: ten full-length missions in three acts and a Final Stand (a short run: act I only). The player starts with a
 * pack of three towers, walks each act's map (missions, camps, the act boss), drafts towers, relics and Doctrines, and
 * carries the reactor's damage from mission to mission. One lost mission ends the run. Every transition is pure.
 */
export { missionsOf, actsOf };
/** Starter packs: one tower that hits flyers, one with area damage (it also hits buried units) and one controller. */
const STARTERS: readonly (readonly TowerId[])[] = [
  ["pulse", "tesla", "lance", "shrapnel", "inferno"],
  ["blast", "mortar", "plasma"],
  ["frost", "acid", "stasis"],
];
/** The trap column a "trap pack" swaps in for the controller (threat 4 unlock). */
const TRAPS: readonly TowerId[] = ["spikes", "mine", "grill"];
export interface RunOptions {
  length?: RunLength;
  threat?: number;
  /** A daily run's UTC date. */
  daily?: string;
  /** Unlocks: a fourth starter pack, and a trap pack among them. */
  packs?: 3 | 4;
  trapPack?: boolean;
}
export function newRun(seed: number, options: RunOptions = {}, content?: ContentPack): RunState {
  const threat = options.threat ?? 0,
    rules = threatRules(threat),
    count = options.packs ?? 3,
    r = streamOf(seed, "starters"),
    columns = STARTERS.map((list) => draw(r, list, count)),
    traps = content ? TRAPS.filter((id) => content.towers[id]) : TRAPS,
    starters = Array.from({ length: count }, (_, i) => columns.map((c) => c[i % c.length]));
  if (options.trapPack && traps.length) starters[count - 1] = [starters[count - 1][0], starters[count - 1][1], draw(r, traps, 1)[0]];
  let run: RunState = {
    v: 2,
    seed,
    length: options.length ?? "full",
    threat,
    daily: options.daily,
    step: 0,
    act: 0,
    column: -1,
    lane: -1,
    phase: "starter",
    roster: [],
    relics: [],
    doctrines: [],
    ranks: {},
    mods: [],
    scrap: 0,
    reactor: rules.reactorMax,
    reactorMax: rules.reactorMax,
    rerolls: 0,
    offers: { starters },
    log: [],
  };
  if (rules.cursedStart) {
    const cursed = cursedRelic(run, "start", content);
    if (cursed) run = gainRelic(run, cursed);
  }
  return run;
}
export function chooseStarter(run: RunState, index: number): RunState {
  const pack = run.offers.starters?.[index];
  if (run.phase !== "starter" || !pack) return run;
  return { ...run, roster: [...pack], phase: "map", offers: {} };
}
/** The nodes the player may walk to next. */
export const mapChoices = (run: RunState, content: ContentPack) => (run.phase === "map" ? nextNodes(actMapOf(run, content), run.column, run.lane) : []);
/** Walks to a node: a mission waits for Deploy, a camp opens at once. */
export function chooseNode(run: RunState, lane: number, content: ContentPack): RunState {
  const node = mapChoices(run, content).find((n) => n.lane === lane);
  if (!node) return run;
  if (isMissionKind(node.kind)) return { ...run, phase: "mission", node, offers: {} };
  const at: RunState = { ...run, phase: "camp", node, column: node.column, lane: node.lane, rerolls: 0, offers: {} };
  const offers: RunOffers =
    node.kind === "shop" || node.kind === "forge"
      ? { shop: shopStock(at, content, node.kind === "forge") }
      : node.kind === "repair"
        ? { repair: true }
        : { event: pickEvent(at) };
  return { ...at, offers };
}
/** Marks the node's mission as started: from now on it can only be resumed, never restarted. */
export const deploy = (run: RunState): RunState => (run.phase === "mission" && run.node && !run.deployed ? { ...run, deployed: true } : run);
export interface MissionResult {
  won: boolean;
  /** Reactor energy left. */
  lives: number;
  /** Kills per tower type, from the towers standing at the end. */
  kills: Partial<Record<TowerId, number>>;
  /** Tower types built in the mission (standing at the end). */
  built: TowerId[];
  stars?: number;
  wave?: number;
}
/** Is this node the run's last mission? */
const isLast = (run: RunState, node: RunNode) => node.kind === "final" || (node.kind === "boss" && run.length === "short");
/** After a mission: a loss ends the run; a win carries the reactor, pays Scrap and rank XP, and opens the reward. */
export function finishMission(run: RunState, result: MissionResult, content: ContentPack): RunState {
  const node = run.node;
  if (run.phase !== "mission" || !node) return run;
  const kind = node.kind as MissionKind,
    entry: MissionLog = {
      mission: node.mission!,
      kind,
      act: node.act,
      won: result.won,
      stars: result.won ? result.stars : undefined,
      start: run.reactor,
      end: result.won ? result.lives : 0,
      kills: Object.values(result.kills).reduce((a, b) => a + (b ?? 0), 0),
      scrap: 0,
      wave: result.wave,
    };
  if (!result.won) return { ...run, phase: "lost", deployed: undefined, log: [...run.log, entry], offers: {} };
  // Scrap: base, stars, format and hazard pay for the threats the mission carried.
  const generated = runMission(run, node, content),
    hazard = hazardPay(threatsOf(generated.mission, generated.content, generated.mission.availableTowers ?? run.roster, generated.suppressed)),
    scrap = SCRAP_BASE + SCRAP_STAR * Math.max(0, (result.stars ?? 1) - 1) + SCRAP_FORMAT[kind] + hazard;
  // Rank XP: kills plus a bonus per type built; a loaned tower earns nothing for the roster.
  const factor = run.relics.reduce((f, id) => f * (relicOf(id).xp ?? 1), 1),
    ranks = { ...run.ranks },
    rankUps: TowerId[] = [];
  for (const id of run.roster) {
    const gain = ((result.kills[id] ?? 0) + (result.built.includes(id) ? XP_BUILT : 0)) * factor;
    if (!gain) continue;
    const before = rankOf(ranks[id]);
    ranks[id] = Math.round((ranks[id] ?? 0) + gain);
    if (rankOf(ranks[id]) > before) rankUps.push(id);
  }
  const repair = Math.round((FIELD_REPAIR + run.relics.reduce((n, id) => n + (relicOf(id).repair ?? 0), 0)) * threatRules(run.threat).repair);
  const done: RunState = {
    ...run,
    step: run.step + 1,
    column: node.column,
    lane: node.lane,
    reactor: Math.max(1, Math.min(run.reactorMax, result.lives + repair)),
    scrap: run.scrap + scrap,
    ranks,
    funds: undefined,
    loan: undefined,
    deployed: undefined,
    rerolls: 0,
    log: [...run.log, { ...entry, scrap }],
  };
  if (isLast(run, node)) return { ...done, phase: "won", offers: {} };
  const cleared = runDepth(done),
    offers: RunOffers = { towers: towerOffers(done, content, kind === "elite" ? 4 : 3, kind === "elite"), rankUps: rankUps.length ? rankUps : undefined };
  if (cleared % 2 === 0) offers.relics = relicOffers(done, 3, content);
  if (kind === "elite") offers.prize = prizeOffers(done, content);
  if (cleared === 2 && threatRules(run.threat).freeDoctrine && doctrineCandidates(done, content).length) offers.doctrine = true;
  return { ...done, phase: "reward", offers: withSteps(done, offers) };
}
const PICK_PHASES = new Set(["reward", "camp", "act"]);
/** Takes one of the offered towers; at the roster cap `replace` names the tower it replaces. `null` skips for Scrap. */
export function pickTower(run: RunState, id: TowerId | null, replace?: TowerId): RunState {
  const offers = run.offers.towers;
  if (!PICK_PHASES.has(run.phase) || !offers || (id !== null && !offers.includes(id))) return run;
  if (id === null) return { ...run, scrap: run.scrap + SKIP_TOWER, offers: { ...run.offers, towers: undefined } };
  const next = addTower(run, id, replace);
  return next === run ? run : { ...next, offers: { ...next.offers, towers: undefined } };
}
type RelicSlot = "relics" | "prize" | "legendary";
/** Takes a relic from one of the offers; `null` skips (the regular relic pays Scrap). A cursed prize pays 30 Scrap. */
export function pickRelic(run: RunState, slot: RelicSlot, id: RelicId | null): RunState {
  const offers = run.offers[slot];
  if (!PICK_PHASES.has(run.phase) || !offers || (id !== null && !offers.includes(id))) return run;
  const cleared: RunOffers = { ...run.offers, [slot]: undefined };
  // At an act transition the legendary relic and the Doctrine exclude each other, unless Master License grants both.
  if (slot === "legendary" && id && !hasFlag(run.relics, "master")) delete cleared.doctrine;
  if (id === null) return { ...run, scrap: run.scrap + (slot === "relics" ? SKIP_RELIC : 0), offers: cleared };
  const next = gainRelic(run, id);
  return { ...next, scrap: next.scrap + (slot === "prize" && relicOf(id).rarity === "cursed" ? 30 : 0), offers: cleared };
}
/** Commits a roster tower to one of its specialization paths for the rest of the run; `null` skips. */
export function pickDoctrine(run: RunState, tower: TowerId | null, path: string | undefined, content: ContentPack): RunState {
  if (!PICK_PHASES.has(run.phase) || !run.offers.doctrine) return run;
  const cleared: RunOffers = { ...run.offers, doctrine: undefined };
  if (run.phase === "act" && tower && !hasFlag(run.relics, "master")) delete cleared.legendary;
  if (tower === null) return { ...run, offers: cleared };
  if (!path || !doctrinePaths(run, tower, content).includes(path)) return run;
  return { ...run, doctrines: [...run.doctrines, `${tower}:${path}`], offers: cleared };
}
export const rerollPrice = (run: RunState) => REROLL + REROLL_STEP * run.rerolls;
/** Buys a fresh tower draft. */
export function reroll(run: RunState, content: ContentPack): RunState {
  const price = rerollPrice(run);
  if (!PICK_PHASES.has(run.phase) || !run.offers.towers || run.scrap < price) return run;
  const next = { ...run, rerolls: run.rerolls + 1, scrap: run.scrap - price };
  return { ...next, offers: { ...next.offers, towers: towerOffers(next, content, run.offers.towers.length, run.offers.towers.length > 3) } };
}
/** Sells a tower off the roster for Scrap (never the last one). */
export function retire(run: RunState, tower: TowerId): RunState {
  if (!PICK_PHASES.has(run.phase) || !run.roster.includes(tower) || run.roster.length <= 1) return run;
  return { ...removeTower(run, tower), scrap: run.scrap + RETIRE };
}
/** Picks still open in the current reward, camp or act screen. */
export const pendingPicks = (run: RunState) => !!(run.offers.towers || run.offers.relics || run.offers.prize || run.offers.legendary || run.offers.doctrine);
/** Leaves the reward: the next map choice, or after an act boss the act transition. Open picks are dropped. */
export function continueRun(run: RunState, content: ContentPack): RunState {
  if (run.phase === "reward") {
    if (run.node?.kind === "boss") {
      // The act transition: a full repair, then a legendary relic or a Doctrine.
      const act: RunState = { ...run, phase: "act", reactor: run.reactorMax, rerolls: 0, offers: {} };
      return { ...act, offers: withSteps(act, { legendary: legendaryOffers(act, 3, content), doctrine: doctrineCandidates(act, content).length ? true : undefined }) };
    }
    return { ...run, phase: "map", node: undefined, offers: {} };
  }
  if (run.phase === "act") return { ...run, phase: "map", act: run.act + 1, column: -1, lane: -1, node: undefined, offers: {} };
  if (run.phase === "camp") return { ...run, phase: "map", node: undefined, offers: {} };
  return run;
}
/** Repair node: heal the reactor, or reinforce it for good. */
export function repairChoice(run: RunState, choice: "heal" | "reinforce"): RunState {
  if (run.phase !== "camp" || !run.offers.repair) return run;
  const rules = threatRules(run.threat),
    zealot = hasFlag(run.relics, "zealot"),
    next =
      choice === "heal"
        ? zealot
          ? run
          : changeReactor(run, Math.round(REPAIR_NODE * rules.repair))
        : { ...run, reactorMax: run.reactorMax + REINFORCE_NODE, reactor: run.reactor + (zealot ? 0 : REINFORCE_NODE) };
  return { ...next, offers: { ...next.offers, repair: undefined } };
}
/** Event node: applies a choice; the camp stays open for picks the choice opened (a draft, a Doctrine). */
export function eventChoice(run: RunState, index: number, content: ContentPack): RunState {
  const event = run.phase === "camp" && run.offers.event ? eventOf(run.offers.event) : undefined,
    choice = event?.choices(run, content)[index];
  if (!choice || !choice.ok) return run;
  const next = choice.apply(run, content);
  return { ...next, offers: { ...next.offers, event: undefined } };
}
/** Ends the run where it stands (Abandon). */
export const abandon = (run: RunState): RunState => (run.phase === "won" || run.phase === "lost" ? run : { ...run, phase: "lost", deployed: undefined, offers: {} });
export { removeTower };
