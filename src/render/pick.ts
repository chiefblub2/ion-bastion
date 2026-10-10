import type { Enemy, Sim } from "../core/types";
import { isHidden } from "../systems/traits";

/** The enemy under a board point (canvas pixels), nearest first; hidden stealth units cannot be picked. */
export function enemyAt(sim: Sim, x: number, y: number, cell: number, slack = 6): Enemy | undefined {
  let best: Enemy | undefined,
    bestDistance = Infinity;
  for (const e of sim.state.enemies) {
    if (e.hp <= 0 || isHidden(sim, e)) continue;
    const distance = Math.hypot((e.x + 0.5) * cell - x, (e.y + 0.5) * cell - y);
    if (distance <= sim.content.enemies[e.type].size * cell + slack && distance < bestDistance) {
      best = e;
      bestDistance = distance;
    }
  }
  return best;
}
