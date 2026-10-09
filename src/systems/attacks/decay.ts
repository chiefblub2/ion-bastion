import type { DecayAttack } from "../../core/types";
import { applyDamage } from "../damage";
import type { AttackModule } from "./types";
/** Disintegration: a share of the target's max HP on top, strong against tanks and bosses. */
export const decay: AttackModule<DecayAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    percent: { label: "Max.-HP-Schaden", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (enemy) applyDamage(sim, src, enemy, damage + spec.percent * enemy.maxHp);
  },
};
