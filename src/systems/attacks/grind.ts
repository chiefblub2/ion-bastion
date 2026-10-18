import type { Enemy, GrindAttack, Sim } from "../../core/types";
import { isBlocked } from "../barricade";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { speedFactor } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** 0 for a walker at full speed, 1 for one that stands still (stunned, held, pulled back or stuck at a barricade). */
export function stillness(sim: Sim, e: Enemy) {
  if (isBlocked(sim, e)) return 1;
  return 1 - Math.min(1, Math.max(0, speedFactor(e, sim.state.time)));
}
/** Grinder: hits everything on the cell; the slower an enemy goes, the harder the blades bite, up to `1 + bonus` times. */
export const grind: AttackModule<GrindAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    bonus: { label: "Bonus on held enemies", valid: (v) => v >= 0, unit: " %", show: (v) => Math.round(v * 100) },
  },
  apply: (sim, src, { from, reach }, damage, spec) => {
    if (!from || !reach) return;
    // A copy: enemies released on death must not catch the same turn of the blades.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, from) <= reach)
        applyDamage(sim, src, target, damage * (1 + spec.bonus * stillness(sim, target)), false, hitOf("grind", src));
  },
};
