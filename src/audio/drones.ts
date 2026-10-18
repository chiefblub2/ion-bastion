import type { DroneId } from "./mood";
// The synthwave bed's flavour per map theme. Every theme shares one sound (detuned saw pad with chorus, a sub, the
// synth bass); key, tempo and chords come from `MUSIC`, these values only shade it.

/** The bass line while a wave runs (`BASS` in grooves.ts). */
export type BassStyle = "octave" | "pulse" | "offbeat";
/** The lead's 4-bar motif when a fight escalates (`MOTIFS` in grooves.ts). */
export type LeadMotif = "rise" | "call" | "fall" | "pulse";
export interface PadFlavor {
  /** Pad low-pass in Hz. */
  cutoff: number;
  /** Cents between the two saws of a pad voice. */
  spread: number;
  /** Chorus depth, 0–1. */
  chorus: number;
  /** Share of the cutoff the slow filter LFO moves, at most 0.1. */
  breath: number;
  /** LFO rate in Hz. */
  lfo: number;
  /** Level of the sub sine on the root, 0–1. */
  sub: number;
  bass: BassStyle;
  lead: LeadMotif;
}
const p = (cutoff: number, spread: number, chorus: number, breath: number, lfo: number, sub: number, bass: BassStyle, lead: LeadMotif): PadFlavor => ({
  cutoff,
  spread,
  chorus,
  breath,
  lfo,
  sub,
  bass,
  lead,
});

export const DRONES: Record<DroneId, PadFlavor> = {
  menu: p(1500, 10, 0.8, 0.08, 0.05, 0.5, "pulse", "rise"),
  outpost: p(1700, 12, 0.6, 0.06, 0.07, 0.6, "octave", "rise"),
  lock: p(1500, 10, 0.5, 0.05, 0.09, 0.6, "octave", "call"),
  shard: p(2400, 14, 0.7, 0.07, 0.11, 0.5, "offbeat", "pulse"),
  ember: p(1300, 12, 0.5, 0.06, 0.08, 0.7, "octave", "fall"),
  core: p(1800, 10, 0.6, 0.06, 0.1, 0.6, "pulse", "call"),
  frost: p(2500, 16, 0.9, 0.08, 0.05, 0.4, "offbeat", "rise"),
  toxic: p(1400, 14, 0.6, 0.08, 0.12, 0.7, "pulse", "fall"),
  orbit: p(2200, 12, 0.9, 0.07, 0.04, 0.4, "offbeat", "rise"),
  ruin: p(1300, 10, 0.5, 0.05, 0.06, 0.7, "octave", "fall"),
  rift: p(1200, 16, 0.7, 0.09, 0.13, 0.8, "pulse", "call"),
  dune: p(1700, 10, 0.5, 0.05, 0.05, 0.6, "octave", "rise"),
  abyss: p(1200, 12, 0.8, 0.07, 0.04, 0.8, "pulse", "fall"),
  storm: p(1800, 14, 0.6, 0.08, 0.12, 0.6, "octave", "pulse"),
  jungle: p(1900, 12, 0.6, 0.06, 0.07, 0.5, "offbeat", "call"),
  volcano: p(1300, 12, 0.5, 0.07, 0.09, 0.8, "octave", "fall"),
  geode: p(2400, 14, 0.8, 0.07, 0.08, 0.4, "offbeat", "pulse"),
  gear: p(1600, 8, 0.4, 0.05, 0.1, 0.6, "pulse", "call"),
  tide: p(1800, 12, 0.9, 0.08, 0.05, 0.5, "offbeat", "rise"),
};
