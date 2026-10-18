import type { HarpoonAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus, isNetted } from "../status";
import type { AttackModule } from "./types";
/** Speed factor of a reeled-in flyer while the net holds. */
export const HARPOON_DRAG = 0.6;
/**
 * Harpoon: the one trap that shoots up. The bolt nets the flyer (ground towers and traps can hit it while the net
 * holds) and pins it for `pin` seconds; the pin's recovery lasts as long as the net, so it is never pinned twice.
 */
export const harpoon: AttackModule<HarpoonAttack> = {
  aim: "enemy",
  projectile: "optional",
  trapOnly: true,
  airTrap: true,
  params: {
    pin: { label: "Pin", valid: (v) => v > 0, unit: " s" },
    duration: { label: "Net duration", valid: (v) => v > 0, unit: " s" },
  },
  validate: (spec) => (spec.duration < spec.pin ? "The net must hold at least as long as the pin." : undefined),
  // A flyer already caught is left for the next harpoon.
  choose: (sim, _type, _from, _reach, candidates) => candidates.find((c) => !isNetted(c, sim.state.time)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy || enemy.hp <= 0) return;
    const time = sim.state.time;
    applyStatus(sim, enemy, { kind: "netted", factor: HARPOON_DRAG, until: time + spec.duration });
    applyStatus(sim, enemy, { kind: "stun", release: time + spec.pin, until: time + spec.duration });
    applyDamage(sim, src, enemy, damage, false, hitOf("harpoon", src));
  },
};
