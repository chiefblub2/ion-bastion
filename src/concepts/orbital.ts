import { halo } from "../render/material";
import { arcBand, disc, oval, shade } from "../render/shapes";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, onGround, turn } from "../render/tower-art/tilt";
import { SX, SY, box, frame, lit, plane, project, rod, seen } from "./skyburst";
import type { Concept } from "./types";

// Orbital: an uplink dish raised steeply at the sky on a fork over a mast, a feed horn at its focus, on a square pad
// with four corner pylons whose lamps blink in turn.
const HB = 15,
  TILT = { drop: 6, squash: SQUASH, height: HB, pitch: 0.85, deck: 4.5 },
  reach = (l: number) => 9 + l,
  RECOIL = 1;
const GUN = 0x3a4549,
  GUN_TOP = 0x56646a,
  METAL = 0x9aa6ad,
  DEEP = 0x1f272b;
const PAD = [-18, -15, -15, -18, 15, -18, 18, -15, 18, 15, 15, 18, -15, 18, -18, 15];
const PAD_H = 3.5,
  DECK = PAD_H + 1;
const PYLONS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const PYLON = (sx: number, sy: number) => {
  const u = sx * 14.5,
    v = sy * 14.5;
  return [u - 2, v - 2, u + 2, v - 2, u + 2, v + 2, u - 2, v + 2];
};
const PYLON_H = 9;
/** Dish: radius, its rim at `DISH_P` along the axis (behind the pivot); the fork arms either side. */
const DISH_R = 9.5,
  DISH_P = -2.5,
  ARM = 10.6;

export const concept: Concept = {
  tower: "orbital",
  name: "Uplink Array",
  idea: "A dish raised steeply at the sky on a fork over a mast, feed horn at its focus; a square pad with four pylons blinking in turn and a countdown gauge on the deck.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
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
      // Targeting scale round the deck, finer from level 3; an inlay in the trim colour from level 4.
      const ticks = level >= 3 ? 24 : 12;
      g.lineStyle(0.8, shade(c, -0.45), 0.9);
      for (let i = 0; i < ticks; i++) {
        const t = (i / ticks) * Math.PI * 2,
          r1 = i % (ticks / 4) ? 12.6 : 14;
        g.lineBetween(Math.cos(t) * 11.2, Math.sin(t) * 11.2, Math.cos(t) * r1, Math.sin(t) * r1);
      }
      if (level >= 4) arcBand(g, 0, 0, 15.3, 0.9, 0, Math.PI * 2, shade(color, -0.2), 0.95);
      // Groove of the countdown gauge (the gauge itself is live).
      arcBand(g, 0, 0, 9.3, 1.6, 0, Math.PI * 2, DEEP, 0.9);
    });
    // Corner pylons: the two at the back first; armoured from level 5.
    for (const [sx, sy] of PYLONS) {
      const m = turn(PYLON(sx, sy), 0, FOOT);
      block(g, x, y0, FOOT, FOOT, m, DECK - 0.5, PYLON_H, 0.6, level >= 5 ? shade(c, -0.55) : GUN, level >= 5 ? shade(c, -0.3) : GUN_TOP, METAL);
      const lx = X(x, sx * 14.5),
        ly = Y(y0, sy * 14.5, PYLON_H + 0.6);
      disc(g, lx, ly, 1.3, OUTLINE);
      disc(g, lx, ly, 0.8, shade(c, -0.6));
    }
    // The mast and the turntable on top of it.
    drum(g, x, y0, 4.2, DECK, HB - 4.5, GUN, GUN_TOP, 10);
    drum(g, x, y0, 5.5, HB - 4.5, HB - 3.2, DEEP, shade(DEEP, 0.2), 12);
  },
  turret: ({ g, x, y, tower, definition, level, kick, tip, color }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      pitch = TILT.pitch,
      ca = Math.cos(a),
      sa = Math.sin(a),
      back = -kick * RECOIL,
      f = frame(a, pitch, HB),
      end = reach(level) + back,
      // The bowl faces the viewer when the axis does.
      front = seen(f.dv, f.dh) > 0;
    const arm = (s: number) => {
        // Fork arm from the turntable up to the dish's trunnion.
        const n = turn(s > 0 ? [-1.6, ARM - 0.8, 1.6, ARM - 0.8, 1.6, ARM + 0.8, -1.6, ARM + 0.8] : [-1.6, -ARM - 0.8, 1.6, -ARM - 0.8, 1.6, -ARM + 0.8, -1.6, -ARM + 0.8], a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, HB - 3.2, HB + 1.2, 0.4, GUN, GUN_TOP, METAL);
        if (ca * s > -0.2) {
          const hx = X(x, -sa * s * (ARM + 0.9)),
            hy = Y(y0, ca * s * (ARM + 0.9), HB);
          disc(g, hx, hy, 1.7, OUTLINE);
          disc(g, hx, hy, 1.2, METAL);
        }
      },
      yoke = () => {
        // The cross beam of the fork under the dish.
        const n = turn([-1.8, -ARM, 1.8, -ARM, 1.8, ARM, -1.8, ARM], a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, HB - 3.2, HB - 1.8, 0, GUN, GUN_TOP, METAL);
      },
      dish = () => {
        const p = DISH_P + back;
        // Rim and back shell, then the bowl (front) or the ribs (back).
        plane(g, x, y0, f, p - 1.2, DISH_R + 0.8, OUTLINE, 0.95, DISH_R + 0.8, 20);
        plane(g, x, y0, f, p - 0.6, DISH_R, shade(METAL, -0.45), 1, DISH_R, 20);
        if (front) {
          const k = 0.15 * lit(f.du, f.dv, f.dh);
          plane(g, x, y0, f, p - 0.2, DISH_R - 0.9, shade(METAL, 0.05 + k), 1, DISH_R - 0.9, 20);
          plane(g, x, y0, f, p - 0.6, DISH_R * 0.68, shade(METAL, -0.12 + k), 1, DISH_R * 0.68, 18);
          plane(g, x, y0, f, p - 1, DISH_R * 0.32, shade(c, -0.55), 1, DISH_R * 0.32, 12);
          // Level 6+: a ring in the path colour round the bowl.
          if (level >= 6) {
            for (let i = 0; i < 20; i++) {
              const t0 = (i / 20) * Math.PI * 2,
                t1 = ((i + 1) / 20) * Math.PI * 2;
              project(x, y0, f, p - 0.3, Math.cos(t0) * (DISH_R - 1.3), Math.sin(t0) * (DISH_R - 1.3), 0);
              project(x, y0, f, p - 0.3, Math.cos(t1) * (DISH_R - 1.3), Math.sin(t1) * (DISH_R - 1.3), 1);
              g.lineStyle(0.9, color, 1);
              g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
            }
          }
        } else {
          g.lineStyle(0.8, DEEP, 0.9);
          for (let i = 0; i < 6; i++) {
            const t = (i / 6) * Math.PI * 2;
            project(x, y0, f, p - 1.6, 0, 0, 0);
            project(x, y0, f, p - 0.8, Math.cos(t) * DISH_R, Math.sin(t) * DISH_R, 1);
            g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
          }
          plane(g, x, y0, f, p - 1.8, 2.4, GUN, 1, 2.4, 10);
        }
        // Level 5: an armoured backing ring.
        if (level >= 5 && !front) plane(g, x, y0, f, p - 1.4, DISH_R * 0.6, shade(c, -0.5), 1, DISH_R * 0.6, 16);
      },
      feed = () => {
        // Three struts from the rim to the feed horn at the focus.
        for (const t of [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3]) {
          const q = Math.cos(t) * (DISH_R - 0.6),
            z = Math.sin(t) * (DISH_R - 0.6),
            p0 = DISH_P + back - 0.2;
          rod(
            g, x, y0,
            f.pu + p0 * f.du + q * f.eu + z * f.nu, f.pv + p0 * f.dv + q * f.ev + z * f.nv, f.ph + p0 * f.dh + z * f.nh,
            f.pu + (end - 2) * f.du, f.pv + (end - 2) * f.dv, f.ph + (end - 2) * f.dh,
            0.7, METAL,
          );
        }
        box(g, x, y0, f, end - 2.6, end, -1.5, 1.5, -1.5, 1.5, shade(METAL, -0.1), tip ?? shade(c, -0.2));
      };
    const near = ca > 0 ? 1 : -1;
    arm(-near);
    yoke();
    if (front) {
      dish();
      feed();
    } else {
      feed();
      dish();
    }
    arm(near);
  },
  live: ({ g, glow, x, y, tower, definition, level, kick, charge, clock, color, energy }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      f = frame(a, TILT.pitch, HB),
      back = -kick * RECOIL,
      end = reach(level) + back;
    // Countdown gauge on the deck's front half, filling with the charge; pulsing when ready.
    onGround(g, x, y0, DECK, () => {
      if (charge > 0.01) arcBand(g, 0, 0, 9.3, 1.1, Math.PI * (1 - charge), Math.PI, shade(c, -0.05), 0.95);
    });
    if (charge >= 1) onGround(glow, x, y0, DECK, () => arcBand(glow, 0, 0, 9.3, 2.6, 0, Math.PI, c, 0.12 + 0.08 * Math.sin(clock * 6 + tower.id)));
    // Pylon lamps blink in turn.
    const on = Math.floor(clock * 2 + tower.id) % 4;
    PYLONS.forEach(([sx, sy], i) => {
      const lx = X(x, sx * 14.5),
        ly = Y(y0, sy * 14.5, PYLON_H + 0.6);
      if (i !== on && level < 4) return;
      const k = i === on ? 1 : 0.35 + 0.35 * Math.max(0, Math.sin(4 * clock - i * 1.4));
      disc(g, lx, ly, 0.8, shade(c, -0.5 + 0.8 * k));
      disc(glow, lx, ly, 3.2, c, 0.3 * k);
    });
    // Beacon on the dish's top rim, blinking faster as the strike nears.
    const blink = Math.sin(clock * (3 + 9 * charge) + tower.id) > 0.3 ? 1 : 0.15;
    project(x, y0, f, DISH_P + back - 0.6, 0, DISH_R + 0.6, 0);
    disc(g, SX[0], SY[0], 1.3, OUTLINE);
    disc(g, SX[0], SY[0], 0.85, shade(c, -0.4 + 0.7 * blink));
    disc(glow, SX[0], SY[0], 3, c, 0.35 * blink);
    // Level 2: a lamp on the turntable in the trim colour.
    if (level >= 2) {
      const lx = X(x, 0),
        ly = Y(y0, 5.5, HB - 3.9);
      disc(g, lx, ly, 1.1, OUTLINE);
      disc(g, lx, ly, 0.7, shade(color, 0.2));
      disc(glow, lx, ly, 2.3, color, 0.35);
    }
    // Designator: the horn glows with the charge; a flare on the uplink.
    project(x, y0, f, end, 0, 0, 1);
    disc(glow, SX[1], SY[1], 2.4, c, Math.min(0.5, 0.12 + 0.3 * charge + energy));
    if (kick > 0) halo(glow, SX[1], SY[1], 8 * (0.5 + kick), c, 0.3 * kick);
  },
};
