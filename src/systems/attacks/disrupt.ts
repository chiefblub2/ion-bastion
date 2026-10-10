import type { DisruptAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Störsender pulse: switches off the special abilities of every enemy around the target. */
export const disrupt: AttackModule<DisruptAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    radius: { label: "Pulsradius", valid: (v) => v > 0, unit: " Felder" },
    duration: { label: "Störung", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const until = sim.state.time + spec.duration;
    sim.state.events.push({ type: "pulse", at: { ...at }, radius: spec.radius, color: sim.content.towers[src.type].color });
    // A copy: enemies released on death must not catch the same pulse.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, at) <= spec.radius) {
        applyStatus(sim, target, { kind: "disrupted", until });
        // The shield breaks and only recharges its usual delay after the disruption ends.
        if (target.shield !== undefined) {
          target.shield = 0;
          target.lastHit = Math.max(target.lastHit ?? -Infinity, until);
        }
        applyDamage(sim, src, target, damage, false, hitOf("disrupt", src));
      }
  },
};
