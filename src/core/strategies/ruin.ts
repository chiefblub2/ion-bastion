import { b, type Strategies } from "./build";
/** Sector V: A plays the intended tactic, B an alternative. */
export const RUIN_STRATEGIES: Strategies = {
  truemmerallee: {
    // Lances on rubble cells reach the avenue from afar; Impuls and Nova hold the corners.
    A: {
      builds: [
        b("frost", 14, 8), b("pulse", 9, 5), b("blast", 11, 8), b("lance", 6, 2), b("lance", 12, 9),
      ],
    },
    // Everything on the last bend, upgraded before anything new is built.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 12, 9), b("pulse", 14, 8), b("tesla", 11, 8), b("blast", 14, 9),
      ],
    },
  },
  bunkerlinie: {
    // Every bunker gap gets a tower that covers two lanes at once.
    A: {
      builds: [
        b("blast", 6, 3), b("pulse", 11, 3), b("frost", 10, 7), b("flak", 5, 7), b("blast", 15, 3),
        b("pulse", 2, 3), b("blast", 14, 7),
      ],
    },
    // Open rows right beside the lanes, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 17, 1), b("pulse", 8, 8), b("pulse", 6, 2), b("frost", 7, 8), b("pulse", 9, 2),
        b("flak", 8, 2), b("blast", 3, 8), b("frost", 11, 10),
      ],
    },
  },
  kathedrale: {
    // Focused fire at the altar loop: Korrosion weakens, an aura amplifies.
    A: {
      upgradeFirst: true,
      builds: [
        b("pulse", 10, 6), b("pulse", 9, 7), b("blast", 11, 6), b("acid", 7, 5), b("blast", 8, 4),
        b("aura", 9, 8),
      ],
    },
    // Novas along the nave, a lance looking down it, Flak for the gliders.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 9, 7), b("pulse", 10, 6), b("lance", 7, 4), b("blast", 7, 5), b("flak", 7, 8),
        b("blast", 9, 6), b("flak", 7, 10),
      ],
    },
  },
  hochbahn: {
    // Lances between the straights pierce whole sprinter lines; Kryo at the turn.
    A: {
      builds: [
        b("frost", 18, 7), b("lance", 11, 5), b("blast", 12, 7), b("lance", 18, 9), b("pulse", 8, 6),
        b("lance", 15, 7), b("lance", 11, 6), b("blast", 11, 0),
      ],
    },
    // Spread mix of Nova, Glut and Zerfall at both ends, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 2, 7), b("frost", 15, 9), b("lance", 8, 9), b("blast", 4, 4), b("lance", 8, 4),
        b("blast", 13, 10), b("inferno", 21, 5), b("flak", 3, 4), b("decay", 18, 7),
      ],
    },
  },
  zitadelle: {
    // Zerfall at the gate melts the titans, a Detektor beside it reveals the Phantome; lances on the north wall cover the long loop.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 18, 4), b("lance", 7, 2), b("pulse", 11, 10), b("lance", 14, 2), b("decay", 9, 10), b("detector", 18, 6),
      ],
    },
    // Impuls cluster at the east wall, lances and acid along the north, aura support.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 16, 9), b("lance", 10, 2), b("pulse", 16, 8), b("lance", 6, 2), b("decay", 5, 2),
        b("acid", 8, 12), b("inferno", 13, 10), b("pulse", 15, 10), b("aura", 11, 2), b("acid", 14, 2),
      ],
    },
  },
};
