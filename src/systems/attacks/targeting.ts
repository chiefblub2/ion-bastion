import type { Enemy, Point, Sim, TowerId } from "../../core/types";
import { dist } from "../path";
import { isNetted } from "../status";
import { isHidden, layerOf } from "../traits";
/** A netted flyer (or a leaping enemy currently in the air) counts as air and ground, so ground-only towers can hit it too. */
export const canTarget = (sim: Sim, tower: TowerId, e: Enemy) => {
  const targets = sim.content.towers[tower].targets;
  return targets.includes(layerOf(sim, e)) || (targets.includes("ground") && isNetted(e, sim.state.time));
};
/** Target selection: like `canTarget`, but stealthed enemies need a detector; area damage still hits them. */
export const canAcquire = (sim: Sim, tower: TowerId, e: Enemy) => canTarget(sim, tower, e) && !isHidden(sim, e);
/**
 * Secondary targets of a specialization: up to `count` living enemies within `radius` of `center` that
 * `accept` takes, nearest first, then by id. Targeted procs pass `canAcquire`, area procs `canTarget`.
 */
export function nearest(sim: Sim, center: Point, radius: number, count: number, accept: (e: Enemy) => boolean): Enemy[] {
  return sim.state.enemies
    .filter((e) => e.hp > 0 && dist(e, center) <= radius && accept(e))
    .sort((a, b) => dist(a, center) - dist(b, center) || a.id - b.id)
    .slice(0, count);
}
