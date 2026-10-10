import type { AuraAttack } from "../../core/types";
import type { AttackModule } from "./types";
/** Support towers never attack; their bonuses are queried in `systems/auras.ts`. */
export const aura: AttackModule<AuraAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {},
  validate: (spec) =>
    (["damage", "speed", "range"] as const).every((k) => Number.isFinite(spec.base?.[k]) && spec.base[k] >= 0)
      ? undefined
      : "Invalid aura base bonus.",
  apply: () => {},
};
