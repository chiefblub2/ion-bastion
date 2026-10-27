import { missionById } from "../content/missions";
import { g } from "../content/waves";
import { waveHpScale } from "../systems/spawn";
import type { ContentPack, EnemyId, MissionDefinition, TowerId, WaveDefinition, WaveGroup } from "../core/types";
import { threatRules } from "./ascension";
import { bossModOf, harden } from "./boss";
import type { MissionKind, RunNode } from "./map";
import { rankOf, rankTransform } from "./ranks";
import { applyRelics, hasFlag } from "./relics";
import { draw, streamOf, type Rng } from "./rng";
import type { RunState } from "./run";
import { runMissionId } from "./run-id";
import { needsOf, offspring, rosterCovers, type Need } from "./threats";
import { compose, discount, lockSpecializations, only, upgradePrice, type PackFn } from "./transform";
import { DEPTH_HP, ECONOMY_SHARE, ELITE_HP, ELITE_WAVES, WAVES } from "./tuning";
import { pageOf } from "../ui/tower-pages";
/**
 * Mission formats. A mission plays a window of its source campaign mission: it enters at `enter` (a share of the
 * source's waves) with the credits a player would have had there ("hot drop"), and plays `waveCount` waves up to the
 * source's last one, resampled when the window is shorter or longer.
 */
export const FORMATS: Readonly<Record<MissionKind, { enter: number }>> = {
  standard: { enter: 0.15 },
  elite: { enter: 0.15 },
  boss: { enter: 0.15 },
  final: { enter: 0 },
};
const MAX_GROUP = 40;
/** Fallback when no enemy of the source mission fits the roster. */
const BASIC: readonly EnemyId[] = ["drone", "runner", "tank"];
/** Starting credits of a hot drop into `wave` (0-based): the source's own plus a share of the income before it. */
export function creditsAt(source: MissionDefinition, wave: number, content: ContentPack) {
  let income = 0;
  for (const w of source.waves.slice(0, wave)) {
    income += w.bonus;
    for (const group of w.groups) income += group.count * content.enemies[group.type].reward;
  }
  return Math.round(source.startingCredits + income * ECONOMY_SHARE);
}
export interface PoolOptions {
  /** Needs the act allows at all (act I never sends stealth). */
  allowed: ReadonlySet<Need>;
  /** Extra weight for stealth types (Blackout). */
  stealth?: number;
}
/**
 * The enemy types of the source mission the run may send, weighted by how often the source sends them, and the needs
 * the source had that the roster cannot answer (those types are left out; the mission card shows them struck through).
 * The Titan stays out: boss waves place it on their own.
 */
export function enemyPool(source: MissionDefinition, roster: readonly TowerId[], content: ContentPack, options: PoolOptions) {
  const covers = rosterCovers(roster, content),
    suppressed = new Set<Need>(),
    fits = (id: EnemyId, seen = new Set<EnemyId>()): boolean => {
      if (seen.has(id)) return true;
      seen.add(id);
      const e = content.enemies[id],
        needs = needsOf(e);
      if (needs.some((n) => !options.allowed.has(n))) return false;
      const missing = needs.filter((n) => !covers[n]);
      for (const n of missing) suppressed.add(n);
      return !missing.length && offspring(e).every((o) => fits(o, seen));
    },
    pool = new Map<EnemyId, number>();
  for (const w of source.waves)
    for (const group of w.groups)
      if (group.type !== "boss" && fits(group.type)) {
        const stealthy = options.stealth && needsOf(content.enemies[group.type]).includes("detect") ? options.stealth : 1;
        pool.set(group.type, (pool.get(group.type) ?? 0) + group.count * stealthy);
      }
  if (!pool.size) for (const id of BASIC) pool.set(id, 1);
  return { pool, suppressed: [...suppressed] };
}
const tenth = (v: number) => Math.round(v * 10) / 10;
/** Share of the source groups whose enemy type is swapped even though the roster could fight it. */
const SWAP = 0.6;
/**
 * One generated wave, remixed from a source wave: every group keeps its layer, its budget (count × HP × √speed) and
 * its spawn span, but its type may be swapped for another of the pool. `airBias` turns ground groups into flyers.
 */
function remixWave(r: Rng, source: WaveDefinition, pool: Map<EnemyId, number>, content: ContentPack, airBias = 0, grounded = 0): WaveGroup[] {
  const types = [...pool.keys()],
    layerOf = (id: EnemyId) => content.enemies[id].layer,
    cost = (id: EnemyId) => content.enemies[id].hp * Math.sqrt(content.enemies[id].speed),
    air = types.filter((id) => layerOf(id) === "air"),
    ground = types.filter((id) => layerOf(id) === "ground");
  return source.groups
    .map((group) => {
      const toAir = airBias > 0 && air.length > 0 && group.type !== "boss" && layerOf(group.type) === "ground" && r() < airBias,
        toGround = !toAir && grounded > 0 && ground.length > 0 && layerOf(group.type) === "air" && r() < grounded;
      if (group.type === "boss" || (!toAir && !toGround && pool.has(group.type) && r() >= SWAP)) return group;
      const same = toAir ? air : toGround ? ground : types.filter((id) => layerOf(id) === layerOf(group.type)),
        type = draw(r, same.length ? same : types, 1, (id) => Math.sqrt(pool.get(id)!))[0],
        count = Math.min(MAX_GROUP, Math.max(1, Math.round((group.count * cost(group.type)) / cost(type)))),
        span = (group.count - 1) * group.interval,
        interval = count > 1 ? Math.min(3, Math.max(0.22, span / (count - 1))) : group.interval;
      return g(type, count, Math.round(interval * 100) / 100, tenth(group.delay + (r() - 0.5) * 2));
    })
    .map((x) => (x.delay < 0 ? { ...x, delay: 0 } : x));
}
/**
 * The share of the budget that may fly, by the roster's anti-air attack towers: one carries 35%, two 60%, three or
 * more any share. Control towers that also reach flyers (Cryo, Acid, ...) slow them but do not count.
 */
export function airCap(roster: readonly TowerId[], content: ContentPack) {
  const n = roster.filter((id) => pageOf(content.towers[id]) === 0 && content.towers[id].targets.includes("air")).length;
  return n >= 3 ? 1 : n === 2 ? 0.6 : 0.35;
}
/** The share of air groups the remix turns into ground groups so the source's air share fits under the cap. */
function groundedShare(source: MissionDefinition, content: ContentPack, cap: number) {
  let air = 0,
    total = 0;
  for (const w of source.waves)
    for (const group of w.groups) {
      const e = content.enemies[group.type],
        v = group.count * e.hp * Math.sqrt(e.speed);
      total += v;
      if (e.layer === "air") air += v;
    }
  const share = total ? air / total : 0;
  return share > cap ? 1 - cap / share : 0;
}
/** Index of a mission column inside its act: first, second, boss. */
const columnSlot = (node: RunNode) => (node.kind === "final" ? 0 : Math.min(2, node.column / 2));
/** The number of waves of a mission node: by act and column (`WAVES`), plus `ELITE_WAVES` for an elite. */
export function waveCount(node: RunNode) {
  const row = WAVES[Math.min(node.act, WAVES.length - 1)];
  return row[Math.min(columnSlot(node), row.length - 1)] + (node.kind === "elite" ? ELITE_WAVES : 0);
}
/** The HP factor of a node on top of the source curve. */
export function depthOf(node: RunNode, threat: number) {
  const rules = threatRules(threat),
    row = DEPTH_HP[Math.min(node.act, DEPTH_HP.length - 1)],
    base = row[Math.min(columnSlot(node), row.length - 1)] + rules.depth;
  return base * (node.kind === "elite" ? ELITE_HP * rules.eliteHp : 1) * rules.hp;
}
/** The run's content pack: doctrines, shop mods, ranks, then relics, in that order. */
export function runPack(run: Pick<RunState, "doctrines" | "mods" | "ranks" | "roster" | "relics">): PackFn {
  const veteran = hasFlag(run.relics, "veteran");
  const steps: PackFn[] = [lockSpecializations(run.doctrines)];
  for (const m of run.mods) steps.push(m.kind === "drill" ? upgradePrice(0, only([m.tower]), (u) => u.id === "level-2") : discount(0.75, only([m.tower])));
  for (const id of run.roster) {
    const rank = Math.max(rankOf(run.ranks[id]), veteran ? 1 : 0);
    if (rank) steps.push(rankTransform(id, rank));
  }
  return compose(steps);
}
const KIND_TEXT: Record<MissionKind, string> = { standard: "Standard", elite: "Elite", boss: "Act boss", final: "Final Stand" };
const ACT_TEXT = ["Act I", "Act II", "Act III", "Final"];
export interface RunMission {
  mission: MissionDefinition;
  content: ContentPack;
  /** Needs the source had that the roster cannot answer: those enemy types were left out. */
  suppressed: Need[];
}
/**
 * The mission of a node: the source mission's map with a hot-drop economy, waves generated from its enemy pool and
 * HP curve, the run's reactor, the roster as its only towers, and the run's pack (doctrines, mods, ranks, relics,
 * boss modifiers). The same run state always yields the same mission.
 */
export function runMission(run: RunState, node: RunNode, base: ContentPack): RunMission {
  const source = missionById(node.mission ?? "", base.missions);
  if (!source) throw new Error(`Unknown run mission '${node.mission}'.`);
  const kind = node.kind as MissionKind,
    format = FORMATS[kind],
    rules = threatRules(run.threat),
    mods = (node.mods ?? []).map(bossModOf),
    roster = run.loan && !run.roster.includes(run.loan) ? [...run.roster, run.loan] : run.roster,
    allowed = new Set<Need>(node.act === 0 ? ["air", "under"] : ["air", "under", "detect"]),
    blackout = mods.find((m) => m.stealth),
    canStealth = allowed.has("detect") && rosterCovers(roster, base).detect;
  const r = streamOf(run.seed, "waves", run.step, node.mission),
    { pool, suppressed } = enemyPool(source, roster, base, { allowed, stealth: blackout && canStealth ? blackout.stealth : undefined }),
    airBias = Math.max(0, ...mods.map((m) => m.airBias ?? 0)),
    grounded = airBias ? 0 : groundedShare(source, base, airCap(roster, base)),
    n = source.waves.length,
    start = Math.min(n - 1, Math.round(format.enter * n)),
    count = waveCount(node),
    depth = depthOf(node, run.threat);
  let waves = Array.from({ length: count }, (_, i): WaveDefinition => {
    const at = start + (i * (n - 1 - start)) / (count - 1),
      lo = Math.floor(at),
      frac = at - lo,
      from = source.waves[lo],
      hp = waveHpScale(source, lo + 1) * (1 - frac) + waveHpScale(source, Math.min(n, lo + 2)) * frac;
    return {
      groups: remixWave(r, from, pool, base, airBias, grounded),
      // Each wave pays its source wave's bonus, so a short mission (it skips source waves) pays less.
      bonus: from.bonus,
      hpMultiplier: Math.round(hp * depth * 1000) / 1000,
    };
  });
  // The last mission of a run ends with Titans: one, or two when the source mission ends without one.
  const last = kind === "final" || (kind === "boss" && run.length === "short");
  if (last && !waves[count - 1].groups.some((x) => x.type === "boss")) {
    const end = waves[count - 1],
      tail = Math.max(4, ...end.groups.map((x) => x.delay + (x.count - 1) * x.interval));
    waves[count - 1] = { ...end, groups: [...end.groups, g("boss", 2, 6, tenth(tail * 0.5))] };
  }
  for (const m of mods) if (m.waves) waves = m.waves(waves);
  if (blackout && !canStealth) waves = harden(waves, 1.2);
  const credits = Math.max(1, Math.round(creditsAt(source, start, base) * rules.credits) + (run.funds ?? 0));
  const names = [...pool.keys()].map((id) => base.enemies[id].name).join(", ");
  const mission: MissionDefinition = {
    id: runMissionId(run),
    name: source.map.name,
    focus: `${ACT_TEXT[Math.min(node.act, 3)]} · ${KIND_TEXT[kind]}: ${names}`,
    map: source.map,
    waves,
    startingCredits: credits,
    reactorEnergy: Math.max(1, run.reactor),
    availableTowers: [...roster],
  };
  const pack = compose([runPack(run), ...mods.flatMap((m) => (m.content ? [m.content] : []))])(base);
  const done = applyRelics(pack, mission, run.relics, run.reactorMax);
  return { ...done, suppressed };
}
