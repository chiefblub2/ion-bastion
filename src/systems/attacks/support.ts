import type { BountyAttack, MarkAttack, RepairAttack } from "../../core/types";
import type { AttackModule } from "./types";
/** Bounty Beacon: never attacks; `systems/support.ts` adds the bonus to kills in range. */
export const bounty: AttackModule<BountyAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    bonus: { label: "Bounty", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
  },
  apply: () => {},
};
/** Reparaturdock: never attacks; `systems/support.ts` repairs the reactor after each wave. */
export const repair: AttackModule<RepairAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    amount: { label: "Repair per wave", valid: (v) => Number.isInteger(v) && v > 0, unit: " Energie" },
  },
  apply: () => {},
};
/** Peilsender: never attacks; `systems/support.ts` raises the damage enemies in range take. */
export const mark: AttackModule<MarkAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    amount: { label: "Bonus damage", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
  },
  apply: () => {},
};
