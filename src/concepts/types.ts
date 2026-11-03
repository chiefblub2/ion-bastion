/**
 * Throwaway concept sheet for the 3/4 tilt of the Attack towers (`/gallery.html?concepts`, dev-only, never in the game).
 * Each concept is drawn with the tilt kit (`render/tower-art/tilt.ts`) exactly like Pulse's Hex Sentinel
 * (`tower-art/sentinel.ts`) and Nova's Siege Cannon (`tower-art/siege.ts`), but reads its projection from its own
 * `tilt` instead of `MUZZLES`, so nothing here changes the battlefield.
 */
import type { Tilt } from "../render/muzzles";
import type { TurretContext } from "../render/tower-art/kit";
import type { TowerId } from "../core/types";

export interface Concept {
  tower: TowerId;
  /** Name of the look, e.g. "Hex Sentinel". */
  name: string;
  /** One line on the idea, shown beside the row. */
  idea: string;
  /** Projection: ground drop, squash, barrel pivot height, pitch and the deck height the path motif lies on. */
  tilt: Tilt;
  /** Barrel length from the centre by level (absent for radial towers) and the recoil on a full kick. */
  reach?: (level: number) => number;
  recoil?: number;
  /** Parallel barrels across the aim, or a fan (count and angle step); like `MuzzleSpec.sides` / `fan`. */
  sides?: readonly number[];
  fan?: (level: number) => { count: number; step: number };
  /** Height of the point chains, beams and shots leave from when the tower has no barrel. */
  emit?: number;
  /** Still part: depends only on level and trim colour (baked in the game). Must not read clock, charge, kick, angle or id. */
  base: (ctx: TurretContext) => void;
  /**
   * The turret: ink on `g` that depends only on level, colour, path, `tower.angle` and `kick` (cached per angle in the
   * game). No clock, charge or id, and no glow.
   */
  turret: (ctx: TurretContext) => void;
  /** Everything else drawn every frame: lamps, charge indicators, heat, smoke, sparks and all glow. Drawn after `turret`. */
  live: (ctx: TurretContext) => void;
}
