/**
 * Hex Sentinel: Pulse's look, a small armoured turret drawn in a slight 3/4 tilt with plain Graphics.
 *
 * World axes around the tower's ground centre: u east, v south, h up; a point lands on the screen at
 * (x + u, y0 + v × squash − h), with y0 = y + drop. The projection lives in `MUZZLES.barrel.tilt`, so shots, flashes
 * and beams leave the drawn muzzle. The foundation (`sentinelBase`) depends only on the level and the trim colour and
 * bakes like any tower body; the turret (`sentinelTurret`) and every light are live.
 */
import { LIGHT, facing, halo, plate, sunken } from "../material";
import { MUZZLES } from "../muzzles";
import { arcBand, disc, oval, ring, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, tube, turn } from "./tilt";

const TILT = MUZZLES.barrel!.tilt!,
  RECOIL = MUZZLES.barrel!.recoil;
/** Foundation: hex radius and extrusion; the ground squash, the drop below the cell centre and the barrel height. */
const R = 21,
  H = 7,
  SQ = SQUASH,
  DROP = TILT.drop,
  HB = TILT.height;
/** Palette: deep shadow, side armour, primary armour, metallic highlight, barrel casing and the dark outline. */
const DEEP = 0x14282f,
  SIDE = 0x25434a,
  ARMOR = 0x46636a,
  METAL = 0x76918f,
  CASING = 0x34474e;

// --- Footprints (along, across), clockwise on the screen with v pointing down. ---------------------------------------
/** The foundation: corners at 0°, 60°, …, so a flat face looks at the viewer. */
const HEX = Array.from({ length: 12 }, (_, i) => (i % 2 ? Math.sin : Math.cos)((Math.floor(i / 2) * Math.PI) / 3) * R);
/** The armoured shell: a stretched octagon, blunt at the back, angled at the front. */
const SHELL = [-12, -5.6, -8, -9.6, 6, -9.6, 11.5, -5.6, 11.5, 5.6, 6, 9.6, -8, 9.6, -12, 5.6];
/** The reinforced cannon housing in front of the shell, narrowing towards the barrel. */
const HOUSING = [9, -4.5, 15, -3.6, 15, 3.6, 9, 4.5];
/** Heat fins at the back from level 5. */
const FINS = [-5, 0, 5].map((q) => [-15.5, q - 0.8, -11.5, q - 0.8, -11.5, q + 0.8, -15.5, q + 0.8]);
const SHELL_BASE = H + 2.6,
  SHELL_TOP = H + 9.6,
  SHELL_BEVEL = 2.4,
  HOUSING_BASE = HB - 2.8,
  HOUSING_TOP = HB + 2.6;
/** Energy glass in the trim colour: dim at rest, lit by `k` (0–1). */
const glass = (color: number, k: number) => shade(color, -0.55 + 0.6 * k);

/**
 * The still foundation (baked per level and trim colour): contact shadow, the extruded hex with seams and energy slots,
 * the bevelled deck with its recessed bearing, and the fixed bearing collar.
 */
export function sentinelBase({ g, x, y, level, color }: TurretContext) {
  const y0 = y + DROP;
  // Contact shadow: a tight dark core under the block and a soft spread to the lower right.
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, R + 6, R + 2, 0x050b10, 0.22);
    oval(g, 2, 3, R + 1.5, R, 0x050b10, 0.35);
  });
  // Extruded walls: the three faces turned to the viewer, darker the further they face from the light.
  for (let i = 0; i < 3; i++) {
    const j = i + 1,
      a = (i * Math.PI) / 3 + Math.PI / 6,
      u0 = X(x, HEX[2 * i]),
      u1 = X(x, HEX[2 * j]),
      b0 = Y(y0, HEX[2 * i + 1], 0),
      b1 = Y(y0, HEX[2 * j + 1], 0),
      t0 = Y(y0, HEX[2 * i + 1], H),
      t1 = Y(y0, HEX[2 * j + 1], H),
      face = shade(SIDE, 0.28 * facing(a)),
      at = (f: number, h: number) => [u0 + (u1 - u0) * f, b0 + (b1 - b0) * f - h] as const;
    quad(g, u0 - 0.7, b0 + 1, u1 + 0.7, b1 + 1, u1 + 0.7, t1, u0 - 0.7, t0, OUTLINE, 0.95);
    quad(g, u0, b0, u1, b1, u1, t1, u0, t0, face);
    // Dark foot along the ground and a lit lip under the deck edge.
    quad(g, u0, b0 - 1.2, u1, b1 - 1.2, u1, b1, u0, b0, shade(face, -0.45));
    quad(g, u0, t0, u1, t1, u1, t1 + 1, u0, t0 + 1, shade(face, 0.32));
    // Panel seams: two upright joints.
    g.lineStyle(0.7, DEEP, 0.9);
    for (const f of [0.2, 0.8]) {
      const [sx, sy] = at(f, 1.2),
        [, ty] = at(f, H - 1.2);
      g.lineBetween(sx, sy, sx, ty);
    }
    // Energy slot in the middle panel: a dark socket and its dim glass (the light itself is live).
    const [ax, ay] = at(0.32, 3),
      [bx, by] = at(0.68, 3);
    quad(g, ax, ay - 1.3, bx, by - 1.3, bx, by + 1.3, ax, ay + 1.3, DEEP);
    quad(g, ax + 0.6, ay - 0.6, bx - 0.6, by - 0.6, bx - 0.6, by + 0.6, ax + 0.6, ay + 0.6, glass(color, 0.15));
    if (level >= 3) {
      g.fillStyle(shade(METAL, -0.2));
      for (const f of [0.1, 0.9]) {
        const [rx, ry] = at(f, H / 2);
        g.fillRect(rx - 0.7, ry - 0.7, 1.4, 1.4);
      }
    }
  }
  // The corner between the left walls catches a sliver of light.
  g.lineStyle(0.8, shade(SIDE, 0.45), 0.8);
  g.lineBetween(X(x, HEX[4]), Y(y0, HEX[5], 0.6), X(x, HEX[4]), Y(y0, HEX[5], H - 0.4));
  // The deck: a bevelled hex plate, the bearing recess, seams and bolts.
  onGround(g, x, y0, H, () => {
    plate(g, 0, 0, { n: 6, rot: 0 }, R, ARMOR);
    g.lineStyle(0.7, DEEP, 0.55);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(Math.cos(a) * 13.5, Math.sin(a) * 13.5, Math.cos(a) * (R - 2.2), Math.sin(a) * (R - 2.2));
    }
    // From level 4 an inlay in the trim colour follows the deck's rim.
    if (level >= 4) {
      g.lineStyle(0.8, shade(color, -0.3), 0.9);
      for (let i = 0; i < 6; i++) {
        const a0 = (i * Math.PI) / 3,
          a1 = a0 + Math.PI / 3;
        g.lineBetween(Math.cos(a0) * (R - 3.4), Math.sin(a0) * (R - 3.4), Math.cos(a1) * (R - 3.4), Math.sin(a1) * (R - 3.4));
      }
    }
    sunken(g, 0, 0, "disc", 12.4, DEEP);
    // Groove of the energy ring under the turret; the ring itself is drawn live with the charge.
    ring(g, 0, 0, 10, 2.2, OUTLINE, 0.9);
    const bolts = level >= 3 ? 6 : 3;
    for (let i = 0; i < bolts; i++) {
      const a = Math.PI / 6 + (i * Math.PI * 2) / bolts,
        bx = Math.cos(a) * 16.5,
        by = Math.sin(a) * 16.5;
      disc(g, bx, by, 1.5, shade(ARMOR, -0.45));
      disc(g, bx - 0.4, by - 0.4, 0.7, METAL, 0.9);
    }
  });
  // Bearing collar standing in the recess: a short dark drum.
  const top = H + 2.6;
  drum(g, x, y0, 7.6, H, top, CASING);
  onGround(g, x, y0, top, () => arcBand(g, 0, 0, 7.1, 0.9, LIGHT - 0.9, LIGHT + 0.9, METAL, 0.8));
}

/**
 * The live part: the energy ring and wall slots (lit by the charge), the shell's cast shadow, the turning bearing
 * teeth, the shell, the cannon housing and the barrel with its energy channel, in front-to-back order for the aim.
 */
export function sentinelTurret(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, charge, kick, tip, energy, clock, color } = ctx,
    a = tower.angle,
    y0 = y + DROP,
    c = Math.cos(a),
    s = Math.sin(a),
    pulse = definition.color,
    end = MUZZLES.barrel!.reach(level) - kick * RECOIL,
    away = s < 0,
    lit = Math.min(1, 0.25 + 0.75 * charge + energy);
  // Energy ring in its groove: ink, so the turret covers its back; light only on the front arc the turret leaves free.
  onGround(g, x, y0, H, () => ring(g, 0, 0, 10, 1.1, glass(color, lit)));
  onGround(glow, x, y0, H, () => arcBand(glow, 0, 0, 10, 3, 0.25, Math.PI - 0.25, color, 0.12 + 0.25 * lit));
  // Wall slots: lit one after another as the shot charges; from level 4 a light also chases along them.
  for (let i = 0; i < 3; i++) {
    const j = i + 1,
      u0 = HEX[2 * i],
      v0 = HEX[2 * i + 1],
      u1 = HEX[2 * j],
      v1 = HEX[2 * j + 1],
      chase = level >= 4 ? 0.35 * Math.max(0, Math.sin(4 * clock - i * 1.8)) : 0,
      on = Math.min(1, Math.max(0, Math.min(1, charge * 3 - (2 - i))) * 0.6 + 0.2 + chase),
      ax = X(x, u0 + (u1 - u0) * 0.34),
      ay = Y(y0, v0 + (v1 - v0) * 0.34, 3),
      bx = X(x, u0 + (u1 - u0) * 0.66),
      by = Y(y0, v0 + (v1 - v0) * 0.66, 3);
    g.lineStyle(1.2, glass(color, on), 1);
    g.lineBetween(ax, ay, bx, by);
    glow.lineStyle(2.6, color, 0.2 * on);
    glow.lineBetween(ax, ay, bx, by);
  }
  // Shadow of the shell on the deck, cast to the lower right.
  turn(SHELL, a, FOOT);
  onGround(g, x, y0, H, () => {
    for (let i = 0; i < 8; i++) point(i, FOOT[2 * i] + 4.5, FOOT[2 * i + 1] + 6);
    fillPoints(g, 8, 0x050b10, 0.3);
  });
  // Bearing teeth on the collar's front, turning with the aim.
  g.fillStyle(shade(METAL, -0.25), 0.9);
  for (let i = 0; i < 8; i++) {
    const t = a + (i * Math.PI) / 4,
      st = Math.sin(t);
    if (st <= 0.15) continue;
    g.fillRect(X(x, Math.cos(t) * 7.7) - 0.5, Y(y0, st * 7.7, H + 1.3) - 1, 1, 2);
  }
  const barrel = () => {
      const from = 14.5 - kick * RECOIL;
      tube(g, x, y0, a, HB, from, end - 3.6, 2.3, CASING);
      // Energy channel along the barrel's top, brighter as the shot charges.
      tube(g, x, y0, a, HB + 1.1, from + 1, end - 4.4, 0.65, shade(pulse, -0.35 + 0.45 * charge), 1, false);
      tube(g, x, y0, a, HB, end - 3.6, end, 3.1, shade(CASING, -0.1));
      tube(g, x, y0, a, HB, end - 1.4, end, 3.1, tip ?? shade(CASING, -0.15), 1, false);
      // Brake slot.
      tube(g, x, y0, a, HB, end - 2.7, end - 2.1, 3.2, OUTLINE, 0.7, false);
      if (s > 0.12) {
        endFace(g, x, y0, a, HB, end, 3.1, shade(CASING, -0.45));
        endFace(g, x, y0, a, HB, end, 1.4, shade(pulse, -0.1 + 0.4 * charge));
      }
      glow.lineStyle(2.2, pulse, 0.1 + 0.3 * charge + energy);
      glow.lineBetween(X(x, c * (from + 1)), Y(y0, s * (from + 1), HB + 1.1), X(x, c * (end - 4.4)), Y(y0, s * (end - 4.4), HB + 1.1));
      disc(glow, X(x, c * end), Y(y0, s * end, HB), 2.6, pulse, 0.12 + 0.3 * charge);
      // Right after a shot: a hot core at the muzzle (the flash itself is an effect).
      if (kick > 0) {
        const mx = X(x, c * (end + 1)),
          my = Y(y0, s * (end + 1), HB);
        halo(glow, mx, my, 4 * (1.3 + kick), pulse, 0.3 * kick);
        disc(g, mx, my, 1.4 * (0.5 + kick), shade(pulse, 0.75));
      }
    },
    housing = () => {
      const n = turn(HOUSING, a, FOOT);
      block(g, x, y0, FOOT, FOOT, n, HOUSING_BASE, HOUSING_TOP - 0.8, 0.8, shade(SIDE, 0.05), shade(ARMOR, 0.05), METAL);
    },
    fins = () => {
      if (level < 5) return;
      for (const fin of FINS) {
        const n = turn(fin, a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, SHELL_BASE + 0.8, SHELL_TOP - 1, 0.4, SIDE, ARMOR, METAL);
      }
    },
    shell = () => {
      const n = turn(SHELL, a, FOOT);
      turn(SHELL, a, INSET, 0.8, -0.25);
      block(g, x, y0, FOOT, INSET, n, SHELL_BASE, SHELL_TOP, SHELL_BEVEL, SIDE, shade(ARMOR, 0.08), METAL);
      const ht = SHELL_TOP + SHELL_BEVEL,
        sx = (p: number, q: number) => X(x, p * c - q * s),
        sy = (p: number, q: number) => Y(y0, p * s + q * c, ht);
      // Top panel: a seam across and the recessed energy channel along the axis.
      g.lineStyle(0.7, DEEP, 0.85);
      g.lineBetween(sx(-3, -6.8), sy(-3, -6.8), sx(-3, 6.8), sy(-3, 6.8));
      quad(g, sx(-7.5, -1.6), sy(-7.5, -1.6), sx(6.5, -1.6), sy(6.5, -1.6), sx(6.5, 1.6), sy(6.5, 1.6), sx(-7.5, 1.6), sy(-7.5, 1.6), DEEP);
      const fill = -7 + 13 * charge;
      if (charge > 0.02) quad(g, sx(-7, -0.8), sy(-7, -0.8), sx(fill, -0.8), sy(fill, -0.8), sx(fill, 0.8), sy(fill, 0.8), sx(-7, 0.8), sy(-7, 0.8), shade(pulse, -0.1 + 0.3 * charge));
      glow.lineStyle(2.4, pulse, 0.1 + 0.35 * charge);
      glow.lineBetween(sx(-7, 0), sy(-7, 0), sx(fill, 0), sy(fill, 0));
      // Indicator lamps at the back corners in the trim colour: one at level 1, two from level 2.
      for (const q of level >= 2 ? [-5.6, 5.6] : [5.6]) {
        const lx = sx(-8.6, q),
          ly = sy(-8.6, q);
        disc(g, lx, ly, 1.3, OUTLINE);
        disc(g, lx, ly, 0.8, shade(color, 0.2));
        disc(glow, lx, ly, 2.4, color, 0.35);
      }
      // Level 3: bolt heads on the front corners of the top.
      if (level >= 3)
        for (const q of [-5.2, 5.2]) {
          const bx = sx(4.2, q),
            by = sy(4.2, q);
          disc(g, bx, by, 0.9, shade(ARMOR, -0.45));
          disc(g, bx - 0.3, by - 0.3, 0.4, METAL);
        }
    };
  if (away) {
    barrel();
    housing();
    shell();
    fins();
  } else {
    fins();
    shell();
    housing();
    barrel();
  }
}
