import type { ChainAttack, Enemy } from "../../core/types";
import { applyDamage } from "../damage";
import { dist } from "../path";
import { canAcquire } from "./targeting";
import type { AttackModule } from "./types";
/** Lightning: hits instantly, then jumps to the nearest unstruck enemy with falloff. */
export const chain: AttackModule<ChainAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    jumps: { label: "Sprünge", valid: (v) => Number.isInteger(v) && v >= 1 },
    range: { label: "Sprungweite", valid: (v) => v > 0, unit: " Felder" },
    falloff: { label: "Schaden je Sprung", valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    const s = sim.state,
      color = sim.content.towers[src.type].color,
      struck = new Set([enemy.id]);
    applyDamage(sim, src, enemy, damage);
    let from: Enemy = enemy;
    for (let jump = 0; jump < spec.jumps; jump++) {
      const next = s.enemies
        .filter(
          (c) =>
            c.hp > 0 &&
            !struck.has(c.id) &&
            canAcquire(sim, src.type, c) &&
            dist(c, from) <= spec.range,
        )
        .sort((a, b) => dist(a, from) - dist(b, from) || a.id - b.id)[0];
      if (!next) break;
      damage *= spec.falloff;
      struck.add(next.id);
      s.events.push({ type: "chain", from: { x: from.x, y: from.y }, to: { x: next.x, y: next.y }, color });
      applyDamage(sim, src, next, damage);
      from = next;
    }
  },
};
