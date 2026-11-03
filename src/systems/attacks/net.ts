import type { NetAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { exposeNetted, netCloud } from "./specials";
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
    const until = sim.state.time + spec.duration,
      special = src.special;
    // Exposed Target: a net that took hold also weakens the flyer until it ends.
    exposeNetted(sim, enemy, special, applyStatus(sim, enemy, { kind: "netted", factor: spec.factor, until }), until);
    applyDamage(sim, src, enemy, damage, false, hitOf("net", src));
    // Net Cloud: other flyers nearby are caught in the same net, without damage.
    if (special?.kind === "net-cloud") netCloud(sim, src, enemy, special, spec.factor, until);
  },
};
