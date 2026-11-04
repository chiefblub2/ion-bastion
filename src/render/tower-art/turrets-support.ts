import type { TurretStyle } from "../../core/types";
import type { Drawing } from "./kit";
import { TILTED, liveTurret } from "./tilted";
/** Turret drawings of the Support tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const SUPPORT_TURRETS = {
  // Bounty Beacon: the Coin Press in the 3/4 tilt (see `models/`).
  beacon: liveTurret(TILTED.beacon!),
  // Repair Dock: the Gantry Dock in the 3/4 tilt (see `models/`).
  dock: liveTurret(TILTED.dock!),
  // Tracker: the Target Scope in the 3/4 tilt (see `models/`).
  tracker: liveTurret(TILTED.tracker!),
  // Refinery: the Smelter in the 3/4 tilt (see `models/`).
  refinery: liveTurret(TILTED.refinery!),
  // Detector: the Radar Mast in the 3/4 tilt (see `models/`).
  radar: liveTurret(TILTED.radar!),
  // Aura: the Emitter Dais in the 3/4 tilt (see `models/`).
  aura: liveTurret(TILTED.aura!),
  // Overclock: the Overdrive Core in the 3/4 tilt (see `models/`).
  clock: liveTurret(TILTED.clock!),
  // Fire Control: the Range Bunker in the 3/4 tilt (see `models/`).
  director: liveTurret(TILTED.director!),
  // Armory: the Munitions Depot in the 3/4 tilt (see `models/`).
  armory: liveTurret(TILTED.armory!),
  // Skylink: the Sky Relay in the 3/4 tilt (see `models/`).
  skylink: liveTurret(TILTED.skylink!),
  // Nexus: the Relay Lattice in the 3/4 tilt (see `models/`).
  nexus: liveTurret(TILTED.nexus!),
  // Workshop: the Forge Bench in the 3/4 tilt (see `models/`).
  workshop: liveTurret(TILTED.workshop!),
  // Vault: the Strongroom in the 3/4 tilt (see `models/`).
  vault: liveTurret(TILTED.vault!),
  // Shield Generator: the Bastion Emitter in the 3/4 tilt (see `models/`).
  shieldgen: liveTurret(TILTED.shieldgen!),
  // Recycler: the Shredder Hopper in the 3/4 tilt (see `models/`).
  recycler: liveTurret(TILTED.recycler!),
} satisfies Partial<Record<TurretStyle, Drawing>>;
