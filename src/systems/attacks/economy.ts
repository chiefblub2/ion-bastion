import type { BarrierAttack, DiscountAttack, InterestAttack, OverkillAttack } from "../../core/types";
import type { AttackModule } from "./types";
/** Workshop: never attacks; `systems/workshop.ts` lowers the upgrade prices of towers in range. */
export const discount: AttackModule<DiscountAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    amount: { label: "Upgrade discount", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => v * 100 },
  },
  apply: () => {},
};
/** Vault: never attacks; `systems/support.ts` pays interest on the owner's credits after each wave. */
export const interest: AttackModule<InterestAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    rate: { label: "Interest per wave", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => v * 100 },
    cap: { label: "Interest cap", valid: (v) => Number.isInteger(v) && v > 0, unit: " credits" },
  },
  apply: () => {},
};
/** Shield Generator: never attacks; `systems/support.ts` absorbs reactor damage when enemies leak. */
export const barrier: AttackModule<BarrierAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    amount: { label: "Shield per wave", valid: (v) => Number.isInteger(v) && v > 0, unit: " energy" },
  },
  apply: () => {},
};
/** Recycler: never attacks; `systems/recycler.ts` passes the overkill of kills in range on. */
export const overkill: AttackModule<OverkillAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    share: { label: "Overkill passed on", valid: (v) => v > 0 && v <= 3, unit: " %", show: (v) => v * 100 },
    reach: { label: "Jump distance", valid: (v) => v > 0, unit: " cells" },
  },
  apply: () => {},
};
