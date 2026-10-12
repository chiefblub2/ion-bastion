import type { Grid } from "./clock";
import type { ZzfxParams } from "./zzfx";
// One ZzFX recipe per cue. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on /gallery.html?sound.

export const COMBAT_CUES = ["bolt", "lob", "blast", "crackle", "beam", "swell", "chime", "hiss", "zap", "sweep", "crack", "trap", "impact", "kill", "evade", "overload", "income", "repair"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated", "boss"] as const;
export const UI_CUES = ["click", "hover"] as const;
export const DRUM_CUES = ["kick", "snare", "hat", "stomp", "bass", "arp"] as const;
export type CueId = (typeof COMBAT_CUES)[number] | (typeof FLOW_CUES)[number] | (typeof UI_CUES)[number] | (typeof DRUM_CUES)[number];
export type Pool = "combat" | "flow" | "ui" | "drums";
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
const drum = (params: ZzfxParams): CueSpec => ({ params, pool: "drums", cap: 2, gap: 0.03, priority: 1 });

export const RECIPES: Record<CueId, CueSpec> = {
  bolt: combat([0.4, 0.05, 880, 0, 0.01, 0.06, 0, 1.5, -20, 0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.02, 0, -3000], 4, 0.04),
  lob: combat([0.3, 0.05, 180, 0, 0.02, 0.1, 1, 1, -4, 0, 0, 0, 0, 0.3, 0, 0, 0, 0.7, 0.03, 0, -1200], 3, 0.06),
  blast: combat([0.6, 0.05, 70, 0, 0.05, 0.35, 4, 2, -2, 0, 0, 0, 0, 0.6, 0, 0, 0, 0.5, 0.05, 0, -900], 3, 0.07, 2),
  crackle: combat([0.35, 0.1, 1200, 0, 0.02, 0.08, 3, 1, 0, 0, 0, 0, 0.02, 0.8, 0, 0.1, 0, 0.6, 0, 0.4, 2000], 3, 0.06),
  beam: combat([0.3, 0, 520, 0.01, 0.12, 0.1, 2, 1, 0, 0, 0, 0, 0, 0, 30, 0, 0, 0.5, 0.02, 0, -2500], 2, 0.1),
  swell: combat([0.5, 0.05, 55, 0.03, 0.15, 0.4, 0, 1, -1, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.1, 0, -500], 2, 0.15, 2),
  chime: combat([0.3, 0.02, 1568, 0, 0.05, 0.3, 0, 1, 0, 0, 523, 0.04, 0, 0, 0, 0, 0.08, 0.4, 0.02, 0, 0], 2, 0.1),
  hiss: combat([0.25, 0.1, 300, 0.02, 0.08, 0.15, 4, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0.5, 0, 0, 3000], 2, 0.08),
  zap: combat([0.3, 0.05, 1400, 0, 0.02, 0.07, 5, 0.4, -60, 0, 0, 0, 0, 0, 0, 0.05, 0, 0.6, 0, 0, -4000], 3, 0.06),
  sweep: combat([0.35, 0, 700, 0.01, 0.1, 0.2, 0, 1, -25, -2, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -2000], 2, 0.12),
  crack: combat([0.5, 0.02, 180, 0, 0, 0.12, 4, 1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 0.01, 0, -6000], 2, 0.08, 2),
  trap: combat([0.35, 0.03, 240, 0, 0.01, 0.08, 1, 1, 0, 0, -80, 0.02, 0, 0, 0, 0, 0, 0.8, 0, 0, -2000], 3, 0.05),
  impact: combat([0.2, 0.1, 400, 0, 0, 0.05, 4, 1, 0, 0, 0, 0, 0, 0.5, 0, 0, 0, 1, 0.01, 0, -2500], 4, 0.03, 0),
  kill: combat([0.3, 0.05, 1320, 0, 0.02, 0.12, 0, 1, 0, 0, 660, 0.03, 0, 0, 0, 0, 0.05, 0.5, 0, 0, -6000], 3, 0.05, 2),
  evade: combat([0.2, 0.05, 900, 0.01, 0, 0.08, 4, 1, 30, 0, 0, 0, 0, 0.8, 0, 0, 0, 1, 0, 0, 2500], 2, 0.1, 0),
  overload: combat([0.4, 0, 440, 0, 0.1, 0.4, 2, 1, -8, 0, 0, 0, 0, 0, 0, 0.1, 0, 0.6, 0.05, 0, -1500], 1, 0.3, 3),
  income: combat([0.15, 0.05, 1760, 0, 0.01, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], 2, 0.08, 0),
  repair: combat([0.2, 0, 660, 0.02, 0.05, 0.15, 1, 1, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0.7, 0, 0, -3000], 1, 0.2, 0),
  build: flow([0.35, 0, 523, 0, 0.03, 0.12, 1, 1, 0, 0, 262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  sell: flow([0.3, 0, 784, 0, 0.03, 0.12, 1, 1, 0, 0, -262, 0.04, 0, 0, 0, 0, 0, 0.7, 0.01, 0, -3000], 2),
  upgrade: flow([0.35, 0, 523, 0, 0.06, 0.2, 0, 1, 0, 0, 262, 0.05, 0.1, 0, 0, 0, 0, 0.7, 0.01, 0, -4000], 2),
  leak: flow([0.6, 0, 80, 0, 0.08, 0.4, 1, 1, -3, 0, 0, 0, 0, 0.2, 0, 0, 0, 0.8, 0.05, 0.3, -800], 3, true),
  waveStart: flow([0.45, 0, 220, 0.05, 0.3, 0.5, 2, 1, 0, 0, 110, 0.2, 0, 0, 0, 0, 0.12, 0.6, 0.1, 0.2, -1800], 3),
  waveEnd: flow([0.4, 0, 659, 0.02, 0.2, 0.5, 0, 1, 0, 0, -165, 0.15, 0, 0, 0, 0, 0.1, 0.6, 0.05, 0, -4000], 3),
  won: flow([0.5, 0, 523, 0.02, 0.5, 0.8, 0, 1, 0, 0, 262, 0.12, 0.25, 0, 0, 0, 0.15, 0.7, 0.1, 0, -5000], 4, true),
  lost: flow([0.5, 0, 330, 0.02, 0.5, 1, 2, 1, -1, 0, -55, 0.25, 0, 0, 0, 0, 0.2, 0.6, 0.1, 0.2, -1500], 4, true),
  lowReactor: flow([0.45, 0, 880, 0, 0.08, 0.08, 5, 0.5, 0, 0, 0, 0, 0.18, 0, 0, 0, 0, 0.8, 0, 0, -3000], 4, true),
  reject: flow([0.3, 0, 160, 0, 0.04, 0.08, 1, 1, 0, 0, -40, 0.03, 0, 0, 0, 0, 0, 0.8, 0, 0, -1500], 1),
  incoming: flow([0.45, 0, 440, 0.01, 0.15, 0.2, 5, 0.5, 0, 0, 110, 0.08, 0.12, 0, 0, 0, 0, 0.7, 0, 0, -2500], 3),
  eliminated: flow([0.45, 0, 392, 0.02, 0.3, 0.6, 2, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0.15, 0.6, 0.05, 0, -1500], 3),
  boss: flow([0.55, 0, 110, 0.02, 0.5, 0.6, 2, 1, 0, 0, 55, 0.15, 0.3, 0.1, 0, 0, 0.12, 0.7, 0.05, 0.15, -1200], 4, true),
  click: ui([0.2, 0, 1200, 0, 0, 0.025, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -5000], 0.03),
  hover: ui([0.06, 0, 2400, 0, 0, 0.015, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 0.05),
  kick: drum([0.8, 0, 150, 0, 0.03, 0.15, 0, 1, 0, 0, -90, 0.012, 0, 0, 0, 0, 0, 1, 0.02, 0, -1000]),
  snare: drum([0.5, 0, 220, 0, 0.02, 0.12, 4, 1, 0, 0, 0, 0, 0, 1.5, 0, 0, 0, 0.8, 0.01, 0, 1500]),
  hat: drum([0.25, 0, 8000, 0, 0, 0.04, 4, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 7000]),
  stomp: drum([0.7, 0, 55, 0, 0.02, 0.2, 0, 1, -2, 0, 0, 0, 0, 0.3, 0, 0, 0, 1, 0.02, 0, -400]),
  bass: drum([0.35, 0, 55, 0.005, 0.08, 0.06, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.02, 0, -600]),
  arp: drum([0.18, 0, 880, 0, 0.02, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0.5, 0.01, 0, -5000]),
};
/** When a cue may sound (its beat grid) and whether it is pitched to the current chord. */
export interface Timing {
  grid: Grid;
  pitched: boolean;
}
const t = (grid: Grid, pitched: boolean): Timing => ({ grid, pitched });
export const TIMING: Record<CueId, Timing> = {
  bolt: t(32, true), crackle: t(32, true), zap: t(32, true), evade: t(32, false), impact: t(32, false),
  chime: t(16, true), beam: t(16, true), trap: t(16, true), hiss: t(16, false), crack: t(16, false), lob: t(16, true), kill: t(16, true), income: t(16, true),
  blast: t(8, false), sweep: t(8, true), repair: t(8, true), leak: t(8, false),
  swell: t(4, true), overload: t(4, true), lowReactor: t(4, false), incoming: t(4, false),
  build: t(16, true), sell: t(16, true), upgrade: t(16, true),
  waveStart: t(1, true), waveEnd: t(1, true), won: t(1, true), lost: t(1, true), eliminated: t(1, true), boss: t(1, true),
  reject: t(0, false), click: t(0, false), hover: t(0, false),
  kick: t(16, false), snare: t(16, false), hat: t(16, false), stomp: t(16, false), bass: t(16, true), arp: t(16, true),
};
