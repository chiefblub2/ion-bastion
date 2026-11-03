import type { Sheet, TiltedArt } from "./tilted";
import { halo } from "../material";
import { disc, oval, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { OUTLINE, SQUASH, X, Y, block, drum, fillPoints, onGround, point, quad, FOOT, turn } from "./tilt";
import { GUN, SHADOW_INK, castShadow, depth, framer, lamp, paint, part, rect } from "./tilt-parts";

// Executioner: the Headsman, a glaive launcher on a stepped scaffold: a long arm with a counterweight carries the blade
// flat in a cradle at its tip; once charged a spinning glaive waits at the hilt.
const TILT = { drop: 5, squash: SQUASH, height: 11, deck: 6 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 5,
  reach = (l: number) => 22 + l;
/** Stepped scaffold: a wide diamond, a narrower one on it, and two posts on the side corners. */
const LOWER = [-22, 0, 0, -22, 22, 0, 0, 22],
  UPPER = [-15, 0, 0, -15, 15, 0, 0, 15];
const LOW_TOP = 3,
  DECK = 6,
  HUB_TOP = 8.5;
const POSTS = [rect(-21, -17.5, -1.6, 1.6), rect(17.5, 21, -1.6, 1.6)];
const COUNTER = rect(-13, -5.5, -4.2, 4.2),
  ARM = rect(-5.5, 14, -1.9, 1.9),
  PRONGS = [rect(11.5, 15, 2.2, 3.6), rect(11.5, 15, -3.6, -2.2)],
  PLATES = [rect(-12, -6.5, 4.2, 5.3), rect(-12, -6.5, -5.3, -4.2)];
const ARM_TOP = 9.8,
  COUNTER_TOP = 14;
/** Blade half widths along it: from the guard out to the point (fractions of its length). */
const BLADE = [
  [0, 2.4],
  [0.55, 3.3],
  [0.82, 2.6],
  [1, 0],
] as const;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, 27, 21, SHADOW_INK, 0.2);
    oval(g, 1.5, 2.5, 20, 17, SHADOW_INK, 0.36);
  });
  const diamond = (shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number) => {
    const n = turn(shape, 0, FOOT);
    block(g, x, y0, FOOT, FOOT, n, h0, h1, bevel, wall, top, GUN.metal);
  };
  diamond(LOWER, 0, LOW_TOP, 0, GUN.side, shade(GUN.top, -0.12));
  // Blood-red runners on the lower step's front edges.
  for (const s of [-1, 1]) {
    const ax = X(x, s * 20),
      ay = Y(y0, 2, LOW_TOP),
      bx = X(x, s * 2),
      by = Y(y0, 20, LOW_TOP);
    g.lineStyle(1, shade(c, -0.1), 0.95);
    g.lineBetween(ax, ay, bx, by);
  }
  for (const post of POSTS) part(g, x, y0, 0, post, LOW_TOP, 9, 0.6, GUN.side, GUN.top, GUN.metal);
  diamond(UPPER, LOW_TOP, DECK, 0, shade(GUN.side, 0.05), GUN.top);
  onGround(g, x, y0, DECK, () => {
    // Rivets on the upper step from level 3, a trim inlay from level 4.
    if (level >= 3)
      for (const [u, v] of [
        [-11, 0],
        [0, -11],
        [11, 0],
        [0, 11],
      ])
        disc(g, u, v, 1, GUN.deep);
    if (level >= 4) {
      g.lineStyle(0.8, shade(color, -0.2), 0.9);
      g.lineBetween(-12, 0, 0, -12);
      g.lineBetween(0, -12, 12, 0);
      g.lineBetween(12, 0, 0, 12);
      g.lineBetween(0, 12, -12, 0);
    }
  });
  drum(g, x, y0, 7, DECK, HUB_TOP - 0.5, GUN.deep, shade(GUN.deep, 0.18), 14);
}

/** The blade lying flat at height h along the aim from d0 to d1: a dark edge under it, then the top face. */
function blade(g: Ink, x: number, y0: number, a: number, d0: number, d1: number, h: number, color: number, tip?: number) {
  const P = framer(x, y0, a),
    len = d1 - d0,
    n = BLADE.length * 2 - 1;
  const outline = (dh: number, grow: number) => {
    let i = 0;
    for (const [f, w] of BLADE) {
      const [px, py] = P(d0 + f * len + (f === 1 ? grow : 0), -(w + (w ? grow : 0)), h + dh);
      point(i++, px, py);
    }
    for (let k = BLADE.length - 2; k >= 0; k--) {
      const [f, w] = BLADE[k],
        [px, py] = P(d0 + f * len, w + grow, h + dh);
      point(i++, px, py);
    }
  };
  outline(-1.2, 0.8);
  fillPoints(g, n, OUTLINE, 0.9);
  outline(-1.1, 0);
  fillPoints(g, n, shade(color, -0.55));
  outline(0, 0);
  fillPoints(g, n, shade(color, -0.05));
  // The fuller: a dark groove along the middle.
  const f0 = P(d0 + 1.5, 0, h),
    f1 = P(d0 + 0.75 * len, 0, h);
  g.lineStyle(1, shade(color, -0.6), 1);
  g.lineBetween(f0[0], f0[1], f1[0], f1[1]);
  // The edge on the lit side and the hot point.
  const side = Math.cos(a) > 0 ? -1 : 1,
    e0 = P(d0 + 0.55 * len, side * 3.1, h),
    e1 = P(d0 + 0.97 * len, side * 0.2, h);
  g.lineStyle(0.8, shade(color, 0.55), 0.95);
  g.lineBetween(e0[0], e0[1], e1[0], e1[1]);
  if (tip !== undefined) {
    const t0 = P(d0 + 0.86 * len, -2.1, h),
      t1 = P(d1, 0, h),
      t2 = P(d0 + 0.86 * len, 2.1, h);
    g.fillStyle(tip);
    g.fillTriangle(t0[0], t0[1], t1[0], t1[1], t2[0], t2[1]);
  }
}

function turret(ctx: TurretContext) {
  const { g, x, y, tower, definition, level, kick, tip, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    back = -kick * RECOIL,
    end = reach(level) + back;
  castShadow(g, x, y0, a, rect(-13, end, -4.5, 4.5), DECK, 0.24);
  const parts: [number, () => void][] = [
    [
      depth(a, -9, 0),
      () => {
        if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, HUB_TOP + 0.5, COUNTER_TOP - 1.5, 0, shade(c, -0.45), shade(c, -0.15), shade(c, 0.3));
        part(g, x, y0, a, COUNTER, HUB_TOP, COUNTER_TOP, 1.2, GUN.side, GUN.top, GUN.metal);
        const ht = COUNTER_TOP + 1.2;
        // A crimson band across the counterweight's roof.
        const band = [P(-10.6, -3.3, ht), P(-9.4, -3.3, ht), P(-9.4, 3.3, ht), P(-10.6, 3.3, ht)];
        quad(g, ...band[0], ...band[1], ...band[2], ...band[3], shade(c, -0.15));
        if (level >= 3)
          for (const q of [-2.6, 2.6]) {
            const [bx, by] = P(-11.5, q, ht);
            disc(g, bx, by, 0.8, OUTLINE);
            disc(g, bx - 0.3, by - 0.3, 0.35, GUN.metal);
          }
        if (level >= 6) {
          const s = [P(-8.2, -3.2, ht), P(-7.2, -3.2, ht), P(-7.2, 3.2, ht), P(-8.2, 3.2, ht)];
          quad(g, ...s[0], ...s[1], ...s[2], ...s[3], color);
        }
      },
    ],
    [
      depth(a, 6, 0),
      () => {
        part(g, x, y0, a, ARM, HUB_TOP, ARM_TOP, 0, GUN.side, GUN.top, GUN.metal);
        // The blade on the arm, its guard and the cradle's prongs holding it at the tip.
        const order = Math.cos(a) > 0 ? [1, 0] : [0, 1];
        part(g, x, y0, a, PRONGS[order[0]], ARM_TOP - 1, HB + 2, 0, GUN.side, GUN.top, GUN.metal);
        blade(g, x, y0, a, 7 + back, end, HB, c, tip);
        part(g, x, y0, a, rect(5 + back, 7 + back, -5, 5), ARM_TOP, HB + 1.6, 0.5, shade(c, -0.6), shade(c, -0.3), shade(c, 0.3));
        part(g, x, y0, a, PRONGS[order[1]], ARM_TOP - 1, HB + 2, 0, GUN.side, GUN.top, GUN.metal);
      },
    ],
  ];
  paint(parts);
  // The hub cap over the pivot.
  const [hx, hy] = P(0, 0, HUB_TOP);
  oval(g, hx, hy, 4.6, 4.6 * SQUASH, GUN.deep);
  oval(g, hx - 0.3, hy - 0.3, 3.2, 3.2 * SQUASH, shade(c, -0.4));
}

function live(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, kick, charge, energy, clock, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  // The edge glows with the charge, brighter from level 5.
  const e0 = P(10, 0, HB),
    e1 = P(end - 1, 0, HB);
  glow.lineStyle(3, shade(c, 0.4), Math.min(0.5, 0.12 + 0.25 * charge + energy));
  glow.lineBetween(e0[0], e0[1], e1[0], e1[1]);
  if (level >= 2) {
    const [lx, ly] = P(-12, Math.cos(a) > 0 ? 3.2 : -3.2, COUNTER_TOP + 1.3);
    lamp(g, glow, lx, ly, color);
  }
  // From level 4 two lamps on the posts blink in turn.
  if (level >= 4)
    [-19.25, 19.25].forEach((u, i) => {
      const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * Math.PI)),
        px = X(x, u),
        py = Y(y0, 0, 9.4);
      lamp(g, glow, px, py, color, on);
    });
  // Charged: a glaive of three curved blades spins over the hub, ready to be thrown.
  if (charge >= 0.95) {
    const [hx, hy] = P(0, 0, HUB_TOP + 4),
      spin = clock * 1.5 + tower.id;
    disc(glow, hx, hy, 6, c, 0.25);
    onGround(g, hx, hy, 0, () => {
      g.fillStyle(shade(c, 0.25));
      for (let k = 0; k < 3; k++) {
        const b = spin + (k * Math.PI * 2) / 3,
          p = (t: number, r: number) => [Math.cos(b + t) * r, Math.sin(b + t) * r] as const,
          [x0, y0_] = p(0, 1.2),
          [x1, y1] = p(0.35, 4.6),
          [x2, y2] = p(1.05, 6.8),
          [x3, y3] = p(0.7, 3.6);
        g.fillTriangle(x0, y0_, x1, y1, x3, y3);
        g.fillTriangle(x1, y1, x2, y2, x3, y3);
      }
      disc(g, 0, 0, 1.6, shade(c, -0.4));
    });
  }
  if (kick > 0) {
    const [mx, my] = P(end, 0, HB);
    halo(glow, mx, my, 4 * (1 + kick), c, 0.3 * kick);
  }
}

const sheet: Sheet = {
  tower: "executioner",
  name: "Headsman",
  idea: "Glaive launcher on a stepped diamond scaffold: a counterweighted arm carries the long blade flat in a cradle; a glaive spins at the hilt once charged.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  turret,
  live,
};
/** Headsman in the four parts of a tilted tower (`tilted.ts`). */
export const headsman: TiltedArt = { base: sheet.base, below: sheet.below ?? (() => {}), turret: sheet.turret, above: sheet.live };
