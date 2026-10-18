import { resolveUpgrades } from "../core/upgrades";
import type { AttackKind, Enemy, Sim } from "../core/types";
import { dist } from "./path";
import { isSuppressed } from "./traits";
// g4 support towers (Overclock, Fire Control, Armory, Skylink, Nexus).
import type { AttackSpec, CritAttack, DamageSource, OverclockAttack, Point, Tower, TowerId } from "../core/types";
import { isNetted } from "./status";
import { layerOf } from "./traits";
import { credit } from "../core/economy";
/**
 * Effects of the passive support towers. Like auras they are derived from the current
 * towers on every query, without a cache, and overlapping towers count only the strongest.
 */
function strongest(sim: Sim, kind: AttackKind, key: string, e?: Enemy) {
  let best = 0;
  for (const t of sim.state.towers) {
    const resolved = resolveUpgrades(t, sim.content);
    if (resolved.attack.kind !== kind || (e && dist(e, t) > resolved.stats.range) || isSuppressed(sim, t)) continue;
    best = Math.max(best, (resolved.attack as unknown as Record<string, number>)[key]);
  }
  return best;
}
/** Bounty Beacon: extra credits for a kill in range, rounded so co-op splits stay whole. */
export const bountyBonus = (sim: Sim, e: Enemy, reward: number) => Math.round(reward * strongest(sim, "bounty", "bonus", e));
/** Peilsender: damage multiplier for an enemy in range; 1 without a tracker. */
export const markFactor = (sim: Sim, e: Enemy) => 1 + strongest(sim, "mark", "amount", e);
/** Reparaturdock: after a completed wave each dock restores energy, never above the mission's start value. */
export function repairReactor(sim: Sim) {
  const s = sim.state;
  for (const t of s.towers) {
    const attack = resolveUpgrades(t, sim.content).attack;
    if (attack.kind !== "repair") continue;
    const amount = Math.min(attack.amount, sim.mission.reactorEnergy - s.lives);
    if (amount <= 0) continue;
    s.lives += amount;
    s.events.push({ type: "repair", at: { x: t.x, y: t.y }, amount, color: sim.content.towers[t.type].color });
  }
}
// ── new towers: g1 (Attack+Control A) ──
// ── end g1 ──
// ── new towers: g2 (Control B) ──
// ── end g2 ──
// ── new towers: g3 (Traps) ──
// ── end g3 ──
// ── new towers: g4 (Support A) ──
/**
 * Calls `fn` for every unsuppressed support tower of `kind` whose radius reaches `at`, with its resolved attack and
 * radius. The base definition is checked first, so a board without such a tower costs one pass over the towers.
 */
function reaching<K extends AttackKind>(sim: Sim, kind: K, at: Point, fn: (attack: Extract<AttackSpec, { kind: K }>, tower: Tower, range: number) => void) {
  for (const t of sim.state.towers) {
    if (sim.content.towers[t.type].attack.kind !== kind) continue;
    const resolved = resolveUpgrades(t, sim.content);
    if (dist(at, t) > resolved.stats.range || isSuppressed(sim, t)) continue;
    fn(resolved.attack as Extract<AttackSpec, { kind: K }>, t, resolved.stats.range);
  }
}
/** Overclock: whether a burst window is open at `time`; every Overclock shares the same wave-time grid. */
export const overclockActive = (a: OverclockAttack, time: number) => time % a.period < a.window;
/** Overclock: cooldown speed factor of a tower, `1 + boost` of the strongest Overclock in reach with an open window. */
export function overclockRate(sim: Sim, t: Point) {
  let boost = 0;
  reaching(sim, "overclock", t, (a) => {
    if (overclockActive(a, sim.state.time)) boost = Math.max(boost, a.boost);
  });
  return 1 + boost;
}
/** Fire Control in reach of `t` with the best average gain per shot, if any. */
export function fireControlOf(sim: Sim, t: Point) {
  let best: { attack: CritAttack; tower: Tower } | undefined;
  reaching(sim, "crit", t, (attack, tower) => {
    if (!best || (attack.multiplier - 1) / attack.every > (best.attack.multiplier - 1) / best.attack.every) best = { attack, tower };
  });
  return best;
}
/**
 * Fire Control, at fire time: counts the shot on the tower and returns the crit multiplier on every `every`th one
 * (else 1). Without a Fire Control in reach nothing is counted, so `critCount` stays absent in solo play without one.
 */
export function critFactor(sim: Sim, t: Tower, target: Point) {
  const fc = fireControlOf(sim, t);
  if (!fc) return 1;
  t.critCount = (t.critCount ?? 0) + 1;
  if (t.critCount < fc.attack.every) return 1;
  t.critCount = 0;
  sim.state.events.push({ type: "crit", at: { x: target.x, y: target.y }, from: { x: t.x, y: t.y }, color: sim.content.towers[fc.tower.type].color });
  return fc.attack.multiplier;
}
/** Armory: share of the armor trait that hits of the tower `tower` (an id, possibly sold) ignore; 0 without an Armory. */
export function armoryPierce(sim: Sim, tower?: number) {
  if (tower === undefined) return 0;
  const t = sim.state.towers.find((o) => o.id === tower);
  let best = 0;
  if (t) reaching(sim, "pierceaura", t, (a) => (best = Math.max(best, a.fraction)));
  return best;
}
/** Skylink: the damage share of the strongest Skylink holding a point; 0 when none reaches it. */
export function skylinkHold(sim: Sim, at: Point) {
  let best = 0;
  reaching(sim, "skylink", at, (a) => (best = Math.max(best, a.factor)));
  return best;
}
/** Skylink: damage factor of a ground-only tower's hit on a flyer it can only reach through a Skylink; 1 otherwise. */
export function skylinkFactor(sim: Sim, src: DamageSource, e: Enemy) {
  if (sim.content.towers[src.type].targets.includes("air") || layerOf(sim, e) !== "air" || isNetted(e, sim.state.time)) return 1;
  return skylinkHold(sim, e) || 1;
}
/** Nexus: the distinct attack tower types (support towers excluded) within a Nexus's radius, in first-built order. */
export function nexusTypes(sim: Sim, nexus: Point, range: number): TowerId[] {
  const types = new Set<TowerId>();
  for (const o of sim.state.towers) if (sim.content.towers[o.type].targets.length && dist(o, nexus) <= range) types.add(o.type);
  return [...types];
}
/** Nexus: damage factor of a tower, `1 + bonus × min(cap, types)` of the strongest Nexus in reach. */
export function synergyFactor(sim: Sim, t: Point) {
  let best = 0;
  reaching(sim, "synergy", t, (a, nexus, range) => (best = Math.max(best, a.bonus * Math.min(a.cap, nexusTypes(sim, nexus, range).length))));
  return 1 + best;
}
// ── end g4 ──
// ── new towers: g5 (Support B) ──
/** Vault: interest of `rate` on `credits`, rounded down and capped. */
export const interestOn = (credits: number, rate: number, cap: number) => Math.min(cap, Math.floor(Math.max(0, credits) * rate));
/**
 * Vault: after a completed wave every owner of a Vault earns interest on their own unspent credits; only the
 * owner's best-paying Vault counts. Paid through `credit`, so co-op wallets stay separate.
 */
export function payInterest(sim: Sim) {
  const s = sim.state,
    best = new Map<number, { tower: Tower; amount: number }>();
  for (const t of s.towers) {
    const attack = resolveUpgrades(t, sim.content).attack;
    if (attack.kind !== "interest") continue;
    const amount = interestOn(s.wallets[t.owner] ?? 0, attack.rate, attack.cap);
    if (amount > (best.get(t.owner)?.amount ?? 0)) best.set(t.owner, { tower: t, amount });
  }
  for (const [owner, { tower: t, amount }] of best) {
    credit(s, owner, amount);
    s.events.push({ type: "income", at: { x: t.x, y: t.y }, amount, color: sim.content.towers[t.type].color });
  }
}
/** Shield Generator: charge left this wave. */
export const barrierLeft = (sim: Sim, t: Pick<Tower, "type" | "upgrades" | "barrier">) => {
  const attack = resolveUpgrades(t, sim.content).attack;
  return attack.kind === "barrier" ? Math.max(0, attack.amount - (t.barrier ?? 0)) : 0;
};
/**
 * Shield Generator: an enemy reaches the reactor with `leak` damage; generators absorb what they can, in build
 * order. Returns the damage that still reaches the reactor.
 */
export function absorbLeak(sim: Sim, e: Enemy, leak: number) {
  const s = sim.state;
  let rest = leak;
  for (const t of s.towers) {
    if (rest <= 0) break;
    const take = Math.min(rest, barrierLeft(sim, t));
    if (take <= 0) continue;
    t.barrier = (t.barrier ?? 0) + take;
    rest -= take;
    s.events.push({ type: "barrier", from: { x: t.x, y: t.y }, at: { x: e.x, y: e.y }, amount: take, color: sim.content.towers[t.type].color });
  }
  return rest;
}
/** After a completed wave: Vault interest, then every Shield Generator recharges. */
export function settleEconomy(sim: Sim) {
  payInterest(sim);
  for (const t of sim.state.towers) delete t.barrier;
}
// ── end g5 ──
