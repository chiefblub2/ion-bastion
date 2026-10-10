import { b, type Strategies } from "./build";
/** Sector XII: A plays the intended tactic, B an alternative. */
export const VOLCANO_STRATEGIES: Strategies = {
  aschefeld: {
    // Frost and Tar slow the enraging embers, the Executioner finishes them.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 4, 1), b("pulse", 4, 3), b("frost", 8, 3), b("executioner", 6, 5), b("tar", 5, 2), b("flak", 8, 5),
        b("decay", 2, 3), b("blast", 9, 1), b("pulse", 3, 5), b("tesla", 9, 3), b("executioner", 1, 3), b("tar", 7, 4),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 4, 1), b("pulse", 4, 3), b("tesla", 8, 3), b("stasis", 6, 5), b("executioner", 3, 5), b("frost", 7, 1),
        b("blast", 8, 5), b("decay", 2, 3),
      ],
    },
  },
  lavastrom: {
    // Flak and Tesla take the slow-immune ashwings, Frost and Tar hold the embers.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 4, 3), b("pulse", 9, 5), b("flak", 4, 1), b("tesla", 8, 3), b("frost", 8, 5), b("executioner", 4, 5),
        b("tar", 5, 4), b("decay", 8, 7), b("flak", 11, 3), b("blast", 9, 1), b("pulse", 3, 7), b("tesla", 11, 5),
        b("executioner", 11, 7),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 4, 3), b("pulse", 9, 5), b("flak", 4, 1), b("tesla", 8, 3), b("stasis", 8, 5), b("executioner", 4, 5),
        b("executioner", 11, 7), b("decay", 4, 7), b("snare", 5, 4), b("flak", 11, 3), b("blast", 9, 1), b("pulse", 3, 7), b("tesla", 11, 5),
      ],
    },
  },
  schlackengrat: {
    // No slows: burst towers and Executioners fell the raging embers, Flak and Tesla the ashwings.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 3), b("pulse", 8, 5), b("flak", 4, 1), b("tesla", 8, 1), b("executioner", 3, 3), b("decay", 6, 7),
        b("mortar", 10, 5), b("quake", 4, 5), b("blast", 8, 7), b("executioner", 11, 3), b("flak", 10, 1), b("pulse", 3, 7),
        b("spikes", 5, 4),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 3), b("pulse", 8, 5), b("flak", 4, 1), b("tesla", 8, 1), b("shrapnel", 3, 3), b("executioner", 7, 7),
        b("acid", 9, 3), b("inferno", 4, 5), b("blast", 8, 7), b("flak", 10, 1), b("pulse", 3, 7), b("executioner", 11, 3),
      ],
    },
  },
  glutkammer: {
    // Ten energy: stack the coils with burst and anti-air before anything reaches the reactor.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 3), b("pulse", 6, 7), b("flak", 4, 1), b("frost", 8, 5), b("tesla", 8, 1), b("executioner", 4, 5),
        b("tar", 5, 4), b("decay", 8, 9), b("blast", 8, 7), b("flak", 11, 3), b("executioner", 11, 5), b("pulse", 3, 9),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 3), b("pulse", 6, 7), b("flak", 4, 1), b("stasis", 8, 5), b("tesla", 8, 1), b("executioner", 4, 5),
        b("snare", 5, 4), b("shrapnel", 8, 9), b("blast", 8, 7), b("flak", 11, 3), b("executioner", 11, 5), b("pulse", 3, 9),
      ],
    },
  },
  vulkanschlund: {
    // Frost and Tar for the embers, Flak and Tesla for the wings, Executioners for the titans.
    A: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 4), b("flak", 4, 1), b("pulse", 4, 9), b("tesla", 9, 4), b("frost", 6, 7), b("executioner", 10, 6),
        b("tar", 5, 2), b("decay", 6, 1), b("flak", 10, 1), b("quake", 4, 7), b("blast", 10, 9), b("executioner", 4, 4),
        b("tesla", 9, 7), b("pulse", 10, 11), b("executioner", 8, 9),
      ],
    },
    B: {
      upgradeFirst: true,
      builds: [
        b("blast", 6, 4), b("flak", 4, 1), b("pulse", 4, 9), b("tesla", 9, 4), b("stasis", 6, 7), b("executioner", 10, 6),
        b("shrapnel", 4, 4), b("snare", 5, 2), b("flak", 10, 1), b("blast", 10, 9), b("executioner", 4, 7), b("tesla", 9, 7),
        b("executioner", 8, 9), b("acid", 11, 4),
      ],
    },
  },
};
