import type { ContentPack, Enemy, Point, Sim, SiphonAttack, Tower, TowerId } from "../core/types";
import { resolveUpgrades } from "../core/upgrades";
import { dist } from "./path";
import { speedFactor } from "./status";
/**
 * Siphon: every hindered enemy (slowed, netted, stunned or pulled, by any tower) within a Siphon's range feeds
 * the attack towers around the Siphon. Like auras it is derived from the current state on every query; a tower
 * near several Siphons takes the strongest one, and Siphons never feed each other.
 */
export interface SiphonBoost {
  /** Extra fire rate, e.g. 0.3 for 30 % more attacks per second. */
  rate: number;
  /** Power Tap: extra damage. */
  damage: number;
  /** The Siphon that gives the boost; absent without one. */
  from?: Tower;
}
const NONE: SiphonBoost = { rate: 0, damage: 0 };
export const isSiphon = (type: TowerId, content: ContentPack) => content.towers[type].attack.kind === "siphon";
/** Hindered enemies within the Siphon's range, in list order, up to its cap; the scene draws its drain streams from them. */
export function siphonDrained(sim: Sim, siphon: Tower): Enemy[] {
  const { attack, stats } = resolveUpgrades(siphon, sim.content),
    { cap } = attack as SiphonAttack,
    time = sim.state.time,
    drained: Enemy[] = [];
  for (const e of sim.state.enemies) if (e.hp > 0 && dist(e, siphon) <= stats.range && speedFactor(e, time) < 1 && drained.push(e) >= cap) break;
  return drained;
}
/** Number of hindered enemies within the Siphon's range, counting up to its cap. */
export function siphonCount(sim: Sim, siphon: Tower) {
  const { attack, stats } = resolveUpgrades(siphon, sim.content),
    { cap } = attack as SiphonAttack,
    time = sim.state.time;
  let n = 0;
  for (const e of sim.state.enemies) if (e.hp > 0 && dist(e, siphon) <= stats.range && speedFactor(e, time) < 1 && ++n >= cap) break;
  return n;
}
/** Boost from the Siphons whose reach covers an attack tower at `at`, the best value per stat like auras (`from` gives the rate); nothing for a Siphon itself. */
export function siphonBoost(sim: Sim, at: Point & { type: TowerId }): SiphonBoost {
  if (isSiphon(at.type, sim.content)) return NONE;
  let best = NONE;
  for (const t of sim.state.towers) {
    if (!isSiphon(t.type, sim.content)) continue;
    const { attack, specialization: special } = resolveUpgrades(t, sim.content),
      spec = attack as SiphonAttack;
    if (dist(t, at) > spec.reach) continue;
    const n = siphonCount(sim, t),
      rate = n * spec.bonus;
    const damage = special?.kind === "power-tap" ? n * special.bonus : 0;
    best = rate > best.rate ? { rate, damage: Math.max(damage, best.damage), from: t } : damage > best.damage ? { ...best, damage } : best;
  }
  return best;
}
