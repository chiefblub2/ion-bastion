import type { TurretStyle } from "../../core/types";
import type { Drawing } from "./kit";
import { TILTED } from "./tilted";
/**
 * Base plates by `visual.turret`. Every tower is drawn in the 3/4 tilt, so this is each model's still base
 * (`TiltedArt.base`, baked by `TowerBodies`); `render/towers.ts` fails to compile while a style has no turret drawing.
 */
export const BASES = Object.fromEntries(Object.entries(TILTED).map(([style, art]) => [style, art!.base])) as Record<TurretStyle, Drawing>;
