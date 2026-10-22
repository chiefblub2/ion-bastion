import { missionById } from "../content/missions";
import { g } from "../content/waves";
import { waveHpScale } from "../systems/spawn";
import type { ContentPack, EnemyDefinition, EnemyId, MissionDefinition, TowerId, WaveDefinition, WaveGroup } from "../core/types";
import { isSupport } from "../systems/attacks";
import { applyRelics } from "./relics";
import { draw, streamOf, type Rng } from "./rng";
import type { RouteNode, RunState } from "./run";
import { runMissionId } from "./run-id";
/** Waves per generated mission; the boss node plays a longer one. */
export const RUN_WAVES = 12,
  BOSS_WAVES = 14;
/** HP factor per run step on top of the source mission's own curve; the roster is smaller than in the campaign. */
export const DEPTH_HP = [0.65, 0.65, 0.72, 0.78, 0.85] as const;
export const ELITE_HP = 1.15;
/** Fallback when no enemy of the source mission fits the roster. */
const BASIC: readonly EnemyId[] = ["drone", "runner", "tank"];
/** Attack kinds that hit buried units: area damage, besides the traps. */
const AREA_KINDS: ReadonlySet<string> = new Set(["splash", "mortar", "quake", "pool", "strike"]);
const MAX_GROUP = 40;
type Need = "air" | "detect" | "under";
function needsOf(e: Readonly<EnemyDefinition>): Need[] {
  const kinds = new Set((e.traits ?? []).map((t) => t.kind)),
    needs: Need[] = [];
  if (e.layer === "air" || kinds.has("leap") || kinds.has("phase")) needs.push("air");
  if (kinds.has("stealth") || kinds.has("cloakField")) needs.push("detect");
  if (kinds.has("burrow") || kinds.has("tunnel")) needs.push("under");
  return needs;
}
/** What a roster can answer: flyers, stealth (a Detector) and buried units (traps or area damage). */
export function rosterCovers(roster: readonly TowerId[], content: ContentPack): Record<Need, boolean> {
  const towers = roster.map((id) => content.towers[id]);
  return {
    air: towers.some((t) => !isSupport(t.attack) && t.targets.includes("air")),
    detect: towers.some((t) => t.attack.kind === "detect"),
    under: towers.some((t) => t.placement === "path" || AREA_KINDS.has(t.attack.kind)),
  };
}
/** Enemy types a split or a brood adds; they must be answerable too. */
function offspring(e: Readonly<EnemyDefinition>): EnemyId[] {
  return (e.traits ?? []).flatMap((t) => ("type" in t && typeof t.type === "string" ? [t.type as EnemyId] : []));
}
/**
 * The enemy types of the source mission that the roster can fight, weighted by how often the source mission sends
 * them. The Titan stays out: boss waves place it on their own.
 */
export function enemyPool(source: MissionDefinition, roster: readonly TowerId[], content: ContentPack): Map<EnemyId, number> {
  const covers = rosterCovers(roster, content),
    fits = (id: EnemyId, seen = new Set<EnemyId>()): boolean => {
      if (seen.has(id)) return true;
      seen.add(id);
      const e = content.enemies[id];
      return needsOf(e).every((n) => covers[n]) && offspring(e).every((o) => fits(o, seen));
    },
    pool = new Map<EnemyId, number>();
  for (const w of source.waves)
    for (const group of w.groups)
      if (group.type !== "boss" && fits(group.type)) pool.set(group.type, (pool.get(group.type) ?? 0) + group.count);
  if (!pool.size) for (const id of BASIC) pool.set(id, 1);
  return pool;
}
const tenth = (v: number) => Math.round(v * 10) / 10;
/** Share of the source groups whose enemy type is swapped even though the roster could fight it. */
const SWAP = 0.6;
/**
 * One generated wave, remixed from the source wave: every group keeps its layer, its budget (count × HP × √speed) and
 * its spawn span, but its type may be swapped for another of the pool, so the air share and the density stay those of
 * the source mission. A type the roster cannot fight is always swapped; the Titans stay as they are.
 */
function remixWave(r: Rng, source: WaveDefinition, pool: Map<EnemyId, number>, content: ContentPack): WaveGroup[] {
  const types = [...pool.keys()],
    layerOf = (id: EnemyId) => content.enemies[id].layer,
    // Fast units are worth more than their HP: a swapped group keeps its HP × √speed, not its bare HP.
    cost = (id: EnemyId) => content.enemies[id].hp * Math.sqrt(content.enemies[id].speed);
  return source.groups.map((group) => {
    if (group.type === "boss" || (pool.has(group.type) && r() >= SWAP)) return group;
    const same = types.filter((id) => layerOf(id) === layerOf(group.type)),
      type = draw(r, same.length ? same : types, 1, (id) => Math.sqrt(pool.get(id)!))[0],
      count = Math.min(MAX_GROUP, Math.max(1, Math.round((group.count * cost(group.type)) / cost(type)))),
      span = (group.count - 1) * group.interval,
      interval = count > 1 ? Math.min(3, Math.max(0.22, span / (count - 1))) : group.interval;
    return g(type, count, Math.round(interval * 100) / 100, tenth(group.delay + (r() - 0.5) * 2));
  }).map((x) => (x.delay < 0 ? { ...x, delay: 0 } : x));
}
/**
 * The mission of the run's current node: the source mission's map, starting credits and reactor, with waves
 * generated from its enemy pool and HP curve (resampled to `RUN_WAVES`), the roster as its only towers and the
 * relics applied. The same run state always yields the same mission.
 */
export function runMission(run: RunState, node: RouteNode, base: ContentPack) {
  const source = missionById(node.mission, base.missions);
  if (!source) throw new Error(`Unknown run mission '${node.mission}'.`);
  const r = streamOf(run.seed, "waves", run.step, node.mission),
    pool = enemyPool(source, run.roster, base),
    boss = node.kind === "boss",
    length = boss ? BOSS_WAVES : RUN_WAVES,
    n = source.waves.length,
    depth = DEPTH_HP[Math.min(run.step, DEPTH_HP.length - 1)] * (node.kind === "elite" ? ELITE_HP : 1);
  const waves = Array.from({ length }, (_, i): WaveDefinition => {
    const at = Math.round((i * (n - 1)) / (length - 1)),
      from = source.waves[at],
      groups = remixWave(r, from, pool, base);
    // The finale of the boss node always brings Titans: one, or two when the source mission ends without one.
    if (boss && i === length - 1 && !groups.some((x) => x.type === "boss")) groups.push(g("boss", 2, 6, tenth(Math.max(4, ...from.groups.map((x) => x.delay + (x.count - 1) * x.interval)) * 0.5)));
    return {
      groups,
      // Fewer waves than the source: each bonus grows, so the mission pays about the same in total.
      bonus: Math.round((from.bonus * n) / length),
      hpMultiplier: Math.round(waveHpScale(source, at + 1) * depth * 1000) / 1000,
    };
  });
  const mission: MissionDefinition = {
    id: runMissionId(run),
    name: source.map.name,
    focus: `Run mission ${run.step + 1}${node.kind === "normal" ? "" : node.kind === "elite" ? " · Elite" : " · Boss"}: ${[...pool.keys()].map((id) => base.enemies[id].name).join(", ")}`,
    map: source.map,
    waves,
    startingCredits: source.startingCredits,
    reactorEnergy: source.reactorEnergy,
    availableTowers: [...run.roster],
  };
  return applyRelics(base, mission, run.relics);
}
