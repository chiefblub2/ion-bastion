import type { TurretStyle } from "../../core/types";
import type { Drawing } from "./kit";
import { sentinelAbove, sentinelBase, sentinelBelow, sentinelTurret } from "./sentinel";
import { siegeAbove, siegeBase, siegeBelow, siegeTurret } from "./siege";
/**
 * A tower drawn in the 3/4 tilt (projection in `TILTS`), in four parts drawn bottom to top:
 * - `base`: still, depends only on level and trim colour; baked like every tower body (`TowerBodies`).
 * - `below`: live parts under the turret (lights on the foundation, rings in a groove).
 * - `turret`: ink only, depending on level, colours, path, `tower.angle` and `kick` and nothing else (no clock, charge,
 *   id or glow), so `TurretCache` keeps it as a picture per aim angle and recoil step; `stillTurret` checks it.
 * - `above`: live parts over the turret (charge indicators, lamp light, heat, smoke) and all of the turret's glow.
 * Drawn live, the same three layers run in the same order, so a cached and a live turret look alike.
 */
export interface TiltedArt {
  base: Drawing;
  below: Drawing;
  turret: Drawing;
  above: Drawing;
}
export const TILTED: Partial<Record<TurretStyle, TiltedArt>> = {
  // Pulse: the Hex Sentinel.
  barrel: { base: sentinelBase, below: sentinelBelow, turret: sentinelTurret, above: sentinelAbove },
  // Nova: the Siege Cannon.
  heavy: { base: siegeBase, below: siegeBelow, turret: siegeTurret, above: siegeAbove },
};
/** The whole live turret of a tilted tower: its three layers in order. */
export const liveTurret =
  (art: TiltedArt): Drawing =>
  (ctx) => {
    art.below(ctx);
    art.turret(ctx);
    art.above(ctx);
  };
