/**
 * Uplink Array: Orbital's look in the 3/4 tilt (see `tilt.ts`): an uplink dish looking up at the sky, leaning a little
 * towards the target, on a fork over a mast, with a level designator laser under it as the muzzle; a calm octagonal pad
 * with two short antenna posts at the back. The pad and mast (`base`) bake per level and trim colour; fork, dish and
 * designator (`turret`) depend only on the aim and recoil and are cached per angle (`TowerPictures`); the deck's
 * countdown gauge and the post and turntable lamps (`below`) and the dish beacon's blink and the designator's glow
 * (`above`) are live. The projection lives in `TILTS.uplink`, the laser in `MUZZLES.uplink`.
 */
import { MUZZLES, TILTS } from "../muzzles";
import type { TiltedArt } from "./tilted";
import { halo } from "../material";
import { arcBand, disc, oval, shade } from "../shapes";
import { FOOT, INSET, OUTLINE, X, Y, block, drum, endFace, onGround, tube, turn } from "./tilt";
import { SX, SY, box, frame, lit, plane, project, rod } from "./tilt-frame";

// Orbital: an uplink dish looking up at the sky, leaning a little towards the target, on a fork over a mast; under it a
// level designator laser is the muzzle. A calm octagonal pad with two short antenna posts at the back.
const TILT = TILTS.uplink,
  HB = TILT.height,
  reach = MUZZLES.uplink.reach,
  RECOIL = MUZZLES.uplink.recoil;
/** The dish leans this far from upright towards the aim; its centre sits at `DISH_H`. */
const LEAN = 0.32,
  DISH_H = 17.5;
const GUN = 0x3a4549,
  GUN_TOP = 0x56646a,
  METAL = 0x9aa6ad,
  DEEP = 0x1f272b;
const PAD = [-17, -10, -10, -17, 10, -17, 17, -10, 17, 10, 10, 17, -10, 17, -17, 10];
const PAD_H = 3.5,
  DECK = PAD_H + 1;
/** Two short antenna posts on the back corners (behind the dish, so they never cover it). */
const PYLONS = [
  [-1, -1],
  [1, -1],
];
const POST = 12;
const PYLON = (sx: number, sy: number) => {
  const u = sx * POST,
    v = sy * POST;
  return [u - 1.8, v - 1.8, u + 1.8, v - 1.8, u + 1.8, v + 1.8, u - 1.8, v + 1.8];
};
const PYLON_H = 8;
/** Dish: radius, its rim at `DISH_P` along the axis (behind the pivot); the fork arms either side. */
const DISH_R = 11,
  ARM = 10.8;

/** The dish's frame: its axis leans `LEAN` from upright towards the aim. */
const dishFrame = (a: number) => frame(a, Math.PI / 2 - LEAN, DISH_H);

export const uplinkArray: TiltedArt = {
  base: ({ g, x, y, level, definition, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color;
    onGround(g, x, y0, 0, () => {
      oval(g, 5, 7, 25, 22, 0x050b10, 0.2);
      oval(g, 1.5, 2.5, 20, 18, 0x050b10, 0.35);
    });
    const n = turn(PAD, 0, FOOT);
    turn(PAD, 0, INSET, 0.93);
    block(g, x, y0, FOOT, INSET, n, 0, PAD_H, 1, GUN, GUN_TOP, METAL);
    onGround(g, x, y0, DECK, () => {
      // An inlay in the trim colour from level 4 (from level 3 a darker seam in its place).
      if (level >= 3) arcBand(g, 0, 0, 14, 0.9, 0, Math.PI * 2, level >= 4 ? shade(color, -0.4) : shade(c, -0.65), 0.9);
      // Groove of the countdown gauge (the gauge itself is live).
      arcBand(g, 0, 0, 9.3, 1.6, 0, Math.PI * 2, DEEP, 0.9);
    });
    // Antenna posts at the back; armoured in the tower colour from level 5.
    for (const [sx, sy] of PYLONS) {
      const m = turn(PYLON(sx, sy), 0, FOOT);
      block(g, x, y0, FOOT, FOOT, m, DECK - 0.5, PYLON_H, 0.6, level >= 5 ? shade(c, -0.55) : GUN, level >= 5 ? shade(c, -0.3) : GUN_TOP, METAL);
      const lx = X(x, sx * POST),
        ly = Y(y0, sy * POST, PYLON_H + 0.6);
      disc(g, lx, ly, 1.3, OUTLINE);
      disc(g, lx, ly, 0.8, shade(c, -0.6));
    }
    // The mast and the turntable on top of it.
    drum(g, x, y0, 4.2, DECK, HB - 3.5, GUN, GUN_TOP, 10);
    drum(g, x, y0, 5.5, HB - 3.5, HB - 2.2, DEEP, shade(DEEP, 0.2), 12);
  },
  // Live, under the turret: the deck's countdown gauge, the post lamps blinking in turn and the turntable lamp.
  below: ({ g, glow, x, y, tower, definition, level, charge, clock, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color;
    onGround(g, x, y0, DECK, () => {
      if (charge > 0.01) arcBand(g, 0, 0, 9.3, 1.1, Math.PI * (1 - charge), Math.PI, shade(c, -0.05), 0.95);
    });
    if (charge >= 1) onGround(glow, x, y0, DECK, () => arcBand(glow, 0, 0, 9.3, 2.6, 0, Math.PI, c, 0.12 + 0.08 * Math.sin(clock * 6 + tower.id)));
    const on = Math.floor(clock * 2 + tower.id) % 2;
    PYLONS.forEach(([sx, sy], i) => {
      const lx = X(x, sx * POST),
        ly = Y(y0, sy * POST, PYLON_H + 0.6);
      if (i !== on && level < 4) return;
      const k = i === on ? 1 : 0.35 + 0.35 * Math.max(0, Math.sin(4 * clock - i * 1.4));
      disc(g, lx, ly, 0.8, shade(c, -0.5 + 0.8 * k));
      disc(glow, lx, ly, 3.2, c, 0.3 * k);
    });
    if (level >= 2) {
      const lx = X(x, 0),
        ly = Y(y0, 5.5, HB - 2.9);
      disc(g, lx, ly, 1.1, OUTLINE);
      disc(g, lx, ly, 0.7, shade(color, 0.2));
      disc(glow, lx, ly, 2.3, color, 0.35);
    }
  },
  turret: ({ g, x, y, tower, definition, level, kick, tip, color }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      back = -kick * RECOIL,
      end = reach(level) + back,
      fd = dishFrame(a);
    const arm = (s: number) => {
        // Fork arm from the turntable up to the dish's trunnion.
        const n = turn(s > 0 ? [-1.6, ARM - 0.8, 1.6, ARM - 0.8, 1.6, ARM + 0.8, -1.6, ARM + 0.8] : [-1.6, -ARM - 0.8, 1.6, -ARM - 0.8, 1.6, -ARM + 0.8, -1.6, -ARM + 0.8], a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, HB - 2.2, DISH_H, 0.4, GUN, GUN_TOP, METAL);
        if (ca * s > -0.2) {
          const hx = X(x, -sa * s * (ARM + 0.9)),
            hy = Y(y0, ca * s * (ARM + 0.9), DISH_H - 0.5);
          disc(g, hx, hy, 1.7, OUTLINE);
          disc(g, hx, hy, 1.2, METAL);
        }
      },
      yoke = () => {
        const n = turn([-2, -ARM, 2, -ARM, 2, ARM, -2, ARM], a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, HB - 2.2, HB - 0.8, 0, GUN, GUN_TOP, METAL);
      },
      dish = () => {
        // Back shell and rim, then the bowl: bright rim, darker towards the deep middle, a hub in the tower colour.
        const k = 0.15 * lit(fd.du, fd.dv, fd.dh);
        plane(g, x, y0, fd, -1.2, DISH_R + 0.8, OUTLINE, 0.95, DISH_R + 0.8, 18);
        plane(g, x, y0, fd, -0.2, DISH_R, shade(METAL, 0.12 + k), 1, DISH_R, 18);
        plane(g, x, y0, fd, -0.8, DISH_R * 0.62, shade(METAL, -0.28 + k), 1, DISH_R * 0.62, 14);
        plane(g, x, y0, fd, -1.2, DISH_R * 0.26, shade(c, -0.35), 1, DISH_R * 0.26, 10);
        // Level 5 an armoured rim in the tower colour; from level 6 a ring in the path colour.
        const ring = (r: number, w: number, col: number) => {
          g.lineStyle(w, col, 1);
          g.beginPath();
          for (let i = 0; i <= 24; i++) {
            const t = (i / 24) * Math.PI * 2;
            project(x, y0, fd, -0.1, Math.cos(t) * r, Math.sin(t) * r, 0);
            if (i) g.lineTo(SX[0], SY[0]);
            else g.moveTo(SX[0], SY[0]);
          }
          g.strokePath();
        };
        if (level >= 5) ring(DISH_R - 0.2, 1.4, shade(c, -0.45));
        if (level >= 6) ring(DISH_R - 2.6, 0.9, color);
        // Feed horn on one central boom above the bowl.
        rod(g, x, y0, fd.pu, fd.pv, fd.ph, fd.pu + 6.5 * fd.du, fd.pv + 6.5 * fd.dv, fd.ph + 6.5 * fd.dh, 0.8, shade(METAL, -0.15));
        box(g, x, y0, fd, 6, 8.2, -1.5, 1.5, -1.5, 1.5, shade(METAL, -0.1), shade(c, -0.2));
        // The beacon on the top rim (its blink is light, `above`).
        project(x, y0, fd, -0.3, -DISH_R - 0.2, 0, 0);
        disc(g, SX[0], SY[0], 1.3, OUTLINE);
        disc(g, SX[0], SY[0], 0.85, shade(c, -0.1));
      },
      designator = () => {
        // A housing under the dish and the level laser barrel; the lens is the muzzle.
        const f = frame(a, 0, HB);
        box(g, x, y0, f, -3.5 + back, 4 + back, -2.6, 2.6, -1.8, 1.8, GUN, GUN_TOP);
        tube(g, x, y0, a, HB, 4 + back, end - 1.6, 1.4, shade(METAL, -0.1));
        tube(g, x, y0, a, HB, end - 1.6, end, 1.9, GUN);
        if (tip !== undefined) tube(g, x, y0, a, HB, end - 0.7, end, 1.9, tip, 1, false);
        if (sa > 0.1) endFace(g, x, y0, a, HB, end, 1.1, shade(c, -0.3));
      };
    const near = ca > 0 ? 1 : -1;
    arm(-near);
    yoke();
    if (sa > 0) {
      dish();
      designator();
    } else {
      designator();
      dish();
    }
    arm(near);
  },
  // Live, over the turret: the dish beacon blinking faster as the strike nears, the designator's glow and flare.
  above: ({ glow, x, y, tower, definition, level, kick, charge, clock, energy }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      end = reach(level) - kick * RECOIL,
      blink = Math.sin(clock * (3 + 9 * charge) + tower.id) > 0.3 ? 1 : 0.15;
    project(x, y0, dishFrame(a), -0.3, -DISH_R - 0.2, 0, 0);
    disc(glow, SX[0], SY[0], 3, c, 0.35 * blink);
    disc(glow, SX[0], SY[0], 1, 0xffffff, 0.3 * blink);
    project(x, y0, frame(a, 0, HB), end, 0, 0, 1);
    disc(glow, SX[1], SY[1], 2.4, c, Math.min(0.5, 0.12 + 0.3 * charge + energy));
    if (kick > 0) halo(glow, SX[1], SY[1], 8 * (0.5 + kick), c, 0.3 * kick);
  },
};
