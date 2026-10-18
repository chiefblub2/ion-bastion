import type { SiphonAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { canAcquire, nearest } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Siphon: a draining beam that slows its target. The pay-off is not the beam but the field: hindered enemies
 * near the Siphon speed up the attack towers around it (`systems/siphon.ts`, read by `effectiveTowerStats`).
 */
export const siphon: AttackModule<SiphonAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    factor: { label: "Slow", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => Math.round((1 - v) * 100) },
    duration: { label: "Duration", valid: (v) => v > 0, unit: " s" },
    reach: { label: "Feeds towers within", valid: (v) => v > 0, unit: " cells" },
    bonus: { label: "Fire rate per enemy", valid: (v) => v > 0, unit: " %", show: (v) => Math.round(v * 100) },
    cap: { label: "Enemies counted", valid: (v) => Number.isInteger(v) && v >= 1, unit: "" },
  },
  apply: (sim, src, { enemy, from }, damage, spec) => {
    if (!enemy) return;
    const s = sim.state,
      until = s.time + spec.duration,
      color = sim.content.towers[src.type].color,
      special = src.special;
    if (from) s.events.push({ type: "beam", from: { ...from }, to: { x: enemy.x, y: enemy.y }, color });
    applyStatus(sim, enemy, { kind: "slow", factor: spec.factor, until });
    applyDamage(sim, src, enemy, damage, false, hitOf("siphon", src));
    // Leech Field: the beam forks to the nearest other enemies, slowing them without damage.
    if (special?.kind !== "siphon-fork") return;
    for (const o of nearest(sim, enemy, special.radius, special.count, (c) => c !== enemy && canAcquire(sim, src.type, c))) {
      s.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: o.x, y: o.y }, color });
      applyStatus(sim, o, { kind: "slow", factor: spec.factor, until });
    }
  },
};
