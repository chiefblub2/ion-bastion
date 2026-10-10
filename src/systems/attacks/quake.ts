import type { DamageSource, Point, QuakeAttack, Sim } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** One shockwave around `from`, weaker towards `reach`; returns the enemies it hit. */
export function quakeWave(sim: Sim, src: DamageSource, from: Point, reach: number, damage: number, edge: number) {
  sim.state.events.push({ type: "pulse", at: { ...from }, radius: reach, color: sim.content.towers[src.type].color });
  const hit = [];
  // A copy: enemies released on death must not catch the same wave.
  for (const target of [...sim.state.enemies]) {
    const d = dist(target, from);
    if (target.hp > 0 && canTarget(sim, src.type, target) && d <= reach) {
      applyDamage(sim, src, target, damage * (1 - (1 - edge) * (d / reach)), false, hitOf("quake", src));
      hit.push(target);
    }
  }
  return hit;
}
/** Fires the delayed waves that are due, in the order they were scheduled; the queue disappears once empty. */
export function fireAftershocks(sim: Sim) {
  const s = sim.state;
  if (!s.pending) return;
  const due = s.pending.filter((p) => s.time >= p.due);
  if (!due.length) return;
  s.pending = s.pending.filter((p) => s.time < p.due);
  if (!s.pending.length) delete s.pending;
  for (const p of due) quakeWave(sim, p.source, p.at, p.radius, p.damage, p.edge);
}
/** Beben: a shockwave around the tower itself, weaker towards the edge of its range. */
export const quake: AttackModule<QuakeAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    edge: { label: "Edge damage", valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { from, reach }, damage, spec) => {
    if (!from || !reach) return;
    const hit = quakeWave(sim, src, from, reach, damage, spec.edge),
      special = src.special,
      s = sim.state;
    // Fracture: set after the wave, so the wave itself does not profit from it.
    if (special?.kind === "fracture")
      for (const target of hit) if (target.hp > 0) applyStatus(sim, target, { kind: "vulnerable", amount: special.bonus, until: s.time + special.duration });
    // Aftershock: one more wave later, frozen now; it never schedules another.
    if (special?.kind === "aftershock")
      (s.pending ??= []).push({ due: s.time + special.delay, source: plain(src), at: { ...from }, radius: reach, damage: damage * special.factor, edge: spec.edge });
  },
};
