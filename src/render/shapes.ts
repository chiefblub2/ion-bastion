import type Phaser from "phaser";
import type { Point } from "../core/types";
export type Ink = Phaser.GameObjects.Graphics;
/** The two inks of the battlefield: `g` paints normally, `glow` adds light (additive blending). */
export interface Pen {
  readonly g: Ink;
  readonly glow: Ink;
}
/** Pixel size of one grid cell. */
export const CELL = 56;
/** Grid coordinate (cell index or fractional position) to the pixel centre. */
export const px = (v: number) => (v + 0.5) * CELL;
/** Shared corner buffer of the fills below; Phaser copies the coordinates, so one buffer serves every shape. */
const POINTS: Point[] = Array.from({ length: 128 }, () => ({ x: 0, y: 0 }));
function set(i: number, x: number, y: number) {
  POINTS[i].x = x;
  POINTS[i].y = y;
}
function fill(g: Ink, n: number, color: number, alpha: number) {
  g.fillStyle(color, alpha);
  g.fillPoints(POINTS, true, false, n);
}
export function polygon(g: Ink, x: number, y: number, r: number, n: number, color: number, rotation = 0, alpha = 1) {
  for (let i = 0; i < n; i++) {
    const a = rotation + (i * Math.PI * 2) / n;
    set(i, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  fill(g, n, color, alpha);
}
/** Spiky star with `n` spikes between the radii `inner` and `outer`. */
export function star(g: Ink, x: number, y: number, outer: number, inner: number, n: number, color: number, rotation = 0, alpha = 1) {
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? inner : outer,
      a = rotation + (i * Math.PI) / n;
    set(i, x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  fill(g, n * 2, color, alpha);
}
/** Mixes a colour towards white (`f > 0`) or black (`f < 0`) by `|f|`. */
export function shade(color: number, f: number) {
  const target = f < 0 ? 0 : 255,
    k = Math.abs(f),
    channel = (shift: number) => Math.round(((color >> shift) & 255) * (1 - k) + target * k);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
/** Corners of a round shape: smooth at its size, and far fewer than the 100 Phaser spends on every circle. */
export const sides = (r: number) => Math.min(40, Math.max(8, Math.round(6 + r)));
/** Filled circle as a polygon; use it instead of `fillCircle`. */
export function disc(g: Ink, x: number, y: number, r: number, color: number, alpha = 1) {
  if (r > 0 && alpha > 0) polygon(g, x, y, r, sides(r), color, 0, alpha);
}
// Phaser spends 100 segments on every `arc`, however short, and on each corner of `fillRoundedRect`. The three
// helpers below keep the current fill or line style, so they replace `fillCircle`, `strokeCircle` and `arc` one for one.
function round(x: number, y: number, r: number) {
  const n = sides(r);
  for (let i = 0; i < n; i++) set(i, x + Math.cos((i * Math.PI * 2) / n) * r, y + Math.sin((i * Math.PI * 2) / n) * r);
  return n;
}
/** Circle in the current fill style; use it instead of `fillCircle`. */
export function fillRound(g: Ink, x: number, y: number, r: number) {
  if (r > 0) g.fillPoints(POINTS, true, false, round(x, y, r));
}
/** Circle outline in the current line style; use it instead of `strokeCircle`. */
export function strokeRound(g: Ink, x: number, y: number, r: number) {
  if (r > 0) g.strokePoints(POINTS, true, true, round(x, y, r));
}
/** Arc from `a0` to `a1` into the open path (about 4 px per segment); use it instead of `arc` between `beginPath` and `strokePath`. */
export function arcPath(g: Ink, x: number, y: number, r: number, a0: number, a1: number) {
  const n = Math.min(48, Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 4)));
  g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
}
/** Filled ellipse with the radii `rx` and `ry`, turned by `rotation`; use it instead of `fillEllipse` (which takes diameters). */
export function oval(g: Ink, x: number, y: number, rx: number, ry: number, color: number, alpha = 1, rotation = 0) {
  if (rx <= 0 || ry <= 0 || alpha <= 0) return;
  const n = sides(Math.max(rx, ry)),
    c = Math.cos(rotation),
    s = Math.sin(rotation);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      ex = Math.cos(a) * rx,
      ey = Math.sin(a) * ry;
    set(i, x + ex * c - ey * s, y + ex * s + ey * c);
  }
  fill(g, n, color, alpha);
}
/** Band of width `w` around radius `r` from angle `a0` to `a1`, built from triangles: exact alpha, no overlapping joins. */
export function arcBand(g: Ink, x: number, y: number, r: number, w: number, a0: number, a1: number, color: number, alpha = 1) {
  if (w <= 0 || alpha <= 0) return;
  const inner = Math.max(0, r - w / 2),
    outer = r + w / 2,
    // About 5 px per segment, but at least 16 around a full circle so small rings stay round.
    n = Math.min(48, Math.max(2, Math.ceil((Math.abs(a1 - a0) * outer) / 5), Math.ceil((Math.abs(a1 - a0) / (Math.PI * 2)) * 16)));
  g.fillStyle(color, alpha);
  let ca = Math.cos(a0),
    sa = Math.sin(a0);
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n,
      cb = Math.cos(a),
      sb = Math.sin(a);
    g.fillTriangle(x + ca * outer, y + sa * outer, x + cb * outer, y + sb * outer, x + cb * inner, y + sb * inner);
    if (inner > 0) g.fillTriangle(x + ca * outer, y + sa * outer, x + cb * inner, y + sb * inner, x + ca * inner, y + sa * inner);
    ca = cb;
    sa = sb;
  }
}
/** Closed band; use it instead of `strokeCircle`. */
export const ring = (g: Ink, x: number, y: number, r: number, w: number, color: number, alpha = 1) =>
  arcBand(g, x, y, r, w, 0, Math.PI * 2, color, alpha);
/** Pie slice from `a0` to `a1`; use it instead of `slice` plus `fillPath`. */
export const wedge = (g: Ink, x: number, y: number, r: number, a0: number, a1: number, color: number, alpha = 1) =>
  arcBand(g, x, y, r / 2, r, a0, a1, color, alpha);
/** Box with cut corners and the half sizes `hw` × `hh`; use it instead of `fillRoundedRect`. */
export function chamferRect(g: Ink, x: number, y: number, hw: number, hh: number, cut: number, color: number, alpha = 1) {
  const c = Math.max(0.01, Math.min(cut, hw, hh));
  set(0, x - hw + c, y - hh);
  set(1, x + hw - c, y - hh);
  set(2, x + hw, y - hh + c);
  set(3, x + hw, y + hh - c);
  set(4, x + hw - c, y + hh);
  set(5, x - hw + c, y + hh);
  set(6, x - hw, y + hh - c);
  set(7, x - hw, y - hh + c);
  fill(g, 8, color, alpha);
}
/**
 * Quad along the angle with cosine `c` and sine `s`: from distance `d0` to `d1`, with the lateral offsets
 * `a0`/`b0` at the start and `a1`/`b1` at the end (positive offsets lie at the angle + π/2).
 */
export function strip(g: Ink, x: number, y: number, c: number, s: number, d0: number, d1: number, a0: number, b0: number, a1: number, b1: number, color: number, alpha = 1) {
  if (alpha <= 0) return;
  set(0, x + c * d0 - s * a0, y + s * d0 + c * a0);
  set(1, x + c * d1 - s * a1, y + s * d1 + c * a1);
  set(2, x + c * d1 - s * b1, y + s * d1 + c * b1);
  set(3, x + c * d0 - s * b0, y + s * d0 + c * b0);
  fill(g, 4, color, alpha);
}
const mix = (h: number, v: number) => Math.imul(h ^ (Math.round(v * 64) | 0), 0x01000193);
/** Deterministic noise in [0, 1) from up to three numbers (positions, ids, time steps), so frames and screenshots repeat. */
export function hash01(a: number, b = 0, c = 0) {
  let h = mix(mix(mix(0x811c9dc5, a), b), c);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Jagged lightning between two pixel points: wide glow, white-hot core and one side branch; `seed` picks the shape. */
export function lightning({ g, glow }: Pen, x0: number, y0: number, x1: number, y1: number, color: number, alpha: number, seed: number, branch = true) {
  const dx = x1 - x0,
    dy = y1 - y0,
    length = Math.hypot(dx, dy) || 1,
    nx = -dy / length,
    ny = dx / length,
    n = Math.min(12, Math.max(4, Math.round(length / 14))),
    amp = Math.min(9, 0.12 * length);
  for (let i = 0; i <= n; i++) {
    const k = i / n,
      off = i === 0 || i === n ? 0 : (hash01(seed, i) * 2 - 1) * amp * Math.sin(Math.PI * k);
    set(i, x0 + dx * k + nx * off, y0 + dy * k + ny * off);
  }
  const fork = 1 + Math.floor(hash01(seed, 31) * (n - 1)),
    bx = POINTS[fork].x,
    by = POINTS[fork].y;
  glow.lineStyle(5, color, 0.22 * alpha);
  glow.strokePoints(POINTS, false, false, n + 1);
  glow.lineStyle(2.2, color, 0.5 * alpha);
  glow.strokePoints(POINTS, false, false, n + 1);
  g.lineStyle(1.1, 0xffffff, alpha);
  g.strokePoints(POINTS, false, false, n + 1);
  if (!branch || length < 30) return;
  const a = Math.atan2(dy, dx) + (hash01(seed, 32) < 0.5 ? -0.7 : 0.7),
    reach = 0.28 * length;
  for (let i = 0; i <= 3; i++) {
    const k = i / 3,
      off = i === 0 ? 0 : (hash01(seed, 40 + i) * 2 - 1) * amp * 0.5;
    set(i, bx + Math.cos(a) * reach * k - Math.sin(a) * off, by + Math.sin(a) * reach * k + Math.cos(a) * off);
  }
  glow.lineStyle(3, color, 0.25 * alpha);
  glow.strokePoints(POINTS, false, false, 4);
  g.lineStyle(0.8, 0xffffff, 0.7 * alpha);
  g.strokePoints(POINTS, false, false, 4);
}
