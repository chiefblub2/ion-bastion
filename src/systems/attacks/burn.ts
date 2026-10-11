import type { BurnAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus, BURN_TICK } from "../status";
import type { AttackModule } from "./types";
/** Incendiary hit: direct damage, then burning that scales with the hit, so levels and auras count. */
export const burn: AttackModule<BurnAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    ratio: { label: "Burn damage", valid: (v) => v > 0, unit: " % of hit", show: (v) => v * 100 },
    duration: { label: "Burn duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("burn", src));
    const time = sim.state.time;
    applyStatus(sim, enemy, {
      kind: "burn",
      dps: (damage * spec.ratio) / spec.duration,
      next: time + BURN_TICK,
      until: time + spec.duration,
      source: { ...src },
      // Wildfire: only burns of this path spread when their carrier dies.
      ...(src.special?.kind === "wildfire" ? { spread: { factor: src.special.remainingFactor, radius: src.special.radius, count: src.special.count } } : {}),
    });
  },
};
