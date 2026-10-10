import { resolveUpgrades } from "../core/upgrades";
import type { Sim } from "../core/types";
import { dist } from "./path";
import { hasCloakField, hasTrait, isSuppressed } from "./traits";
/** Marks stealthed enemies inside any detector's range as revealed for this tick. */
export function updateDetection(sim: Sim) {
  const detectors = sim.state.towers
    .map((t) => ({ t, resolved: resolveUpgrades(t, sim.content) }))
    .filter(({ t, resolved }) => resolved.attack.kind === "detect" && !isSuppressed(sim, t));
  // Cloaked neighbours are revealed like stealthed enemies; `revealed` stays unset on every other enemy in solo.
  const cloak = hasCloakField(sim);
  for (const e of sim.state.enemies)
    if (cloak || hasTrait(sim, e, "stealth")) e.revealed = detectors.some(({ t, resolved }) => dist(e, t) <= resolved.stats.range);
}
