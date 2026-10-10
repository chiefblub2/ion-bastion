import { b, type Strategies } from "./build";
/** Sector VIII (Zahnwerk): A plays the intended tactic, B an alternative. */
export const GEAR_STRATEGIES: Strategies = {
  zahnkranz: {
    // Pockets between the teeth reach several legs; frost and tesla stop the cogs early.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 4, 2), b("frost", 8, 3), b("tesla", 8, 2), b("blast", 4, 9), b("pulse", 12, 2),
        b("blast", 8, 9), b("flak", 6, 8), b("pulse", 12, 9), b("tesla", 10, 8),
      ],
    },
    // Gravitron in the middle pulls the cogs back, novas in the bottom pockets.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 8, 3), b("gravity", 7, 4), b("blast", 4, 9), b("frost", 4, 2),
        b("pulse", 12, 2), b("blast", 8, 9), b("pulse", 12, 9), b("flak", 10, 8),
      ],
    },
  },
  hemmung: {
    // Corridor towers reach both legs; decay and focus take the pistons on lap one.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 4, 4), b("decay", 8, 4), b("focus", 10, 4), b("frost", 12, 4), b("flak", 6, 5),
        b("pulse", 16, 4), b("tesla", 18, 5), b("blast", 2, 4), b("flak", 14, 5), b("lance", 8, 6),
      ],
    },
    // Lance on the long corridor, frost and tesla for the cogs.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 4, 4), b("lance", 10, 4), b("pulse", 12, 4), b("frost", 16, 4),
        b("decay", 8, 5), b("flak", 18, 4), b("blast", 14, 5), b("pulse", 6, 3),
      ],
    },
  },
  unruh: {
    // The lane between the tips bundles four legs; notch towers cover the pinch from both sides.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 3, 5), b("tesla", 7, 5), b("frost", 11, 5), b("pulse", 7, 2),
        b("blast", 3, 4), b("flak", 11, 6), b("decay", 7, 8), b("pulse", 11, 4), b("blast", 3, 6),
      ],
    },
    // Tesla in the waist, novas in the notches; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 3, 5), b("blast", 11, 5), b("tesla", 7, 5), b("frost", 7, 2),
        b("flak", 11, 4), b("pulse", 7, 8), b("lance", 3, 4), b("blast", 3, 6),
      ],
    },
  },
  planetenrad: {
    // Each arm lane tower sees both legs and an inner corner; gravity and lance hold the hub.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 7, 4), b("frost", 4, 7), b("tesla", 7, 10), b("pulse", 10, 7), b("gravity", 7, 7),
        b("flak", 7, 2), b("decay", 4, 6), b("lance", 10, 8), b("blast", 7, 12),
      ],
    },
    // Tesla and nova on opposite arms, focus down the lane.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 4, 7), b("tesla", 7, 4), b("blast", 10, 7), b("frost", 7, 10),
        b("focus", 7, 7), b("flak", 4, 8), b("lance", 7, 12), b("decay", 7, 2),
      ],
    },
  },
  uhrwerk: {
    // The hook lane first: corridor towers see both legs; decay and focus for pistons, frost for cogs.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 11, 4), b("tesla", 6, 2), b("frost", 8, 5), b("pulse", 4, 4), b("focus", 11, 6),
        b("blast", 3, 6), b("flak", 11, 7), b("decay", 5, 7), b("lance", 12, 8),
      ],
    },
    // Pulse on the right side, nova in the pocket, tesla at the hook.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 12, 5), b("blast", 4, 6), b("pulse", 4, 4), b("tesla", 8, 5),
        b("frost", 6, 2), b("flak", 11, 7), b("lance", 4, 7), b("decay", 5, 8),
      ],
    },
  },
};
