import type { Enemy, Sim } from "../core/types";
import { storeEcho } from "./hex";
import { shareTether } from "./tether";
/**
 * Called by `applyDamage` with the damage that reached an enemy's HP (capped at the HP it had): a Hex curse
 * remembers it, and a Shared Pain tether passes a share on to the linked enemies.
 */
export function afterDealt(sim: Sim, e: Enemy, amount: number) {
  if (amount <= 0 || !e.status.length) return;
  storeEcho(e, amount, sim.state.time);
  shareTether(sim, e, amount);
}
