import type { Enemy, PierceAttack, Point, Sim, TowerId } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** The line from `from` through `target` to `reach`: its end point and every enemy on it, nearest first. */
function line(sim: Sim, type: TowerId, from: Point, target: Enemy, reach: number, width: number) {
  const dx = target.x - from.x,
    dy = target.y - from.y,
    length = Math.hypot(dx, dy) || 1,
    ux = dx / length,
    uy = dy / length,
    end = Math.max(reach, length);
  // Projection along the line and distance from it, for every candidate.
  const hits = sim.state.enemies
    .filter((e) => e.hp > 0 && canTarget(sim, type, e))
    .map((e) => ({ e, along: (e.x - from.x) * ux + (e.y - from.y) * uy, off: Math.abs((e.x - from.x) * uy - (e.y - from.y) * ux) }))
    .filter((h) => h.e === target || (h.along >= 0 && h.along <= end && h.off <= width))
    .sort((a, b) => a.along - b.along || a.e.id - b.e.id)
    .map((h) => h.e);
  return { hits, to: { x: from.x + ux * end, y: from.y + uy * end } };
}
/** Railgun: an instant line from the tower through the target to the end of its range. */
export const pierce: AttackModule<PierceAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    width: { label: "Strahlbreite", valid: (v) => v > 0, unit: " Felder" },
    falloff: { label: "Schaden je Durchschlag", valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 },
  },
  // Enemies trail along the path, not along the beam: aim where the line hits the most of them.
  choose: (sim, type, from, reach, candidates, spec) => {
    let best = candidates[0],
      most = 0;
    for (const c of candidates) {
      const count = line(sim, type, from, c, reach, spec.width).hits.length;
      if (count > most) [best, most] = [c, count];
    }
    return best;
  },
  apply: (sim, src, { enemy, from, reach }, damage, spec) => {
    if (!enemy || !from) return;
    const { hits, to } = line(sim, src.type, from, enemy, reach ?? 0, spec.width);
    sim.state.events.push({ type: "beam", from: { ...from }, to, color: sim.content.towers[src.type].color });
    for (const e of hits) {
      applyDamage(sim, src, e, damage, false, hitOf("pierce", src));
      damage *= spec.falloff;
    }
  },
};
