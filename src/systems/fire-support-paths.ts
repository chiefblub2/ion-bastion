import { resolveUpgrades } from "../core/upgrades";
import type { CritRider, DamageSource, Enemy, OverclockAttack, Point, Sim, SynergyAttack, Tower } from "../core/types";
import type { Hit } from "./damage";
import { dist } from "./path";
import { applyStatus } from "./status";
import { isSuppressed, layerOf, resists } from "./traits";
import { nexusTypes, overclockActive, specialOf, withSpecial } from "./support";
/**
 * Fire-support paths: the support combat paths that boost the firing towers (rate, crits, reach, damage), of
 * Overclock, Fire Control, Skylink and Nexus; the counterpart of `target-paths.ts`. Every effect is derived per query from the
 * towers' specializations; the only state is `Tower.salvo` (Opening Salvo) and `Enemy.spotted` (Spotting), both
 * absent until a path uses them, so boards without these paths behave exactly as before.
 */

// ── Overclock ──
/** Opening Salvo: whether the tower's once-per-wave salvo window is open. */
function salvoOpen(sim: Sim, oc: Tower) {
  if (oc.salvo === undefined) return false;
  const special = specialOf(sim, oc, "opening-salvo");
  return !!special && sim.state.time - oc.salvo < special.duration;
}
/**
 * Fire-rate boost one Overclock gives right now: its full boost while its window (or its Opening Salvo) is open,
 * else the Afterburn tail, which fades linearly from `boost` to 0 over `duration` s after each window closes.
 */
export function windowBoost(sim: Sim, a: OverclockAttack, oc: Tower) {
  const time = sim.state.time;
  if (overclockActive(a, time) || salvoOpen(sim, oc)) return a.boost;
  const burn = specialOf(sim, oc, "afterburn");
  if (!burn) return 0;
  const since = (time % a.period) - a.window;
  return since >= 0 && since < burn.duration ? burn.boost * (1 - since / burn.duration) : 0;
}
/** Opening Salvo, once per tick before the towers fire: the first enemy of a wave inside the radius opens the window. */
export function openSalvos(sim: Sim) {
  const s = sim.state;
  for (const t of s.towers) {
    if (t.salvo !== undefined) continue;
    const resolved = resolveUpgrades(t, sim.content);
    if (resolved.specialization?.kind !== "opening-salvo" || isSuppressed(sim, t)) continue;
    if (s.enemies.some((e) => e.hp > 0 && dist(e, t) <= resolved.stats.range)) t.salvo = s.time;
  }
}
/** After a wave: every Opening Salvo is ready again. */
export function resetSalvos(sim: Sim) {
  for (const t of sim.state.towers) delete t.salvo;
}
/** Charged Rounds, judged at fire time: damage factor of a shot while a Charged Rounds Overclock in reach has its window open. */
export function chargedFactor(sim: Sim, t: Point) {
  let best = 0;
  withSpecial(sim, "charged-rounds", t, (special, oc) => {
    const a = resolveUpgrades(oc, sim.content).attack as OverclockAttack;
    if (overclockActive(a, sim.state.time)) best = Math.max(best, special.bonus);
  });
  return 1 + best;
}

// ── Fire Control ──
/** What a crit of the tower `t` carries: the strongest Penetrator, Stagger and Spotting in reach; undefined without any. */
export function critRider(sim: Sim, t: Point): CritRider | undefined {
  const rider: CritRider = {};
  withSpecial(sim, "penetrator", t, (s) => (rider.pierce = Math.max(rider.pierce ?? 0, s.fraction)));
  withSpecial(sim, "stagger", t, (s) => {
    if (s.slow > (rider.slow ?? 0)) Object.assign(rider, { slow: s.slow, duration: s.duration });
  });
  withSpecial(sim, "spotting", t, (s) => (rider.spot = Math.max(rider.spot ?? 0, s.bonus)));
  return Object.keys(rider).length ? rider : undefined;
}
/** Penetrator: share of the armor reduction a crit ignores; 0 for every other hit. */
export const critPierce = (hit?: Hit) => hit?.crit?.pierce ?? 0;

// ── Skylink ──
/** Downlink: speed factor of a flyer held by a Downlink Skylink; slow immunity and dampen fields resist it. */
export function downlinkFactor(sim: Sim, e: Enemy) {
  let slow = 0;
  withSpecial(sim, "downlink", e, (s) => (slow = Math.max(slow, s.slow)));
  if (!slow || layerOf(sim, e) !== "air" || resists(sim, e, "slow")) return 1;
  return 1 - slow;
}

// ── Nexus ──
/** Resonance and Harmony: range and fire-rate bonus of an attack tower at `at`, per tower type around the strongest Nexus. */
export function nexusBoost(sim: Sim, at: Point) {
  const boost = { range: 0, rate: 0 };
  const per = (bonus: number, nexus: Tower, range: number) => {
    const cap = (resolveUpgrades(nexus, sim.content).attack as SynergyAttack).cap;
    return bonus * Math.min(cap, nexusTypes(sim, nexus, range).length);
  };
  withSpecial(sim, "nexus-resonance", at, (s, nexus, range) => (boost.range = Math.max(boost.range, per(s.bonus, nexus, range))));
  withSpecial(sim, "harmony", at, (s, nexus, range) => (boost.rate = Math.max(boost.rate, per(s.bonus, nexus, range))));
  return boost;
}

// ── Damage ──
/**
 * Damage factor of the combat paths on one hit, before armor: Spotting (consumes the mark), Wing Tag, Flak Relay
 * and Diversity. Different paths multiply; within a path only the strongest tower counts.
 */
export function fireSupportFactor(sim: Sim, src: DamageSource, e: Enemy, dot: boolean) {
  let factor = 1;
  if (e.spotted && !dot && e.spotted.by !== src.tower) {
    factor *= 1 + e.spotted.bonus;
    delete e.spotted;
  }
  let wing = 0,
    flak = 0,
    diversity = 0,
    air: boolean | undefined;
  const isAir = () => (air ??= layerOf(sim, e) === "air");
  for (const t of sim.state.towers) {
    const resolved = resolveUpgrades(t, sim.content),
      special = resolved.specialization;
    if (special?.kind !== "wing-tag" && special?.kind !== "flak-relay" && special?.kind !== "diversity") continue;
    if (isSuppressed(sim, t)) continue;
    const range = resolved.stats.range;
    if (special.kind === "wing-tag") {
      if (special.bonus > wing && dist(e, t) <= range && isAir()) wing = special.bonus;
    } else if (special.kind === "flak-relay") {
      if (dot || special.bonus <= flak || !sim.content.towers[src.type].targets.includes("air") || !isAir()) continue;
      const shooter = sim.state.towers.find((o) => o.id === src.tower);
      if (shooter && dist(shooter, t) <= range) flak = special.bonus;
    } else if (special.bonus > diversity && dist(e, t) <= range && nexusTypes(sim, t, range).length >= special.min) diversity = special.bonus;
  }
  return factor * (1 + wing) * (1 + flak) * (1 + diversity);
}
/** After a hit: a crit with Stagger slows its target, a crit with Spotting marks it for the next tower. */
export function fireSupportAfterHit(sim: Sim, src: DamageSource, e: Enemy, hit?: Hit) {
  const crit = hit?.crit;
  if (!crit || e.hp <= 0) return;
  if (crit.slow) applyStatus(sim, e, { kind: "slow", factor: 1 - crit.slow, until: sim.state.time + crit.duration! });
  if (crit.spot) e.spotted = { by: src.tower, bonus: crit.spot };
}
