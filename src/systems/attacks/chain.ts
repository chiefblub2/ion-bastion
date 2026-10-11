import type { ChainAttack, DamageSource, Enemy, Sim } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { dist } from "../path";
import { hasTrait } from "../traits";
import { canAcquire } from "./targeting";
import type { AttackModule } from "./types";
/** One chain from `start`; `struck` is shared, so a second chain never hits an enemy twice in one salvo. */
function arc(sim: Sim, src: DamageSource, start: Enemy, damage: number, spec: ChainAttack, struck: Set<number>) {
  const s = sim.state,
    color = sim.content.towers[src.type].color;
  struck.add(start.id);
  applyDamage(sim, src, start, damage, false, hitOf("chain", src));
  // An insulated primary target takes its hit and stops the chain.
  if (hasTrait(sim, start, "insulated")) return;
  let from: Enemy = start;
  for (let jump = 0; jump < spec.jumps; jump++) {
    const next = s.enemies
      .filter(
        (c) =>
          c.hp > 0 &&
          !struck.has(c.id) &&
          !hasTrait(sim, c, "insulated") &&
          canAcquire(sim, src.type, c) &&
          dist(c, from) <= spec.range,
      )
      .sort((a, b) => dist(a, from) - dist(b, from) || a.id - b.id)[0];
    if (!next) break;
    damage *= spec.falloff;
    struck.add(next.id);
    s.events.push({ type: "chain", from: { x: from.x, y: from.y }, to: { x: next.x, y: next.y }, color });
    applyDamage(sim, src, next, damage, false, hitOf("chain", src, { chain: true }));
    from = next;
  }
}
/** Lightning: hits instantly, then jumps to the nearest unstruck enemy with falloff. */
export const chain: AttackModule<ChainAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    jumps: { label: "Jumps", valid: (v) => Number.isInteger(v) && v >= 1 },
    range: { label: "Jump range", valid: (v) => v > 0, unit: " cells" },
    falloff: { label: "Damage per jump", valid: (v) => v > 0 && v <= 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { enemy, from, proc, candidates }, damage, spec) => {
    if (!enemy) return;
    const struck = new Set<number>();
    arc(sim, src, enemy, damage, spec, struck);
    // Twin Arc: a marked salvo starts a second, weaker chain at the best enemy the first one missed.
    const special = src.special;
    if (special?.kind !== "twin-arc" || !proc || !candidates) return;
    const second = candidates.find((c) => c.hp > 0 && !struck.has(c.id) && canAcquire(sim, src.type, c));
    if (!second) return;
    if (from) sim.state.events.push({ type: "chain", from: { ...from }, to: { x: second.x, y: second.y }, color: sim.content.towers[src.type].color });
    arc(sim, plain(src), second, damage * special.factor, spec, struck);
  },
};
