import { b, type Strategies } from "./build";
/** Sector III: A plays the intended tactic, B an alternative. */
export const TOXIC_STRATEGIES: Strategies = {
  sickergrube: {
    // Korrosion in the pit between both legs, Impuls and Nova profit from the extra damage.
    A: {
      builds: [
        b("acid", 8, 6), b("pulse", 9, 6), b("flak", 6, 5), b("pulse", 8, 7), b("blast", 9, 8),
        b("acid", 9, 5), b("frost", 11, 6), b("pulse", 6, 3), b("blast", 11, 8), b("pulse", 12, 2),
      ],
    },
    // Tesla and Nova in the pit, Impuls on both rims, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 9, 7), b("blast", 8, 5), b("pulse", 12, 5), b("flak", 11, 3), b("frost", 6, 8),
        b("blast", 11, 8), b("pulse", 5, 3),
      ],
    },
  },
  nebelsumpf: {
    // Stasis at the bottom of the V freezes dense groups inside the splash of two Novas.
    A: {
      builds: [
        b("stasis", 11, 8), b("blast", 10, 7), b("blast", 11, 6), b("pulse", 10, 8), b("flak", 10, 5),
        b("pulse", 12, 6), b("stasis", 8, 5), b("blast", 6, 4), b("tesla", 14, 4),
      ],
    },
    // No stasis: Nova, Tesla and Kryo in the V, more Tesla on the entry staircase.
    B: {
      builds: [
        b("blast", 10, 7), b("tesla", 11, 7), b("frost", 10, 8), b("flak", 11, 6), b("pulse", 11, 8),
        b("blast", 12, 6), b("tesla", 8, 5), b("pulse", 6, 4),
      ],
    },
  },
  brackwasser: {
    // Korrosion inside the upper loop marks everything for the Impuls ring around it.
    A: {
      builds: [
        b("acid", 10, 4), b("pulse", 11, 4), b("flak", 8, 3), b("pulse", 9, 4), b("frost", 10, 5),
        b("pulse", 6, 5), b("pulse", 8, 5), b("acid", 6, 2), b("pulse", 11, 7),
      ],
    },
    // No Korrosion: Impuls and Kryo in the lower basin between the pools.
    B: {
      builds: [
        b("pulse", 5, 7), b("pulse", 11, 8), b("flak", 10, 7), b("frost", 6, 8), b("pulse", 6, 5),
        b("pulse", 10, 8),
      ],
    },
  },
  faulturm: {
    // Aura early in the middle of the spiral, the cluster around it covers both inner rings.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 11, 7), b("aura", 10, 6), b("flak", 9, 5), b("tesla", 12, 5), b("frost", 9, 8),
        b("pulse", 12, 8), b("tesla", 10, 4), b("blast", 8, 7), b("pulse", 12, 7),
      ],
    },
    // No aura: Novas in the middle plus towers outside the outer ring.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 11, 7), b("tesla", 12, 5), b("flak", 9, 5), b("blast", 16, 6), b("frost", 0, 7),
        b("pulse", 12, 8), b("blast", 8, 12), b("tesla", 0, 4),
      ],
    },
  },
  giftkessel: {
    // Nova and Korrosion in the bowl, Zerfall against the panzer and titan waves.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 10, 8), b("acid", 9, 7), b("tesla", 11, 7), b("pulse", 11, 6), b("decay", 13, 7),
        b("blast", 13, 8), b("flak", 14, 4), b("decay", 9, 4),
      ],
    },
    // No Korrosion: Tesla and Impuls in the bowl, two Zerfall towers for the titans.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 10, 8), b("pulse", 9, 7), b("pulse", 11, 6), b("blast", 13, 8), b("decay", 11, 8),
        b("flak", 14, 4), b("frost", 9, 6), b("decay", 6, 8),
      ],
    },
  },
};
