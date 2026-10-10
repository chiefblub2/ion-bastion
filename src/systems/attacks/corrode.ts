import type { CorrodeAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { dist } from "../path";
import { applyStatus } from "../status";
import { canTarget } from "./targeting";
import type { AttackModule } from "./types";
/** Acid splash: weakens every enemy in the radius so all towers deal more damage to it. */
export const corrode: AttackModule<CorrodeAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Säureradius", valid: (v) => v > 0, unit: " Felder" },
    amount: { label: "Mehrschaden", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
    duration: { label: "Dauer", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { at }, damage, spec) => {
    const until = sim.state.time + spec.duration;
    for (const target of [...sim.state.enemies])
      if (target.hp > 0 && canTarget(sim, src.type, target) && dist(target, at) <= spec.radius) {
        // Weakened first, so the acid hit itself already counts.
        applyStatus(sim, target, { kind: "vulnerable", amount: spec.amount, until });
        applyDamage(sim, src, target, damage, false, hitOf("corrode", src));
      }
  },
};
