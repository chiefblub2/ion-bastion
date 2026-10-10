import type Phaser from "phaser";
import type { Point } from "../core/types";
export type Ink = Phaser.GameObjects.Graphics;
/** Pixel size of one grid cell. */
export const CELL = 56;
/** Grid coordinate (cell index or fractional position) to the pixel centre. */
export const px = (v: number) => (v + 0.5) * CELL;
export function polygon(g: Ink, x: number, y: number, r: number, n: number, color: number, rotation = 0, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(
    Array.from({ length: n }, (_, i) => ({
      x: x + Math.cos(rotation + (i * Math.PI * 2) / n) * r,
      y: y + Math.sin(rotation + (i * Math.PI * 2) / n) * r,
    })),
    true,
  );
}
/** Spiky star with `n` spikes between the radii `inner` and `outer`. */
export function star(g: Ink, x: number, y: number, outer: number, inner: number, n: number, color: number, rotation = 0) {
  g.fillStyle(color);
  g.fillPoints(
    Array.from({ length: n * 2 }, (_, i) => {
      const rad = i % 2 ? inner : outer,
        a = rotation + (i * Math.PI) / n;
      return { x: x + Math.cos(a) * rad, y: y + Math.sin(a) * rad };
    }),
    true,
  );
}
/** Mixes a colour towards white (`f > 0`) or black (`f < 0`) by `|f|`. */
export function shade(color: number, f: number) {
  const target = f < 0 ? 0 : 255,
    k = Math.abs(f),
    channel = (shift: number) => Math.round(((color >> shift) & 255) * (1 - k) + target * k);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
/** Zig-zag lightning between two grid positions. */
export function bolt(g: Ink, from: Point, to: Point, color: number, alpha: number) {
  const fx = px(from.x),
    fy = px(from.y),
    x = px(to.x),
    y = px(to.y),
    length = Math.hypot(x - fx, y - fy) || 1,
    nx = -(y - fy) / length,
    ny = (x - fx) / length;
  g.lineStyle(2, color, alpha);
  g.strokePoints(
    Array.from({ length: 6 }, (_, i) => {
      const k = i / 5,
        off = i % 5 === 0 ? 0 : i % 2 ? 6 : -6;
      return { x: fx + (x - fx) * k + nx * off, y: fy + (y - fy) * k + ny * off };
    }),
    false,
  );
}
