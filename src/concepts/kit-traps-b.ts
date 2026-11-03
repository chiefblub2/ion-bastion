/**
 * Helpers of the "Traps B" concepts (Tripwire, Barricade, Warp Pad, Arc Plate, Oil Slick, Grinder, Harpoon): traps lie
 * on the path, so they are low slabs and recesses in the path bed, drawn with the tilt kit (`render/tower-art/tilt.ts`).
 * Ground coordinates around the trap's ground centre (`y0 = y + DROP`): u east, v south, h up.
 */
import { shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, fillPoints, onGround, point, turn } from "../render/tower-art/tilt";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";

/** Traps sit a little lower than towers: their centre is the path's middle. */
export const DROP = 2;
export const trapTilt = (deck: number) => ({ drop: DROP, squash: SQUASH, height: 0, deck });
/** Trap gunmetal: deep shadow, wall, top, metallic highlight; the path bed's dark recess colour. */
export const IRON = { deep: 0x15191b, wall: 0x353c3f, top: 0x535d61, metal: 0x93a0a3 } as const;
export const RECESS = 0x0b0d0e;

/** A regular n-gon footprint of radius r, its first corner at `rot` (corners clockwise on the screen). */
export function ngon(n: number, r: number, rot = 0) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.cos(rot + (i * 2 * Math.PI) / n) * r, Math.sin(rot + (i * 2 * Math.PI) / n) * r);
  return out;
}
/** A rectangle footprint (u0…u1, v0…v1), clockwise on the screen. */
export const box2 = (u0: number, u1: number, v0: number, v1: number) => [u0, v0, u1, v0, u1, v1, u0, v1];
/** A block over a footprint (not turned), from h0 to h1, with a bevel to a top inset by k. */
export function slab(g: Ink, x: number, y0: number, shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number, glint: number, k = 0.86, du = 0, dv = 0) {
  const n = turn(shape, 0, FOOT, 1, 0, du, dv);
  turn(shape, 0, INSET, bevel >= 1 ? k : 1, 0, du, dv);
  block(g, x, y0, FOOT, INSET, n, h0, h1, bevel, wall, top, glint);
}
/** A dark cut in the path bed around a footprint (grown by `grow`), so a trap reads as set into the ground. */
export function recess(g: Ink, x: number, y0: number, shape: readonly number[], grow = 1.15, alpha = 0.85) {
  const n = shape.length / 2;
  onGround(g, x, y0, 0, () => {
    for (let i = 0; i < n; i++) point(i, shape[2 * i] * grow + 0.8, shape[2 * i + 1] * grow + 1.2);
    fillPoints(g, n, RECESS, alpha);
  });
}
/** Screen point of ground (u, v) at height h. */
export const at = (x: number, y0: number, u: number, v: number, h: number) => [X(x, u), Y(y0, v, h)] as const;
/** Whether the trap is armed (re-armed after its last trigger). */
export const armed = (ctx: TurretContext) => ctx.tower.cooldown === 0;
/** The ready lamp's socket (still: level 2 on), drawn into the base. */
export function readySocket(g: Ink, x: number, y0: number, u: number, v: number, h: number, color: number) {
  lampInk(g, ...at(x, y0, u, v, h), color, 0.2);
}
/** The ready lamp's glass and light: lit while armed (live). */
export function readyLight(ctx: TurretContext, x: number, y0: number, u: number, v: number, h: number) {
  const on = armed(ctx) ? 1 : 0.15,
    [lx, ly] = at(x, y0, u, v, h);
  lampInk(ctx.g, lx, ly, ctx.definition.color, on);
  lampLight(ctx.glow, lx, ly, ctx.definition.color, on);
}
/** From level 4: small lights along the given ground points chase one after another (live). */
export function chase(ctx: TurretContext, x: number, y0: number, points: readonly (readonly [number, number])[], h: number) {
  if (ctx.level < 4) return;
  points.forEach(([u, v], i) => {
    const on = 0.25 + 0.75 * Math.max(0, Math.sin(4 * ctx.clock - i * 1.2)),
      [lx, ly] = at(x, y0, u, v, h);
    ctx.g.fillStyle(OUTLINE);
    ctx.g.fillRect(lx - 1.1, ly - 0.8, 2.2, 1.6);
    ctx.g.fillStyle(shade(ctx.color, -0.6 + 0.7 * on));
    ctx.g.fillRect(lx - 0.6, ly - 0.4, 1.2, 0.8);
    if (on > 0.5) {
      ctx.glow.fillStyle(ctx.color, 0.25 * on);
      ctx.glow.fillRect(lx - 1.8, ly - 1.4, 3.6, 2.8);
    }
  });
}
/** Trim colour: the tower's own until a path is chosen (level 6), then the path's. */
export const trim = (ctx: TurretContext) => (ctx.level >= 6 ? ctx.color : ctx.definition.color);
