import type { Grid } from "./clock";
import type { ZzfxParams } from "./zzfx";
// ZzFX recipes for the short effects that are not part of the music: tower shots and actions, a few combat accents,
// alerts, stinger fallbacks and interface clicks. Shots stay tonal or low-passed, so a busy field never turns to hiss. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on
// /gallery.html?sound.

export const COMBAT_CUES = [
  "blast", "kill", "evade", "overload", "income", "repair",
  // ── new towers: g1 (Attack+Control A) ──
  "strike", "shatter",
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  "echo",
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  "warp", "breach",
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  "crit",
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  "recycle", "barrier",
  // ── end g5 ──
] as const;
/** One quiet transient per tower family, played the moment it fires; `shots.ts` budgets and levels them. */
export const SHOT_CUES = ["shotRapid", "shotHeavy", "shotElectric", "shotControl", "shotFire", "shotTrap"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated", "boss"] as const;
export const UI_CUES = ["click", "hover"] as const;
export type CueId = (typeof COMBAT_CUES)[number] | (typeof SHOT_CUES)[number] | (typeof FLOW_CUES)[number] | (typeof UI_CUES)[number];
export type Pool = "combat" | "flow" | "ui";
export interface CueSpec {
  params: ZzfxParams;
  pool: Pool;
  /** Simultaneous voices of this cue. */
  cap: number;
  /** Minimum seconds between two starts of this cue. */
  gap: number;
  /** A full pool gives way to a higher priority. */
  priority: number;
  /** Dips the music bus. */
  duck?: boolean;
}
const combat = (params: ZzfxParams, cap: number, gap: number, priority = 1): CueSpec => ({ params, pool: "combat", cap, gap, priority });
const flow = (params: ZzfxParams, priority: number, duck = false): CueSpec => ({ params, pool: "flow", cap: 2, gap: 0.08, priority, duck });
const ui = (params: ZzfxParams, gap: number): CueSpec => ({ params, pool: "ui", cap: 2, gap, priority: 1 });
/** The shot mixer sets the pace; cap and gap here are only a safety net. */
const shot = (params: ZzfxParams): CueSpec => ({ params, pool: "combat", cap: 3, gap: 0.05, priority: 0 });

export const RECIPES: Record<CueId, CueSpec> = {
  blast: combat([0.45, 0.05, 70, 0, 0.05, 0.35, 4, 2, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.05, 0, -700], 1, 0.5, 2),
  kill: combat([0.15, 0.05, 1320, 0, 0.02, 0.12, 0, 1, 0, 0, 660, 0.03, 0, 0, 0, 0, 0.05, 0.5, 0, 0, -5000], 1, 0.5, 2),
  evade: combat([0.12, 0.05, 900, 0.01, 0, 0.08, 0, 1, 30, 0, 0, 0, 0, 0.1, 0, 0, 0, 1, 0, 0, -4000], 1, 0.3, 0),
  overload: combat([0.3, 0, 440, 0, 0.1, 0.4, 0, 1, -8, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.05, 0, -1500], 1, 0.3, 3),
  income: combat([0.12, 0.05, 1760, 0, 0.01, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 1, 0.3, 0),
  repair: combat([0.15, 0, 660, 0.02, 0.05, 0.15, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -3000], 1, 0.3, 0),
  // ── new towers: g1 (Attack+Control A) ──
  // A deep falling boom with a long noisy tail.
  strike: combat([0.5, 0.05, 55, 0.01, 0.12, 0.6, 4, 2, -1, 0, 0, 0, 0, 0.8, 0, 0, 0.04, 0.5, 0.1, 0, -500], 1, 0.5, 3),
  // Glassy: a bright tone jumping up, with a little crackle.
  shatter: combat([0.18, 0.1, 1500, 0, 0.02, 0.16, 0, 1, 0, 0, 600, 0.03, 0.05, 0.3, 0, 0, 0, 0.6, 0.02, 0, -5000], 1, 0.3, 1),
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // Hex echo: a hollow, falling sine with its own echo (ZzFX delay) and a slow tremolo; low-passed.
  echo: combat([0.22, 0.05, 330, 0.03, 0.05, 0.3, 0, 1, -5, 0, 0, 0, 0, 0, 2, 0, 0.09, 0.6, 0.05, 0.25, -1800], 1, 0.25, 1),
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  // A rising, wobbling sweep: something folds back down the lane.
  warp: combat([0.2, 0.05, 260, 0.01, 0.06, 0.18, 0, 1, 18, 0, 0, 0, 0, 0, 6, 0, 0, 0.6, 0.02, 0.2, -2600], 1, 0.25, 1),
  // A low, splintering crunch when a barricade gives way.
  breach: combat([0.4, 0.05, 75, 0, 0.04, 0.3, 3, 1, -2, 0, 0, 0, 0, 0.8, 0, 0, 0, 0.5, 0.04, 0, -900], 1, 0.4, 2),
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  // Fire Control crit: a short bright metallic ping with a downward flick, thinned to a few per second.
  crit: combat([0.14, 0.05, 1480, 0, 0.01, 0.07, 0, 1.6, 0, 0, -380, 0.02, 0, 0, 0, 0, 0, 0.6, 0, 0, -2600], 2, 0.15, 1),
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  // A low metallic clank that rises: scrap thrown on to the next enemy.
  recycle: combat([0.14, 0.05, 330, 0, 0.02, 0.08, 1, 1, 6, 0, 0, 0, 0, 0.1, 0, 0, 0, 0.6, 0.01, 0, -2200], 1, 0.15, 1),
  // A soft glassy shimmer: the reactor shield takes the hit.
  barrier: combat([0.25, 0, 523, 0.01, 0.12, 0.3, 0, 1, 0, 0, 262, 0.06, 0, 0, 0, 0, 0.08, 0.7, 0.03, 0, -2500], 1, 0.25, 3),
  // ── end g5 ──
  shotRapid: shot([0.0175, 0.1, 1800, 0, 0, 0.025, 0, 1, 0, 0, 0, 0, 0, 0.15, 0, 0, 0, 1, 0, 0, -3000]),
  shotHeavy: shot([0.042, 0.1, 90, 0, 0.01, 0.08, 0, 1, -3, 0, 0, 0, 0, 0.15, 0, 0, 0, 1, 0.01, 0, -600]),
  shotElectric: shot([0.0175, 0.1, 2600, 0, 0, 0.03, 0, 1, -40, 0, 0, 0, 0, 0.3, 0, 0, 0, 1, 0, 0, -3500]),
  shotControl: shot([0.0175, 0.1, 600, 0.01, 0.01, 0.06, 1, 1, -4, 0, 0, 0, 0, 0.1, 0, 0, 0, 1, 0, 0, -2500]),
  shotFire: shot([0.0175, 0.1, 400, 0.005, 0.02, 0.06, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -1600]),
  shotTrap: shot([0.0245, 0.05, 1400, 0, 0, 0.02, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -4000]),
  build: flow([0.35, 0, 523, 0, 0.03, 0.12, 1, 1, 0, 0, 262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  sell: flow([0.3, 0, 784, 0, 0.03, 0.12, 1, 1, 0, 0, -262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  upgrade: flow([0.35, 0, 523, 0, 0.06, 0.2, 0, 1, 0, 0, 262, 0.05, 0.1, 0, 0, 0, 0, 0.7, 0.01, 0, -4000], 2),
  leak: flow([0.5, 0, 80, 0, 0.08, 0.4, 1, 1, -3, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.05, 0.3, -800], 3, true),
  waveStart: flow([0.45, 0, 220, 0.05, 0.3, 0.5, 2, 1, 0, 0, 110, 0.2, 0, 0, 0, 0, 0.12, 0.6, 0.1, 0.2, -1800], 3),
  waveEnd: flow([0.4, 0, 659, 0.02, 0.2, 0.5, 0, 1, 0, 0, -165, 0.15, 0, 0, 0, 0, 0.1, 0.6, 0.05, 0, -4000], 3),
  won: flow([0.5, 0, 523, 0.02, 0.5, 0.8, 0, 1, 0, 0, 262, 0.12, 0.25, 0, 0, 0, 0.15, 0.7, 0.1, 0, -5000], 4, true),
  lost: flow([0.5, 0, 330, 0.02, 0.5, 1, 2, 1, -1, 0, -55, 0.25, 0, 0, 0, 0, 0.2, 0.6, 0.1, 0.2, -1500], 4, true),
  lowReactor: flow([0.35, 0, 880, 0, 0.08, 0.08, 0, 1, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.8, 0, 0, -3000], 4, true),
  reject: flow([0.25, 0, 160, 0, 0.04, 0.08, 1, 1, 0, 0, -40, 0.03, 0, 0, 0, 0, 0, 0.8, 0, 0, -1500], 1),
  incoming: flow([0.35, 0, 440, 0.01, 0.15, 0.2, 0, 1, 0, 0, 110, 0.08, 0.12, 0, 0, 0, 0, 0.7, 0, 0, -2500], 3),
  eliminated: flow([0.4, 0, 392, 0.02, 0.3, 0.6, 2, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.6, 0.05, 0, -1500], 3),
  boss: flow([0.55, 0, 110, 0.02, 0.5, 0.6, 2, 1, 0, 0, 55, 0.15, 0.3, 0.1, 0, 0, 0.12, 0.7, 0.05, 0.15, -1200], 4, true),
  click: ui([0.15, 0, 1200, 0, 0, 0.025, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -5000], 0.03),
  hover: ui([0.05, 0, 2400, 0, 0, 0.015, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 0.05),
};

/** When a cue may sound (its beat grid) and whether it is pitched to the current chord. */
export interface Timing {
  grid: Grid;
  pitched: boolean;
}
const t = (grid: Grid, pitched: boolean): Timing => ({ grid, pitched });
export const TIMING: Record<CueId, Timing> = {
  shotRapid: t(0, false), shotHeavy: t(0, false), shotElectric: t(0, false), shotControl: t(0, false), shotFire: t(0, false), shotTrap: t(0, false),
  blast: t(4, false), kill: t(16, true), evade: t(16, false), overload: t(4, true), income: t(16, true), repair: t(8, true),
  build: t(0, false), sell: t(0, false), upgrade: t(0, false), leak: t(8, false),
  waveStart: t(1, true), waveEnd: t(1, true), won: t(1, true), lost: t(1, true), eliminated: t(1, true), boss: t(1, true),
  lowReactor: t(4, false), incoming: t(4, false),
  reject: t(0, false), click: t(0, false), hover: t(0, false),
  // ── new towers: g1 (Attack+Control A) ──
  strike: t(4, false), shatter: t(16, true),
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  echo: t(8, true),
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  warp: t(16, false), breach: t(4, false),
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  crit: t(0, false),
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  recycle: t(16, false), barrier: t(8, true),
  // ── end g5 ──
};
