import { b, type Strategies } from "./build";
/** Sector VII (Kreislauf): A plays the intended tactic, B an alternative. */
export const CIRCLE_STRATEGIES: Strategies = {
  umlaufbahn: {
    // Inner corners first, they reach two sides of the ring each.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 3, 2), b("pulse", 12, 9), b("blast", 12, 5), b("frost", 3, 9), b("pulse", 12, 2),
        b("tesla", 7, 2), b("flak", 7, 9), b("blast", 4, 5), b("pulse", 14, 6), b("blast", 3, 3),
      ],
    },
    // A nova at the bulge, tesla inside it, then the long sides; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 12, 5), b("tesla", 14, 6), b("pulse", 7, 2), b("frost", 12, 3),
        b("blast", 7, 9), b("pulse", 4, 9), b("flak", 3, 5),
      ],
    },
  },
  doppelschleife: {
    // The notch between both legs, then the corners.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 9, 3), b("blast", 10, 2), b("pulse", 2, 2), b("frost", 10, 4), b("tesla", 9, 6),
        b("flak", 16, 2), b("blast", 2, 9), b("pulse", 16, 9), b("blast", 10, 6), b("pulse", 9, 9),
      ],
    },
    // Tesla in the notch, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 9, 3), b("blast", 10, 3), b("pulse", 9, 6), b("frost", 2, 2),
        b("blast", 16, 9), b("pulse", 16, 2), b("flak", 10, 6), b("blast", 2, 9),
      ],
    },
  },
  mahlstrom: {
    // Both notches and the corridor between them.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 9, 3), b("blast", 10, 5), b("tesla", 9, 7), b("frost", 7, 2), b("pulse", 11, 10),
        b("blast", 10, 9), b("flak", 7, 5), b("pulse", 16, 4), b("aura", 10, 7), b("blast", 3, 4),
        b("pulse", 3, 9), b("blast", 13, 9),
      ],
    },
    // Tesla in the corridor, novas in the notches; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 9, 7), b("blast", 9, 2), b("pulse", 11, 9), b("frost", 10, 4),
        b("blast", 13, 10), b("pulse", 3, 8), b("flak", 16, 7), b("blast", 10, 2), b("pulse", 7, 3),
      ],
    },
  },
};
