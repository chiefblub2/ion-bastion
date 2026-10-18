import type { EncaseAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { resists } from "../traits";
import type { AttackModule } from "./types";
/**
 * Amber: a resin glob encases its target. Held and immune, it stores every hit until the resin shatters
 * (`systems/encase.ts`), then it cannot be encased again for the recovery.
 */
export const encase: AttackModule<EncaseAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    duration: { label: "Encased", valid: (v) => v > 0, unit: " s" },
    bonus: { label: "Shatter bonus", valid: (v) => v >= 0, unit: " %", show: (v) => v * 100 },
    recovery: { label: "Recovery", valid: (v) => v >= 0, unit: " s" },
  },
  // An enemy that can still be encased: one already held or in its recovery would waste the glob.
  choose: (sim, _type, _from, _reach, candidates) => {
    const time = sim.state.time;
    return candidates.find((c) => !c.status.some((s) => s.kind === "encase" && time < s.until)) ?? candidates[0];
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("encase", src));
    // Units that shrug off a stun (unstoppable, dampened) break the resin before it sets.
    if (enemy.hp <= 0 || resists(sim, enemy, "stun")) return;
    const time = sim.state.time;
    applyStatus(sim, enemy, { kind: "encase", release: time + spec.duration, until: time + spec.duration + spec.recovery, stored: 0, bonus: spec.bonus, source: src });
  },
};
