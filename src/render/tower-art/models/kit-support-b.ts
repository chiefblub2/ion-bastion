/** Shared helpers of the Support B concepts (Armory, Skylink, Nexus, Workshop, Vault, Shield Generator, Recycler). */
import { facing } from "../../material";
import { disc, oval, ring, shade, type Ink } from "../../shapes";
import { OUTLINE, SQUASH, X, Y, block, onGround } from "../tilt";

/** Installation steel: walls, tops, deep recesses and the metallic highlight. */
export const STEEL = 0x3a454b,
  STEEL_TOP = 0x56646a,
  DEEP = 0x1a2328,
  METAL = 0x8e9ea2,
  BRASS = 0xb08a3a;

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
/** A footprint as a typed array (for `block`), optionally scaled about the centre. */
export function shape(points: readonly number[], k = 1) {
  return Float64Array.from(points, (p) => p * k);
}
/** Contact shadow under an installation of radius r: a tight core and a soft spread to the lower right. */
export function contact(g: Ink, x: number, y0: number, r: number) {
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, r + 5, r + 1, 0x050b10, 0.2);
    oval(g, 2, 3, r + 1, r, 0x050b10, 0.36);
  });
}
/** A bevelled slab over a footprint, its top inset by `bevel` pixels all round. */
export function slab(g: Ink, x: number, y0: number, foot: Float64Array, inset: Float64Array, h0: number, h1: number, wall = STEEL, top = STEEL_TOP, glint = METAL, bevel = 0.8) {
  block(g, x, y0, foot, inset, foot.length / 2, h0, h1, bevel, wall, top, glint);
}
/** A ring lying on the plane at height h. */
export function flatRing(g: Ink, x: number, y0: number, h: number, r: number, width: number, color: number, alpha = 1) {
  onGround(g, x, y0, h, () => ring(g, 0, 0, r, width, color, alpha));
}
/** A small sphere: outline, body lit from the upper left, a glint. */
export function ball(g: Ink, sx: number, sy: number, r: number, color: number) {
  disc(g, sx, sy, r + 0.6, OUTLINE, 0.95);
  disc(g, sx, sy, r, shade(color, -0.25));
  disc(g, sx - r * 0.2, sy - r * 0.25, r * 0.7, color);
  disc(g, sx - r * 0.4, sy - r * 0.45, r * 0.3, shade(color, 0.6), 0.9);
}
/** A small upright cylinder (post, socket, cartridge) at ground (u, v) from h0 to h1: dark side, lit cap. */
export function post(g: Ink, x: number, y0: number, u: number, v: number, r: number, h0: number, h1: number, side: number, cap = shade(side, 0.3)) {
  const sx = X(x, u),
    b = Y(y0, v, h0),
    t = Y(y0, v, h1);
  oval(g, sx, b, r + 0.5, r * SQUASH + 0.5, OUTLINE, 0.9);
  g.fillStyle(OUTLINE, 0.9);
  g.fillRect(sx - r - 0.5, t, 2 * r + 1, b - t);
  oval(g, sx, b, r, r * SQUASH, shade(side, -0.15));
  g.fillStyle(side);
  g.fillRect(sx - r, t, 2 * r, b - t);
  // A lit band on the side turned to the light.
  g.fillStyle(shade(side, 0.25 + 0.1 * facing(Math.PI)));
  g.fillRect(sx - r * 0.75, t, r * 0.45, b - t);
  oval(g, sx, t, r, r * SQUASH, cap);
}
