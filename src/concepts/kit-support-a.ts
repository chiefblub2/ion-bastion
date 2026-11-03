/**
 * Helpers of the Support A concepts (Aura, Refinery, Detector, Bounty Beacon, Repair Dock, Tracker, Overclock, Fire
 * Control): installations rather than guns, so most of each is still (`base`) and only dishes, coins, hands and lights
 * move (`above`). Throwaway like the concept sheet; reads the tilt kit only.
 */
import { shade, type Ink } from "../render/shapes";
import { part } from "../render/tower-art/tilt-parts";
import { OUTLINE, SQUASH, X, Y, drum, fillPoints, onGround, point, quad } from "../render/tower-art/tilt";

/** Installation steel: deep shadow, wall, roof, metallic highlight. */
export const STEEL = { deep: 0x182127, side: 0x34434a, top: 0x56676e, metal: 0x93a5a8 } as const;
export const SHADOW_INK = 0x050b10;

/** Regular n-gon footprint (u, v pairs, clockwise on the screen), rotated by `rot`. */
export const ngon = (n: number, r: number, rot = 0) =>
  Array.from({ length: n }, (_, i) => [Math.cos(rot + (i * Math.PI * 2) / n) * r, Math.sin(rot + (i * Math.PI * 2) / n) * r]).flat();
/** A footprint shifted by (du, dv). */
export const shift = (shape: readonly number[], du: number, dv: number) => shape.map((c, i) => c + (i % 2 ? dv : du));
/** A still armoured block over a footprint (not turned), with a bevelled top inset by `k` about its own centre. */
export function slab(g: Ink, x: number, y0: number, shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number, glint = shade(top, 0.45), k = 0.8) {
  part(g, x, y0, 0, shape, h0, h1, bevel, wall, top, glint, k);
}
/** Screen point of (u east, v south, h up). */
export const at = (x: number, y0: number) => (u: number, v: number, h: number) => [X(x, u), Y(y0, v, h)] as const;
/** An upright cylinder standing at (u, v). */
export function drumAt(g: Ink, x: number, y0: number, u: number, v: number, r: number, h0: number, h1: number, color: number, top = shade(color, 0.12), segments = 12) {
  drum(g, X(x, u), y0 + v * SQUASH, r, h0, h1, color, top, segments);
}
/** A contact shadow on the ground: a dark core and a soft spread to the lower right. */
export function contact(g: Ink, x: number, y0: number, rx: number, ry: number) {
  onGround(g, x, y0, 0, () => {
    ring(g, 4, 6, rx + 5, ry + 3, 0.2);
    ring(g, 1.5, 2.5, rx, ry, 0.36);
  });
}
function ring(g: Ink, cx: number, cy: number, rx: number, ry: number, alpha: number) {
  const n = 20;
  for (let i = 0; i < n; i++) point(i, cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry);
  fillPoints(g, n, SHADOW_INK, alpha);
}
/**
 * A toothed gear on a plane: centre (cx, cy) on screen, radius r, `teeth` teeth (at most 12), turned by `rot`; `sy`
 * squashes it vertically (1 on an upright wall, `SQUASH` on the ground).
 */
export function gear(g: Ink, cx: number, cy: number, r: number, teeth: number, rot: number, color: number, sy = 1) {
  const n = teeth * 2;
  for (let i = 0; i < n; i++) {
    const t = rot + (i / n) * Math.PI * 2,
      rr = i % 2 ? r * 0.78 : r;
    point(i, cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * sy);
  }
  fillPoints(g, n, color);
}
/** A disc on an upright wall facing the viewer: centre (cx, cy), radius r, `n` corners. */
export function face(g: Ink, cx: number, cy: number, r: number, color: number, alpha = 1, sy = 1, n = 16) {
  for (let i = 0; i < n; i++) point(i, cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r * sy);
  fillPoints(g, n, color, alpha);
}
/** A four-sided pyramid roof from the square footprint ±s at height h0 up to an apex at h1: the faces turned to the viewer. */
export function roof(g: Ink, x: number, y0: number, s: number, h0: number, h1: number, color: number) {
  const P = at(x, y0),
    apex = P(0, 0, h1),
    c = [P(-s, -s, h0), P(s, -s, h0), P(s, s, h0), P(-s, s, h0)];
  // Outline, then west, east and south faces (the north one lies behind the apex).
  quad(g, c[0][0] - 0.7, c[0][1], c[1][0] + 0.7, c[1][1], c[2][0] + 0.7, c[2][1] + 0.7, c[3][0] - 0.7, c[3][1] + 0.7, OUTLINE, 0.9);
  g.fillStyle(OUTLINE, 0.9);
  g.fillTriangle(c[0][0] - 0.7, c[0][1], c[1][0] + 0.7, c[1][1], apex[0], apex[1] - 0.8);
  g.fillTriangle(c[3][0] - 0.7, c[3][1] + 0.7, c[2][0] + 0.7, c[2][1] + 0.7, apex[0], apex[1] - 0.8);
  g.fillStyle(shade(color, 0.22));
  g.fillTriangle(c[0][0], c[0][1], c[3][0], c[3][1], apex[0], apex[1]);
  g.fillStyle(shade(color, -0.3));
  g.fillTriangle(c[1][0], c[1][1], c[2][0], c[2][1], apex[0], apex[1]);
  g.fillStyle(color);
  g.fillTriangle(c[3][0], c[3][1], c[2][0], c[2][1], apex[0], apex[1]);
}
