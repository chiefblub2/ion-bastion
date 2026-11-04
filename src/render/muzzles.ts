import type { Point, TurretStyle } from "../core/types";
/** Look of the flash when a barrel fires. */
export type FlashStyle = "gun" | "heavy" | "energy" | "flame" | "spray";
export interface MuzzleSpec {
  /** Barrel length from the tower centre in pixels, by level. */
  reach: (level: number) => number;
  /** Pixels the barrel slides back on a full kick. */
  recoil: number;
  /** Parallel barrels, shifted sideways by these offsets. */
  sides?: readonly number[];
  /** Fanned barrels: how many and the angle between them. */
  fan?: (level: number) => { count: number; step: number };
  flash: FlashStyle;
}
/**
 * Projection of a tower drawn in the 3/4 tilt (`TILTS`): its ground centre sits `drop` px below the cell centre, ground
 * depth is squashed by `squash` and the barrel axis is `height` px up, so a muzzle tip is a projected point.
 */
export interface Tilt {
  drop: number;
  squash: number;
  /** Height of the barrel's pivot above the ground centre. */
  height: number;
  /** Elevation of the barrel in radians (Nova's cannon), 0 for a level barrel. */
  pitch?: number;
  /** Height of the plane the path motif lies on (Pulse's deck, Nova's ground between its legs). */
  deck: number;
  /** Towers without a barrel: height above the ground centre that chains, beams and shots leave from. */
  emit?: number;
}
/**
 * Towers drawn in the 3/4 tilt, by turret style (Pulse's Hex Sentinel, Nova's Siege Cannon). Barrels, flashes and
 * shots of these turrets are projected through their entry; a tilted tower may have no barrel (`emit`).
 */
export const TILTS: Partial<Record<TurretStyle, Tilt>> = {
  barrel: { drop: 5, squash: 0.65, height: 15, deck: 7 },
  heavy: { drop: 6, squash: 0.65, height: 14, pitch: 0.35, deck: 0.5 },
  // Flak: the Skyguard's twin guns.
  twin: { drop: 5, squash: 0.65, height: 14, pitch: 0.42, deck: 6 },
  // Shrapnel: the Scattergun's fan.
  scatter: { drop: 5, squash: 0.65, height: 11, deck: 5 },
  // Executioner: the Headsman's glaive arm.
  blade: { drop: 5, squash: 0.65, height: 11, deck: 6 },
  // Lance: the Railspear's rails.
  rail: { drop: 5, squash: 0.65, height: 10, deck: 3.5 },
  // Skyburst: the Rocket Rack's four tubes.
  battery: { drop: 5, squash: 0.65, height: 13, pitch: 0.5, deck: 6 },
  // Mortar: the Pit Mortar's steep tube.
  mortar: { drop: 5, squash: 0.65, height: 6, pitch: 0.9, deck: 0.6 },
  // Catalyst: the Reagent Flask's neck.
  flask: { drop: 5, squash: 0.65, height: 14, pitch: 0.18, deck: 5.5 },
  // Orbital: the Uplink Array's designator laser.
  uplink: { drop: 6, squash: 0.65, height: 10.5, deck: 4.5 },
  // Ember: the Furnace Torch's nozzle.
  flame: { drop: 5, squash: 0.65, height: 10.5, deck: 6.2 },
  // Focus: the Lens Fork's lens.
  lens: { drop: 5, squash: 0.65, height: 17, deck: 7.5 },
  // Tesla: the Coil Spire; chains leave from its top ball.
  coil: { drop: 6, squash: 0.65, height: 29.5, deck: 4.8, emit: 33.5 },
  // Decay: the Prism Cradle; orbs leave from the floating crystal.
  prism: { drop: 6, squash: 0.65, height: 22, deck: 3.6, emit: 22 },
  // Quake: the Hydraulic Press; its wave starts on the ground.
  hammer: { drop: 6, squash: 0.65, height: 0, deck: 4 },
  // Control, Traps and Support: the models in `tower-art/models/` (each module's own `tilt`; `tilted.test.ts` keeps them equal).
  crystal: { drop: 6, squash: 0.65, height: 27, deck: 5, emit: 27 },
  emitter: { drop: 6, squash: 0.65, height: 14.5, deck: 3.5, emit: 14.5 },
  vat: { drop: 5, squash: 0.65, height: 10, deck: 5 },
  gravity: { drop: 6, squash: 0.65, height: 17, deck: 4.4, emit: 17 },
  antenna: { drop: 5, squash: 0.65, height: 13, deck: 4.6, emit: 13 },
  launcher: { drop: 5, squash: 0.65, height: 10.5, pitch: 0.3, deck: 5 },
  caster: { drop: 5, squash: 0.65, height: 12.5, pitch: 0.25, deck: 6 },
  spiral: { drop: 6, squash: 0.65, height: 14, deck: 3.5 },
  resin: { drop: 5, squash: 0.65, height: 12, deck: 5.7 },
  magnet: { drop: 6, squash: 0.65, height: 0, deck: 4.4, emit: 26 },
  fan: { drop: 6, squash: 0.65, height: 0, deck: 4.6, emit: 23 },
  tether: { drop: 5, squash: 0.65, height: 11, deck: 4.6 },
  shrinker: { drop: 5, squash: 0.65, height: 13, deck: 6.2 },
  sigil: { drop: 5, squash: 0.65, height: 12, deck: 5.6 },
  siphon: { drop: 5, squash: 0.65, height: 10.5, deck: 4.8 },
  mine: { drop: 2, squash: 0.65, height: 0, deck: 3.4 },
  spikes: { drop: 2, squash: 0.65, height: 0, deck: 0 },
  tar: { drop: 2, squash: 0.65, height: 0, deck: 3.5 },
  snare: { drop: 2, squash: 0.65, height: 0, deck: 3 },
  grill: { drop: 2, squash: 0.65, height: 0, deck: 3.4 },
  spring: { drop: 2, squash: 0.65, height: 0, deck: 3 },
  limpet: { drop: 2, squash: 0.65, height: 0, deck: 2.2 },
  pit: { drop: 2, squash: 0.65, height: 0, deck: 1.8 },
  tripwire: { drop: 2, squash: 0.65, height: 0, deck: 1 },
  barricade: { drop: 2, squash: 0.65, height: 0, deck: 0.5 },
  warp: { drop: 2, squash: 0.65, height: 0, deck: 2.6 },
  plate: { drop: 2, squash: 0.65, height: 0, deck: 1.8 },
  slick: { drop: 2, squash: 0.65, height: 0, deck: 0.2 },
  grinder: { drop: 2, squash: 0.65, height: 0, deck: 2.4 },
  harpoon: { drop: 2, squash: 0.65, height: 3.4, deck: 1.6, pitch: 0.95 },
  aura: { drop: 5, squash: 0.65, height: 25, deck: 6 },
  refinery: { drop: 5, squash: 0.65, height: 6.5, deck: 12 },
  radar: { drop: 5, squash: 0.65, height: 25, deck: 6 },
  beacon: { drop: 5, squash: 0.65, height: 24, deck: 6, emit: 24 },
  dock: { drop: 5, squash: 0.65, height: 12, deck: 3 },
  tracker: { drop: 5, squash: 0.65, height: 17, deck: 4 },
  clock: { drop: 5, squash: 0.65, height: 11, deck: 4 },
  director: { drop: 5, squash: 0.65, height: 16, deck: 11.5 },
  armory: { drop: 5, squash: 0.65, height: 15, deck: 6.2 },
  skylink: { drop: 6, squash: 0.65, height: 17.5, deck: 5.5 },
  nexus: { drop: 6, squash: 0.65, height: 16.5, deck: 5.5 },
  workshop: { drop: 5, squash: 0.65, height: 17, deck: 6.6 },
  vault: { drop: 4, squash: 0.65, height: 15, deck: 16.6 },
  shieldgen: { drop: 5, squash: 0.65, height: 12.5, deck: 5 },
  recycler: { drop: 5, squash: 0.65, height: 13, deck: 13 },
};
/**
 * Barrels of the turrets that have one. Turret drawings, muzzle flashes and the starting point of projectiles
 * all read this table, so a flash always sits on the barrel tip. Radial turrets (coil, crystal, emitter, …) have none.
 */
export const MUZZLES: Partial<Record<TurretStyle, MuzzleSpec>> = {
  barrel: { reach: (l) => 21 + l, recoil: 5, flash: "gun" },
  heavy: { reach: (l) => 22 + l, recoil: 6, flash: "heavy" },
  twin: { reach: (l) => 20 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  rail: { reach: (l) => 25 + l, recoil: 6, flash: "energy" },
  flame: { reach: (l) => 15 + 0.5 * l, recoil: 3, flash: "flame" },
  mortar: { reach: (l) => 12 + l, recoil: 5, flash: "heavy" },
  blade: { reach: (l) => 22 + l, recoil: 5, flash: "gun" },
  scatter: { reach: (l) => 18 + l, recoil: 3, fan: (l) => ({ count: l >= 4 ? 5 : 3, step: 0.32 }), flash: "gun" },
  launcher: { reach: (l) => 15 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  vat: { reach: (l) => 17 + l, recoil: 4, flash: "spray" },
  lens: { reach: (l) => 14 + 0.4 * l, recoil: 0, flash: "energy" },
  flask: { reach: (l) => 15 + l, recoil: 2, flash: "spray" },
  caster: { reach: (l) => 16 + l, recoil: 6, flash: "heavy" },
  battery: { reach: (l) => 15 + l, recoil: 3, sides: [-5.4, -1.8, 1.8, 5.4], flash: "heavy" },
  uplink: { reach: (l) => 13 + l, recoil: 1, flash: "energy" },
  spiral: { reach: (l) => 15 + l, recoil: 1, flash: "energy" },
  resin: { reach: (l) => 15 + l, recoil: 3, flash: "spray" },
  tether: { reach: (l) => 17 + l, recoil: 4, flash: "gun" },
  shrinker: { reach: (l) => 17 + l, recoil: 1, flash: "energy" },
  sigil: { reach: (l) => 14 + l * 0.5, recoil: 0, flash: "energy" },
  siphon: { reach: (l) => 16 + l, recoil: 1, flash: "energy" },
  // Harpoon: the Sky Lance's launcher tube (traps show no muzzle flash; harpoons leave its tip).
  harpoon: { reach: (l) => 8.5 + 0.2 * l, recoil: 2, flash: "gun" },
};
/**
 * Barrel tips in pixels for a turret at (`x`, `y`) aiming at `angle`: one per parallel or fanned barrel, projected on a
 * tilted turret (offsets across the aim lie on the ground plane); the emit point of a tilted turret without a barrel;
 * empty for other turrets without one. `flat`: the board point under each tip instead (no squash, no height), where a
 * shot's ground path starts.
 */
export function muzzleTips(turret: TurretStyle, level: number, x: number, y: number, angle: number, kick = 0, flat = false): Point[] {
  const spec = MUZZLES[turret],
    tilt = flat ? undefined : TILTS[turret];
  if (!spec) return tilt?.emit !== undefined ? [{ x, y: y + tilt.drop - tilt.emit }] : [];
  const d = spec.reach(level) - kick * spec.recoil,
    p = TILTS[turret]?.pitch ?? 0,
    ground = d * Math.cos(p),
    tip = (a: number, side: number) => {
      const c = Math.cos(a),
        s = Math.sin(a),
        u = c * ground - s * side,
        v = s * ground + c * side;
      return tilt ? { x: x + u, y: y + tilt.drop + v * tilt.squash - tilt.height - d * Math.sin(p) } : { x: x + u, y: y + v };
    };
  if (spec.fan) {
    const { count, step } = spec.fan(level);
    return Array.from({ length: count }, (_, i) => tip(angle + (i - (count - 1) / 2) * step, 0));
  }
  return (spec.sides ?? [0]).map((side) => tip(angle, side));
}
/** Screen direction a barrel points in when its turret aims at `angle`: the aim itself, foreshortened on a tilted turret. */
export function muzzleHeading(turret: TurretStyle, angle: number) {
  const tilt = TILTS[turret];
  if (!tilt) return angle;
  const p = tilt.pitch ?? 0;
  return Math.atan2(Math.sin(angle) * Math.cos(p) * tilt.squash - Math.sin(p), Math.cos(angle) * Math.cos(p));
}
