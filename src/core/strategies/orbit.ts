import { b, type Strategies } from "./build";
/** Sector IV: A plays the intended tactic, B an alternative. */
export const ORBIT_STRATEGIES: Strategies = {
  andockring: {
    // Two refineries right after the first tower, then the ring's inner corners.
    A: {
      builds: [
        b("pulse", 12, 3), b("refinery", 17, 0), b("refinery", 17, 11), b("blast", 12, 6),
        b("frost", 13, 9), b("flak", 10, 3), b("blast", 10, 5), b("tesla", 13, 2),
        b("pulse", 4, 5), b("blast", 4, 9), b("aura", 12, 5), b("pulse", 13, 8),
      ],
    },
    // No economy: tesla and novas inside the ring, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 12, 5), b("blast", 10, 3), b("pulse", 13, 9), b("frost", 12, 3),
        b("blast", 10, 6), b("flak", 4, 5), b("blast", 4, 9), b("pulse", 9, 5),
      ],
    },
  },
  frachtschleuse: {
    // Cheap towers in the two narrow pockets of the airlock, where they reach both legs.
    A: {
      builds: [
        b("pulse", 4, 6), b("blast", 11, 6), b("pulse", 5, 4), b("frost", 12, 7),
        b("flak", 4, 3), b("blast", 5, 7), b("tesla", 11, 4), b("blast", 8, 3), b("pulse", 12, 5),
      ],
    },
    // Three pulses upgraded early carry both pockets, novas join later; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("pulse", 5, 6), b("pulse", 12, 6), b("pulse", 4, 4), b("blast", 11, 4),
        b("blast", 5, 7), b("flak", 8, 3), b("frost", 12, 7),
      ],
    },
  },
  schwerelos: {
    // Flak nests on the inner steps of the staircase, a Detektor under it reveals the Phantome, an aura boosts, two Zerfall for the Titan.
    A: {
      upgradeFirst: true,
      builds: [
        b("flak", 7, 4), b("pulse", 10, 6), b("blast", 5, 4), b("flak", 8, 6),
        b("aura", 8, 4), b("flak", 9, 4), b("detector", 8, 7), b("decay", 7, 6), b("decay", 11, 6),
      ],
    },
    // No flak and no Detektor: all-round tesla, lance and pulse, the few Phantome slip through; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 7, 4), b("pulse", 10, 6), b("lance", 4, 2), b("tesla", 11, 8),
        b("frost", 8, 6), b("pulse", 13, 8), b("lance", 14, 10),
      ],
    },
  },
  solarsegel: {
    // Lances at the ends of the long straights fire down the whole row, a Detektor between the lanes reveals Phantome.
    A: {
      builds: [
        b("lance", 21, 4), b("pulse", 19, 3), b("lance", 0, 7), b("frost", 2, 5),
        b("lance", 0, 4), b("detector", 8, 3), b("blast", 19, 2), b("flak", 2, 6), b("lance", 21, 1),
        b("tesla", 5, 5), b("blast", 13, 3),
      ],
    },
    // Short-range novas and tesla at both turns plus a late Detektor, no lances.
    B: {
      builds: [
        b("blast", 19, 3), b("pulse", 2, 5), b("tesla", 19, 2), b("frost", 2, 6), b("blast", 3, 5),
        b("flak", 16, 3), b("blast", 21, 3), b("tesla", 12, 5), b("blast", 6, 3),
      ],
    },
  },
  kommandobruecke: {
    // Aura-boosted cluster between the bridge's horizontal lanes with a Detektor in front, Zerfall and Korrosion for the Titans.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 13, 5), b("pulse", 13, 6), b("flak", 14, 6), b("aura", 14, 5),
        b("tesla", 16, 8), b("decay", 16, 3), b("frost", 12, 6), b("acid", 16, 9), b("detector", 12, 5),
      ],
    },
    // Lances fire down the long straights, novas and tesla hold the corners, a Detektor reveals Phantome; upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 13, 5), b("lance", 19, 4), b("tesla", 16, 8), b("frost", 13, 6),
        b("decay", 16, 3), b("lance", 10, 7), b("flak", 16, 9), b("blast", 12, 6), b("detector", 12, 5),
      ],
    },
  },
};
