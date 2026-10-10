import type { VolleyAttack } from "../../core/types";
import { direct } from "./direct";
import type { AttackModule } from "./types";
/** Schrapnell: one shot each at several different enemies per salvo; `attackEnemies` reads `volley`. */
export const volley: AttackModule<VolleyAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    targets: { label: "Ziele pro Salve", valid: (v) => Number.isInteger(v) && v >= 1 },
  },
  volley: (spec) => spec.targets,
  apply: (sim, src, impact, damage) => direct.apply(sim, src, impact, damage, { kind: "direct" }),
};
