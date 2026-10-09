import type { SplashAttack } from "../../core/types";
import { applyDamage } from "../damage";
import { dist } from "../path";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Splash damage centred on a point, so a shell can land where its target no longer is. */
export const splash: AttackModule<SplashAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Explosionsradius", valid: (v) => v > 0, unit: " Felder" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    // A copy: enemies released on death must not catch the same explosion.
    for (const target of [...sim.state.enemies])
      if (canTarget(sim, src.type, target) && dist(target, at) <= spec.radius)
        applyDamage(sim, src, target, damage);
  },
};
