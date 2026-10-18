import type { StrikeAttack } from "../../core/types";
import type { AttackModule } from "./types";
/**
 * Orbital: a beacon dart paints the spot under the strongest enemy in reach; `delay` seconds after it lands, the
 * strike comes down on that point (see `systems/strikes.ts`), not on the enemy, so fast units can outrun it.
 */
export const strike: AttackModule<StrikeAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Strike radius", valid: (v) => v > 0, unit: " cells" },
    delay: { label: "Strike delay", valid: (v) => v > 0, unit: " s" },
  },
  // The enemy with the most HP; ties keep the tower's priority order.
  choose: (_sim, _type, _from, _reach, candidates) => candidates.reduce((best, c) => (c.hp > best.hp ? c : best)),
  apply: (sim, src, { at }, damage, spec) => {
    const s = sim.state;
    (s.strikes ??= []).push({ source: src, at: { x: at.x, y: at.y }, radius: spec.radius, damage, due: s.time + spec.delay, delay: spec.delay });
  },
};
