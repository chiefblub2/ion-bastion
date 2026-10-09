import type { Point } from "../core/types";
/** Position on a cell path at a fractional distance (cells walked from the entry). */
export function positionOnPath(path: readonly Point[], distance: number): Point {
  const i = Math.max(0, Math.min(Math.floor(distance), path.length - 2)),
    f = distance - i,
    a = path[i],
    b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
