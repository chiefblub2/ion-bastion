/**
 * Helpers of the "Control A" concepts (Cryo, Stasis, Korrosion, Gravitron, Jammer, Snare Net, Plasma, Mesmer): regular
 * footprints, plinths, arcs along a plinth's front, chasing lamps and vertical prisms. Throwaway with the concept sheet.
 */
import { facing } from "../../material";
import { disc, oval, shade, type Ink } from "../../shapes";
import { OUTLINE, SQUASH, X, Y, block, fillPoints, onGround, point, quad } from "../tilt";
import { GUN } from "../tilt-parts";

/** Regular n-gon footprint (u, v pairs, clockwise on the screen), rotated by `rot`. */
export function ngon(n: number, r: number, rot = 0) {
  const f = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    f[2 * i] = Math.cos(a) * r;
    f[2 * i + 1] = Math.sin(a) * r;
  }
  return f;
}
/** Soft contact shadow under a foundation of radius r, cast to the lower right. */
export function contact(g: Ink, x: number, y0: number, r: number) {
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, r + 5, r + 1.5, 0x050b10, 0.2);
    oval(g, 2, 3, r + 1, r, 0x050b10, 0.36);
  });
}
/** A bevelled n-gon plinth from h0 to h1. */
export function plinth(g: Ink, x: number, y0: number, n: number, r: number, h0: number, h1: number, rot = Math.PI / n, wall: number = GUN.side, top: number = GUN.top, glint: number = GUN.metal, bevel = 1) {
  block(g, x, y0, ngon(n, r, rot), ngon(n, r - 1.4 * bevel, rot), n, h0, h1, bevel, wall, top, glint);
}
/** Ground point at radius r and angle t on the plane at height h. */
export const ringPoint = (x: number, y0: number, r: number, t: number, h: number) => [X(x, Math.cos(t) * r), Y(y0, Math.sin(t) * r, h)] as const;
/** A line along the front half of a circle of radius r at height h (t from t0 to t1). */
export function frontArc(g: Ink, x: number, y0: number, r: number, h: number, width: number, color: number, alpha = 1, t0 = 0.15, t1 = Math.PI - 0.15) {
  const n = 11;
  g.lineStyle(width, color, alpha);
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n,
      b = t0 + ((t1 - t0) * (i + 1)) / n;
    g.lineBetween(X(x, Math.cos(a) * r), Y(y0, Math.sin(a) * r, h), X(x, Math.cos(b) * r), Y(y0, Math.sin(b) * r, h));
  }
}
/** Lamps along the front of a round rim: dim and steady below level 4, chasing round from level 4 (live). */
export function chase(g: Ink, glow: Ink, x: number, y0: number, r: number, h: number, count: number, clock: number, color: number, level: number) {
  for (let i = 0; i < count; i++) {
    const t = 0.35 + ((Math.PI - 0.7) * i) / (count - 1),
      [lx, ly] = ringPoint(x, y0, r, t, h),
      on = level >= 4 ? 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.1)) : 0.25;
    disc(g, lx, ly, 1.1, OUTLINE);
    disc(g, lx, ly, 0.7, shade(color, -0.6 + 0.75 * on));
    if (on > 0.5) disc(glow, lx, ly, 2.4, color, 0.3 * on);
  }
}
/** Bolt heads on a ring of radius r at height h (only the front half shows). */
export function bolts(g: Ink, x: number, y0: number, r: number, h: number, count: number, rot = 0) {
  for (let i = 0; i < count; i++) {
    const t = rot + (i * Math.PI * 2) / count;
    if (Math.sin(t) < -0.2) continue;
    const [bx, by] = ringPoint(x, y0, r, t, h);
    disc(g, bx, by, 0.85, GUN.deep);
    disc(g, bx - 0.3, by - 0.3, 0.4, GUN.metal);
  }
}
/**
 * An upright hexagonal prism at ground (u, v) from h0 to h1 with a pointed cap rising `tip` above h1: its faces turned to
 * the viewer, lit from the upper left, and the six cap facets (seen from above).
 */
export function prism(g: Ink, x: number, y0: number, u: number, v: number, r: number, h0: number, h1: number, tip: number, color: number) {
  const cx = x + u,
    cv = v,
    corner = (i: number) => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r] as const;
  // Outline: the silhouette is the hull of the bottom front, the cap and the sides.
  for (let i = 0; i < 6; i++) {
    const [a0, b0] = corner(i),
      [a1, b1] = corner(i + 1),
      t = ((i + 0.5) * Math.PI) / 3;
    quad(g, X(cx, a0) - 0.6, Y(y0, cv + b0, h0) + 0.6, X(cx, a1) + 0.6, Y(y0, cv + b1, h0) + 0.6, X(cx, a1) + 0.6, Y(y0, cv + b1, h1), X(cx, a0) - 0.6, Y(y0, cv + b0, h1), OUTLINE, Math.sin(t) > 0 ? 0.9 : 0);
  }
  for (let i = 0; i < 6; i++) {
    const t = ((i + 0.5) * Math.PI) / 3;
    if (Math.sin(t) <= 0) continue;
    const [a0, b0] = corner(i),
      [a1, b1] = corner(i + 1);
    quad(g, X(cx, a0), Y(y0, cv + b0, h0), X(cx, a1), Y(y0, cv + b1, h0), X(cx, a1), Y(y0, cv + b1, h1), X(cx, a0), Y(y0, cv + b0, h1), shade(color, -0.35 + 0.35 * facing(t)));
  }
  const apex = [X(cx, 0), Y(y0, cv, h1 + tip)] as const;
  for (let i = 0; i < 6; i++) {
    const [a0, b0] = corner(i),
      [a1, b1] = corner(i + 1),
      t = ((i + 0.5) * Math.PI) / 3;
    g.fillStyle(shade(color, 0.05 + 0.3 * facing(t)));
    g.fillTriangle(X(cx, a0), Y(y0, cv + b0, h1), X(cx, a1), Y(y0, cv + b1, h1), apex[0], apex[1]);
  }
  // A bright edge on the lit side of the cap.
  const [la, lb] = corner(3);
  g.lineStyle(0.6, shade(color, 0.6), 0.9);
  g.lineBetween(X(cx, la), Y(y0, cv + lb, h1), apex[0], apex[1]);
}
export { SQUASH };
