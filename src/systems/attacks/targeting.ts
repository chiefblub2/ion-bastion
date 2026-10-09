import type { Enemy, Sim, TowerId } from "../../core/types";
import { isHidden } from "../traits";
export const canTarget = (sim: Sim, tower: TowerId, e: Enemy) =>
  sim.content.towers[tower].targets.includes(sim.content.enemies[e.type].layer);
/** Target selection: like `canTarget`, but stealthed enemies need a detector; area damage still hits them. */
export const canAcquire = (sim: Sim, tower: TowerId, e: Enemy) => canTarget(sim, tower, e) && !isHidden(sim, e);
