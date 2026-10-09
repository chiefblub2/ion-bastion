import type { IncomeAttack } from "../../core/types";
import type { AttackModule } from "./types";
/** Refinery: never attacks; `systems/waves.ts` pays its credits after each wave. */
export const income: AttackModule<IncomeAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    amount: { label: "Ertrag pro Welle", valid: (v) => Number.isInteger(v) && v > 0, unit: " Credits" },
  },
  apply: () => {},
};
