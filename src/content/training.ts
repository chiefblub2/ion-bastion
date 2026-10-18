import type { MissionDefinition, Point } from "../core/types";
import { parseMap } from "./maps";
import { g } from "./waves";
// The guided Training mission: a short, forgiving map that the coach (`ui/coach.ts`) walks a new player through.
// It is not part of the campaign, so it stays out of `MISSIONS`, the sectors, the balance script and multiplayer.
export const TRAINING_MAP = parseMap("training", "Training Grounds", [
  "............",
  "S=======...#",
  ".......=....",
  "..#....=....",
  ".......=....",
  ".......====R",
  "............",
  "....#.......",
], "outpost");
/** The cell the coach suggests for the first tower: inside the bend, so it covers both legs of the path. */
export const TRAINING_SPOT: Point = { x: 6, y: 2 };
export const TRAINING: MissionDefinition = {
  id: "training",
  name: "Training",
  focus: "Learn to build, start waves and upgrade",
  map: TRAINING_MAP,
  waves: [
    { groups: [g("drone", 5, 1.8)], bonus: 110 },
    { groups: [g("drone", 8, 1.1)], bonus: 40 },
    { groups: [g("drone", 8, 1), g("runner", 4, 1, 6)], bonus: 50 },
    { groups: [g("drone", 10, 0.9), g("tank", 2, 2.5, 6)], bonus: 60 },
  ],
  startingCredits: 100,
  reactorEnergy: 10,
  availableTowers: ["pulse", "frost"],
  manualWaves: true,
};
