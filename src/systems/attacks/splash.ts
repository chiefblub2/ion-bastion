import type { Point, Sim, SplashAttack } from "../../core/types";
import { applyDamage, hitOf, type DamageSource } from "../damage";
import { dist } from "../path";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Damage to every targetable enemy within `radius` of a point; `kind` tells traits which attack it was (splash or mortar). */
export function blast(sim: Sim, src: DamageSource, at: Point, radius: number, damage: number, kind: "splash" | "mortar") {
  // A copy: enemies released on death must not catch the same explosion.
  for (const target of [...sim.state.enemies])
    if (canTarget(sim, src.type, target) && dist(target, at) <= radius) applyDamage(sim, src, target, damage, false, hitOf(kind, src));
}
/** Splash damage centred on a point, so a shell can land where its target no longer is. */
export const splash: AttackModule<SplashAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Explosionsradius", valid: (v) => v > 0, unit: " Felder" },
  },
  apply: (sim, src, { at }, damage, spec) => blast(sim, src, at, spec.radius, damage, "splash"),
};
