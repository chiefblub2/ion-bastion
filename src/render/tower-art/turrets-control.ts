import type { TurretStyle } from "../../core/types";
import type { Drawing } from "./kit";
import { TILTED, liveTurret } from "./tilted";
/** Turret drawings of the Control tab's towers by `visual.turret`; `render/towers.ts` assembles them into `TURRETS`. */
export const CONTROL_TURRETS = {
  // Cryo: the Cryo Condenser in the 3/4 tilt (see `models/`).
  crystal: liveTurret(TILTED.crystal!),
  // Jammer: the Interference Crown in the 3/4 tilt (see `models/`).
  antenna: liveTurret(TILTED.antenna!),
  // Snare Net: the Net Thrower in the 3/4 tilt (see `models/`).
  launcher: liveTurret(TILTED.launcher!),
  // Plasma: the Plasma Caster in the 3/4 tilt (see `models/`).
  caster: liveTurret(TILTED.caster!),
  // Gravitron: the Graviton Gate in the 3/4 tilt (see `models/`).
  gravity: liveTurret(TILTED.gravity!),
  // Stasis: the Chrono Glass in the 3/4 tilt (see `models/`).
  emitter: liveTurret(TILTED.emitter!),
  // Korrosion: the Acid Sprayer in the 3/4 tilt (see `models/`).
  vat: liveTurret(TILTED.vat!),
  // Mesmer: the Hypno Dish in the 3/4 tilt (see `models/`).
  spiral: liveTurret(TILTED.spiral!),
  // Amber: the Resin Clamp in the 3/4 tilt (see `models/`).
  resin: liveTurret(TILTED.resin!),
  // Magnetar: the Pole Spire in the 3/4 tilt (see `models/`).
  magnet: liveTurret(TILTED.magnet!),
  // Cyclone: the Vortex Funnel in the 3/4 tilt (see `models/`).
  fan: liveTurret(TILTED.fan!),
  // Tether: the Grapple Winch in the 3/4 tilt (see `models/`).
  tether: liveTurret(TILTED.tether!),
  // Shrink Ray: the Cone Projector in the 3/4 tilt (see `models/`).
  shrinker: liveTurret(TILTED.shrinker!),
  // Hex: the Sigil Altar in the 3/4 tilt (see `models/`).
  sigil: liveTurret(TILTED.sigil!),
  // Siphon: the Drain Tank in the 3/4 tilt (see `models/`).
  siphon: liveTurret(TILTED.siphon!),
} satisfies Partial<Record<TurretStyle, Drawing>>;
