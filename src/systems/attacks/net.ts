import type { NetAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { layerOf } from "../traits";
import { canAcquire, nearest } from "./targeting";
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
    if (applyStatus(sim, enemy, { kind: "netted", factor: spec.factor, until }) && special?.kind === "exposed-target")
      applyStatus(sim, enemy, { kind: "vulnerable", amount: special.bonus, until });
    applyDamage(sim, src, enemy, damage, false, hitOf("net", src));
    // Net Cloud: other flyers nearby are caught in the same net, without damage.
    if (special?.kind !== "net-cloud") return;
    const color = sim.content.towers[src.type].color;
    for (const other of nearest(sim, enemy, special.radius, special.count, (c) => c !== enemy && layerOf(sim, c) === "air" && canAcquire(sim, src.type, c))) {
      sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: other.x, y: other.y }, color });
      applyStatus(sim, other, { kind: "netted", factor: spec.factor, until });
    }
  },
};
