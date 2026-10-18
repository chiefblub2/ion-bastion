import type { PoolAttack } from "../../core/types";
import { BURN_TICK } from "../status";
import type { AttackModule } from "./types";
/**
 * Plasma: a lobbed shell that leaves a burning pool where it lands. The pool, not the shell, deals the damage:
 * the tower's damage per second to every ground enemy inside, for `duration` seconds (see `systems/zones.ts`).
 */
export const pool: AttackModule<PoolAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Pool radius", valid: (v) => v > 0, unit: " cells" },
    duration: { label: "Pool duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const s = sim.state;
    (s.zones ??= []).push({
      source: src,
      at: { x: at.x, y: at.y },
      radius: spec.radius,
      dps: damage,
      duration: spec.duration,
      until: s.time + spec.duration,
      // The next point of the shared grid, so overlapping pools of one tower step together and never stack.
      next: Math.ceil(s.time / BURN_TICK - 1e-9) * BURN_TICK,
    });
  },
};
