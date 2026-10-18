import type { Enemy, Sim, StatusEffect } from "../core/types";
type Encasement = Extract<StatusEffect, { kind: "encase" }>;
/** The running encasement that still holds, if any; the shatter itself is the `encase` status tick. */
function holding(e: Enemy, time: number): Encasement | undefined {
  if (!e.status.length) return undefined;
  const s = e.status.find((x): x is Encasement => x.kind === "encase");
  return s && s.stored >= 0 && time < s.release ? s : undefined;
}
/** True while the resin holds: the enemy stands still, whatever else pushes or pulls at it. */
export const isEncased = (e: Enemy, time: number) => holding(e, time) !== undefined;
/**
 * Amber: a hit on an encased enemy is stored instead of dealt (dots too). True if it was absorbed.
 * An infinite hit (Pitfall) still passes, so a pit swallows the whole block.
 */
export function absorbEncased(sim: Sim, e: Enemy, amount: number) {
  if (!Number.isFinite(amount)) return false;
  const s = holding(e, sim.state.time);
  if (!s) return false;
  s.stored += Math.max(0, amount);
  return true;
}
