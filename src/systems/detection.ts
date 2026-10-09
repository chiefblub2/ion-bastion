import { resolveUpgrades } from "../core/upgrades";
import type { Sim } from "../core/types";
import { dist } from "./path";
import { hasTrait } from "./traits";
/** Marks stealthed enemies inside any detector's range as revealed for this tick. */
export function updateDetection(sim: Sim) {
  const detectors = sim.state.towers
    .map((t) => ({ t, resolved: resolveUpgrades(t, sim.content) }))
    .filter(({ resolved }) => resolved.attack.kind === "detect");
  for (const e of sim.state.enemies)
    if (hasTrait(sim, e, "stealth")) e.revealed = detectors.some(({ t, resolved }) => dist(e, t) <= resolved.stats.range);
}
