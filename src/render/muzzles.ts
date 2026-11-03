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
  /**
   * A turret drawn in the 3/4 tilt (Hex Sentinel): its ground centre sits `drop` px below the cell centre, ground depth is
   * squashed by `squash` and the barrel axis is `height` px up, so the tip is a projected point.
   */
  tilt?: Tilt;
}
export interface Tilt {
  drop: number;
  squash: number;
  /** Height of the barrel's pivot above the ground centre. */
  height: number;
  /** Elevation of the barrel in radians (Nova's cannon), 0 for a level barrel. */
  pitch?: number;
  /** Height of the plane the path motif lies on (Pulse's deck, Nova's ground between its legs). */
  deck: number;
}
/**
 * Barrels of the turrets that have one. Turret drawings, muzzle flashes and the starting point of projectiles
 * all read this table, so a flash always sits on the barrel tip. Radial turrets (coil, crystal, emitter, …) have none.
 */
export const MUZZLES: Partial<Record<TurretStyle, MuzzleSpec>> = {
  barrel: { reach: (l) => 21 + l, recoil: 5, flash: "gun", tilt: { drop: 5, squash: 0.65, height: 15, deck: 7 } },
  heavy: { reach: (l) => 22 + l, recoil: 6, flash: "heavy", tilt: { drop: 6, squash: 0.65, height: 14, pitch: 0.35, deck: 0.5 } },
  twin: { reach: (l) => 20 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  rail: { reach: (l) => 25 + l, recoil: 6, flash: "energy" },
  flame: { reach: (l) => 15 + l, recoil: 3, flash: "flame" },
  mortar: { reach: (l) => 12 + l, recoil: 7, flash: "heavy" },
  blade: { reach: (l) => 22 + l, recoil: 5, flash: "gun" },
  scatter: { reach: (l) => 15 + l, recoil: 3, fan: (l) => ({ count: l >= 4 ? 5 : 3, step: 0.32 }), flash: "gun" },
  launcher: { reach: (l) => 15 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  vat: { reach: (l) => 17 + l, recoil: 4, flash: "spray" },
  lens: { reach: (l) => 16 + l, recoil: 0, flash: "energy" },
  flask: { reach: (l) => 15 + l, recoil: 2, flash: "spray" },
  caster: { reach: (l) => 14 + l, recoil: 6, flash: "heavy" },
  battery: { reach: (l) => 15 + l, recoil: 3, sides: [-5.4, -1.8, 1.8, 5.4], flash: "heavy" },
  // ── new towers: g1 (Attack+Control A) ──
  uplink: { reach: (l) => 15 + l, recoil: 1, flash: "energy" },
  spiral: { reach: (l) => 15 + l, recoil: 1, flash: "energy" },
  resin: { reach: (l) => 15 + l, recoil: 3, flash: "spray" },
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  tether: { reach: (l) => 17 + l, recoil: 4, flash: "gun" },
  shrinker: { reach: (l) => 17 + l, recoil: 1, flash: "energy" },
  sigil: { reach: (l) => 14 + l * 0.5, recoil: 0, flash: "energy" },
  siphon: { reach: (l) => 16 + l, recoil: 1, flash: "energy" },
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  // ── end g5 ──
};
/** Barrel tips in pixels for a turret at (`x`, `y`) aiming at `angle`; empty for turrets without a barrel. */
export function muzzleTips(turret: TurretStyle, level: number, x: number, y: number, angle: number, kick = 0): Point[] {
  const spec = MUZZLES[turret];
  if (!spec) return [];
  const d = spec.reach(level) - kick * spec.recoil;
  if (spec.fan) {
    const { count, step } = spec.fan(level);
    return Array.from({ length: count }, (_, i) => {
      const a = angle + (i - (count - 1) / 2) * step;
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  }
  const c = Math.cos(angle),
    s = Math.sin(angle),
    tilt = spec.tilt;
  if (tilt) {
    const p = tilt.pitch ?? 0,
      ground = d * Math.cos(p);
    return [{ x: x + c * ground, y: y + tilt.drop + s * ground * tilt.squash - tilt.height - d * Math.sin(p) }];
  }
  return (spec.sides ?? [0]).map((side) => ({ x: x + c * d - s * side, y: y + s * d + c * side }));
}
/** Screen direction a barrel points in when its turret aims at `angle`: the aim itself, foreshortened on a tilted turret. */
export function muzzleHeading(turret: TurretStyle, angle: number) {
  const tilt = MUZZLES[turret]?.tilt;
  if (!tilt) return angle;
  const p = tilt.pitch ?? 0;
  return Math.atan2(Math.sin(angle) * Math.cos(p) * tilt.squash - Math.sin(p), Math.cos(angle) * Math.cos(p));
}
