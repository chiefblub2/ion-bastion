import type { Point, Sim, Strike } from "../core/types";
import { canTarget, nearest } from "./attacks/targeting";
import { applyDamage, hitOf, plain, type DamageSource } from "./damage";
import { dist } from "./path";
/** Blast radius of a Cluster Payload bomblet in cells. */
export const BOMBLET_RADIUS = 0.6;
/** Damage to every enemy the source tower can target within `radius` of `at`, hidden ones included (an area hit). */
function hitArea(sim: Sim, src: DamageSource, at: Point, radius: number, damage: number) {
  // A copy: fragments released by a death in the blast must not catch it.
  for (const target of [...sim.state.enemies])
    if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, at) <= radius) applyDamage(sim, src, target, damage, false, hitOf("strike", src));
}
/** One strike coming down: the main blast, then Cluster Payload's bomblets on the nearest survivors outside it. */
function strikeDown(sim: Sim, k: Strike) {
  const s = sim.state,
    color = sim.content.towers[k.source.type].color,
    special = k.source.special;
  s.events.push({ type: "strike", at: { ...k.at }, radius: k.radius, color });
  hitArea(sim, k.source, k.at, k.radius, k.damage);
  if (special?.kind !== "cluster") return;
  const targets = nearest(sim, k.at, special.radius, special.count, (c) => dist(c, k.at) > k.radius && canTarget(sim, k.source.type, c));
  for (const t of targets) {
    const at = { x: t.x, y: t.y };
    s.events.push({ type: "strike", at, radius: BOMBLET_RADIUS, color });
    hitArea(sim, plain(k.source), at, BOMBLET_RADIUS, k.damage * special.factor);
  }
}
/** Lands every Orbital strike that is due, in firing order; absent once none is left. */
export function landStrikes(sim: Sim) {
  const s = sim.state;
  if (!s.strikes) return;
  // Tolerates float drift, so a strike lands on the tick its delay ends.
  const due = s.strikes.filter((k) => s.time >= k.due - 1e-9);
  if (!due.length) return;
  const left = s.strikes.filter((k) => s.time < k.due - 1e-9);
  if (left.length) s.strikes = left;
  else delete s.strikes;
  for (const k of due) strikeDown(sim, k);
}
