import type { ConfuseAttack, Enemy, Sim, SpecializationSpec } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { resists } from "../traits";
import { canAcquire, nearest } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Hypnotises one enemy: it walks backwards at its own speed until the trance ends, then is immune for the recovery.
 * Units that shrug off a pull (unstoppable, dampened) keep their heading. True if the trance took hold.
 */
function hypnotise(sim: Sim, e: Enemy, spec: ConfuseAttack, special: SpecializationSpec | undefined) {
  if (resists(sim, e, "pull")) return false;
  const release = sim.state.time + spec.duration;
  if (!applyStatus(sim, e, { kind: "confuse", release, until: release + spec.recovery })) return false;
  // Mind Break: only a trance that took hold opens the damage window, until it ends.
  if (special?.kind === "mind-break") applyStatus(sim, e, { kind: "vulnerable", amount: special.bonus, until: release });
  return true;
}
/** Mesmer: a hypnotic orb turns its target around, so it crosses traps and kill zones a second time. */
export const confuse: AttackModule<ConfuseAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    duration: { label: "Trance", valid: (v) => v > 0, unit: " s" },
    recovery: { label: "Recovery", valid: (v) => v >= 0, unit: " s" },
  },
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("confuse", src));
    if (enemy.hp <= 0) return;
    const special = src.special;
    hypnotise(sim, enemy, spec, special);
    // Mass Hypnosis: the trance spreads to the nearest enemies the tower could see, without damage.
    if (special?.kind !== "mass-trance") return;
    const color = sim.content.towers[src.type].color;
    for (const other of nearest(sim, enemy, special.radius, special.count, (c) => c !== enemy && canAcquire(sim, src.type, c)))
      if (hypnotise(sim, other, spec, special)) sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: other.x, y: other.y }, color });
  },
};
