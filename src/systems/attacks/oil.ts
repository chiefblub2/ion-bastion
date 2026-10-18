import type { OilAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Oil Slick: coats everything on the cell; fire does the rest (`systems/oil.ts`). */
export const oil: AttackModule<OilAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    boost: { label: "Burn damage", valid: (v) => v >= 1, unit: " ×" },
    radius: { label: "Ignition radius", valid: (v) => v > 0, unit: " cells" },
    duration: { label: "Oil duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { from, reach }, damage, spec) => {
    if (!from || !reach) return;
    const until = sim.state.time + spec.duration;
    // A copy: enemies released on death must not catch the same coat.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, from) <= reach) {
        applyDamage(sim, src, target, damage, false, hitOf("oil", src));
        if (target.hp > 0) applyStatus(sim, target, { kind: "oiled", boost: spec.boost, radius: spec.radius, until });
      }
  },
};
