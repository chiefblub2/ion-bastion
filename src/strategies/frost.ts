import { b, type Strategies } from "./build";
/** Sector II: A plays the intended tactic, B an alternative. */
export const FROST_STRATEGIES: Strategies = {
  eisbrecher: {
    // Impuls and Flak open, then two lances fire along the middle straight and down its east end.
    A: { builds: [b("pulse", 3, 7), b("flak", 16, 3), b("lance", 6, 4), b("lance", 20, 5)] },
    // No lances: two Novas splash the dense rows, Tesla chains along the middle straight.
    B: { builds: [b("blast", 4, 3), b("tesla", 14, 7), b("flak", 16, 3), b("blast", 19, 7)] },
  },
  kryotal: {
    // Kryo in the middle of the M slows both inner legs, Glut burns the slowed groups, Impuls finishes.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 5, 6), b("frost", 9, 4), b("inferno", 13, 6), b("pulse", 9, 7),
        b("inferno", 5, 3), b("frost", 13, 4), b("flak", 9, 8),
      ],
    },
    // Two Novas between the legs splash the runner packs, Tesla and Flak for the air.
    B: { builds: [b("blast", 5, 6), b("blast", 9, 4), b("tesla", 13, 7), b("flak", 9, 7)] },
  },
  gletscherspalte: {
    // Tesla coils inside the crevasse gaps: every bolt jumps along and across the folds.
    A: {
      builds: [
        b("tesla", 9, 6), b("pulse", 7, 5), b("flak", 11, 3), b("tesla", 5, 5), b("tesla", 11, 7),
        b("blast", 7, 8),
      ],
    },
    // Novas in the gaps splash two folds at once, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [b("blast", 7, 6), b("blast", 11, 4), b("flak", 9, 5), b("pulse", 5, 4), b("frost", 9, 8)],
    },
  },
  polarnacht: {
    // Three Flak in the notch of the V cover both arms, Impuls and Nova handle the ground.
    A: {
      builds: [b("pulse", 14, 5), b("flak", 9, 6), b("blast", 9, 4), b("flak", 7, 7), b("flak", 11, 7)],
    },
    // Tesla coils hit air and ground alike, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [b("tesla", 9, 7), b("tesla", 9, 5), b("flak", 13, 5), b("pulse", 7, 8), b("blast", 11, 8)],
    },
  },
  frostwall: {
    // Zerfall at the gate breaks the titans, Nova and Flak cover the rest.
    A: {
      builds: [
        b("decay", 13, 5), b("blast", 13, 7), b("flak", 15, 4), b("pulse", 15, 7), b("decay", 15, 5),
        b("frost", 13, 4), b("blast", 12, 9), b("decay", 4, 9), b("flak", 6, 7),
      ],
    },
    // Lances along the long rows with Korrosion, no Zerfall.
    B: {
      builds: [
        b("lance", 15, 8), b("acid", 13, 7), b("flak", 15, 4), b("lance", 2, 11), b("blast", 13, 4),
        b("acid", 4, 9), b("pulse", 15, 7), b("lance", 9, 2),
      ],
    },
  },
};
