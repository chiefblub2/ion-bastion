import type { SlowAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import type { AttackModule } from "./types";
export const slow: AttackModule<SlowAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    factor: { label: "Verlangsamung", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => (1 - v) * 100 },
    duration: { label: "Dauer", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("slow", src));
    applyStatus(sim, enemy, { kind: "slow", factor: spec.factor, until: sim.state.time + spec.duration });
  },
};
