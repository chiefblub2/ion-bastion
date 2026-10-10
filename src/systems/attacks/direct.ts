import type { DirectAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import type { AttackModule } from "./types";
export const direct: AttackModule<DirectAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {},
  apply: (sim, src, { enemy }, damage) => {
    if (enemy) applyDamage(sim, src, enemy, damage, false, hitOf("direct", src));
  },
};
