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
/** Direction of travel (radians) at a path distance; wraps on a `loop` like `positionOnPath`, so a pushed-back unit never reads outside the path. */
export function headingOnPath(path: readonly Point[], distance: number, loop?: boolean): number {
  const n = path.length,
    i = loop ? Math.floor(((distance % n) + n) % n) : Math.max(0, Math.min(Math.floor(distance), n - 2)),
    a = path[i],
    b = path[(i + 1) % n];
  return Math.atan2(b.y - a.y, b.x - a.x);
}
/**
 * Euclidean length. `Math.sqrt` is correctly rounded in every engine, `Math.hypot` is not, and lockstep clients on
 * different browsers must agree to the last bit.
 */
export const len = (dx: number, dy: number) => Math.sqrt(dx * dx + dy * dy);
export const dist = (a: Point, b: Point) => len(a.x - b.x, a.y - b.y);
