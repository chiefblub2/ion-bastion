/**
 * Throwaway concept sheet for the 3/4 tilt of the Control, Traps and Support towers (`/gallery.html?concepts`, dev-only,
 * never in the game). Each concept is drawn with the tilt kit (`render/tower-art/tilt.ts`, `tilt-parts.ts`,
 * `tilt-frame.ts`) in the four parts of a real tilted tower (`render/tower-art/tilted.ts`), but reads its projection from
 * its own `tilt` instead of `TILTS`, so nothing here changes the battlefield.
 */
import type { Tilt } from "../render/muzzles";
import type { Drawing } from "../render/tower-art/kit";
import type { TowerId } from "../core/types";

export interface Concept {
  tower: TowerId;
  /** Name of the look, e.g. "Hex Sentinel". */
  name: string;
  /** One line on the idea, shown beside the row. */
  idea: string;
  /** Projection: ground drop, squash, barrel pivot height, pitch, the deck height the path motif lies on, emit point. */
  tilt: Tilt;
  /** Barrel length from the centre by level (absent without a barrel) and the recoil on a full kick. */
  reach?: (level: number) => number;
  recoil?: number;
  /** Parallel barrels across the aim, or a fan (count and angle step); like `MuzzleSpec.sides` / `fan`. */
  sides?: readonly number[];
  fan?: (level: number) => { count: number; step: number };
  /** Still: depends only on level and trim colour (baked in the game). Must not read clock, charge, kick, angle or id. */
  base: Drawing;
  /** Live, under the turret: lights on the foundation the turret may cover. */
  below: Drawing;
  /**
   * The turret: ink on `g` that depends only on level, colour, path, `tower.angle` and `kick` (cached per angle in the
   * game). No clock, charge or id, and no glow. Towers that never aim ignore the angle.
   */
  turret: Drawing;
  /** Live, over the turret: charge indicators, lamp light, fields, sparks and all glow. */
  above: Drawing;
}
