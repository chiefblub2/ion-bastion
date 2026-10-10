import { b, type Strategies } from "./build";
/** Sector VII: A plays the intended tactic, B an alternative. */
export const DUNE_STRATEGIES: Strategies = {
  treibsand: {
    // Acid strips the Skarabäen armour, Nova and Tesla mop up in the gaps.
    A: { builds: [b("pulse", 6, 3), b("frost", 7, 5), b("acid", 8, 7), b("blast", 10, 5), b("pulse", 10, 3), b("tesla", 11, 7)] },
    // Upgrades first: Tesla and Lance in the middle gaps, Nova and Zerfall against the armoured tanks.
    B: { upgradeFirst: true, builds: [b("tesla", 6, 3), b("lance", 7, 5), b("blast", 8, 7), b("decay", 10, 3), b("frost", 10, 5)] },
  },
  karawanenweg: {
    // Nova and Tesla on the gaps, upgraded first; a Mine at the end of the first ridge and Spikes at the turn catch the Gräber when they surface.
    A: {
      upgradeFirst: true,
      builds: [b("blast", 7, 6), b("tesla", 4, 4), b("flak", 10, 4), b("frost", 6, 3), b("mine", 5, 9), b("spikes", 8, 2), b("pulse", 13, 4)],
    },
    // No traps: Tesla chains, Nova splash and a Quake handle the Gräber on their own.
    B: {
      upgradeFirst: true,
      builds: [b("blast", 7, 6), b("tesla", 4, 4), b("flak", 10, 4), b("frost", 6, 3), b("decay", 12, 6), b("quake", 10, 6), b("pulse", 13, 4)],
    },
  },
  glasebene: {
    // Only traps plus Nova, Frost and Flak: Mines and Spikes in the corners where the legs turn, Novas splash the surfacing Gräber.
    A: {
      builds: [b("mine", 14, 1), b("tar", 1, 3), b("blast", 8, 1), b("frost", 5, 3), b("flak", 10, 5), b("blast", 5, 5)],
    },
    B: {
      upgradeFirst: true,
      builds: [b("blast", 8, 1), b("frost", 5, 3), b("flak", 10, 5), b("blast", 5, 5), b("mine", 14, 1), b("spikes", 14, 5), b("pit", 6, 2)],
    },
  },
  sturmkamm: {
    // Tesla and Nova, upgraded first; Mines and Spikes on the switchbacks wear down everything that surfaces, Flak covers the air.
    A: {
      upgradeFirst: true,
      builds: [b("tesla", 5, 3), b("blast", 9, 3), b("flak", 7, 5), b("frost", 11, 5), b("mine", 8, 4), b("spikes", 9, 6), b("pulse", 12, 3)],
    },
    // A Quake and Zerfall against the heavy ones, no traps.
    B: {
      upgradeFirst: true,
      builds: [b("tesla", 5, 3), b("blast", 9, 3), b("flak", 7, 5), b("frost", 11, 5), b("pulse", 12, 3), b("quake", 9, 7), b("decay", 5, 5)],
    },
  },
  "oase-null": {
    // Tesla and Nova between the rings, upgraded first; a Mine and Spikes on the outer ring catch the Gräber.
    A: {
      upgradeFirst: true,
      builds: [b("tesla", 7, 3), b("blast", 11, 3), b("flak", 16, 4), b("frost", 7, 7), b("mine", 9, 4), b("spikes", 10, 8), b("pulse", 3, 5)],
    },
    // A Quake in the heart of the spiral, no traps.
    B: {
      upgradeFirst: true,
      builds: [b("tesla", 7, 3), b("blast", 11, 3), b("flak", 16, 4), b("frost", 7, 7), b("pulse", 3, 5), b("quake", 11, 7), b("decay", 16, 7)],
    },
  },
};
