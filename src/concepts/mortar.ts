import { facing, halo } from "../render/material";
import { disc, oval, shade } from "../render/shapes";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "../render/tower-art/tilt";
import { SX, SY, frame, project, rod } from "./skyburst";
import type { Concept } from "./types";

// Mortar: a fat, short tube at a steep pitch on a bipod, in a sandbagged pit round a bolted turntable.
const TILT = { drop: 5, squash: SQUASH, height: 6, pitch: 0.9, deck: 0.6 },
  reach = (l: number) => 12 + l,
  RECOIL = 5;
const GUN = 0x3a4549,
  GUN_TOP = 0x56646a,
  METAL = 0x8a9a9c,
  DEEP = 0x1f272b,
  SAND = 0x8c7a55;
/** Sandbags round the pit: angle and row (row 1 only from level 5). */
const BAGS = Array.from({ length: 12 }, (_, i) => (i * Math.PI * 2) / 12 + Math.PI / 12);
const RING_R = 17.5;
/** The breech cradle: a block that holds the tube's base. */
const CRADLE = [-6.5, -5.5, 3.5, -6.5, 5.5, -4.5, 5.5, 4.5, 3.5, 6.5, -6.5, 5.5];
const CRADLE_H = 6.5;

function bag(g: Parameters<Concept["base"]>[0]["g"], x: number, y0: number, t: number, h: number, c: number) {
  const bx = X(x, Math.cos(t) * RING_R),
    by = Y(y0, Math.sin(t) * RING_R, h),
    rot = Math.atan2(Math.cos(t) * SQUASH, -Math.sin(t)),
    lightK = facing(t);
  oval(g, bx, by + 0.6, 5.4, 3.2, OUTLINE, 0.9, rot);
  oval(g, bx, by, 4.8, 2.6, shade(c, -0.2 + 0.25 * lightK), 1, rot);
  oval(g, bx - 0.6, by - 0.8, 3, 1.2, shade(c, 0.25), 0.8, rot);
}

export const concept: Concept = {
  tower: "mortar",
  name: "Pit Mortar",
  idea: "A fat tube raised at ~50° on a bipod over a bolted turntable, sunk in a ring of sandbags; a shell nose shows in the bore once loaded.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base: ({ g, x, y, level, definition, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color,
      sand = shade(SAND, 0.1);
    onGround(g, x, y0, 0, () => {
      oval(g, 4, 6, 25, 22, 0x050b10, 0.2);
      // The pit floor: packed earth darkening to the middle.
      oval(g, 0, 0, RING_R + 2, RING_R + 2, shade(c, -0.62));
      oval(g, 0, 0, RING_R - 3, RING_R - 3, shade(c, -0.72));
    });
    const rows = level >= 5 ? [0, 2.6] : [0];
    // Back half of the ring first, so the turntable covers it.
    for (const h of rows) for (const t of BAGS) if (Math.sin(t) <= 0) bag(g, x, y0, t, 1.3 + h, sand);
    // Bolted turntable: a dark drum with bolts round its rim, more from level 3, an inlay in the trim colour from level 4.
    drum(g, x, y0, 10.5, 0, 2.2, GUN, GUN_TOP, 14);
    onGround(g, x, y0, 2.2, () => {
      const n = level >= 3 ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        disc(g, Math.cos(t) * 8.6, Math.sin(t) * 8.6, 0.9, DEEP);
        disc(g, Math.cos(t) * 8.6 - 0.3, Math.sin(t) * 8.6 - 0.3, 0.4, METAL);
      }
      if (level >= 4) {
        g.lineStyle(0.9, shade(color, -0.2), 0.95);
        const m = 20;
        for (let i = 0; i < m; i++) {
          const t0 = (i / m) * Math.PI * 2,
            t1 = ((i + 1) / m) * Math.PI * 2;
          g.lineBetween(Math.cos(t0) * 6.6, Math.sin(t0) * 6.6, Math.cos(t1) * 6.6, Math.sin(t1) * 6.6);
        }
      }
    });
    for (const h of rows) for (const t of BAGS) if (Math.sin(t) > 0) bag(g, x, y0, t, 1.3 + h, sand);
    // Ammo crate with two shells beside the pit wall at the back left.
    const n = turn([-17, -11, -11, -11, -11, -6, -17, -6], 0, FOOT);
    block(g, x, y0, FOOT, FOOT, n, 0, 3, 0, shade(c, -0.5), shade(c, -0.3), shade(c, 0.1));
  },
  turret: ({ g, x, y, tower, definition, level, kick, tip, color }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      pitch = TILT.pitch,
      HB = TILT.height,
      end = reach(level) - kick * RECOIL,
      back = -kick * RECOIL,
      ca = Math.cos(a),
      sa = Math.sin(a),
      f = frame(a, pitch, HB),
      away = sa < -0.05,
      R = 4.3;
    // The tube's shadow, long and to the lower right.
    onGround(g, x, y0, 2.2, () => {
      const s = turn([-3, -4.5, 12, -3.5, 12, 3.5, -3, 4.5], a, FOOT);
      for (let i = 0; i < s; i++) point(i, FOOT[2 * i] + 6, FOOT[2 * i + 1] + 9);
      fillPoints(g, s, 0x050b10, 0.28);
    });
    const cradle = () => {
        const n = turn(CRADLE, a, FOOT);
        turn(CRADLE, a, INSET, 0.8, -1);
        block(g, x, y0, FOOT, INSET, n, 2.2, CRADLE_H, 1, GUN, GUN_TOP, METAL);
        // Elevation wheel on the side turned to the viewer.
        const s = ca >= 0 ? 1 : -1,
          wx = X(x, -sa * s * 6.6 - ca * 1),
          wy = Y(y0, ca * s * 6.6 - sa * 1, 4.6);
        if (ca * s > -0.3) {
          disc(g, wx, wy, 2.4, OUTLINE);
          disc(g, wx, wy, 1.8, shade(METAL, -0.2));
          disc(g, wx, wy, 0.7, DEEP);
        }
      },
      barrel = () => {
        const from = -3 + back;
        tube(g, x, y0, a, HB, from, from + 4.5, R + 0.8, GUN, 1, true, pitch);
        tube(g, x, y0, a, HB, from + 4.5, end - 2.2, R, shade(c, -0.25), 1, true, pitch);
        // Bands: one at level 1, two from level 3; level 5 a reinforcing collar; from level 6 a band in the path colour.
        const bands = level >= 3 ? [0.35, 0.6] : [0.5];
        for (const k of bands) {
          const d = from + 4.5 + (end - 2.2 - from - 4.5) * k;
          tube(g, x, y0, a, HB, d - 0.6, d + 0.6, R + 0.35, shade(c, -0.55), 1, false, pitch);
        }
        if (level >= 5) tube(g, x, y0, a, HB, from + 4.5, from + 6.8, R + 0.9, shade(c, -0.45), 1, true, pitch);
        if (level >= 6) {
          const d = from + 4.5 + (end - 2.2 - from - 4.5) * 0.8;
          tube(g, x, y0, a, HB, d - 0.7, d + 0.7, R + 0.3, color, 1, false, pitch);
        }
        tube(g, x, y0, a, HB, end - 2.2, end, R + 0.6, shade(c, -0.45), 1, true, pitch);
        if (tip !== undefined) tube(g, x, y0, a, HB, end - 0.9, end, R + 0.6, tip, 1, false, pitch);
        if (towardViewer(a, pitch) > 0.02) {
          endFace(g, x, y0, a, HB, end, R + 0.6, shade(c, -0.6), pitch);
          endFace(g, x, y0, a, HB, end, R - 0.6, OUTLINE, pitch);
        }
      },
      bipod = () => {
        // Two legs from a clamp on the tube to feet on the turntable ahead.
        for (const s of [-1, 1]) {
          const fu = ca * 9 - sa * s * 6.5,
            fv = sa * 9 + ca * s * 6.5;
          // The clamp point in ground coordinates: back out its height from the screen point.
          const pu = f.pu + (7 + back * 0.5) * f.du - R * f.nu,
            pv = f.pv + (7 + back * 0.5) * f.dv - R * f.nv,
            ph = f.ph + (7 + back * 0.5) * f.dh - R * f.nh;
          rod(g, x, y0, pu, pv, ph, fu, fv, 2.2, 1.3, GUN_TOP);
          disc(g, X(x, fu), Y(y0, fv, 2.2), 1.4, DEEP);
        }
      };
    if (away) {
      bipod();
      barrel();
      cradle();
    } else {
      cradle();
      barrel();
      bipod();
    }
  },
  live: ({ g, glow, x, y, tower, definition, level, kick, charge, clock, color, energy }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      pitch = TILT.pitch,
      HB = TILT.height,
      end = reach(level) - kick * RECOIL,
      f = frame(a, pitch, HB),
      ca = Math.cos(a),
      sa = Math.sin(a);
    project(x, y0, f, end, 0, 0, 0);
    const mx = SX[0],
      my = SY[0];
    // Loaded: the shell's nose shows in the bore.
    if (charge > 0.85 && kick === 0 && towardViewer(a, pitch) > 0.02) endFace(g, x, y0, a, HB, end - 1.2, 2.2, shade(0xc9a25a, 0.1), pitch);
    // Smoke rising from the muzzle after a shot, and heat in the tube.
    if (kick > 0) {
      const drift = 1 - kick;
      halo(glow, mx, my, 6 * (1 + kick), c, 0.3 * kick);
      for (const k of [0, 1]) disc(g, mx + (k ? 3 : -2) * drift, my - 4 - 10 * drift - k * 3, 2 + 3.5 * drift, 0x8f989e, 0.4 * kick);
    }
    if (energy > 0) disc(glow, mx, my, 3.5, c, energy);
    // Level 2: a lamp on the cradle's back; level 4: lights in the front sandbag gaps chase round.
    if (level >= 2) {
      const lx = X(x, -ca * 5.6),
        ly = Y(y0, -sa * 5.6, CRADLE_H + 0.8);
      if (sa < 0.3) {
        disc(g, lx, ly, 1.2, OUTLINE);
        disc(g, lx, ly, 0.75, shade(color, 0.2));
        disc(glow, lx, ly, 2.4, color, 0.35);
      }
    }
    if (level >= 4)
      [0.25, 0.42, 0.58, 0.75].forEach((k, i) => {
        const t = Math.PI * k,
          on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.1)),
          lx = X(x, Math.cos(t) * 10.6),
          ly = Y(y0, Math.sin(t) * 10.6, 1.1);
        disc(g, lx, ly, 0.8, shade(color, -0.6 + 0.7 * on));
        if (on > 0.5) disc(glow, lx, ly, 2.2, color, 0.25 * on);
      });
  },
};
