import type { DecayAttack } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { canAcquire, nearest } from "./targeting";
import type { AttackModule } from "./types";
/** Disintegration: a share of the target's max HP on top, strong against tanks and bosses. */
export const decay: AttackModule<DecayAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    percent: { label: "Max-HP damage", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => v * 100 },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    const special = src.special;
    // Final Decay: a wounded target (judged on impact, strictly below) takes more of its max HP.
    const percent = spec.percent + (special?.kind === "max-hp-execute" && enemy.hp < special.threshold * enemy.maxHp ? special.extraPercent : 0),
      raw = damage + percent * enemy.maxHp;
    applyDamage(sim, src, enemy, raw, false, hitOf("decay", src));
    // Contagion: nearby enemies take a share of their own max HP, capped by the main hit.
    if (special?.kind !== "contagion") return;
    const color = sim.content.towers[src.type].color;
    for (const other of nearest(sim, enemy, special.radius, special.count, (c) => c !== enemy && canAcquire(sim, src.type, c))) {
      sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: other.x, y: other.y }, color });
      applyDamage(sim, plain(src), other, Math.min(other.maxHp * special.maxHpPercent, raw * special.hitCapFactor), false, hitOf("decay", plain(src)));
    }
  },
};
