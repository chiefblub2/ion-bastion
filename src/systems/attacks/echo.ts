import type { EchoAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus, hasStatus } from "../status";
import type { AttackModule } from "./types";
/**
 * Hex: a cursed shard. The curse comes first, so the shard's own hit is already remembered; `delay` seconds
 * later the enemy takes `share` of everything it took meanwhile (see `systems/hex.ts`). Prefers uncursed enemies.
 */
export const echo: AttackModule<EchoAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {
    share: { label: "Echo", valid: (v) => v > 0 && v <= 2, unit: " %", show: (v) => Math.round(v * 100) },
    delay: { label: "Curse time", valid: (v) => v > 0, unit: " s" },
  },
  choose: (sim, _type, _from, _reach, candidates) => candidates.find((c) => !hasStatus(c, "echo", sim.state.time)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    const time = sim.state.time;
    applyStatus(sim, enemy, { kind: "echo", share: spec.share, stored: 0, delay: spec.delay, until: time + spec.delay, source: src });
    applyDamage(sim, src, enemy, damage, false, hitOf("echo", src));
  },
};
