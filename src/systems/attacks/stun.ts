import type { StunAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Stasis pulse: stuns every enemy around the target; recovery prevents a permanent lock. */
export const stun: AttackModule<StunAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    radius: { label: "Pulse radius", valid: (v) => v > 0, unit: " cells" },
    duration: { label: "Stun", valid: (v) => v > 0, unit: " s" },
    recovery: { label: "Recovery", valid: (v) => v >= 0, unit: " s" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const time = sim.state.time;
    sim.state.events.push({ type: "pulse", at: { ...at }, radius: spec.radius, color: sim.content.towers[src.type].color });
    // A copy: enemies released on death must not catch the same pulse.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, at) <= spec.radius) {
        applyDamage(sim, src, target, damage, false, hitOf("stun", src));
        if (target.hp > 0)
          applyStatus(sim, target, {
            kind: "stun",
            release: time + spec.duration,
            until: time + spec.duration + spec.recovery,
            // Temporal Exposure: stored with the stun, so a rejected or resisted stun never grants it.
            ...(src.special?.kind === "temporal-exposure" ? { exposure: { amount: src.special.bonus, duration: src.special.duration } } : {}),
          });
      }
  },
};
