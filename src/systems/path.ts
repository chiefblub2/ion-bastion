import type { Point } from "../core/types";
/**
 * Position on a cell path at a fractional distance (cells walked from the entry).
 * On a `loop` the distance wraps around and the last cell leads back to the first.
 */
export function positionOnPath(path: readonly Point[], distance: number, loop?: boolean): Point {
  if (loop) {
    const n = path.length,
      d = ((distance % n) + n) % n,
      i = Math.floor(d),
      a = path[i],
      b = path[(i + 1) % n],
      f = d - i;
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  const i = Math.max(0, Math.min(Math.floor(distance), path.length - 2)),
    f = distance - i,
    a = path[i],
    b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
