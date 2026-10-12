import type { ZzfxParams } from "./zzfx";
// One ZzFX recipe per cue. Tune them in the ZzFX designer (https://killedbyapixel.github.io/ZzFX) and on /gallery.html?sound.

export const COMBAT_CUES = ["bolt", "lob", "blast", "crackle", "beam", "swell", "chime", "hiss", "zap", "sweep", "crack", "trap", "impact", "kill", "evade", "overload", "income", "repair"] as const;
export const FLOW_CUES = ["build", "sell", "upgrade", "leak", "waveStart", "waveEnd", "won", "lost", "lowReactor", "reject", "incoming", "eliminated"] as const;
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
  click: ui([0.2, 0, 1200, 0, 0, 0.025, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -5000], 0.03),
  hover: ui([0.06, 0, 2400, 0, 0, 0.015, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, -6000], 0.05),
};
