/**
 * Shared kit of the towers drawn in the slight 3/4 tilt (Pulse's Hex Sentinel, Nova's Siege Cannon).
 *
 * World axes around a tower's ground centre: u east, v south, h up. A point lands on the screen at
 * (x + u, y0 + v × SQUASH − h), where y0 is the ground centre (the cell centre plus the tower's `drop`). Light comes from
 * the upper left as everywhere else (`facing`). Every helper writes into shared scratch buffers, so a frame allocates
 * no geometry.
 */
import { LIGHT, facing } from "../material";
import { oval, shade, type Ink } from "../shapes";

/** Vertical squash of the ground plane: depth on the board shows at 0.65 of its width. */
export const SQUASH = 0.65;
/** Dark outline of every tilted part. */
export const OUTLINE = 0x081217;

const PTS = Array.from({ length: 24 }, () => ({ x: 0, y: 0 }));
/** Scratch footprints for `turn`. */
export const FOOT = new Float64Array(32),
  INSET = new Float64Array(32);

export const X = (x: number, u: number) => x + u,
  Y = (y0: number, v: number, h: number) => y0 + v * SQUASH - h;

/**
 * Exact-length copies per corner count: a drawing then hands Phaser only its own corners, never stale ones left in the
 * scratch buffer by another tower, so a still base records the same calls every time (`stillBody`).
 */
const BY_COUNT: { x: number; y: number }[][] = [];
/** Fills the first `n` scratch points (set through `point`). */
export function fillPoints(g: Ink, n: number, color: number, alpha = 1) {
  const out = (BY_COUNT[n] ??= Array.from({ length: n }, () => ({ x: 0, y: 0 })));
  for (let i = 0; i < n; i++) {
    out[i].x = PTS[i].x;
    out[i].y = PTS[i].y;
  }
  g.fillStyle(color, alpha);
  g.fillPoints(out, true, false, n);
}
export function point(i: number, x: number, y: number) {
  PTS[i].x = x;
  PTS[i].y = y;
}
export function quad(g: Ink, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillTriangle(x0, y0, x1, y1, x2, y2);
  g.fillTriangle(x0, y0, x2, y2, x3, y3);
}
/** Turns a footprint (along, across pairs) by `a` into `out` (u, v pairs), scaled by `k` about `along` on the axis. */
export function turn(src: readonly number[], a: number, out: Float64Array, k = 1, along = 0, du = 0, dv = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  for (let i = 0; i < src.length; i += 2) {
    const p = (src[i] - along) * k + along,
      q = src[i + 1] * k;
    out[i] = du + p * c - q * s;
    out[i + 1] = dv + p * s + q * c;
  }
  return src.length / 2;
}
/** Outward normal angle of edge i of a convex footprint whose corners run clockwise on the screen. */
export function normalOf(f: Float64Array | readonly number[], n: number, i: number) {
  const j = (i + 1) % n;
  return Math.atan2(-(f[2 * j] - f[2 * i]), f[2 * j + 1] - f[2 * i + 1]);
}
/**
 * Armoured block over a convex footprint (clockwise): walls from h0 to h1 on the sides turned to the viewer, a chamfer
 * up to an inset top at h1 + `bevel` (none below 1 px: the top is the footprint), the lit top and a metallic glint on
 * its edges that face the light. Walls darken the further they face from the light.
 */
export function block(g: Ink, x: number, y0: number, f: Float64Array, inset: Float64Array, n: number, h0: number, h1: number, bevel: number, wall: number, top: number, glint: number) {
  for (let i = 0; i < n; i++) point(i, X(x, f[2 * i]), Y(y0, f[2 * i + 1], h1));
  fillPoints(g, n, OUTLINE, 0.9);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = normalOf(f, n, i);
    if (Math.sin(a) <= 0.02) continue;
    const u0 = X(x, f[2 * i]),
      u1 = X(x, f[2 * j]),
      face = shade(wall, 0.3 * facing(a)),
      b0 = Y(y0, f[2 * i + 1], h0),
      b1 = Y(y0, f[2 * j + 1], h0),
      t0 = Y(y0, f[2 * i + 1], h1),
      t1 = Y(y0, f[2 * j + 1], h1);
    quad(g, u0 - 0.5, b0 + 0.6, u1 + 0.5, b1 + 0.6, u1 + 0.5, t1, u0 - 0.5, t0, OUTLINE, 0.9);
    quad(g, u0, b0, u1, b1, u1, t1, u0, t0, face);
    // Seam at mid height and a lit lip along the top edge.
    g.lineStyle(0.6, shade(face, -0.45), 0.9);
    g.lineBetween(u0, (b0 + t0) / 2 + 0.6, u1, (b1 + t1) / 2 + 0.6);
    quad(g, u0, t0, u1, t1, u1, t1 + 0.9, u0, t0 + 0.9, shade(face, 0.28));
  }
  // Chamfer faces between the wall tops and the inset top; north-facing ones fall under the top.
  const chamfer = bevel >= 1,
    t = chamfer ? inset : f,
    th = chamfer ? h1 + bevel : h1;
  for (let i = 0; chamfer && i < n; i++) {
    const j = (i + 1) % n;
    quad(
      g,
      X(x, f[2 * i]), Y(y0, f[2 * i + 1], h1),
      X(x, f[2 * j]), Y(y0, f[2 * j + 1], h1),
      X(x, inset[2 * j]), Y(y0, inset[2 * j + 1], th),
      X(x, inset[2 * i]), Y(y0, inset[2 * i + 1], th),
      shade(top, -0.12 + 0.32 * facing(normalOf(f, n, i))),
    );
  }
  for (let i = 0; i < n; i++) point(i, X(x, t[2 * i]), Y(y0, t[2 * i + 1], th));
  fillPoints(g, n, top);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (facing(normalOf(t, n, i)) < 0.45) continue;
    g.lineStyle(0.8, glint, 0.9);
    g.lineBetween(PTS[i].x, PTS[i].y + 0.4, PTS[j].x, PTS[j].y + 0.4);
  }
}
/** Screen point `d` along a barrel aimed at ground angle `a` and pitched up by `pitch`, pivoting at height h. */
export const along = (x: number, y0: number, a: number, h: number, d: number, pitch = 0) =>
  [X(x, Math.cos(a) * Math.cos(pitch) * d), Y(y0, Math.sin(a) * Math.cos(pitch) * d, h + Math.sin(pitch) * d)] as const;
/**
 * Tube along ground angle `a`, pitched up by `pitch`, from distance d0 to d1 off a pivot at height h, radius r: dark
 * outline, body, a highlight on the side turned up and to the light and a shaded underside. Thin parts (`detail`
 * false) stop at the body: the bands would be under a pixel wide.
 */
export function tube(g: Ink, x: number, y0: number, a: number, h: number, d0: number, d1: number, r: number, color: number, alpha = 1, detail = true, pitch = 0) {
  const [x0, ys] = along(x, y0, a, h, d0, pitch),
    [x1, y1] = along(x, y0, a, h, d1, pitch),
    len = Math.sqrt((x1 - x0) ** 2 + (y1 - ys) ** 2) || 1,
    px = -(y1 - ys) / len,
    py = (x1 - x0) / len,
    up = px * Math.cos(LIGHT) * 0.5 - py > 0 ? 1 : -1,
    band = (s0: number, s1: number, col: number, al: number) =>
      quad(g, x0 + px * s0, ys + py * s0, x1 + px * s0, y1 + py * s0, x1 + px * s1, y1 + py * s1, x0 + px * s1, ys + py * s1, col, al);
  band(-r - 0.8, r + 0.8, OUTLINE, 0.85 * alpha);
  band(-r, r, color, alpha);
  if (!detail) return;
  // One lit band with a bright core edge, one shaded band below.
  band(up * r, up * r * 0.3, shade(color, 0.35), alpha);
  band(-up * r, -up * r * 0.35, shade(color, -0.4), alpha);
}
/** How much the end face of a barrel aimed at `a` with `pitch` turns towards the viewer (negative: away). */
export const towardViewer = (a: number, pitch = 0) => Math.sin(a) * Math.cos(pitch) * Math.sqrt(1 - SQUASH * SQUASH) + Math.sin(pitch) * SQUASH;
/** Disc across a barrel (its end face or a bore), centre `d` along the barrel, radius r. */
export function endFace(g: Ink, x: number, y0: number, a: number, h: number, d: number, r: number, color: number, pitch = 0) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    u = ca * cp * d,
    v = sa * cp * d,
    hc = h + sp * d,
    n = 14;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2,
      across = Math.cos(t) * r,
      upward = Math.sin(t) * r;
    // Across: horizontal and square to the aim; upward: square to the barrel in its vertical plane.
    point(i, X(x, u - sa * across - ca * sp * upward), Y(y0, v + ca * across - sa * sp * upward, hc + cp * upward));
  }
  fillPoints(g, n, color);
}
/** Upright cylinder (drum, collar) at the ground centre from h0 to h1: the shaded front half, then its top. */
export function drum(g: Ink, x: number, y0: number, r: number, h0: number, h1: number, color: number, top = shade(color, 0.1), segments = 12) {
  oval(g, x, Y(y0, 0, h0), r + 0.7, r * SQUASH + 0.7, OUTLINE, 0.95);
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * Math.PI,
      t1 = ((i + 1) / segments) * Math.PI;
    quad(
      g,
      X(x, Math.cos(t0) * r), Y(y0, Math.sin(t0) * r, h0),
      X(x, Math.cos(t1) * r), Y(y0, Math.sin(t1) * r, h0),
      X(x, Math.cos(t1) * r), Y(y0, Math.sin(t1) * r, h1),
      X(x, Math.cos(t0) * r), Y(y0, Math.sin(t0) * r, h1),
      shade(color, -0.2 + 0.35 * facing((t0 + t1) / 2)),
    );
  }
  oval(g, x, Y(y0, 0, h1), r, r * SQUASH, top);
}
/** Calls `draw` with `ink` mapped onto the ground plane at height h around (x, y0), scaled by `k`. */
export function onGround(ink: Ink, x: number, y0: number, h: number, draw: () => void, k = 1) {
  ink.save();
  ink.translateCanvas(x, y0 - h);
  ink.scaleCanvas(k, k * SQUASH);
  draw();
  ink.restore();
}
/** Draws `draw` (centred on 0, 0) flat on the plane at height h of a tower whose ground centre is (x, y0), shrunk by k. */
export function onDeck(inks: readonly Ink[], x: number, y0: number, h: number, draw: () => void, k = 0.82) {
  for (const ink of inks) {
    ink.save();
    ink.translateCanvas(x, y0 - h);
    ink.scaleCanvas(k, k * SQUASH);
  }
  draw();
  for (const ink of inks) ink.restore();
}
