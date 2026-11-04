/**
 * Shared pieces of the "Traps A" tilt concepts (Mine, Caltrops, Tar Pit, Bear Trap, Flame Grate, Spring, Sticky Mine,
 * Pitfall). Traps lie on the path where enemies walk over them, so everything stays low: a frame plate a couple of px
 * thick set into the path bed, its front walls visible in the 3/4 view, and a level language on the frame:
 * L2 the armed lamp, L3 four corner bolts, L4 chasing lights along the front wall (live), L5 a rim inlay in the trap's
 * colour, path tiers the inlay and trim in the path colour (`ctx.color`).
 */
import type { TurretContext } from "../kit";
import { OUTLINE, SQUASH, X, Y, onGround, quad } from "../tilt";
import { lampInk, lampLight, part } from "../tilt-parts";
import { disc, oval, shade, type Ink } from "../../shapes";

/** Traps sit a little lower than towers: their ground centre `DROP` px below the cell centre. */
export const DROP = 2;
/** Steel of the trap frames: deep shadow, wall, top, metallic highlight. */
export const STEEL = { deep: 0x1a2228, wall: 0x38444b, top: 0x56656c, metal: 0x93a3a8 } as const;
/** Chamfered square footprint of half size `s` with corners cut by `c` (clockwise on the screen). */
export const chamfered = (s: number, c: number) => [-s + c, -s, s - c, -s, s, -s + c, s, s - c, s - c, s, -s + c, s, -s, s - c, -s, -s + c];
/** Octagon of radius r with flat faces at the cardinal directions. */
export const octagon = (r: number) => Array.from({ length: 16 }, (_, i) => (i % 2 ? Math.sin : Math.cos)(((Math.floor(i / 2) + 0.5) * Math.PI) / 4) * r);

/** Contact shadow of a low trap: a tight dark rim around its footprint. */
export function contact(g: Ink, x: number, y0: number, rx: number, ry: number) {
  onGround(g, x, y0, 0, () => {
    oval(g, 1.5, 2, rx + 2.5, ry + 2.5, 0x050b10, 0.28);
  });
}
/**
 * The frame plate of a trap: a chamfered square (half size `s`, height `h`) with its walls, bevel and lit top, plus the
 * level language that is still (corner bolts from L3, the rim inlay from L5). Returns the screen point helper of its top.
 */
export function frame(ctx: TurretContext, s: number, h: number, cut = 0.3) {
  const { g, x, y, level, definition: d, color } = ctx,
    y0 = y + DROP;
  contact(g, x, y0, s, s);
  part(g, x, y0, 0, chamfered(s, s * cut), 0, h, 1, STEEL.wall, STEEL.top, STEEL.metal, (s - 1.6) / s);
  const top = h + 1;
  onGround(g, x, y0, top, () => {
    // L5: an inlay in the trap's colour round the rim; on a path, in the path colour.
    if (level >= 5) {
      const r = s - 3,
        k = r * cut;
      g.lineStyle(0.9, level >= 6 ? color : shade(d.color, -0.15), 0.9);
      g.strokePoints([{ x: -r + k, y: -r }, { x: r - k, y: -r }, { x: r, y: -r + k }, { x: r, y: r - k }, { x: r - k, y: r }, { x: -r + k, y: r }, { x: -r, y: r - k }, { x: -r, y: -r + k }], true, true);
    }
    // Corner bolts: the two front ones from L1, all four from L3.
    const b = s - 2.6;
    for (const [bx, by] of level >= 3 ? [[-b, -b], [b, -b], [-b, b], [b, b]] : [[-b, b], [b, b]]) {
      disc(g, bx, by, 1.2, STEEL.deep);
      disc(g, bx - 0.35, by - 0.35, 0.55, STEEL.metal);
    }
  });
  return top;
}
/** Screen point of the armed lamp on a frame of half size `s` and top height `top` (its right front corner). */
export const lampSpot = (x: number, y0: number, s: number, top: number) => [X(x, s - 3.2), Y(y0, -(s - 3.2), top)] as const;
/** L2: the armed lamp's socket (ink, still); its light is live (`armedLight`). */
export function lampSocket(ctx: TurretContext, s: number, top: number) {
  if (ctx.level < 2) return;
  const [lx, ly] = lampSpot(ctx.x, ctx.y + DROP, s, top);
  lampInk(ctx.g, lx, ly, ctx.definition.color, 0);
}
/** Live: the armed lamp lights up once the trap has re-armed. */
export function armedLight(ctx: TurretContext, s: number, top: number) {
  if (ctx.level < 2) return;
  const armed = ctx.tower.cooldown === 0,
    [lx, ly] = lampSpot(ctx.x, ctx.y + DROP, s, top);
  if (!armed) return;
  disc(ctx.g, lx, ly, 0.85, shade(ctx.definition.color, 0.3));
  lampLight(ctx.glow, lx, ly, ctx.definition.color, 0.8);
}
/** L4, live: three lights chase along the frame's front wall. */
export function chasers(ctx: TurretContext, s: number, h: number) {
  if (ctx.level < 4) return;
  const { g, glow, x, y, clock, color } = ctx,
    y0 = y + DROP;
  for (let i = 0; i < 3; i++) {
    const u = (i - 1) * s * 0.45,
      on = 0.25 + 0.75 * Math.max(0, Math.sin(4 * clock - i * 1.4)),
      lx = X(x, u),
      ly = Y(y0, s, h * 0.5);
    quad(g, lx - 1.6, ly - 0.6, lx + 1.6, ly - 0.6, lx + 1.6, ly + 0.6, lx - 1.6, ly + 0.6, shade(color, -0.6 + 0.7 * on));
    if (on > 0.5) quad(glow, lx - 2.6, ly - 1.4, lx + 2.6, ly - 1.4, lx + 2.6, ly + 1.4, lx - 2.6, ly + 1.4, color, 0.22 * on);
  }
}
/** A dark recess on a plane at height h: the lit far lip, the shaded near lip, the floor (local flat coordinates). */
export function well(g: Ink, x: number, y0: number, h: number, rx: number, ry: number, floor: number) {
  onGround(g, x, y0, h, () => {
    oval(g, 0, 0, rx + 0.8, ry + 0.8, OUTLINE, 0.9);
    oval(g, 0, 0, rx, ry, floor);
    oval(g, 0, -ry * 0.12, rx * 0.97, ry * 0.86, shade(floor, -0.35));
  });
}
/** Squash helper for flat drawings placed with plain screen math. */
export const sq = (v: number) => v * SQUASH;
