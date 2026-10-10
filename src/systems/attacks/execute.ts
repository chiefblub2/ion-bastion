import type { ExecuteAttack } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { canAcquire, nearest } from "./targeting";
import type { AttackModule } from "./types";
/** Henker: a heavy shot that hits much harder once the target is badly wounded. */
export const execute: AttackModule<ExecuteAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    threshold: { label: "Execute below", valid: (v) => v > 0 && v < 1, unit: " % HP", show: (v) => v * 100 },
    multiplier: { label: "Execution damage", valid: (v) => v >= 1, unit: " ×" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    // Judged on impact, so a target weakened in flight is executed.
    const wounded = enemy.hp < spec.threshold * enemy.maxHp,
      raw = wounded ? damage * spec.multiplier : damage,
      outcome = applyDamage(sim, src, enemy, raw, false, hitOf("execute", src, { execution: wounded }));
    // Blood Transfer: only a kill of the main target by this hit passes its overkill on, once.
    const special = src.special;
    if (special?.kind !== "overkill-transfer" || !outcome?.killed || outcome.overkill <= 0) return;
    const [next] = nearest(sim, enemy, special.radius, 1, (c) => c !== enemy && canAcquire(sim, src.type, c));
    if (!next) return;
    sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: next.x, y: next.y }, color: sim.content.towers[src.type].color });
    applyDamage(sim, plain(src), next, Math.min(outcome.overkill * special.factor, raw), false, hitOf("execute", plain(src)));
  },
};
