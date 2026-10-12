import type { Grid } from "./clock";
import type { ZzfxParams } from "./zzfx";
// ZzFX recipes for the short effects that are not part of the music: a few combat accents, alerts, stinger
// fallbacks and interface clicks. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on
// /gallery.html?sound.

export const COMBAT_CUES = ["blast", "kill", "evade", "overload", "income", "repair"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated", "boss"] as const;
export const UI_CUES = ["click", "hover"] as const;
export type CueId = (typeof COMBAT_CUES)[number] | (typeof FLOW_CUES)[number] | (typeof UI_CUES)[number];
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

export const RECIPES: Record<CueId, CueSpec> = {
  blast: combat([0.45, 0.05, 70, 0, 0.05, 0.35, 4, 2, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.05, 0, -700], 1, 0.5, 2),
  kill: combat([0.15, 0.05, 1320, 0, 0.02, 0.12, 0, 1, 0, 0, 660, 0.03, 0, 0, 0, 0, 0.05, 0.5, 0, 0, -5000], 1, 0.5, 2),
  evade: combat([0.12, 0.05, 900, 0.01, 0, 0.08, 4, 1, 30, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 2500], 1, 0.3, 0),
  overload: combat([0.3, 0, 440, 0, 0.1, 0.4, 0, 1, -8, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.05, 0, -1500], 1, 0.3, 3),
  income: combat([0.12, 0.05, 1760, 0, 0.01, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 1, 0.3, 0),
  repair: combat([0.15, 0, 660, 0.02, 0.05, 0.15, 0, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -3000], 1, 0.3, 0),
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
  blast: t(4, false), kill: t(16, true), evade: t(16, false), overload: t(4, true), income: t(16, true), repair: t(8, true),
  build: t(16, true), sell: t(16, true), upgrade: t(16, true), leak: t(8, false),
  waveStart: t(1, true), waveEnd: t(1, true), won: t(1, true), lost: t(1, true), eliminated: t(1, true), boss: t(1, true),
  lowReactor: t(4, false), incoming: t(4, false),
  reject: t(0, false), click: t(0, false), hover: t(0, false),
};
