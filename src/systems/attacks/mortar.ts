import type { MortarAttack } from "../../core/types";
import { blast } from "./splash";
import type { AttackModule } from "./types";
/** Artillery: a slow shell with a big blast, unable to aim at enemies inside its dead zone. */
export const mortar: AttackModule<MortarAttack> = {
  aim: "point",
  projectile: "optional",
  params: {
    radius: { label: "Explosionsradius", valid: (v) => v > 0, unit: " Felder" },
    minRange: { label: "Toter Winkel", valid: (v) => v >= 0, unit: " Felder" },
  },
  minRange: (spec) => spec.minRange,
  apply: (sim, src, impact, damage, spec) => blast(sim, src, impact.at, spec.radius, damage, "mortar"),
};
