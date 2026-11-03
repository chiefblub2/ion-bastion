import { disc, shade, type Ink } from "../shapes";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, endFace, fillPoints, onGround, point, tube } from "./tilt";

/**
 * Shared parts of the tilted turrets (Skyguard, Scattergun, Headsman, Railspear, …): a gunmetal palette, footprints,
 * blocks turned about their own centre, a screen framer, back-to-front painting by depth, barrels shifted across the
 * aim, cast shadows and lamps. See `tilt.ts` for the projection.
 */
/** Gunmetal palette shared by batch A: deep shadow, side metal, top metal, metallic highlight. */
export const GUN = { deep: 0x172227, side: 0x34434a, top: 0x52646b, metal: 0x8b9da1 } as const;
export const SHADOW_INK = 0x050b10;
/** Rectangle footprint (along p0..p1, across q0..q1), clockwise on the screen like the kit's shapes. */
export const rect = (p0: number, p1: number, q0: number, q1: number) => [p0, q0, p1, q0, p1, q1, p0, q1];
/** Turns `src` by `a` into `out` scaled by `k` about its own centroid (the kit's `turn` scales about the axis only). */
export function turnAbout(src: readonly number[], a: number, out: Float64Array, k = 1) {
  const n = src.length / 2,
    c = Math.cos(a),
    s = Math.sin(a);
  let pc = 0,
    qc = 0;
  for (let i = 0; i < n; i++) {
    pc += src[2 * i] / n;
    qc += src[2 * i + 1] / n;
  }
  for (let i = 0; i < n; i++) {
    const p = pc + (src[2 * i] - pc) * k,
      q = qc + (src[2 * i + 1] - qc) * k;
    out[2 * i] = p * c - q * s;
    out[2 * i + 1] = p * s + q * c;
  }
  return n;
}
/** An armoured block over a footprint turned by `a`; with `bevel` its top is inset by `k` about the footprint's centre. */
export function part(g: Ink, x: number, y0: number, a: number, shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number, glint: number, k = 0.8) {
  const n = turnAbout(shape, a, FOOT);
  turnAbout(shape, a, INSET, bevel >= 1 ? k : 1);
  block(g, x, y0, FOOT, INSET, n, h0, h1, bevel, wall, top, glint);
}
/** Screen point of (along p, across q, height h) on a turret aimed at `a`. */
export const framer = (x: number, y0: number, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (p: number, q: number, h: number) => [X(x, p * c - q * s), Y(y0, p * s + q * c, h)] as const;
};
/** Ground depth (towards the viewer) of a turret point: the painter's key. */
export const depth = (a: number, p: number, q: number) => p * Math.sin(a) + q * Math.cos(a);
/** Draws the parts back to front by their depth. */
export function paint(parts: [number, () => void][]) {
  parts.sort((l, r) => l[0] - r[0]);
  for (const [, draw] of parts) draw();
}
/** The kit's `tube` with the pivot shifted `q` across the aim (parallel barrels). */
export function tubeAt(g: Ink, x: number, y0: number, a: number, q: number, h: number, d0: number, d1: number, r: number, color: number, alpha = 1, detail = true, pitch = 0) {
  tube(g, x - Math.sin(a) * q, y0 + Math.cos(a) * q * SQUASH, a, h, d0, d1, r, color, alpha, detail, pitch);
}
export function endAt(g: Ink, x: number, y0: number, a: number, q: number, h: number, d: number, r: number, color: number, pitch = 0) {
  endFace(g, x - Math.sin(a) * q, y0 + Math.cos(a) * q * SQUASH, a, h, d, r, color, pitch);
}
/** Screen point `d` along a barrel shifted `q` across the aim, pitched by `pitch` off a pivot at height h. */
export function muzzleAt(x: number, y0: number, a: number, q: number, h: number, d: number, pitch = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    g = d * Math.cos(pitch);
  return [X(x, c * g - s * q), Y(y0, s * g + c * q, h + d * Math.sin(pitch))] as const;
}
/** A turret footprint's shadow cast to the lower right onto the plane at height h. */
export function castShadow(g: Ink, x: number, y0: number, a: number, shape: readonly number[], h: number, alpha = 0.25) {
  const n = turnAbout(shape, a, FOOT);
  onGround(g, x, y0, h, () => {
    for (let i = 0; i < n; i++) point(i, FOOT[2 * i] + 5, FOOT[2 * i + 1] + 7);
    fillPoints(g, n, SHADOW_INK, alpha);
  });
}
/** A small lamp: dark socket, lit glass and its light. */
export function lamp(g: Ink, glow: Ink, lx: number, ly: number, color: number, on = 1) {
  lampInk(g, lx, ly, color, on);
  lampLight(glow, lx, ly, color, on);
}
/** A lamp's socket and glass alone: still at a steady `on`, so a turret may draw it into its cached ink. */
export function lampInk(g: Ink, lx: number, ly: number, color: number, on = 1) {
  disc(g, lx, ly, 1.35, OUTLINE);
  disc(g, lx, ly, 0.85, shade(color, -0.5 + 0.7 * on));
}
/** A lamp's light alone (glow), for the live part over a cached turret. */
export function lampLight(glow: Ink, lx: number, ly: number, color: number, on = 1) {
  if (on > 0.3) disc(glow, lx, ly, 2.6, color, 0.35 * on);
}

