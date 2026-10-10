import { resolveUpgrades } from "../core/upgrades";
import type { AttackKind, Enemy, Sim } from "../core/types";
import { dist } from "./path";
/**
 * Effects of the passive support towers. Like auras they are derived from the current
 * towers on every query, without a cache, and overlapping towers count only the strongest.
 */
function strongest(sim: Sim, kind: AttackKind, key: string, e?: Enemy) {
  let best = 0;
  for (const t of sim.state.towers) {
    const resolved = resolveUpgrades(t, sim.content);
    if (resolved.attack.kind !== kind || (e && dist(e, t) > resolved.stats.range)) continue;
    best = Math.max(best, (resolved.attack as unknown as Record<string, number>)[key]);
  }
  return best;
}
/** Prämienbake: extra credits for a kill in range, rounded so co-op splits stay whole. */
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
