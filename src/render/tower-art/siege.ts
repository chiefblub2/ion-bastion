/**
 * Siege Cannon: Nova's look in the slight 3/4 tilt (see `tilt.ts`): four armoured legs and an amber drum (still, baked
 * per level and trim colour), a toothed bearing ring and a turning armoured housing with an elevated cannon (its ink
 * cached per aim angle and recoil, `siegeTurret`; lights and smoke live in `siegeBelow` and `siegeAbove`).
 * The cannon's pivot height and elevation live in `TILTS.heavy`, so shells, flashes and smoke leave its muzzle.
 */
import { facing, halo } from "../material";
import { MUZZLES, TILTS } from "../muzzles";
import { disc, oval, polygon, shade } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "./tilt";

const TILT = TILTS.heavy,
  RECOIL = MUZZLES.heavy.recoil,
  DROP = TILT.drop,
  HB = TILT.height,
  PITCH = TILT.pitch ?? 0;
/** Gunmetal of the legs, bearing and breech, and its metallic highlight. */
const LEG = 0x3a4549,
  LEG_TOP = 0x56646a,
  DARK = 0x222b30,
  METAL = 0x8a9a9c,
  CASING = 0x3b464b;
/** Heights: drum, bearing ring and turret plate, then the housing. */
const DRUM = 5.5,
  RING = 8,
  PLATE = 9,
  TOP = 15.5,
  BEVEL = 2;

// --- Footprints (along, across), clockwise on the screen. -----------------------------------------------------------
const LEG_SLAB = [8, -2.6, 17, -2.2, 17, 2.2, 8, 2.6];
const LEG_PAD = [16, -3, 17.5, -4.5, 21, -4.5, 22.5, -3, 22.5, 3, 21, 4.5, 17.5, 4.5, 16, 3];
/** Legs on the diagonals, the two at the back first. */
const LEGS = [(5 * Math.PI) / 4, (7 * Math.PI) / 4, (3 * Math.PI) / 4, Math.PI / 4];
const HOUSING = [-9, -7.5, -6, -9.5, 5, -9.5, 9, -6.5, 9, 6.5, 5, 9.5, -6, 9.5, -9, 7.5];
const BREECH = [-13, -4.5, -9, -4.5, -9, 4.5, -13, 4.5];
const MANTLET = [8, -4.6, 11.5, -4, 11.5, 4, 8, 4.6];
/** Level 5: armour plates on both flanks. */
const PLATES = [
  [1, 9.5, 7, 9.5, 7, 10.9, 1, 10.9],
  [1, -10.9, 7, -10.9, 7, -9.5, 1, -9.5],
];
/** Crenels on the drum's rim: at the back (drawn before the bearing ring) and at the front (after it). */
const CRENELS = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3 + Math.PI / 6);
const CRENEL = [11.4, -1.6, 12.8, -1.8, 12.8, 1.8, 11.4, 1.6];
/** Notches in the drum's front wall that hold the level lights. */
const NOTCHES = [Math.PI * 0.2, Math.PI * 0.35, Math.PI * 0.5, Math.PI * 0.65, Math.PI * 0.8];

const amberWall = (c: number) => shade(c, -0.3),
  amberTop = (c: number) => shade(c, 0.04);

/** The still part (baked per level and trim colour): contact shadow, four legs with pads, the amber drum and the ring. */
export function siegeBase({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, 25, 21, 0x050b10, 0.2);
    oval(g, 1.5, 2.5, 15, 14, 0x050b10, 0.38);
  });
  for (const a of LEGS) {
    let n = turn(LEG_SLAB, a, FOOT);
    block(g, x, y0, FOOT, FOOT, n, 0, 3.2, 0, LEG, LEG_TOP, METAL);
    n = turn(LEG_PAD, a, FOOT);
    turn(LEG_PAD, a, INSET, 0.78, 19.25);
    block(g, x, y0, FOOT, INSET, n, 0, 3.6, 1.2, LEG, LEG_TOP, METAL);
    // A hex bolt on every pad, from level 3 with a lit head.
    const bx = X(x, Math.cos(a) * 19.25),
      by = Y(y0, Math.sin(a) * 19.25, 4.8);
    polygon(g, bx, by, 1.9, 6, DARK, 0.3);
    if (level >= 3) disc(g, bx - 0.5, by - 0.5, 0.8, METAL);
  }
  // The amber drum, its notch sockets and the crenels at the back of its rim.
  drum(g, x, y0, 12.5, 1.5, DRUM, amberWall(c), amberTop(c), 16);
  for (const t of NOTCHES) {
    const nx = X(x, Math.cos(t) * 12.6),
      ny = Y(y0, Math.sin(t) * 12.6, 3.5);
    quad(g, nx - 1.2, ny - 1.3, nx + 1.2, ny - 1.3, nx + 1.2, ny + 1.3, nx - 1.2, ny + 1.3, DARK);
    // Below level 4 the notch lights glow steadily, so they bake with the drum; from level 4 they chase (live).
    if (level < 4) quad(g, nx - 0.6, ny - 0.8, nx + 0.6, ny - 0.8, nx + 0.6, ny + 0.8, nx - 0.6, ny + 0.8, shade(color, level >= 2 ? -0.35 : -0.5));
  }
  for (const t of CRENELS) {
    if (Math.sin(t) > 0) continue;
    const n = turn(CRENEL, t, FOOT);
    block(g, x, y0, FOOT, FOOT, n, DRUM, DRUM + 1.3, 0, amberWall(c), amberTop(c), shade(c, 0.4));
  }
  // The dark bearing ring and the turret plate on it.
  drum(g, x, y0, 11, DRUM, RING, DARK, shade(DARK, 0.15), 14);
  for (const t of CRENELS) {
    if (Math.sin(t) <= 0) continue;
    const n = turn(CRENEL, t, FOOT);
    block(g, x, y0, FOOT, FOOT, n, DRUM, DRUM + 1.3, 0, amberWall(c), amberTop(c), shade(c, 0.4));
  }
  drum(g, x, y0, 9.5, RING, PLATE, CASING, shade(CASING, 0.2), 12);
}

const geometry = ({ x, y, tower, level, kick }: TurretContext) => {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP;
  return {
    a,
    ca,
    sa,
    y0,
    end: MUZZLES.heavy.reach(level) - kick * RECOIL,
    back: -kick * RECOIL,
    /** Point `p` along the aim, `q` across it, at height `h`. */
    P: (p: number, q: number, h: number) => [X(x, p * ca - q * sa), Y(y0, p * sa + q * ca, h)] as const,
  };
};
/** The flank the vent slats sit on: the one turned to the viewer. */
const slatSide = (ca: number) => (ca > 0 ? 9.6 : -9.6);

/** Live, under the turret: from level 4 the drum's notch lights chase round in the trim colour (below, they bake with the drum). */
export function siegeBelow({ g, glow, x, y, level, clock, color }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP;
  NOTCHES.forEach((t, i) => {
    const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.1)),
      nx = X(x, Math.cos(t) * 12.7),
      ny = Y(y0, Math.sin(t) * 12.7, 3.5);
    quad(g, nx - 0.6, ny - 0.8, nx + 0.6, ny - 0.8, nx + 0.6, ny + 0.8, nx - 0.6, ny + 0.8, shade(color, -0.6 + 0.7 * on));
    if (on > 0.5) quad(glow, nx - 1.8, ny - 2, nx + 1.8, ny - 2, nx + 1.8, ny + 2, nx - 1.8, ny + 2, color, 0.22 * on);
  });
}

/**
 * The turret's ink (cached per aim angle and recoil): the turning bearing teeth, the housing's shadow, the housing with
 * its dark vent slats and the loading hatch, the mantlet, breech, the elevated barrel (an under-barrel tube from level
 * 5). Reads no clock and no charge, and no glow.
 */
export function siegeTurret(ctx: TurretContext) {
  const { g, x, level, tip, definition, color } = ctx,
    { a, ca, sa, y0, end, back, P } = geometry(ctx),
    c = definition.color,
    away = sa < 0;
  // Teeth on the bearing ring, turning with the aim.
  for (let i = 0; i < 12; i++) {
    const t = a + (i * Math.PI) / 6,
      st = Math.sin(t);
    if (st <= 0.12) continue;
    const t0 = t - 0.12,
      t1 = t + 0.12;
    g.fillStyle(shade(METAL, -0.3 + 0.3 * facing(t)), 0.95);
    g.fillTriangle(X(x, Math.cos(t0) * 11.1), Y(y0, Math.sin(t0) * 11.1, RING - 0.4), X(x, Math.cos(t1) * 11.1), Y(y0, Math.sin(t1) * 11.1, RING - 0.4), X(x, Math.cos(t) * 11.1), Y(y0, st * 11.1, DRUM + 0.8));
  }
  // The housing's shadow on the ground, cast to the lower right.
  turn(HOUSING, a, FOOT);
  onGround(g, x, y0, 0, () => {
    for (let i = 0; i < 8; i++) point(i, FOOT[2 * i] + 7, FOOT[2 * i + 1] + 10);
    fillPoints(g, 8, 0x050b10, 0.18);
  });
  const wall = amberWall(c),
    top = amberTop(c),
    ht = TOP + BEVEL,
    part = (shape: readonly number[], h0: number, h1: number, w: number, t: number, bevel = 0) => {
      const n = turn(shape, a, FOOT);
      block(g, x, y0, FOOT, FOOT, n, h0, h1, bevel, w, t, shade(t, 0.4));
    },
    plates = (visible: boolean) => {
      if (level < 5) return;
      for (const plate of PLATES) if (plate[1] > 0 === ca > 0 === visible) part(plate, PLATE + 1, TOP - 1.5, shade(c, -0.55), shade(c, -0.25));
    },
    housing = () => {
      plates(false);
      const n = turn(HOUSING, a, FOOT);
      turn(HOUSING, a, INSET, 0.8, -0.5);
      block(g, x, y0, FOOT, INSET, n, PLATE, TOP, BEVEL, wall, top, shade(c, 0.45));
      // Dark vent slats on the flank turned to the viewer; the charge lights them live (`siegeAbove`).
      g.lineStyle(1.3, DARK, 1);
      for (const p of [-6, -4, -2]) g.lineBetween(...P(p, slatSide(ca), PLATE + 1.8), ...P(p, slatSide(ca), TOP - 1.6));
      plates(true);
      // Loading hatch along the roof; the next shell slides into it live.
      const slot = [P(-6.5, -1.4, ht), P(3, -1.4, ht), P(3, 1.4, ht), P(-6.5, 1.4, ht)];
      quad(g, ...slot[0], ...slot[1], ...slot[2], ...slot[3], shade(c, -0.7));
      // A lamp at the back corner from level 2 (its light is live), a bolt on each front corner from level 3.
      if (level >= 2) {
        const [lx, ly] = P(-6.5, ca > 0 ? 6 : -6, ht);
        disc(g, lx, ly, 1.4, OUTLINE);
        disc(g, lx, ly, 0.9, shade(color, 0.2));
      }
      if (level >= 3)
        for (const q of [-6.2, 6.2]) {
          const [bx, by] = P(4.6, q, ht);
          disc(g, bx, by, 0.9, shade(c, -0.6));
          disc(g, bx - 0.3, by - 0.3, 0.4, METAL);
        }
    },
    breech = () => {
      part(BREECH, PLATE + 1, TOP - 1.5, DARK, shade(DARK, 0.2));
      // Exhaust vents on the breech's back face (hot and smoking right after a shot, live).
      for (const q of [-2.4, 2.4]) {
        const [vx, vy] = P(-13.2, q, 12.5);
        disc(g, vx, vy, 1.1, OUTLINE);
      }
    },
    mantlet = () => part(MANTLET, 10.5, TOP + 1, DARK, shade(DARK, 0.25)),
    under = () => {
      if (level < 5) return;
      tube(g, x, y0, a, HB - 4, 10 + back, end - 7, 1.6, CASING, 1, false, PITCH);
      if (towardViewer(a, PITCH) > 0.05) endFace(g, x, y0, a, HB - 4, end - 7, 1.1, OUTLINE, PITCH);
    },
    barrel = () => {
      tube(g, x, y0, a, HB, 9.5 + back, 15.5 + back, 3.7, shade(c, -0.3), 1, true, PITCH);
      tube(g, x, y0, a, HB, 15.5 + back, end - 3.2, 2.9, shade(c, -0.05), 1, true, PITCH);
      if (level >= 3) tube(g, x, y0, a, HB, (15.5 + end) / 2 + back / 2 - 0.5, (15.5 + end) / 2 + back / 2 + 0.5, 3, shade(c, -0.55), 1, false, PITCH);
      tube(g, x, y0, a, HB, end - 3.2, end, 3.5, shade(c, -0.35), 1, true, PITCH);
      if (tip !== undefined) tube(g, x, y0, a, HB, end - 1.1, end, 3.5, tip, 1, false, PITCH);
      if (towardViewer(a, PITCH) > 0.05) {
        endFace(g, x, y0, a, HB, end, 3.5, shade(c, -0.6), PITCH);
        endFace(g, x, y0, a, HB, end, 2.2, OUTLINE, PITCH);
      }
    };
  if (away) {
    under();
    barrel();
    mantlet();
    housing();
    breech();
  } else {
    breech();
    housing();
    mantlet();
    under();
    barrel();
  }
}

/**
 * Live, over the turret: the vent slats lit one after another as the next shell loads, the shell sliding into the
 * hatch, the lamp's light, the breech's hot vents and smoke, the heat in the barrel and the muzzle glow.
 */
export function siegeAbove(ctx: TurretContext) {
  const { g, glow, level, charge, kick, energy, color, definition } = ctx,
    { ca, end, P } = geometry(ctx),
    c = definition.color,
    ht = TOP + BEVEL;
  [-6, -4, -2].forEach((p, i) => {
    const on = Math.max(0, Math.min(1, charge * 3 - i));
    if (on <= 0.05) return;
    const [sx0, sy0] = P(p, slatSide(ca), PLATE + 1.8),
      [sx1, sy1] = P(p, slatSide(ca), TOP - 1.6);
    g.lineStyle(0.7, shade(c, -0.2 + 0.4 * on), 1);
    g.lineBetween(sx0, sy0, sx1, sy1);
    glow.lineStyle(2.4, c, 0.25 * on);
    glow.lineBetween(sx0, sy0, sx1, sy1);
  });
  // The next shell slides forward into the breech as the cycle charges.
  const load = Math.max(0, Math.min(1, (charge - 0.2) / 0.8)),
    nose = -1.5 + 4.5 * load;
  if (charge < 1 && kick === 0) {
    const s0 = P(nose - 4.5, -0.9, ht + 0.3),
      s1 = P(nose, -0.9, ht + 0.3),
      s2 = P(nose, 0.9, ht + 0.3),
      s3 = P(nose - 4.5, 0.9, ht + 0.3);
    quad(g, ...s0, ...s1, ...s2, ...s3, 0xc9a25a);
    const n0 = P(nose + 1.4, 0, ht + 0.3);
    g.fillStyle(shade(c, 0.1));
    g.fillTriangle(...s1, ...s2, ...n0);
  }
  if (level >= 2) disc(glow, ...P(-6.5, ca > 0 ? 6 : -6, ht), 2.6, color, 0.35);
  if (kick > 0)
    for (const q of [-2.4, 2.4]) {
      const [vx, vy] = P(-13.2, q, 12.5);
      disc(glow, vx, vy, 3.4, c, 0.4 * kick);
      const drift = 1 - kick,
        [sx, sy] = P(-13.2 - 6 * drift, q * (1 + drift), 12.5 + 9 * drift);
      disc(g, sx, sy, 1.6 + 3.4 * drift, 0x8f989e, 0.45 * kick);
    }
  // Heat in the barrel right after a shot, and a glow on the muzzle from level 5.
  const [mx, my] = P(Math.cos(PITCH) * end, 0, HB + Math.sin(PITCH) * end);
  if (kick > 0) halo(glow, mx, my, 5 * (1.2 + kick), c, 0.3 * kick);
  if (energy > 0) disc(glow, mx, my, 3, c, energy);
}
