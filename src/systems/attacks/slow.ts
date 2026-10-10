import type { SlowAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { canTarget, nearest } from "./targeting";
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
    // Frostburst: other enemies around the target are only slowed, never hit.
    if (special?.kind !== "frostburst") return;
    sim.state.events.push({ type: "pulse", at: { x: enemy.x, y: enemy.y }, radius: special.radius, color: sim.content.towers[src.type].color });
    for (const other of nearest(sim, enemy, special.radius, Infinity, (c) => c !== enemy && canTarget(sim, src.type, c)))
      applyStatus(sim, other, { kind: "slow", factor: special.factor, until: sim.state.time + special.duration });
  },
};
