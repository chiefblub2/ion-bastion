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
 * Barrels of the turrets that have one. Turret drawings, muzzle flashes and the starting point of projectiles
 * all read this table, so a flash always sits on the barrel tip. Radial turrets (coil, crystal, emitter, …) have none.
 */
export const MUZZLES: Partial<Record<TurretStyle, MuzzleSpec>> = {
  barrel: { reach: (l) => 21 + l, recoil: 5, flash: "gun" },
  heavy: { reach: (l) => 19 + l, recoil: 7, flash: "heavy" },
  twin: { reach: (l) => 20 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  rail: { reach: (l) => 25 + l, recoil: 6, flash: "energy" },
  flame: { reach: (l) => 15 + l, recoil: 3, flash: "flame" },
  mortar: { reach: (l) => 12 + l, recoil: 7, flash: "heavy" },
  blade: { reach: (l) => 22 + l, recoil: 5, flash: "gun" },
  scatter: { reach: (l) => 15 + l, recoil: 3, fan: (l) => ({ count: l >= 4 ? 5 : 3, step: 0.32 }), flash: "gun" },
  launcher: { reach: (l) => 15 + l, recoil: 4, sides: [-4, 4], flash: "gun" },
  vat: { reach: (l) => 17 + l, recoil: 4, flash: "spray" },
  lens: { reach: (l) => 16 + l, recoil: 0, flash: "energy" },
  battery: { reach: (l) => 15 + l, recoil: 3, sides: [-5.4, -1.8, 1.8, 5.4], flash: "heavy" },
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
    s = Math.sin(angle);
  return (spec.sides ?? [0]).map((side) => ({ x: x + c * d - s * side, y: y + s * d + c * side }));
}
