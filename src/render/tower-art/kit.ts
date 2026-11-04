/** Shared pieces of the tower drawings: the drawing context and small helpers. */
import type { Tower, TowerDefinition } from "../../core/types";
import { facing } from "../material";
import { shade, type Ink } from "../shapes";
export interface TurretContext {
  g: Ink;
  /** Additive light: energy cores, hot metal, glowing parts. */
  glow: Ink;
  x: number;
  y: number;
  tower: Tower;
  definition: Readonly<TowerDefinition>;
  clock: number;
  /** Level for attack towers, number of purchases for support towers. */
  level: number;
  maxed: boolean;
  /** Display colour; the path colour once a path is chosen. Trim (collar, lamps, inlay) uses it, bodies keep `definition.color`. */
  color: number;
  /** Chosen upgrade path, if any. */
  path?: string;
  /** 1 right after a shot, fading to 0 within the first 30 % of the attack cycle. */
  kick: number;
  /** Progress of the attack cycle, 1 when ready to fire. */
  charge: number;
  /** Colour of the muzzle's last 3 px: hot from level 5, the path colour once specialized. */
  tip?: number;
  /** Extra glow alpha of energy parts from level 5. */
  energy: number;
  /** Highest glow alpha of a light at the centre, so it stays within 0.6 on top of the maxed halo. */
  peak: number;
}
export type Drawing = (ctx: TurretContext) => void;
export const TAU = Math.PI * 2;
// Batched parts: `quad` adds triangles in the current fill style, so a row of equal studs, ticks or vents
// costs one style change and no polygon triangulation.
/** Quad along (`ca`, `sa`) from `d0` to `d1`, with the offsets `a0`/`b0` across at the start and `a1`/`b1` at the end. */
export function quad(g: Ink, x: number, y: number, ca: number, sa: number, d0: number, d1: number, a0: number, b0: number, a1: number, b1: number) {
  const x0 = x + ca * d0,
    y0 = y + sa * d0,
    x1 = x + ca * d1,
    y1 = y + sa * d1;
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * a1, y1 + ca * a1, x1 - sa * b1, y1 + ca * b1);
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * b1, y1 + ca * b1, x0 - sa * b0, y0 + ca * b0);
}
/** Small parts lit from the upper left: every body in a shaded tone, then the halves that face the light. */
export function fins(g: Ink, x: number, y: number, angles: readonly number[], from: number, to: number, w0: number, w1: number, color: number) {
  for (const lit of [false, true]) {
    g.fillStyle(shade(color, lit ? 0.22 : -0.3));
    for (const a of angles) {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        side = facing(a + Math.PI / 2) < 0 ? -1 : 1;
      if (lit) quad(g, x, y, ca, sa, from, to, 0, side * w0, 0, side * w1);
      else quad(g, x, y, ca, sa, from, to, -w0, w0, -w1, w1);
    }
  }
}
/** Ring of at least 16 segments for small radii, where `ring` turns visibly polygonal. */
export function loop(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha = 1) {
  if (alpha <= 0.01) return;
  const n = Math.max(16, Math.ceil(r * 2)),
    r0 = Math.max(0, r - w / 2),
    r1 = r + w / 2;
  g.fillStyle(color, alpha);
  for (let i = 0; i < n; i++) {
    const c0 = Math.cos((i * TAU) / n),
      s0 = Math.sin((i * TAU) / n),
      c1 = Math.cos(((i + 1) * TAU) / n),
      s1 = Math.sin(((i + 1) * TAU) / n);
    g.fillTriangle(x + c0 * r1, y + s0 * r1, x + c1 * r1, y + s1 * r1, x + c1 * r0, y + s1 * r0);
    g.fillTriangle(x + c0 * r1, y + s0 * r1, x + c1 * r0, y + s1 * r0, x + c0 * r0, y + s0 * r0);
  }
}
