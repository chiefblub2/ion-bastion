import type { Point, Sim } from "../core/types";
import { dist } from "./path";
import { hasCloakField, hasTrait, isSuppressed } from "./traits";
import { scannerReveals } from "./protocols";
import { afterimageHolds } from "./target-paths";
import { activeFlares, flareReveals } from "./trap-paths";
import { eachOfKind } from "./tower-kinds";
/** Marks stealthed enemies inside any detector's range as revealed for this tick. */
export function updateDetection(sim: Sim) {
  const detectors: { t: Point; range: number }[] = [];
  eachOfKind(sim.state.towers, sim.content, "detect", (_attack, t, range) => {
    if (!isSuppressed(sim, t)) detectors.push({ t, range });
  });
  // Cloaked neighbours are revealed like stealthed enemies; `revealed` stays unset on every other enemy in solo.
  const cloak = hasCloakField(sim),
    flares = activeFlares(sim);
  for (const e of sim.state.enemies)
    if (cloak || hasTrait(sim, e, "stealth"))
      e.revealed = detectors.some(({ t, range }) => dist(e, t) <= range) || scannerReveals(sim, e) || afterimageHolds(sim, e) || flareReveals(e, flares);
}
