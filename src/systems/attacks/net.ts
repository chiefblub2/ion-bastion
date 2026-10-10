import type { NetAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import type { AttackModule } from "./types";
/** Fangnetz: slows a flyer and pulls it into reach of ground-only towers. */
export const net: AttackModule<NetAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    factor: { label: "Slow", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => Math.round((1 - v) * 100) },
    duration: { label: "Net duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyStatus(sim, enemy, { kind: "netted", factor: spec.factor, until: sim.state.time + spec.duration });
    applyDamage(sim, src, enemy, damage, false, hitOf("net", src));
  },
};
