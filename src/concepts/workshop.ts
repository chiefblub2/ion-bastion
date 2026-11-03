import { halo } from "../render/material";
import { disc, hash01, oval, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, SQUASH, X, Y, onGround, quad } from "../render/tower-art/tilt";
import { lampInk, lampLight, part, rect } from "../render/tower-art/tilt-parts";
import { DEEP, METAL, STEEL, STEEL_TOP, contact, post, shape, slab } from "./kit-support-b";
import type { Concept } from "./types";

// Workshop: the Forge Bench. A chamfered workbench with a tool rack of wrenches on its front and a coal box at the
// back (base); the anvil and the hammer's pivot post (turret, still); the hammer that lifts slowly and strikes on its
// own rhythm, sparks flying from every blow, more with each level, and the coals' glow (above, live).
const DROP = 5,
  H = 6,
  ANVIL = H + 5.5,
  PIVOT_U = 12,
  PIVOT_H = H + 11,
  ARM = 12.5;
const BENCH = [-21, -13, -17, -17, 17, -17, 21, -13, 21, 15, 17, 19, -17, 19, -21, 15];
const FOOT = shape(BENCH),
  INSET = shape(BENCH, 0.93);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 21);
  slab(g, x, y0, FOOT, INSET, 0, H, shade(c, -0.62), shade(STEEL_TOP, 0.05), METAL, 1);
  // Tool rack: wrenches hanging on the bench's front, two more per level up to six.
  const tools = Math.min(6, 2 + level);
  for (let i = 0; i < tools; i++) {
    const u = -13 + i * 5.2,
      top = Y(y0, 19, H - 0.8),
      sx = X(x, u);
    g.lineStyle(1.6, OUTLINE, 0.9);
    g.lineBetween(sx, top, sx, top + 3.6);
    g.lineStyle(0.9, i % 2 ? METAL : shade(c, 0.1), 1);
    g.lineBetween(sx, top, sx, top + 3.4);
    disc(g, sx, top + 3.8, 1.1, i % 2 ? METAL : shade(c, 0.1));
  }
  // Coal box at the back left; its embers glow live.
  part(g, x, y0, 0, rect(-17, -9, -15, -9), H, H + 3, 0.6, DEEP, shade(DEEP, 0.2), METAL);
  onGround(g, x, y0, H + 3.6, () => oval(g, -13, -12, 3.2, 2.2, shade(c, -0.6)));
  // Level 4: the bench's top edge trimmed in the path colour.
  if (level >= 4) {
    g.lineStyle(1, color, 0.95);
    g.lineBetween(X(x, -17), Y(y0, 19, H + 0.4), X(x, 17), Y(y0, 19, H + 0.4));
  }
  if (level >= 2) lampInk(g, X(x, 19), Y(y0, 17, H + 0.8), color);
}

/** Anvil (horn to the west, lit face, dark waist) and the hammer's pivot post. */
function turret({ g, x, y, level, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  part(g, x, y0, 0, rect(-4.5, 3.5, -3, 3), H, H + 2.2, 0, DEEP, shade(DEEP, 0.2), METAL);
  part(g, x, y0, 0, rect(-3, 2, -2, 2), H + 2.2, H + 3.6, 0, shade(STEEL, -0.2), STEEL, METAL);
  part(g, x, y0, 0, rect(-7, 5, -3.4, 3.4), H + 3.6, ANVIL, 0.6, STEEL, shade(STEEL_TOP, 0.15), shade(METAL, 0.3));
  // The horn: a tapered wedge to the west.
  quad(g, X(x, -7), Y(y0, -2.6, ANVIL), X(x, -12.5), Y(y0, 0, ANVIL - 0.8), X(x, -12.5), Y(y0, 0, ANVIL - 1.6), X(x, -7), Y(y0, 2.6, ANVIL - 1), OUTLINE);
  quad(g, X(x, -7), Y(y0, -2.2, ANVIL - 0.2), X(x, -12), Y(y0, 0, ANVIL - 0.9), X(x, -12), Y(y0, 0, ANVIL - 1.4), X(x, -7), Y(y0, 2.2, ANVIL - 1), shade(STEEL_TOP, 0.1));
  // Level 3: a brass hardy plate on the anvil face.
  if (level >= 3) quad(g, X(x, 1), Y(y0, -1.4, ANVIL), X(x, 3), Y(y0, -1.4, ANVIL), X(x, 3), Y(y0, 1.4, ANVIL), X(x, 1), Y(y0, 1.4, ANVIL), shade(c, 0.1));
  post(g, x, y0, PIVOT_U, 4, 2.2, H, PIVOT_H, STEEL, STEEL_TOP);
}

function below() {}

/** Hammer angle in the (u, h) plane through the pivot: the head rests on the anvil at lift 0. */
function hammer(clock: number, id: number) {
  const phase = (clock / 1.4 + id * 0.37) % 1,
    lift = phase < 0.75 ? Math.sin((phase / 0.75) * Math.PI * 0.5) : 1 - (phase - 0.75) / 0.25,
    blow = phase < 0.18 ? 1 - phase / 0.18 : 0,
    rest = Math.atan2(ANVIL + 2.2 - PIVOT_H, -1 - PIVOT_U);
  return { angle: rest - lift * 1.15, blow };
}
function head(g: Ink, sx: number, sy: number, along: number, c: number) {
  const ca = Math.cos(along),
    sa = Math.sin(along),
    w = 2.6,
    l = 3.6,
    corner = (p: number, q: number) => [sx + ca * p - sa * q, sy + sa * p + ca * q] as const;
  quad(g, ...corner(-l - 0.6, -w - 0.6), ...corner(l + 0.6, -w - 0.6), ...corner(l + 0.6, w + 0.6), ...corner(-l - 0.6, w + 0.6), OUTLINE);
  quad(g, ...corner(-l, -w), ...corner(l, -w), ...corner(l, w), ...corner(-l, w), shade(c, -0.15));
  quad(g, ...corner(-l, -w), ...corner(l, -w), ...corner(l, -w * 0.3), ...corner(-l, -w * 0.3), shade(c, 0.3));
}

/** The hammer arm and head, sparks of each blow, the coals' glow and the lamp's light. */
function above({ g, glow, x, y, tower, level, clock, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    { angle, blow } = hammer(clock, tower.id),
    hu = PIVOT_U + Math.cos(angle) * ARM,
    hh = PIVOT_H + Math.sin(angle) * ARM,
    [px, py] = [X(x, PIVOT_U), Y(y0, 4, PIVOT_H)],
    [hx, hy] = [X(x, hu), Y(y0, 1, hh)];
  g.lineStyle(2.6, OUTLINE, 1);
  g.lineBetween(px, py, hx, hy);
  g.lineStyle(1.4, shade(c, -0.4), 1);
  g.lineBetween(px, py, hx, hy);
  head(g, hx, hy, Math.atan2(hy - py, hx - px) + Math.PI / 2, c);
  disc(g, px, py, 1.6, OUTLINE);
  disc(g, px - 0.3, py - 0.3, 0.9, METAL);
  // Coals breathing at the back.
  const coal = 0.5 + 0.5 * Math.sin(clock * 2.3 + tower.id);
  onGround(g, x, y0, H + 3.7, () => oval(g, -13, -12, 2.4, 1.6, shade(c, -0.1 + 0.3 * coal)));
  halo(glow, X(x, -13), Y(y0, -12, H + 4), 5, c, 0.12 + 0.12 * coal);
  if (blow > 0) {
    const [ax, ay] = [X(x, -1), Y(y0, 1, ANVIL + 1)];
    halo(glow, ax, ay, 9, c, 0.3 * blow);
    for (let i = 0; i < 3 + level * 2; i++) {
      const a = -Math.PI / 2 + (hash01(tower.id, i, Math.floor(clock / 1.4)) - 0.5) * 2.6,
        r = 4 + (1 - blow) * (8 + 6 * hash01(i, tower.id));
      disc(g, ax + Math.cos(a) * r, ay + Math.sin(a) * r, 0.9, shade(c, 0.7), blow);
    }
  }
  if (level >= 2) lampLight(glow, X(x, 19), Y(y0, 17, H + 0.8), color);
}

export const concept: Concept = {
  tower: "workshop",
  name: "Forge Bench",
  idea: "Chamfered workbench with a wrench rack and a coal box; an anvil and a pivot post; the hammer lifts slowly and strikes, sparks flying, more per level.",
  tilt: { drop: DROP, squash: SQUASH, height: PIVOT_H, deck: H + 0.6 },
  base,
  below,
  turret,
  above,
};
