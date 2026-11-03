import type { Enemy, PitAttack, Sim } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { hasTrait } from "../traits";
import { sizeOf } from "../shrink";
import { executePercent } from "./specials";
import type { AttackModule } from "./types";
/** Small enough to fall in: body size (a Shrink Ray counts) up to the pit's size, and not unstoppable. */
const fits = (sim: Sim, e: Enemy, spec: PitAttack) => sizeOf(sim, e) <= spec.size && !hasTrait(sim, e, "unstoppable");
/** Fallgrube: swallows small enemies whole, whatever their HP; bigger ones only take damage. */
export const pit: AttackModule<PitAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    size: { label: "Max. enemy size", valid: (v) => v > 0, show: (v) => Math.round(v * 100) },
  },
  choose: (sim, _type, _from, _reach, candidates, spec) => candidates.find((c) => fits(sim, c, spec)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    // Spike Bed (Decay's Final Decay): an enemy too big to fall in takes a share of its max HP on top.
    const raw = fits(sim, enemy, spec) ? Infinity : damage + executePercent(src.special, enemy) * enemy.maxHp;
    applyDamage(sim, src, enemy, raw, false, hitOf("pit", src));
  },
};
