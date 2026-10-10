import type { QuakeAttack } from "../../core/types";
import { applyDamage } from "../damage";
import { dist } from "../path";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Beben: a shockwave around the tower itself, weaker towards the edge of its range. */
export const quake: AttackModule<QuakeAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    edge: { label: "Schaden am Rand", valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { from, reach }, damage, spec) => {
    if (!from || !reach) return;
    sim.state.events.push({ type: "pulse", at: { ...from }, radius: reach, color: sim.content.towers[src.type].color });
    // A copy: enemies released on death must not catch the same wave.
    for (const target of [...sim.state.enemies]) {
      const d = dist(target, from);
      if (target.hp > 0 && canTarget(sim, src.type, target) && d <= reach)
        applyDamage(sim, src, target, damage * (1 - (1 - spec.edge) * (d / reach)));
    }
  },
};
