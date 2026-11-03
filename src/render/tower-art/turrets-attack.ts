import type { TurretStyle } from "../../core/types";
import { TILTED, liveTurret } from "./tilted";
import type { Drawing } from "./kit";
/**
 * Turret drawings of the Attack tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. Every
 * Attack tower is drawn in the 3/4 tilt: its drawing is the live form of its `TiltedArt` (`tilted.ts`).
 */
export const ATTACK_TURRETS = {
  // Pulse: the Hex Sentinel, an armoured turret with one precision barrel in the 3/4 tilt (see `sentinel.ts`).
  barrel: liveTurret(TILTED.barrel!),
  // Nova: the Siege Cannon, an armoured housing with an elevated cannon in the 3/4 tilt (see `siege.ts`).
  heavy: liveTurret(TILTED.heavy!),
  // Flak: the Skyguard in the 3/4 tilt (see `skyguard.ts`).
  twin: liveTurret(TILTED.twin!),
  // Tesla: the Coil Spire in the 3/4 tilt (see `coil-spire.ts`).
  coil: liveTurret(TILTED.coil!),
  // Lance: the Railspear in the 3/4 tilt (see `railspear.ts`).
  rail: liveTurret(TILTED.rail!),
  // Ember: the Furnace Torch in the 3/4 tilt (see `furnace-torch.ts`).
  flame: liveTurret(TILTED.flame!),
  // Mortar: the Pit Mortar in the 3/4 tilt (see `pit-mortar.ts`).
  mortar: liveTurret(TILTED.mortar!),
  // Quake: the Hydraulic Press in the 3/4 tilt (see `hydraulic-press.ts`).
  hammer: liveTurret(TILTED.hammer!),
  // Executioner: the Headsman in the 3/4 tilt (see `headsman.ts`).
  blade: liveTurret(TILTED.blade!),
  // Shrapnel: the Scattergun in the 3/4 tilt (see `scattergun.ts`).
  scatter: liveTurret(TILTED.scatter!),
  // Skyburst: the Rocket Rack in the 3/4 tilt (see `rocket-rack.ts`).
  battery: liveTurret(TILTED.battery!),
  // Catalyst: the Reagent Flask in the 3/4 tilt (see `reagent-flask.ts`).
  flask: liveTurret(TILTED.flask!),
  // Focus: the Lens Fork in the 3/4 tilt (see `lens-fork.ts`).
  lens: liveTurret(TILTED.lens!),
  // Decay: the Prism Cradle in the 3/4 tilt (see `prism-cradle.ts`).
  prism: liveTurret(TILTED.prism!),
  // Orbital: the Uplink Array in the 3/4 tilt (see `uplink-array.ts`).
  uplink: liveTurret(TILTED.uplink!),
} satisfies Partial<Record<TurretStyle, Drawing>>;
