import type { VolleyAttack } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { direct } from "./direct";
import type { AttackModule } from "./types";
/** Schrapnell: one shot each at several different enemies per salvo; `attackEnemies` reads `volley`. */
export const volley: AttackModule<VolleyAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    targets: { label: "Targets per salvo", valid: (v) => Number.isInteger(v) && v >= 1 },
  },
  volley: (spec) => spec.targets,
  apply: (sim, src, impact, damage) => {
    direct.apply(sim, src, impact, damage, { kind: "direct" });
    // Concentrated Volley: the unused shards land on the main target as one extra hit.
    const { enemy, proc } = impact;
    if (src.special?.kind === "unused-volley" && proc && enemy && enemy.hp > 0)
      applyDamage(sim, plain(src), enemy, damage * proc * src.special.bonusPerUnused, false, hitOf("direct", plain(src)));
  },
};
