import type { CritAttack, OverclockAttack, PierceAuraAttack, SkylinkAttack, SynergyAttack } from "../../core/types";
import type { AttackModule, ParamRule } from "./types";
// Support towers that strengthen the towers around them in combat. None of them attacks; `systems/support.ts`
// derives every effect from the current towers on each query.
const share = (label: string): ParamRule => ({ label, valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 });
/** Overclock: `overclockRate` speeds up the cooldown of towers in range during the burst window. */
export const overclock: AttackModule<OverclockAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    boost: { label: "Burst fire rate", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
    window: { label: "Burst length", valid: (v) => v > 0, unit: " s" },
    period: { label: "Cycle", valid: (v) => v > 0, unit: " s" },
  },
  validate: (s) => (s.window < s.period ? undefined : "The burst must be shorter than the cycle."),
  apply: () => {},
};
/** Fire Control: `critFactor` counts the shots of towers in range and multiplies every `every`th one. */
export const crit: AttackModule<CritAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    every: { label: "Crit every nth shot", valid: (v) => Number.isInteger(v) && v >= 2 },
    multiplier: { label: "Crit damage", valid: (v) => v > 1, unit: " ×" },
  },
  apply: () => {},
};
/** Armory: `armoryPierce` lets hits of towers in range ignore part of the armor trait. */
export const pierceaura: AttackModule<PierceAuraAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: { fraction: share("Armor ignored") },
  apply: () => {},
};
/** Skylink: `skylinkHold` makes flyers in range ground targets; `skylinkFactor` scales the ground towers' hits on them. */
export const skylink: AttackModule<SkylinkAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: { factor: share("Damage vs. flyers") },
  apply: () => {},
};
/** Nexus: `synergyFactor` rewards a mix of tower types around it. */
export const synergy: AttackModule<SynergyAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {
    bonus: { label: "Damage per tower type", valid: (v) => v > 0 && v <= 0.25, unit: " %", show: (v) => v * 100 },
    cap: { label: "Tower types counted", valid: (v) => Number.isInteger(v) && v >= 1 },
  },
  apply: () => {},
};
