import type { Enemy, Point, Sim, SplashAttack } from "../../core/types";
import { applyDamage, hitOf, plain, type DamageSource } from "../damage";
import { dist } from "../path";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Damage to every targetable enemy within `radius` of a point; `kind` tells traits which attack it was (splash or mortar).
 * Returns the enemies the blast killed, in id order.
 */
export function blast(sim: Sim, src: DamageSource, at: Point, radius: number, damage: number, kind: "splash" | "mortar"): Enemy[] {
  const killed: Enemy[] = [];
  // A copy: enemies released on death must not catch the same explosion.
  for (const target of [...sim.state.enemies])
    if (canTarget(sim, src.type, target) && dist(target, at) <= radius && applyDamage(sim, src, target, damage, false, hitOf(kind, src))?.killed)
      killed.push(target);
  return killed.sort((a, b) => a.id - b.id);
}
/** Splash damage centred on a point, so a shell can land where its target no longer is. */
export const splash: AttackModule<SplashAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Blast radius", valid: (v) => v > 0, unit: " cells" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const killed = blast(sim, src, at, spec.radius, damage, "splash"),
      special = src.special;
    // Chain Reaction: the first kills explode once more; kills of those explosions never chain.
    if (special?.kind !== "chain-reaction") return;
    for (const dead of killed.slice(0, special.maxPerSalvo)) {
      sim.state.events.push({ type: "pulse", at: { x: dead.x, y: dead.y }, radius: special.radius, color: sim.content.towers[src.type].color });
      blast(sim, plain(src), dead, special.radius, damage * special.factor, "splash");
    }
  },
};
