import type { TurretStyle } from "../../core/types";
import type { Drawing } from "./kit";
import { TILTED, liveTurret } from "./tilted";
/** Turret drawings of the Traps tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const TRAPS_TURRETS = {
  // Mine: the Pressure Charge in the 3/4 tilt (see `models/`).
  mine: liveTurret(TILTED.mine!),
  // Caltrops: the Strewn Jacks in the 3/4 tilt (see `models/`).
  spikes: liveTurret(TILTED.spikes!),
  // Tar Pit: the Tar Heap in the 3/4 tilt (see `models/`).
  tar: liveTurret(TILTED.tar!),
  // Bear Trap: the Iron Jaws in the 3/4 tilt (see `models/`).
  snare: liveTurret(TILTED.snare!),
  // Flame Grate: the Firebox Grate in the 3/4 tilt (see `models/`).
  grill: liveTurret(TILTED.grill!),
  // Spring: the Coil Launcher in the 3/4 tilt (see `models/`).
  spring: liveTurret(TILTED.spring!),
  // Sticky Mine: the Mag Clamp in the 3/4 tilt (see `models/`).
  limpet: liveTurret(TILTED.limpet!),
  // Pitfall: the Stone Shaft in the 3/4 tilt (see `models/`).
  pit: liveTurret(TILTED.pit!),
  // Tripwire: the Bollard Wire in the 3/4 tilt (see `models/`).
  tripwire: liveTurret(TILTED.tripwire!),
  // Barricade: the Hedgehog Wall in the 3/4 tilt (see `models/`).
  barricade: liveTurret(TILTED.barricade!),
  // Warp Pad: the Fold Well in the 3/4 tilt (see `models/`).
  warp: liveTurret(TILTED.warp!),
  // Arc Plate: the Coil Diamond in the 3/4 tilt (see `models/`).
  plate: liveTurret(TILTED.plate!),
  // Oil Slick: the Spill Drum in the 3/4 tilt (see `models/`).
  slick: liveTurret(TILTED.slick!),
  // Grinder: the Roller Trench in the 3/4 tilt (see `models/`).
  grinder: liveTurret(TILTED.grinder!),
  // Harpoon: the Sky Lance in the 3/4 tilt (see `models/`).
  harpoon: liveTurret(TILTED.harpoon!),
} satisfies Partial<Record<TurretStyle, Drawing>>;
