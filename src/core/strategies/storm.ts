import { b, type Strategies } from "./build";
/** Sector IX: A plays the intended tactic, B an alternative. */
export const STORM_STRATEGIES: Strategies = {
  wetterleuchten: {
    // Pulses and Tesla chains in the one-cell gaps reach two legs each; Frost and a Pit hold the gust runners.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 3), b("blast", 10, 3), b("flak", 8, 5), b("tesla", 6, 5), b("frost", 10, 7),
        b("pit", 12, 2), b("executioner", 8, 5), b("decay", 12, 5),
      ],
    },
    // Fewer, upgraded towers and no traps.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 3), b("blast", 10, 3), b("flak", 8, 5), b("tesla", 6, 5), b("executioner", 12, 5), b("frost", 4, 5),
      ],
    },
  },
  hagelfeld: {
    // Flak and Tesla in the gaps shoot the shielded birds down; Frost slows the gust runners.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 1), b("flak", 8, 6), b("tesla", 9, 1), b("executioner", 5, 6), b("lance", 7, 3),
        b("flak", 8, 3), b("frost", 10, 6), b("tar", 11, 10), b("pit", 10, 10), b("blast", 8, 8),
      ],
    },
    // Impulse, Decay and Tesla; Executioner and Lance break the boss.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 1), b("flak", 8, 6), b("tesla", 9, 1), b("decay", 6, 6), b("lance", 7, 3),
        b("flak", 11, 1), b("executioner", 5, 6), b("frost", 10, 6), b("tar", 11, 10), b("blast", 8, 8),
      ],
    },
  },
  blitzableiter: {
    // Everything inside the spiral covers several rings; Flak and Tesla take the birds, Executioner and Pit the heavies.
    A: {
      builds: [
        b("pulse", 4, 6), b("blast", 8, 5), b("decay", 5, 6), b("flak", 9, 6), b("tesla", 6, 3),
      ],
    },
    // Upgrades first, with Executioner and a second Flak instead of Decay.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 4, 6), b("flak", 9, 6), b("tesla", 6, 3), b("blast", 8, 5), b("executioner", 10, 5),
        b("flak", 4, 3),
      ],
    },
  },
  boeenschneise: {
    // A Detector unmasks the Phantoms; Pit and Executioner for crabs, Flak for jellyfish.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 3, 6), b("detector", 5, 7), b("flak", 7, 6), b("tesla", 3, 10), b("pit", 2, 6),
        b("executioner", 5, 5), b("blast", 9, 7), b("decay", 7, 3), b("frost", 9, 3),
        b("lance", 1, 6),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 3, 6), b("detector", 5, 7), b("blast", 7, 6), b("decay", 5, 5), b("flak", 9, 7),
        b("tesla", 3, 10),
        b("lance", 1, 6),
      ],
    },
  },
  "auge-des-sturms": {
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 8, 1), b("blast", 12, 3), b("flak", 6, 3), b("detector", 10, 3), b("lance", 7, 5),
        b("executioner", 12, 5), b("decay", 10, 5), b("tesla", 8, 8), b("pit", 10, 2), b("focus", 10, 8),
        b("frost", 14, 5), b("flak", 12, 8), b("tesla", 4, 10), b("flak", 6, 10), b("stasis", 14, 3),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 8, 1), b("blast", 12, 3), b("flak", 6, 3), b("detector", 10, 3), b("decay", 10, 5),
        b("tesla", 8, 8), b("frost", 14, 5),
        b("lance", 7, 5), b("flak", 12, 8), b("flak", 6, 10), b("tesla", 14, 3), b("executioner", 12, 5), b("focus", 10, 8),
      ],
    },
  },
};
