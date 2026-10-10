import { b, type Strategies } from "./build";
/** Sector IX (Mondsee): A plays the intended tactic, B an alternative. */
export const TIDE_STRATEGIES: Strategies = {
  ebbe: {
    // Flak and tesla where the arm of the L meets both legs.
    A: {
      upgradeFirst: true,
      builds: [
        b("flak", 13, 7), b("tesla", 14, 7), b("pulse", 12, 7), b("blast", 8, 4), b("flak", 6, 3),
        b("pulse", 5, 5), b("frost", 4, 8),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 13, 7), b("flak", 5, 4), b("pulse", 8, 6), b("blast", 16, 7), b("flak", 4, 8), b("frost", 8, 3),
      ],
    },
  },
  flutring: {
    // The notch column reaches both legs; Zerfall and Gravitron slow the swimmers.
    A: {
      upgradeFirst: true,
      builds: [
        b("flak", 9, 5), b("tesla", 9, 3), b("blast", 9, 4), b("pulse", 13, 4), b("gravity", 9, 6),
        b("decay", 5, 5), b("frost", 15, 7), b("jammer", 9, 2),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 9, 4), b("tesla", 9, 3), b("flak", 9, 5), b("pulse", 13, 4), b("frost", 4, 4), b("decay", 15, 7),
      ],
    },
  },
  brandung: {
    // The two middle runs sit two rows apart; Kryo and Zerfall hold the swimmers.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 12, 5), b("tesla", 12, 6), b("flak", 16, 6), b("frost", 8, 5), b("blast", 12, 2),
        b("decay", 12, 8), b("flak", 4, 5), b("gravity", 16, 5),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 12, 6), b("tesla", 12, 5), b("flak", 16, 6), b("pulse", 12, 8), b("frost", 8, 6), b("jammer", 12, 2),
      ],
    },
  },
  springflut: {
    // Flak and tesla in the arms, each one reaches two legs.
    A: {
      upgradeFirst: true,
      builds: [
        b("tesla", 9, 5), b("flak", 10, 7), b("blast", 10, 3), b("pulse", 9, 10), b("flak", 14, 6),
        b("frost", 5, 6), b("decay", 10, 5),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 10, 3), b("tesla", 9, 5), b("flak", 10, 7), b("pulse", 9, 10), b("flak", 14, 6), b("frost", 5, 6),
      ],
    },
  },
  mondfinsternis: {
    // The corridor row between the two middle legs, Gravitron and Störsender against the swimmers.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 9, 6), b("flak", 8, 6), b("tesla", 10, 6), b("blast", 11, 6), b("gravity", 7, 6),
        b("jammer", 12, 6), b("flak", 3, 6), b("decay", 15, 6),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 10, 6), b("tesla", 9, 6), b("pulse", 11, 6), b("flak", 8, 6), b("frost", 12, 6), b("flak", 3, 6),
      ],
    },
  },
};
