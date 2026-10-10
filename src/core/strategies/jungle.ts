import { b, type Strategies } from "./build";
/** Sector X: A plays the intended tactic, B an alternative. */
export const JUNGLE_STRATEGIES: Strategies = {
  lianenpfad: {
    // Blast and Shrapnel thin the swarms from the one-row gaps; Executioners and Decay for the tanks.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 1), b("pulse", 6, 3), b("shrapnel", 10, 3), b("blast", 8, 5), b("executioner", 4, 5),
        b("decay", 6, 7), b("frost", 12, 5), b("flak", 4, 1), b("mortar", 12, 3),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 1), b("pulse", 6, 3), b("quake", 10, 3), b("tesla", 8, 5), b("decay", 4, 5),
        b("frost", 8, 7), b("blast", 12, 5),
      ],
    },
  },
  tempelstufen: {
    // Decay and Executioners against the regenerating colossi, Blast and Flak inside the spiral.
    A: {
      upgradeFirst: true,
      builds: [
        b("decay", 9, 4), b("blast", 3, 5), b("executioner", 9, 3), b("flak", 8, 7), b("pulse", 7, 3),
        b("decay", 4, 3), b("quake", 4, 7), b("frost", 9, 5), b("acid", 3, 3), b("tesla", 7, 5),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("decay", 9, 4), b("blast", 3, 5), b("acid", 9, 3), b("flak", 8, 7), b("pulse", 7, 3),
        b("mortar", 4, 7), b("frost", 9, 5), b("decay", 4, 3),
      ],
    },
  },
  mangrovensumpf: {
    // Only area and burst towers: Decay and Executioners for the colossi, Blast and Quake in the double gaps.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 4), b("blast", 3, 5), b("flak", 4, 2), b("decay", 6, 7), b("executioner", 8, 3), b("quake", 9, 6),
        b("shrapnel", 3, 8), b("mortar", 9, 8), b("acid", 1, 5), b("pulse", 6, 7),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 4), b("blast", 3, 5), b("flak", 4, 2), b("decay", 6, 7), b("shrapnel", 3, 8),
        b("executioner", 8, 3), b("acid", 1, 5), b("mortar", 9, 8), b("quake", 9, 6),
      ],
    },
  },
  schlangengrube: {
    // Ten energy: Decay and Executioners stop the colossi, Blast and Shrapnel the swarms in the tight coils.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 5), b("blast", 6, 3), b("flak", 4, 7), b("decay", 8, 5), b("shrapnel", 9, 7),
        b("executioner", 8, 3), b("quake", 4, 5), b("acid", 11, 5), b("mortar", 9, 3),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 5), b("blast", 6, 3), b("flak", 4, 7), b("decay", 8, 5), b("tesla", 10, 5),
        b("acid", 8, 3), b("mortar", 9, 7), b("frost", 12, 7), b("executioner", 4, 5),
      ],
    },
  },
  "herz-des-dschungels": {
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 4), b("blast", 6, 1), b("flak", 9, 4), b("decay", 6, 7), b("shrapnel", 4, 4),
        b("executioner", 10, 6), b("quake", 4, 7), b("tesla", 8, 9), b("acid", 12, 4), b("frost", 12, 9),
        b("flak", 6, 11), b("mortar", 12, 7),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 4), b("blast", 6, 1), b("flak", 9, 4), b("decay", 6, 7), b("tesla", 4, 4),
        b("acid", 10, 6), b("frost", 12, 4), b("mortar", 8, 9), b("executioner", 4, 7),
      ],
    },
  },
};
