import type { BleedAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus, BURN_TICK } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Caltrops: every enemy on the trap bleeds for each further cell it walks. */
export const bleed: AttackModule<BleedAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    perCell: { label: "Bleed per cell", valid: (v) => v > 0 },
    duration: { label: "Bleed duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { from, reach }, damage, spec) => {
    if (!from || !reach) return;
    const time = sim.state.time;
    // A copy: enemies released on death must not catch the same strike.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, from) <= reach) {
        applyDamage(sim, src, target, damage, false, hitOf("bleed", src));
        if (target.hp > 0)
          applyStatus(sim, target, {
            kind: "bleeding",
            perCell: spec.perCell,
            last: target.distance,
            next: time + BURN_TICK,
            until: time + spec.duration,
            source: src,
          });
      }
  },
};
