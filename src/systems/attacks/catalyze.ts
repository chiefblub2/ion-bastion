import type { CatalyzeAttack } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { activeEffects, prolongEffects } from "../status";
import { canTarget, nearest } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Catalyst: a reagent dart that reacts with every effect already on its target. Weak alone, it grows with
 * each different tower type working on the same enemy; the effects are counted on impact.
 */
export const catalyze: AttackModule<CatalyzeAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    bonus: { label: "Bonus per effect", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
    cap: { label: "Effects counted", valid: (v) => Number.isInteger(v) && v >= 1, unit: "" },
  },
  // The most affected enemy in range; ties keep the tower's priority order.
  choose: (sim, _type, _from, _reach, candidates) => {
    let best = candidates[0],
      most = activeEffects(best, sim.state.time);
    for (const c of candidates) {
      const n = activeEffects(c, sim.state.time);
      if (n > most) [best, most] = [c, n];
    }
    return best;
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    const time = sim.state.time,
      effects = Math.min(spec.cap, activeEffects(enemy, time)),
      raw = damage * (1 + spec.bonus * effects),
      special = src.special;
    applyDamage(sim, src, enemy, raw, false, hitOf("catalyze", src));
    // Stabilizer: the other towers' effects on a survivor last longer.
    if (special?.kind === "prolong" && enemy.hp > 0) prolongEffects(enemy, time, special.extend, special.max);
    // Volatile Mix: a well-affected target splashes the reaction on its neighbours, never twice on itself.
    if (special?.kind !== "reaction-splash" || effects < special.min) return;
    const around = nearest(sim, enemy, special.radius, Infinity, (c) => c !== enemy && canTarget(sim, src.type, c));
    sim.state.events.push({ type: "pulse", at: { x: enemy.x, y: enemy.y }, radius: special.radius, color: sim.content.towers[src.type].color });
    for (const c of around) applyDamage(sim, plain(src), c, raw * special.factor, false, hitOf("catalyze", plain(src), { area: true }));
  },
};
