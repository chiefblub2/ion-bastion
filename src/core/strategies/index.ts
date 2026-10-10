import { ABYSS_STRATEGIES } from "./abyss";
import { b, type Strategies } from "./build";
import { CIRCLE_STRATEGIES } from "./circle";
import { DUNE_STRATEGIES } from "./dune";
import { FROST_STRATEGIES } from "./frost";
import { GEAR_STRATEGIES } from "./gear";
import { GEODE_STRATEGIES } from "./geode";
import { JUNGLE_STRATEGIES } from "./jungle";
import { ORBIT_STRATEGIES } from "./orbit";
import { RIFT_STRATEGIES } from "./rift";
import { RUIN_STRATEGIES } from "./ruin";
import { STORM_STRATEGIES } from "./storm";
import { TIDE_STRATEGIES } from "./tide";
import { TOXIC_STRATEGIES } from "./toxic";
import { VOLCANO_STRATEGIES } from "./volcano";
/** Sector I; the other sectors keep their strategies in their own module. */
const GRENZZONE: Strategies = {
  "outpost-07": {
    // Both inner corners of the first loop, then the second loop.
    A: {
      builds: [
        b("pulse", 4, 4), b("pulse", 6, 5), b("pulse", 6, 7), b("blast", 9, 7), b("frost", 9, 4),
        b("pulse", 11, 4), b("blast", 13, 4), b("pulse", 13, 7), b("frost", 11, 7),
      ],
    },
    // Tesla and Nova in the middle loop, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("tesla", 6, 6), b("blast", 9, 6), b("pulse", 4, 4), b("frost", 9, 4),
        b("blast", 6, 4), b("pulse", 13, 5), b("tesla", 11, 6),
      ],
    },
  },

  schleusenring: {
    // Inner area between both legs, aura in the middle.
    A: {
      builds: [
        b("pulse", 10, 5), b("pulse", 12, 5), b("frost", 13, 6), b("blast", 8, 5),
        b("aura", 11, 5), b("flak", 9, 5), b("pulse", 6, 5), b("blast", 12, 8), b("pulse", 9, 6),
      ],
    },
    // Novas on the corners and edge positions, upgrades first.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 13, 5), b("pulse", 15, 6), b("frost", 13, 8), b("tesla", 11, 5), b("blast", 7, 5),
        b("pulse", 15, 2), b("blast", 11, 9), b("pulse", 15, 8),
      ],
    },
  },
  splitterfeld: {
    // Small islands between two legs.
    A: {
      builds: [
        b("pulse", 5, 4), b("pulse", 9, 5), b("frost", 6, 4), b("blast", 10, 5),
        b("flak", 13, 7), b("blast", 12, 7), b("tesla", 5, 9), b("frost", 9, 8),
        b("pulse", 13, 9), b("blast", 6, 9),
      ],
    },
    // Nova and Kryo on the islands instead of Impuls.
    B: {
      builds: [
        b("blast", 5, 4), b("frost", 6, 4), b("blast", 9, 5), b("frost", 10, 5),
        b("tesla", 12, 7), b("flak", 13, 7), b("blast", 6, 9), b("pulse", 9, 8),
        b("flak", 13, 9),
      ],
    },
  },
  glutpass: {
    // Kryo on both curves, reserve before the reactor.
    A: {
      builds: [
        b("pulse", 13, 3), b("frost", 12, 3), b("pulse", 5, 7), b("blast", 12, 2),
        b("frost", 4, 7), b("flak", 13, 4), b("blast", 5, 6), b("tesla", 15, 8),
        b("blast", 14, 10),
      ],
    },
    // Aura cluster in the first hairpin, novas in the reserve.
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 13, 3), b("pulse", 13, 2), b("frost", 11, 3), b("aura", 12, 3),
        b("flak", 13, 4), b("blast", 15, 8), b("tesla", 16, 8), b("frost", 15, 7),
        b("blast", 4, 7), b("pulse", 13, 10),
      ],
    },
  },
  kernfestung: {
    // A defense zone in every ring, aura between middle and inner.
    A: {
      builds: [
        b("pulse", 15, 3), b("pulse", 10, 3), b("frost", 14, 8), b("blast", 15, 8),
        b("aura", 14, 6), b("flak", 9, 8), b("blast", 6, 6), b("tesla", 8, 6),
        b("pulse", 6, 8), b("pulse", 11, 6), b("blast", 5, 2),
      ],
    },
    // Concentrated core around the reactor, plus outer support.
    B: {
      builds: [
        b("blast", 8, 6), b("pulse", 6, 6), b("pulse", 10, 6), b("aura", 8, 5),
        b("frost", 11, 5), b("blast", 5, 6), b("tesla", 10, 8), b("flak", 4, 6),
        b("blast", 15, 3), b("pulse", 15, 5), b("frost", 7, 9),
      ],
    },
  },
};
/** Two different defenses per map: A plays the intended tactic, B an alternative. */
export const STRATEGIES: Strategies = {
  ...GRENZZONE,
  ...FROST_STRATEGIES,
  ...TOXIC_STRATEGIES,
  ...ORBIT_STRATEGIES,
  ...RUIN_STRATEGIES,
  ...RIFT_STRATEGIES,
  ...DUNE_STRATEGIES,
  ...ABYSS_STRATEGIES,
  ...STORM_STRATEGIES,
  ...JUNGLE_STRATEGIES,
  ...VOLCANO_STRATEGIES,
  ...GEODE_STRATEGIES,
  ...CIRCLE_STRATEGIES,
  ...GEAR_STRATEGIES,
  ...TIDE_STRATEGIES,
};
