/**
 * Reagent Flask: Catalyst's look in the 3/4 tilt (see `tilt.ts`): a round glass flask on a cup cradle over a lab bench,
 * its neck the barrel. The flask never turns, so its glass is part of the baked bench (`base`); the reagent rising with
 * the charge, its bubbles, the shine and the bench's chasing lights are live under the turret (`below`); the neck and
 * the filler port (`turret`) depend only on the aim and recoil and are cached per angle (`TurretCache`), so a neck
 * aimed at the viewer lies over the reagent, and one aimed away starts where it leaves the flask's outline. The vapour
 * after a shot is `above`. The projection lives in `TILTS.flask`, the neck in `MUZZLES.flask`.
 */
import { MUZZLES, TILTS } from "../muzzles";
import type { TiltedArt } from "./tilted";
import { LIGHT, halo } from "../material";
import { arcBand, disc, oval, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, towardViewer, tube, turn } from "./tilt";
import { SX, SY, frame, project } from "./tilt-frame";

// Catalyst: a glass flask on a cup cradle whose neck is the barrel; the reagent level inside is the charge.
const TILT = TILTS.flask,
  /** Height of the flask's centre (the neck's pivot) and its radius. */
  HS = TILT.height,
  RS = 7.6,
  PITCH = TILT.pitch ?? 0,
  reach = MUZZLES.flask.reach,
  RECOIL = MUZZLES.flask.recoil;
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

/**
 * The neck: glass tube from the flask to the muzzle, copper coil from level 3, the tip colour at its mouth. Aimed away
 * from the viewer it starts where it leaves the flask's outline on the screen, so the flask hides the rest.
 */
function neck({ g, x, y, tower, definition, level, kick, tip }: TurretContext) {
  const a = tower.angle,
    y0 = y + TILT.drop,
    c = definition.color,
    p = PITCH,
    end = reach(level) - kick * RECOIL,
    // Screen length of one unit along the neck, and the distance at which it clears the flask's outline.
    ux = Math.cos(a) * Math.cos(p),
    uy = Math.sin(a) * Math.cos(p) * SQUASH - Math.sin(p),
    from = towardViewer(a, p) > 0.02 ? RS - 1.5 : Math.max(RS - 1.5, (RS + 0.9) / Math.max(0.05, Math.sqrt(ux * ux + uy * uy)));
  if (from >= end - 2) return;
  tube(g, x, y0, a, HS, from, end - 2, 2.3, shade(c, -0.6), 1, true, p);
  tube(g, x, y0, a, HS, from + 0.5, end - 2.5, 1, shade(c, -0.1), 0.9, false, p);
  if (level >= 3) for (let d = Math.max(RS + 0.5, from + 0.5); d < end - 3; d += 1.6) tube(g, x, y0, a, HS, d, d + 0.7, 2.6, COPPER, 1, false, p);
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

/** The lamp on the cup's front (from level 2): its socket bakes with the bench, its light is live. */
const lampAt = (x: number, y0: number) => [X(x, 0), Y(y0, 5.8, BENCH_H + 3.5)] as const;

export const reagentFlask: TiltedArt = {
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
    // Level 2: the lamp's socket and glass on the cup.
    if (level >= 2) {
      const [lx, ly] = lampAt(x, y0);
      disc(g, lx, ly, 1.2, OUTLINE);
      disc(g, lx, ly, 0.75, shade(color, 0.2));
    }
    // The flask's glass: a dark outline and the tinted, empty glass (the reagent and the shine are live).
    disc(g, x, y0 - HS, RS + 0.9, OUTLINE);
    disc(g, x, y0 - HS, RS, glass(c));
  },
  // Live, under the turret: the reagent with its meniscus and bubbles, the glass's shine, the strap from level 5, the
  // vials' and lamp's light and the bench's chasing lights.
  below: (ctx) => {
    const { g, glow, x, y, tower, definition, level, charge, clock, color, energy } = ctx,
      y0 = y + TILT.drop,
      c = definition.color,
      cx = x,
      cy = y0 - HS,
      fill = 0.2 + 0.75 * charge,
      r = RS - 1.1,
      surface = cy + (1 - 2 * fill) * r;
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
    // Level 5: a metal strap round the flask's equator (its front half, over the glass and the reagent).
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
    // Glow of the vials in the rack as the next dart brews, and the lamp's light.
    for (const [u, v] of VIALS) disc(glow, X(x, u), Y(y0, v, BENCH_H + 4), 2.6, c, 0.08 + 0.16 * charge);
    if (level >= 2) disc(glow, ...lampAt(x, y0), 2.4, color, 0.35);
    if (level >= 4)
      [-13, -4.5, 4.5, 13].forEach((u, i) => {
        const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.1)),
          lx = X(x, u),
          ly = Y(y0, Math.abs(u) > 12 ? 16 : 18, BENCH_H / 2);
        g.fillStyle(shade(color, -0.6 + 0.7 * on));
        g.fillRect(lx - 0.9, ly - 0.5, 1.8, 1);
        if (on > 0.5) disc(glow, lx, ly, 2.2, color, 0.25 * on);
      });
  },
  // The neck and, on the shoulder opposite it, the filler port (a ring in the path colour from level 6).
  turret: (ctx) => {
    const { g, x, y, tower, level, color } = ctx,
      a = tower.angle,
      y0 = y + TILT.drop,
      f = frame(a, PITCH, HS),
      away = towardViewer(a, PITCH) <= 0.02;
    if (away) neck(ctx);
    project(x, y0, f, -RS * 0.55, 0, RS * 0.8, 0);
    if (Math.sin(a) > -0.6) {
      oval(g, SX[0], SY[0], 2.2, 1.4, OUTLINE);
      oval(g, SX[0], SY[0], 1.6, 0.9, level >= 6 ? color : METAL);
    }
    if (!away) neck(ctx);
  },
  // Live, over the turret: a shock ring of reagent vapour right after a shot.
  above: ({ glow, x, y, tower, definition, level, kick }) => {
    if (kick <= 0) return;
    const y0 = y + TILT.drop,
      c = definition.color;
    project(x, y0, frame(tower.angle, PITCH, HS), reach(level), 0, 0, 0);
    halo(glow, SX[0], SY[0], 4 * (1 + kick), c, 0.3 * kick);
    halo(glow, x, y0 - HS, RS + 2 + (1 - kick) * 5, c, 0.2 * kick);
  },
};
