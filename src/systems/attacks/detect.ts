import type { DetectAttack } from "../../core/types";
import type { AttackModule } from "./types";
/** Detector: never attacks; `systems/detection.ts` reveals stealthed enemies in its range. */
export const detect: AttackModule<DetectAttack> = {
  aim: "none",
  projectile: "forbidden",
  params: {},
  apply: () => {},
};
