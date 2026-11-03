import { facing } from "../material";
import { shade, type Ink } from "../shapes";
import { OUTLINE, SQUASH, X, Y, fillPoints, point, quad } from "./tilt";

/** Pitched 3D parts of the tilted turrets (Rocket Rack, Pit Mortar, Reagent Flask, Uplink Array): frames along a pitched axis, lit boxes, discs across the axis and rods. */
/**
 * A frame along a pitched axis: `d` along the barrel (ground angle `a`, elevation `pitch`), `e` across it (level), `n`
 * square to both, pointing up. The origin is (pu, pv, ph) in tower ground coordinates (u east, v south, h up).
 */
export interface Frame {
  du: number; dv: number; dh: number;
  eu: number; ev: number;
  nu: number; nv: number; nh: number;
  pu: number; pv: number; ph: number;
}
export function frame(a: number, pitch: number, ph: number, pu = 0, pv = 0): Frame {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return { du: ca * cp, dv: sa * cp, dh: sp, eu: -sa, ev: ca, nu: -ca * sp, nv: -sa * sp, nh: cp, pu, pv, ph };
}
/** Screen point of frame coordinates (p along, q across, z up). */
export const SX = new Float64Array(16),
  SY = new Float64Array(16);
export function project(x: number, y0: number, f: Frame, p: number, q: number, z: number, i: number) {
  SX[i] = X(x, f.pu + p * f.du + q * f.eu + z * f.nu);
  SY[i] = Y(y0, f.pv + p * f.dv + q * f.ev + z * f.nv, f.ph + p * f.dh + z * f.nh);
}
/** Direction towards the viewer of the board's oblique projection (as in `towardViewer`). */
const WV = Math.sqrt(1 - SQUASH * SQUASH),
  WH = SQUASH;
/** How much a world direction faces the viewer: > 0 visible. */
export const seen = (nv: number, nh: number) => nv * WV + nh * WH;
/** Brightness of a face with world normal (u, v, h): light from the upper left and above, −1…1. */
export function lit(u: number, v: number, h: number) {
  const flat = Math.sqrt(u * u + v * v);
  return 0.55 * h + (flat > 0.01 ? 0.75 * flat * facing(Math.atan2(v, u)) : 0);
}
const FACES = [
  // corner indices (p bit 4, q bit 2, z bit 1) and the face normal as [d, e, n] signs
  [4, 6, 7, 5, 1, 0, 0],
  [0, 1, 3, 2, -1, 0, 0],
  [2, 3, 7, 6, 0, 1, 0],
  [0, 4, 5, 1, 0, -1, 0],
  [1, 5, 7, 3, 0, 0, 1],
  [0, 2, 6, 4, 0, 0, -1],
];
/** Convex hull (screen) of the first `n` projected points into the scratch polygon, grown by `grow` px; returns its size. */
function hull(n: number, grow: number) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => SX[a] - SX[b] || SY[a] - SY[b]),
    cross = (o: number, a: number, b: number) => (SX[a] - SX[o]) * (SY[b] - SY[o]) - (SY[a] - SY[o]) * (SX[b] - SX[o]),
    out: number[] = [];
  for (const pass of [idx, [...idx].reverse()]) {
    const start = out.length;
    for (const i of pass) {
      while (out.length >= start + 2 && cross(out[out.length - 2], out[out.length - 1], i) <= 0) out.pop();
      out.push(i);
    }
    out.pop();
  }
  let cx = 0,
    cy = 0;
  for (const i of out) {
    cx += SX[i] / out.length;
    cy += SY[i] / out.length;
  }
  out.forEach((i, k) => {
    const dx = SX[i] - cx,
      dy = SY[i] - cy,
      l = Math.sqrt(dx * dx + dy * dy) || 1;
    point(k, SX[i] + (dx / l) * grow, SY[i] + (dy / l) * grow);
  });
  return out.length;
}
/**
 * A box in frame coordinates (p0…p1 along, q0…q1 across, z0…z1 up): a dark outline round its silhouette, then every
 * face turned to the viewer, lit by its normal. Returns whether the front face (+p) is visible.
 */
export function box(g: Ink, x: number, y0: number, f: Frame, p0: number, p1: number, q0: number, q1: number, z0: number, z1: number, color: number, front = color) {
  for (let i = 0; i < 8; i++) project(x, y0, f, i & 4 ? p1 : p0, i & 2 ? q1 : q0, i & 1 ? z1 : z0, i);
  fillPoints(g, hull(8, 0.7), OUTLINE, 0.9);
  let shown = false;
  for (const [a, b, c, d, sd, se, sn] of FACES) {
    const nu = sd * f.du + se * f.eu + sn * f.nu,
      nv = sd * f.dv + se * f.ev + sn * f.nv,
      nh = sd * f.dh + sn * f.nh;
    if (seen(nv, nh) <= 0.01) continue;
    if (sd > 0) shown = true;
    quad(g, SX[a], SY[a], SX[b], SY[b], SX[c], SY[c], SX[d], SY[d], shade(sd > 0 ? front : color, -0.25 + 0.42 * lit(nu, nv, nh)));
  }
  return shown;
}
/** A disc in the frame's (e, n) plane at `p` along the axis (a dish, a flange), radius r, `n` corners. */
export function plane(g: Ink, x: number, y0: number, f: Frame, p: number, r: number, color: number, alpha = 1, rz = r, n = 16) {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    project(x, y0, f, p, Math.cos(t) * r, Math.sin(t) * rz, 0);
    point(i, SX[0], SY[0]);
  }
  fillPoints(g, n, color, alpha);
}
/** A straight rod between two points in tower ground coordinates (u, v, h), w px wide: outline, body, lit edge. */
export function rod(g: Ink, x: number, y0: number, u0: number, v0: number, h0: number, u1: number, v1: number, h1: number, w: number, color: number) {
  const ax = X(x, u0),
    ay = Y(y0, v0, h0),
    bx = X(x, u1),
    by = Y(y0, v1, h1);
  g.lineStyle(w + 1.4, OUTLINE, 0.9);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(w, color, 1);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(Math.max(0.5, w * 0.35), shade(color, 0.35), 0.9);
  g.lineBetween(ax - 0.3, ay - 0.4, bx - 0.3, by - 0.4);
}

