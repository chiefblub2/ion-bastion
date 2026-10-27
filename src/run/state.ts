import type { ContentPack, TowerId } from "../core/types";
import { pageOf } from "../ui/tower-pages";
import { actTiers } from "./acts";
import { threatRules } from "./ascension";
import { actMap, type MissionKind, type RunLength, type RunNode } from "./map";
import { rankOf } from "./ranks";
import { relicFit, usable } from "./relic-fit";
import { hasFlag, relicOf, relicsOf, signatureOf, type Rarity, type RelicId } from "./relics";
import { draw, streamOf, type Rng } from "./rng";
import { sharedTags } from "./tags";
import { needsOf, rosterCovers, type Need } from "./threats";
import { pathsOf } from "./transform";
import { ROSTER_CAP } from "./tuning";
/**
 * The state of a run and the helpers every transition shares. Everything is pure: every offer is drawn from the seed
 * and the run's position, so a stored run always replays alike.
 */
export interface RunMod {
  tower: TowerId;
  /** `drill`: the tower's level 2 costs 1 credit; `discount`: the tower costs 25% less. */
  kind: "drill" | "discount";
}
export type ShopKind = "patch" | "funds" | "drill" | "discount" | "relic" | "tower" | "doctrine" | "xp";
export interface ShopItem {
  kind: ShopKind;
  price: number;
  relic?: RelicId;
  tower?: TowerId;
  sold?: true;
}
export type RunPhase = "starter" | "map" | "mission" | "reward" | "camp" | "act" | "won" | "lost";
export interface RunOffers {
  starters?: TowerId[][];
  /** A tower draft (after a win, or from an event). */
  towers?: TowerId[];
  /** The regular relic, after every second mission. */
  relics?: RelicId[];
  /** The elite prize: rare and legendary relics, and a cursed one that pays Scrap. */
  prize?: RelicId[];
  /** Act transition: a legendary relic (or a Doctrine instead, unless Master License grants both). */
  legendary?: RelicId[];
  /** A Doctrine pick is pending. */
  doctrine?: true;
  shop?: ShopItem[];
  event?: string;
  repair?: true;
  /** Decisions the reward opened with (`run/rewards.ts`), for its "Reward 2 of 3"; absent with a single one. */
  steps?: number;
  /** Tower types that ranked up with the last mission (shown once). */
  rankUps?: TowerId[];
}
export interface MissionLog {
  mission: string;
  kind: MissionKind;
  act: number;
  won: boolean;
  stars?: number;
  /** Reactor energy at the start and the end of the mission. */
  start: number;
  end: number;
  kills: number;
  scrap: number;
  /** The wave the mission ended on. */
  wave?: number;
}
export interface RunState {
  v: 2;
  seed: number;
  length: RunLength;
  threat: number;
  /** A daily run: the UTC date it belongs to. */
  daily?: string;
  /** Missions played; keys the per-mission streams. */
  step: number;
  /** The act being played: 0–2, 3 for the Final Stand. */
  act: number;
  /** Position on the act's map; column -1 is the start of the act. */
  column: number;
  lane: number;
  phase: RunPhase;
  roster: TowerId[];
  relics: RelicId[];
  /** `<tower>:<path>`: specialization paths this run unlocked. */
  doctrines: string[];
  /** Rank XP per tower type. */
  ranks: Partial<Record<TowerId, number>>;
  mods: RunMod[];
  scrap: number;
  reactor: number;
  reactorMax: number;
  /** Extra starting credits for the next mission only (Field Funds). */
  funds?: number;
  /** A tower lent for the next mission only (Mercenary crew). */
  loan?: TowerId;
  /** Draft rerolls bought in the current reward. */
  rerolls: number;
  offers: RunOffers;
  /** The node being played, or the camp being visited. */
  node?: RunNode;
  /** The node's mission was started; it can only be resumed now. */
  deployed?: true;
  log: MissionLog[];
}
export const runDepth = (run: RunState) => run.log.filter((h) => h.won).length;
export const actMapOf = (run: RunState, content: ContentPack) => actMap(run.seed, run.act, content, run.threat, run.length);
export const priceOf = (run: RunState, base: number) => Math.round(base * threatRules(run.threat).prices);
export const rosterCap = (run: RunState) => ROSTER_CAP[Math.min(run.act, ROSTER_CAP.length - 1)] + run.relics.reduce((n, id) => n + (relicOf(id).cap ?? 0), 0);
/** Takes a relic: its one-off reactor change applies at once. */
export function gainRelic(run: RunState, id: RelicId): RunState {
  if (run.relics.includes(id)) return run;
  const r = relicOf(id).reactor;
  let { reactor, reactorMax } = run;
  if (r?.add) {
    reactorMax += r.add;
    reactor += r.add;
  }
  if (r?.factor) {
    reactorMax = Math.max(5, Math.round(reactorMax * r.factor));
    reactor = Math.min(reactor, reactorMax);
  }
  return { ...run, relics: [...run.relics, id], reactor, reactorMax };
}
/** Drops a tower from the roster with everything the run held for it. */
export function removeTower(run: RunState, id: TowerId): RunState {
  const ranks = { ...run.ranks };
  delete ranks[id];
  return {
    ...run,
    roster: run.roster.filter((t) => t !== id),
    doctrines: run.doctrines.filter((d) => !d.startsWith(`${id}:`)),
    mods: run.mods.filter((m) => m.tower !== id),
    ranks,
  };
}
/** Adds a tower; at the cap `replace` names the one it replaces, otherwise the run stays unchanged. */
export function addTower(run: RunState, id: TowerId, replace?: TowerId): RunState {
  if (run.roster.includes(id)) return run;
  if (run.roster.length >= rosterCap(run)) {
    if (!replace || !run.roster.includes(replace)) return run;
    run = removeTower(run, replace);
  }
  return { ...run, roster: [...run.roster, id] };
}
export const changeReactor = (run: RunState, delta: number): RunState => ({ ...run, reactor: Math.max(1, Math.min(run.reactorMax, run.reactor + delta)) });
/** Doctrines a tower type may still take: its specialization paths not yet held, while it holds fewer than its limit. */
export function doctrinePaths(run: RunState, id: TowerId, content: ContentPack): string[] {
  const held = run.doctrines.filter((d) => d.startsWith(`${id}:`)),
    limit = hasFlag(run.relics, "second") ? 2 : 1;
  if (held.length >= limit) return [];
  return pathsOf(content.towers[id]).filter((p) => !held.includes(`${id}:${p}`));
}
export const doctrineCandidates = (run: RunState, content: ContentPack) => run.roster.filter((id) => doctrinePaths(run, id, content).length > 0);
/** The roster tower with the most rank XP (the first one on a tie). */
export const bestTower = (run: RunState) => [...run.roster].sort((a, b) => (run.ranks[b] ?? 0) - (run.ranks[a] ?? 0))[0];
// ── Draft ──
/** Draft weight per build-menu tab: Attack, Control, Traps, Support. */
const TAB_WEIGHT = [3, 2, 1.2, 1];
export type TowerRarity = "common" | "rare" | "epic";
/** Rarity by cost within the tab: the cheapest half common, the next 35% rare, the dearest 15% epic. */
export function towerRarity(id: TowerId, content: ContentPack): TowerRarity {
  const t = content.towers[id],
    tab = Object.values(content.towers)
      .filter((o) => pageOf(o) === pageOf(t))
      .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id)),
    at = tab.findIndex((o) => o.id === id) / Math.max(1, tab.length);
  return at < 0.5 ? "common" : at < 0.85 ? "rare" : "epic";
}
const RARITY_ODDS: readonly (readonly number[])[] = [
  [70, 25, 5],
  [55, 33, 12],
  [40, 40, 20],
];
const RARITIES: readonly TowerRarity[] = ["common", "rare", "epic"];
function rollRarity(r: Rng, act: number, floor = 0): TowerRarity {
  const odds = RARITY_ODDS[Math.min(act, RARITY_ODDS.length - 1)].map((v, i) => (i < floor ? 0 : v)),
    total = odds.reduce((a, b) => a + b, 0);
  let roll = r() * total;
  for (let i = 0; i < odds.length; i++) if ((roll -= odds[i]) < 0) return RARITIES[i];
  return "epic";
}
/** Needs the rest of the act (and, near its end, the next act) will bring that the roster cannot answer yet. */
export function missingCounters(run: RunState, content: ContentPack): Need[] {
  const covers = rosterCovers(run.roster, content),
    nodes: RunNode[] = actMapOf(run, content)
      .slice(run.column + 1)
      .flat();
  if (run.column >= 2 && run.act + 1 < (run.length === "short" ? 1 : 4))
    nodes.push(...actMap(run.seed, run.act + 1, content, run.threat, run.length).flat());
  const missing = new Set<Need>();
  for (const node of nodes) {
    const source = node.mission && content.missions.find((m) => m.id === node.mission);
    if (!source) continue;
    const allowed = node.act === 0 ? ["air", "under"] : ["air", "under", "detect"];
    for (const w of source.waves)
      for (const group of w.groups)
        for (const need of needsOf(content.enemies[group.type])) if (allowed.includes(need) && !covers[need]) missing.add(need);
  }
  return [...missing];
}
/** Towers that answer a need. */
function answersNeed(id: TowerId, need: Need, content: ContentPack) {
  return rosterCovers([id], content)[need];
}
/**
 * A tower draft: `count` towers outside the roster, each of a rarity rolled by the act's odds and drawn by tab weight
 * times its synergy with the roster (1 + 0.5 per shared tag, at most ×2). If the coming nodes bring a threat the roster
 * cannot answer, the first card answers it. `rareFloor` lifts the last card to rare or better (the elite's fourth card).
 */
export function towerOffers(run: RunState, content: ContentPack, count = 3, rareFloor = false, key: unknown = run.rerolls): TowerId[] {
  const r = streamOf(run.seed, "towers", run.step, run.act, run.column, key),
    left = (Object.keys(content.towers) as TowerId[]).filter((id) => !run.roster.includes(id)),
    weight = (id: TowerId) => TAB_WEIGHT[pageOf(content.towers[id])] * Math.min(2, 1 + 0.5 * sharedTags(id, run.roster, content).length),
    out: TowerId[] = [];
  const need = missingCounters(run, content)[0];
  if (need) {
    const counters = left.filter((id) => answersNeed(id, need, content));
    out.push(...draw(r, counters, 1, weight));
  }
  while (out.length < count) {
    const rarity = rollRarity(r, run.act, rareFloor && out.length === count - 1 ? 1 : 0),
      pool = left.filter((id) => !out.includes(id) && towerRarity(id, content) === rarity),
      picks = draw(r, pool.length ? pool : left.filter((id) => !out.includes(id)), 1, weight);
    if (!picks.length) break;
    out.push(picks[0]);
  }
  return out;
}
// ── Relics ──
const RELIC_ODDS: readonly (readonly number[])[] = [
  [80, 20],
  [60, 40],
  [40, 60],
];
/** Relics of a rarity the run does not hold yet and that can still pay off (`relic-fit.ts`). */
const fresh = (run: RunState, rarity: Rarity, content?: ContentPack) => relicsOf(rarity).filter((id) => usable(run, id, content));
/**
 * The regular relic offer: common and rare by the act's odds, never one the run cannot use. With a content pack and
 * at least two cards, one card fits the roster: if none of the drawn ones is a fitting synergy relic, the last card is
 * swapped for one (from a stream of its own, so the other cards stay as the seed drew them).
 */
export function relicOffers(run: RunState, count = 3, content?: ContentPack): RelicId[] {
  const r = streamOf(run.seed, "relics", run.step),
    [common] = RELIC_ODDS[Math.min(run.act, RELIC_ODDS.length - 1)],
    out: RelicId[] = [];
  while (out.length < count) {
    const rarity: Rarity = r() * 100 < common ? "common" : "rare",
      pool = fresh(run, rarity, content).filter((id) => !out.includes(id)),
      any = [...fresh(run, "common", content), ...fresh(run, "rare", content)].filter((id) => !out.includes(id)),
      picks = draw(r, pool.length ? pool : any, 1);
    if (!picks.length) break;
    out.push(picks[0]);
  }
  if (!content || out.length < 2 || out.some((id) => relicFit(run, id, content).synergy)) return out;
  const fitting = [...fresh(run, "common", content), ...fresh(run, "rare", content)].filter((id) => !out.includes(id) && relicFit(run, id, content).synergy),
    swap = draw(streamOf(run.seed, "relics-fit", run.step), fitting, 1)[0];
  return swap ? [...out.slice(0, -1), swap] : out;
}
/** The elite prize: two rare-or-legendary relics and a cursed one (which pays Scrap). */
export function prizeOffers(run: RunState, content?: ContentPack): RelicId[] {
  const r = streamOf(run.seed, "elite-relics", run.step),
    good = draw(r, [...fresh(run, "rare", content), ...fresh(run, "rare", content), ...fresh(run, "legendary", content)].filter((id, i, all) => all.indexOf(id) === i), 2),
    cursed = draw(r, fresh(run, "cursed", content), 1);
  return [...good, ...cursed];
}
export const legendaryOffers = (run: RunState, count = 3, content?: ContentPack): RelicId[] => draw(streamOf(run.seed, "legendary", run.act), fresh(run, "legendary", content), count);
/**
 * The signature relic of the boss just beaten (the first of its modifiers that has one), when it can still pay off
 * and fits the roster; a modifier's technology the roster cannot use is not offered.
 */
export function signatureOffer(run: RunState, content: ContentPack): RelicId | undefined {
  for (const mod of run.node?.mods ?? []) {
    const id = signatureOf(mod);
    if (id && usable(run, id, content) && relicFit(run, id, content).fits) return id;
  }
  return undefined;
}
/** The act transition's relics: the boss's signature relic and two legendary ones, or three legendary ones. */
export function actRelicOffers(run: RunState, content: ContentPack): RelicId[] {
  const legendary = legendaryOffers(run, 3, content),
    signature = signatureOffer(run, content);
  return signature ? [signature, ...legendary.slice(0, 2)] : legendary;
}
export const cursedRelic = (run: RunState, key: unknown, content?: ContentPack): RelicId | undefined => draw(streamOf(run.seed, "cursed", key), fresh(run, "cursed", content), 1)[0];
/** A random roster-free tower of a rarity (events and the shop). */
export function randomTower(run: RunState, content: ContentPack, rarity: TowerRarity, key: unknown): TowerId | undefined {
  const left = (Object.keys(content.towers) as TowerId[]).filter((id) => !run.roster.includes(id) && towerRarity(id, content) === rarity);
  return draw(streamOf(run.seed, "tower-pick", key), left, 1)[0];
}
export const isBossNode = (n?: RunNode) => n?.kind === "boss" || n?.kind === "final";
/** The act's name: its planet, or the Final Stand. */
export const actName = (run: Pick<RunState, "act">, content: ContentPack) => actTiers(content)[Math.min(run.act, 3)].name;
export const rankOfTower = (run: RunState, id: TowerId) => Math.max(rankOf(run.ranks[id]), hasFlag(run.relics, "veteran") ? 1 : 0);
