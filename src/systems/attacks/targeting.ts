import type { Enemy, Sim, TowerId } from "../../core/types";
import { isNetted } from "../status";
import { isHidden } from "../traits";
/** A netted flyer counts as air and ground, so ground-only towers can hit it too. */
export const canTarget = (sim: Sim, tower: TowerId, e: Enemy) => {
  const targets = sim.content.towers[tower].targets;
  return targets.includes(sim.content.enemies[e.type].layer) || (targets.includes("ground") && isNetted(e, sim.state.time));
};
/** Target selection: like `canTarget`, but stealthed enemies need a detector; area damage still hits them. */
export const canAcquire = (sim: Sim, tower: TowerId, e: Enemy) => canTarget(sim, tower, e) && !isHidden(sim, e);
