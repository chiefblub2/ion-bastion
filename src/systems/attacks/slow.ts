import type { SlowAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { tarOil } from "../trap-paths";
import { frostburst } from "./specials";
import type { AttackModule } from "./types";
export const slow: AttackModule<SlowAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    factor: { label: "Slow", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => (1 - v) * 100 },
    duration: { label: "Duration", valid: (v) => v > 0, unit: " s" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("slow", src));
    const until = sim.state.time + spec.duration,
      slowed = applyStatus(sim, enemy, { kind: "slow", factor: spec.factor, until }),
      special = src.special;
    // Brittle Ice: only a slow that took hold weakens the enemy, until the slow's own end.
    if (special?.kind === "brittle-ice" && slowed) applyStatus(sim, enemy, { kind: "vulnerable", amount: special.bonus, until });
    // Frostburst (Spreading Bog): other enemies around the target are only slowed, never hit.
    if (special?.kind === "frostburst") frostburst(sim, src, enemy, special, enemy);
    // Flammable Tar: tarred enemies count as oiled.
    else if (special?.kind === "tar-oil") tarOil(sim, enemy, special);
  },
};
