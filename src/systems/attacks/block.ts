import type { BlockAttack } from "../../core/types";
import { isBlocked, wallShare } from "../barricade";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Barricade: the wall itself lives in the movement hook (`systems/barricade.ts`); the trigger is its spikes, which
 * hit every enemy pressing against a standing wall.
 */
export const block: AttackModule<BlockAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    hp: { label: "Wall HP", valid: (v) => v > 0 },
  },
  apply: (sim, src, { from, reach }, damage) => {
    const wall = sim.state.towers.find((t) => t.id === src.tower);
    if (!from || !reach || !wall || wallShare(wall, sim.content) <= 0) return;
    // A copy: enemies released on death must not catch the same strike.
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, from) <= reach && isBlocked(sim, target))
        applyDamage(sim, src, target, damage, false, hitOf("block", src));
  },
};
