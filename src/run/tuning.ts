/**
 * Every balance knob of the Run mode in one place, tuned with `scripts/run-balance.ts`. Changing one changes runs
 * only: the campaign never reads this file.
 */
/** HP factor per act (I, II, III, Final) and mission column inside it (first, second, boss), on top of the source curve. */
export const DEPTH_HP: readonly (readonly number[])[] = [
  [0.32, 0.34, 0.48],
  [0.6, 0.64, 0.66],
  [1.15, 1.2, 1.25],
  [1.3],
];
export const ELITE_HP = 1.15;
/**
 * Waves per mission by act (I, II, III, Final) and mission column (first, second, boss): short while the player has
 * few towers and upgrades to spend on, longer as the run goes on. The same for every roster and strategy.
 */
export const WAVES: readonly (readonly number[])[] = [
  [5, 5, 8],
  [11, 12, 14],
  [13, 14, 16],
  [20],
];
/** Extra waves of an elite mission over a regular one in the same column. */
export const ELITE_WAVES = 1;
/** Share of a source mission's income up to a wave that a hot drop hands out as starting credits. */
export const ECONOMY_SHARE = 0.7;
/** The run's reactor: its maximum at the start, the field repair after every won mission and the Repair node. */
export const REACTOR_MAX = 30;
export const FIELD_REPAIR = 3;
export const REPAIR_NODE = 10;
export const REINFORCE_NODE = 3;
/** Scrap: per won mission, per star above one, per format, per hazard, and for skipped picks. */
export const SCRAP_BASE = 18;
export const SCRAP_STAR = 10;
export const SCRAP_FORMAT: Readonly<Record<"standard" | "elite" | "boss" | "final", number>> = { standard: 0, elite: 20, boss: 30, final: 0 };
export const HAZARD = 8;
export const SKIP_TOWER = 15;
export const SKIP_RELIC = 25;
export const RETIRE = 15;
export const REROLL = 12;
export const REROLL_STEP = 10;
/** Roster cap per act (I, II, III and the Final Stand). */
export const ROSTER_CAP: readonly number[] = [6, 8, 10, 10];
/** Rank XP: one per kill, plus a bonus for every type built in a mission; thresholds of ranks 1 to 4. */
export const XP_BUILT = 10;
export const RANK_XP: readonly number[] = [60, 180, 360, 600];
/** Shop prices before the threat surcharge. */
export const PRICES = {
  patch: 25,
  funds: 25,
  drill: 30,
  discount: 25,
  relic: 50,
  tower: 40,
  doctrine: 55,
  xp: 25,
  forgeDrill: 20,
} as const;
export const PATCH = 6;
export const FUNDS = 150;
export const XP_BOUGHT = 100;
