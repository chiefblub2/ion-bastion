import { b, type Strategies } from "./build";
/** Sector XIII: A plays the intended tactic, B an alternative. */
export const GEODE_STRATEGIES: Strategies = {
  quarzstollen: {
    // Infernos in the centre: their burn passes the facet; Frost holds the golems in range.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 1), b("blast", 6, 3), b("frost", 10, 5), b("inferno", 7, 3), b("inferno", 5, 1),
        b("inferno", 8, 5),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 1), b("blast", 6, 3), b("frost", 10, 5), b("tar", 5, 2), b("stasis", 8, 5),
        b("executioner", 4, 3), b("tesla", 10, 1), b("acid", 3, 5),
      ],
    },
  },
  spiegelsaal: {
    A: {
      upgradeFirst: true,
      builds: [
        b("flak", 6, 1), b("pulse", 6, 3), b("frost", 10, 5), b("inferno", 5, 3), b("tesla", 10, 1),
        b("inferno", 8, 5), b("blast", 10, 3), b("executioner", 3, 5), b("decay", 8, 7),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("flak", 6, 1), b("pulse", 6, 3), b("tesla", 10, 5), b("stasis", 5, 3), b("blast", 10, 1),
        b("tar", 8, 2), b("acid", 7, 5), b("executioner", 8, 7),
      ],
    },
  },
  geodenkammer: {
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 2, 4), b("flak", 6, 3), b("frost", 5, 7), b("inferno", 10, 3), b("tesla", 2, 7),
        b("blast", 6, 5), b("inferno", 4, 3), b("executioner", 10, 6),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 2, 4), b("flak", 6, 3), b("blast", 5, 7), b("frost", 10, 3), b("tesla", 6, 5),
        b("inferno", 2, 7), b("executioner", 10, 6),
      ],
    },
  },
  prismenschacht: {
    // The detector uncovers the phantoms; Flak and Tesla take the moths.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 5, 2), b("flak", 4, 4), b("tesla", 5, 6), b("detector", 7, 4), b("inferno", 7, 2),
        b("frost", 3, 2), b("blast", 8, 6), b("executioner", 3, 6), b("decay", 8, 8),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 5, 2), b("flak", 4, 4), b("tesla", 5, 6), b("detector", 7, 4), b("blast", 7, 2),
        b("stasis", 8, 8), b("acid", 3, 2), b("executioner", 3, 6),
      ],
    },
  },
  kristallherz: {
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 3), b("flak", 6, 1), b("frost", 10, 5), b("inferno", 4, 3), b("tesla", 8, 5),
        b("blast", 10, 1), b("inferno", 9, 3), b("executioner", 5, 7), b("decay", 4, 9), b("flak", 11, 9),
        b("inferno", 8, 7), b("pulse", 8, 3), b("blast", 3, 5),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 3), b("flak", 6, 1), b("blast", 10, 5), b("stasis", 4, 3), b("tesla", 8, 5),
        b("acid", 10, 1), b("tar", 7, 2), b("executioner", 5, 7), b("decay", 4, 9), b("flak", 11, 9),
      ],
    },
  },
};
