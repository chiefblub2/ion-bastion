import { b, type Strategies } from "./build";
/** Sector VI: A plays the intended tactic, B an alternative. */
export const RIFT_STRATEGIES: Strategies = {
  ereignishorizont: {
    // Kryo and Stasis in the gap between both orbits; every tower there hits two passes.
    A: {
      builds: [
        b("pulse", 14, 9), b("frost", 13, 10), b("blast", 9, 10), b("flak", 14, 5), b("stasis", 14, 1),
        b("pulse", 3, 1), b("blast", 5, 10), b("tesla", 11, 1), b("pulse", 2, 10),
      ],
    },
    // Tesla chains and a Lance on the inner orbit near the event horizon, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 14, 5), b("blast", 13, 10), b("flak", 8, 1), b("frost", 2, 10),
        b("blast", 7, 10), b("decay", 14, 1), b("lance", 4, 3),
      ],
    },
  },
  riss: {
    // Every tower in the bolt's elbows covers two legs; Kryo stalls the rush, a Lance pierces the unstoppable Berserkers.
    A: {
      builds: [
        b("pulse", 4, 3), b("frost", 6, 5), b("pulse", 8, 7), b("flak", 5, 5), b("blast", 7, 7),
        b("lance", 5, 5), b("tesla", 2, 1), b("blast", 7, 5), b("pulse", 9, 7), b("frost", 3, 1),
      ],
    },
    // Korrosion in the first elbow makes every later hit count; Lance and Zerfall for the heavy ones.
    B: {
      builds: [
        b("acid", 4, 3), b("frost", 7, 5), b("tesla", 5, 2), b("pulse", 6, 5), b("blast", 2, 1),
        b("lance", 5, 5), b("decay", 3, 1), b("pulse", 9, 7),
      ],
    },
  },
  zeitschleife: {
    // A Lance in the top corner pierces the Berserkers, Stasis freezes the echo waves, Zerfall cuts their inflated HP.
    A: {
      builds: [
        b("acid", 12, 1), b("pulse", 4, 10), b("pulse", 11, 2), b("lance", 13, 1), b("decay", 2, 10),
        b("blast", 6, 9), b("flak", 16, 1), b("stasis", 3, 10), b("acid", 5, 10),
      ],
    },
    // Two Lances in the top corner pierce along the top bar and the diagonal, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 6, 9), b("lance", 13, 1), b("flak", 16, 1), b("lance", 14, 1), b("inferno", 5, 10),
        b("pulse", 4, 9),
      ],
    },
  },
  nullpunkt: {
    // Lances fire down the long legs and pierce whole tank columns; Korrosion softens them, upgrades first.
    A: {
      upgradeFirst: true,
      builds: [
        b("lance", 8, 3), b("blast", 10, 8), b("acid", 5, 5), b("pulse", 11, 7), b("lance", 10, 4),
        b("blast", 4, 3),
      ],
    },
    // No Lance: Novas and Tesla at the first legs, Korrosion and two Zerfall for the armour, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 4, 3), b("blast", 5, 3), b("tesla", 8, 5), b("tesla", 4, 8), b("acid", 4, 4),
        b("pulse", 10, 4), b("decay", 7, 5), b("decay", 11, 7),
      ],
    },
  },
  singularitaet: {
    // An Aura in the inner ring powers Lances and Zerfall across the spiral; a Detector at the last rings unmasks the Phantoms.
    A: {
      builds: [
        b("decay", 13, 3), b("acid", 7, 4), b("aura", 12, 3), b("lance", 7, 5), b("frost", 9, 3),
        b("pulse", 7, 3), b("detector", 9, 9), b("lance", 11, 3), b("stasis", 7, 7),
        b("blast", 7, 8), b("tesla", 5, 5), b("pulse", 5, 7),
      ],
    },
    // Novas, Glut and Korrosion close to the core, two Stasis and Zerfall for the Titans, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 7, 8), b("inferno", 8, 9), b("lance", 7, 7), b("blast", 13, 5), b("frost", 7, 5),
        b("acid", 7, 9), b("stasis", 11, 3), b("stasis", 7, 7), b("decay", 13, 7), b("frost", 13, 3),
      ],
    },
  },
};
