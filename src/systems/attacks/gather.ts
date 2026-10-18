import type { GatherAttack, Point } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist, positionOnPath } from "../path";
import { clampToWall } from "../barricade";
import { isEncased } from "../encase";
import { applyStatus } from "../status";
import { resists } from "../traits";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Magnetar: a magnetic pulse around the target drags every enemy in its radius along the path towards the target's
 * own path position, up to `strength` cells: the ones ahead are held back, the ones behind pulled up, so the crowd
 * clumps without being pushed back as a whole. Enemies on another stretch of the path (more than twice the radius
 * away along it) stay put, and units that shrug off a pull keep their place.
 */
export const gather: AttackModule<GatherAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    radius: { label: "Pulse radius", valid: (v) => v > 0, unit: " cells" },
    strength: { label: "Drag", valid: (v) => v > 0, unit: " cells" },
  },
  apply: (sim, src, { enemy, at }, damage, spec) => {
    if (!enemy) return;
    const { path, loop } = sim.mission.map,
      s = sim.state,
      special = src.special,
      from: Point[] = [];
    // A copy: enemies released on death must not catch the same pulse.
    for (const e of [...s.enemies]) {
      if (e.hp <= 0 || dist(e, at) > spec.radius || !canTarget(sim, src.type, e)) continue;
      applyDamage(sim, src, e, damage, false, hitOf("gather", src));
      if (e.hp <= 0) continue;
      let gap = enemy.distance - e.distance;
      // On a ring the shorter way round.
      if (loop) gap -= path.length * Math.round(gap / path.length);
      const step = Math.sign(gap) * Math.min(Math.abs(gap), spec.strength);
      if (e !== enemy && step && Math.abs(gap) <= spec.radius * 2 && !resists(sim, e, "pull") && !isEncased(e, s.time)) {
        from.push({ x: e.x, y: e.y });
        e.distance += step;
        // A drag never carries a walker through a standing Barricade.
        clampToWall(sim, e, e.distance - step);
        const p = positionOnPath(path, e.distance, loop);
        e.x = p.x;
        e.y = p.y;
      }
      // Crush Point: the packed crowd takes more damage for a while; Lodestone: it stays slowed together.
      if (special?.kind === "compression") applyStatus(sim, e, { kind: "vulnerable", amount: special.bonus, until: s.time + special.duration });
      else if (special?.kind === "lodestone") applyStatus(sim, e, { kind: "slow", factor: special.factor, until: s.time + special.duration });
    }
    s.events.push({ type: "gather", at: { x: enemy.x, y: enemy.y }, from, color: sim.content.towers[src.type].color });
  },
};
