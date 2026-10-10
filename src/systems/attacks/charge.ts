import type { ChargeAttack } from "../../core/types";
import { applyStatus, hasStatus } from "../status";
import type { AttackModule } from "./types";
/** Haftmine: sticks a bomb to the enemy; `systems/status.ts` sets it off after the fuse or on the carrier's death. */
export const charge: AttackModule<ChargeAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    fuse: { label: "Zünder", valid: (v) => v > 0, unit: " s" },
    radius: { label: "Explosionsradius", valid: (v) => v > 0, unit: " Felder" },
  },
  // One bomb per enemy: the next one goes to someone without a charge.
  choose: (sim, _type, _from, _reach, candidates) =>
    candidates.find((c) => !hasStatus(c, "charged", sim.state.time)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyStatus(sim, enemy, { kind: "charged", damage, radius: spec.radius, until: sim.state.time + spec.fuse, source: src });
  },
};
