import type { PullAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Gravitron pulse: drags every enemy around the target back along the path; recovery prevents a permanent lock. */
export const pull: AttackModule<PullAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    radius: { label: "Pulse radius", valid: (v) => v > 0, unit: " cells" },
    strength: { label: "Pull strength", valid: (v) => v > 0, unit: " ×" },
    duration: { label: "Pull duration", valid: (v) => v > 0, unit: " s" },
    recovery: { label: "Recovery", valid: (v) => v >= 0, unit: " s" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const time = sim.state.time;
    sim.state.events.push({ type: "pulse", at: { ...at }, radius: spec.radius, color: sim.content.towers[src.type].color });
    // A copy: enemies released on death must not catch the same pulse.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, at) <= spec.radius) {
        applyDamage(sim, src, target, damage, false, hitOf("pull", src));
        if (target.hp > 0)
          applyStatus(sim, target, {
            kind: "pull",
            factor: spec.strength,
            release: time + spec.duration,
            until: time + spec.duration + spec.recovery,
          });
      }
  },
};
