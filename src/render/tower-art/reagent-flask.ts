import type { Sheet, TiltedArt } from "./tilted";
import { LIGHT, halo } from "../material";
import { arcBand, disc, oval, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, towardViewer, tube, turn } from "./tilt";
import { SX, SY, frame, project } from "./tilt-frame";

// Catalyst: a glass flask on a cup cradle whose neck is the barrel; the reagent level inside is the charge.
const HS = 14,
  RS = 7.6,
  TILT = { drop: 5, squash: SQUASH, height: HS, pitch: 0.18, deck: 5.5 },
  reach = (l: number) => 15 + l,
  RECOIL = 2;
const GUN = 0x3a4549,
  GUN_TOP = 0x56646a,
  METAL = 0x8a9a9c,
  DEEP = 0x1f272b,
  COPPER = 0xb87333;
/** The bench: a square with clipped corners. */
const BENCH = [-18, -13, -13, -18, 13, -18, 18, -13, 18, 13, 13, 18, -13, 18, -18, 13];
const BENCH_H = 4.5;
/** Spare vials in the rack along the back edge (ground u, v). */
const VIALS = [
  [-13.5, -7],
  [-9, -12.5],
  [12.5, -10],
];
const glass = (c: number) => shade(c, -0.78);

/** The neck: glass tube from inside the flask to the muzzle, copper coil from level 3, the tip colour at its mouth. */
function neck({ g, x, y, tower, definition, level, kick, tip }: TurretContext) {
  const a = tower.angle,
    y0 = y + TILT.drop,
    c = definition.color,
    p = TILT.pitch,
    end = reach(level) - kick * RECOIL;
  tube(g, x, y0, a, HS, RS - 1.5, end - 2, 2.3, shade(c, -0.6), 1, true, p);
  tube(g, x, y0, a, HS, RS - 1, end - 2.5, 1, shade(c, -0.1), 0.9, false, p);
  if (level >= 3) for (let d = RS + 0.5; d < end - 3; d += 1.6) tube(g, x, y0, a, HS, d, d + 0.7, 2.6, COPPER, 1, false, p);
  tube(g, x, y0, a, HS, end - 2, end, 2.8, shade(GUN, 0.1), 1, true, p);
  if (tip !== undefined) tube(g, x, y0, a, HS, end - 0.8, end, 2.8, tip, 1, false, p);
  if (towardViewer(a, p) > 0.02) endFace(g, x, y0, a, HS, end, 1.5, OUTLINE, p);
}
/** Arc of the flask's outline from angle t0 to t1 (screen), as scratch points starting at index k. */
function arcPts(cx: number, cy: number, r: number, t0: number, t1: number, k: number, n: number) {
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    point(k + i, cx + Math.cos(t) * r, cy + Math.sin(t) * r);
  }
  return k + n + 1;
}
function reagent(g: Ink, cx: number, cy: number, r: number, fill: number, color: number, alpha: number) {
  // The surface sits at height (1 − 2 fill) r below the centre; the liquid is the circle below it.
  const s = Math.max(-0.999, Math.min(0.999, 1 - 2 * fill)),
    t = Math.asin(s),
    n = arcPts(cx, cy, r, t, Math.PI - t, 0, 14);
  fillPoints(g, n, color, alpha);
}

const sheet: Sheet = {
  tower: "catalyst",
  name: "Reagent Flask",
  idea: "A round glass flask on a cup cradle over a lab bench; its neck is the barrel, the reagent level rises with the charge, spare vials stand in a rack.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base: ({ g, x, y, level, definition, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color;
    onGround(g, x, y0, 0, () => {
      oval(g, 5, 7, 24, 21, 0x050b10, 0.2);
      oval(g, 1.5, 2.5, 19, 17, 0x050b10, 0.35);
    });
    const n = turn(BENCH, 0, FOOT);
    turn(BENCH, 0, INSET, 0.92);
    block(g, x, y0, FOOT, INSET, n, 0, BENCH_H, 1, GUN, GUN_TOP, METAL);
    const top = BENCH_H + 1;
    onGround(g, x, y0, top, () => {
      // A drip channel round the bench top; bolts from level 3; an inlay in the trim colour from level 4.
      g.lineStyle(0.8, DEEP, 0.8);
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        g.lineBetween(INSET[2 * i] * 0.82, INSET[2 * i + 1] * 0.82, INSET[2 * j] * 0.82, INSET[2 * j + 1] * 0.82);
      }
      if (level >= 3)
        for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1]]) {
          disc(g, sx * 13.5, sy * 13.5, 1, DEEP);
          disc(g, sx * 13.5 - 0.3, sy * 13.5 - 0.3, 0.45, METAL);
        }
      if (level >= 4) {
        g.lineStyle(0.9, shade(color, -0.2), 0.95);
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          g.lineBetween(INSET[2 * i] * 0.72, INSET[2 * i + 1] * 0.72, INSET[2 * j] * 0.72, INSET[2 * j + 1] * 0.72);
        }
      }
    });
    // Spare vials in the rack: glass with a settled reagent, a cap.
    for (const [u, v] of VIALS) {
      drum(g, x + u, y0 + v * SQUASH, 2.2, top, top + 6.5, glass(c), shade(c, -0.5), 8);
      const vx = X(x, u),
        vy = Y(y0, v, top);
      g.fillStyle(shade(c, -0.25), 0.9);
      g.fillRect(vx - 1.6, vy - 3.6, 3.2, 3.2);
      drum(g, x + u, y0 + v * SQUASH, 2.4, top + 6.5, top + 7.6, METAL, shade(METAL, 0.2), 8);
    }
    // The turntable and the cup cradle the flask sits in (round, so it does not turn).
    drum(g, x, y0, 8, top, top + 1.8, DEEP, shade(DEEP, 0.15), 12);
    drum(g, x, y0, 5.8, top + 1.8, HS - RS + 2.5, GUN, GUN_TOP, 12);
    // Level 5: armour cheeks round the cup.
    if (level >= 5) drum(g, x, y0, 6.6, top + 1.8, top + 3.2, shade(c, -0.55), shade(c, -0.3), 12);
  },
  turret: (ctx) => {
    const { g, x, y, tower, level, color } = ctx,
      a = tower.angle,
      y0 = y + TILT.drop,
      cx = x,
      cy = y0 - HS,
      c = ctx.definition.color;
    // The neck behind the flask when aiming away; towards the viewer it is drawn live, over the reagent.
    if (towardViewer(a, TILT.pitch) <= 0.02) neck(ctx);
    // The glass: a dark outline and the tinted, empty glass (the reagent and the shine are live).
    disc(g, cx, cy, RS + 0.9, OUTLINE);
    disc(g, cx, cy, RS, glass(c));
    // A filler port on the shoulder opposite the neck; from level 6 a ring in the path colour round it.
    const f = frame(a, TILT.pitch, HS);
    project(x, y0, f, -RS * 0.55, 0, RS * 0.8, 0);
    if (Math.sin(a) > -0.6) {
      oval(g, SX[0], SY[0], 2.2, 1.4, OUTLINE);
      oval(g, SX[0], SY[0], 1.6, 0.9, level >= 6 ? color : METAL);
    }
  },
  live: (ctx) => {
    const { g, glow, x, y, tower, definition, level, kick, charge, clock, color, energy } = ctx,
      a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      cx = x,
      cy = y0 - HS,
      fill = 0.2 + 0.75 * charge,
      r = RS - 1.1,
      surface = cy + (1 - 2 * fill) * r;
    // Reagent: the liquid, a lighter meniscus and bubbles rising through it.
    reagent(g, cx, cy, r, fill, shade(c, -0.15), 0.92);
    oval(g, cx, surface, Math.sqrt(Math.max(0, r * r - (surface - cy) ** 2)), 1.1, shade(c, 0.35), 0.9);
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 1.1 + i / 3 + tower.id * 0.27) % 1,
        by = cy + r - 1 - phase * (cy + r - surface);
      if (by > surface + 0.5) disc(g, cx - 2.5 + i * 2.5, by, 0.8, shade(c, 0.6), (1 - phase) * 0.9);
    }
    disc(glow, cx, cy + r * (1 - fill), r * 0.9, c, Math.min(0.32, 0.08 + 0.16 * charge + energy));
    // Shine on the glass, from the upper left.
    arcBand(g, cx, cy, RS - 1, 1.4, LIGHT - 0.7, LIGHT + 0.6, 0xffffff, 0.35);
    disc(g, cx - 2.8, cy - 3.2, 1.1, 0xffffff, 0.75);
    // Level 5: a metal strap round the flask's equator (its front half, over the glass) and one over the top.
    if (level >= 5)
      for (const [w, col] of [[2, OUTLINE], [1.1, METAL]] as const) {
        g.lineStyle(w, col, 1);
        g.beginPath();
        for (let i = 0; i <= 12; i++) {
          const t = (i / 12) * Math.PI,
            px = cx + Math.cos(t) * RS,
            py = cy + Math.sin(t) * RS * SQUASH;
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.strokePath();
      }
    // The neck in front of the flask when aiming towards the viewer.
    if (towardViewer(a, TILT.pitch) > 0.02) neck(ctx);
    // Glow of the vials in the rack as the next dart brews.
    for (const [u, v] of VIALS) disc(glow, X(x, u), Y(y0, v, BENCH_H + 4), 2.6, c, 0.08 + 0.16 * charge);
    // Level 2: a lamp on the cup; level 4: lights in the bench front chase round.
    if (level >= 2) {
      const lx = X(x, 0),
        ly = Y(y0, 5.8, BENCH_H + 3.5);
      disc(g, lx, ly, 1.2, OUTLINE);
      disc(g, lx, ly, 0.75, shade(color, 0.2));
      disc(glow, lx, ly, 2.4, color, 0.35);
    }
    if (level >= 4)
      [-13, -4.5, 4.5, 13].forEach((u, i) => {
        const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.1)),
          lx = X(x, u),
          ly = Y(y0, Math.abs(u) > 12 ? 16 : 18, BENCH_H / 2);
        g.fillStyle(shade(color, -0.6 + 0.7 * on));
        g.fillRect(lx - 0.9, ly - 0.5, 1.8, 1);
        if (on > 0.5) disc(glow, lx, ly, 2.2, color, 0.25 * on);
      });
    // A shock ring of reagent vapour right after a shot.
    if (kick > 0) {
      const f = frame(a, TILT.pitch, HS);
      project(x, y0, f, reach(level), 0, 0, 0);
      halo(glow, SX[0], SY[0], 4 * (1 + kick), c, 0.3 * kick);
      halo(glow, cx, cy, RS + 2 + (1 - kick) * 5, c, 0.2 * kick);
    }
  },
};
/** ReagentFlask in the four parts of a tilted tower (`tilted.ts`). */
export const reagentFlask: TiltedArt = { base: sheet.base, below: sheet.below ?? (() => {}), turret: sheet.turret, above: sheet.live };
