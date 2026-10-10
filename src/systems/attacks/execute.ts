import type { ExecuteAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import type { AttackModule } from "./types";
/** Henker: a heavy shot that hits much harder once the target is badly wounded. */
export const execute: AttackModule<ExecuteAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    threshold: { label: "Hinrichtung unter", valid: (v) => v > 0 && v < 1, unit: " % HP", show: (v) => v * 100 },
    multiplier: { label: "Hinrichtungsschaden", valid: (v) => v >= 1, unit: " ×" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    // Judged on impact, so a target weakened in flight is executed.
    const wounded = enemy.hp < spec.threshold * enemy.maxHp;
    applyDamage(sim, src, enemy, wounded ? damage * spec.multiplier : damage, false, hitOf("execute", src, { execution: wounded }));
  },
};
