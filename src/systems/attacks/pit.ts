import type { Enemy, PitAttack, Sim } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { hasTrait } from "../traits";
import type { AttackModule } from "./types";
/** Small enough to fall in: body size up to the pit's size, and not unstoppable. */
const fits = (sim: Sim, e: Enemy, spec: PitAttack) => sim.content.enemies[e.type].size <= spec.size && !hasTrait(sim, e, "unstoppable");
/** Fallgrube: swallows small enemies whole, whatever their HP; bigger ones only take damage. */
export const pit: AttackModule<PitAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    size: { label: "Max. Gegnergröße", valid: (v) => v > 0, show: (v) => Math.round(v * 100) },
  },
  choose: (sim, _type, _from, _reach, candidates, spec) => candidates.find((c) => fits(sim, c, spec)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (enemy) applyDamage(sim, src, enemy, fits(sim, enemy, spec) ? Infinity : damage, false, hitOf("pit", src));
  },
};
