import type { Instrument } from "./instruments";
import type { CueId } from "./recipes";
// Musical flow cues as short instrument phrases on the beat grid: [instrument, chord tone, 1/16 offset, velocity].

export interface Stinger {
  notes: readonly (readonly [Instrument, number, number, number])[];
  /** Dips the music while it plays. */
  duck?: boolean;
}
export const STINGERS: Partial<Record<CueId, Stinger>> = {
  build: { notes: [["pluck", 2, 0, 0.7]] },
  sell: { notes: [["pluck", 0, 0, 0.5]] },
  upgrade: { notes: [["pluck", 1, 0, 0.6], ["bell", 3, 1, 0.6]] },
  waveStart: { notes: [["swell", 0, 0, 0.7], ["bell", 0, 0, 0.5]] },
  waveEnd: { notes: [["bell", 0, 0, 0.5], ["bell", 2, 2, 0.45], ["bell", 4, 4, 0.4]] },
  won: { notes: [["bell", 0, 0, 0.7], ["bell", 1, 2, 0.6], ["bell", 2, 4, 0.6], ["swell", 0, 0, 0.8]], duck: true },
  lost: { notes: [["bass", 0, 0, 0.9], ["swell", 0, 0, 0.7]], duck: true },
  boss: { notes: [["bass", 0, 0, 1], ["tom", 0, 4, 0.8], ["bass", 0, 8, 0.9], ["tom", 0, 12, 0.8]], duck: true },
};
