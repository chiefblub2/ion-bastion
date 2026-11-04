/**
 * Hydraulic Press: Quake's look in the 3/4 tilt (see `tilt.ts`, projection in `TILTS.hammer`). A low octagonal plinth
 * with a round strike plate and three hydraulic legs leaning in from the sides and the back to a crown over the plate
 * (`base`, baked per level and trim colour); the crown's pressure lights and lamp, the plinth's chasing lights and the
 * strike ring on the plate (`below`); a squat bronze hammer on a short chrome piston that hangs raised and slams onto
 * the plate on every shockwave (`turret`: its height follows `kick` alone, so the cache holds one picture per recoil
 * step); and the plate's flare and the strike dust (`above`). No aim: the tower ignores `tower.angle`, and its pulse is
 * centred on the ground (no barrel and no `emit`).
 */
import { facing, halo } from "../material";
import { disc, oval, ring, shade } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, onGround, quad, tube, turn } from "./tilt";
import { TILTS } from "../muzzles";
import type { TiltedArt } from "./tilted";

const DROP = TILTS.hammer.drop;
/** Heights: plinth, crown, the hammer's raised and struck bottom, its thickness and where the piston meets the crown. */
const SLAB = 4,
  CROWN0 = 23,
  CROWN1 = 26.5,
  RAISED = 8,
  STRUCK = SLAB + 0.3,
  HEAD = 5,
  PISTON_TOP = 17.8;
/** Gunmetal, its top, the metallic highlight, the deep plate and the chrome of the pistons. */
const WALL = 0x3a3631,
  TOP = 0x585049,
  METAL = 0x9c8f82,
  DEEP = 0x17130f,
  CHROME = 0xc9d2d6;
/** The plinth: a regular octagon with a flat face towards the viewer. */
const OCT = Array.from({ length: 16 }, (_, i) => {
  const k = Math.floor(i / 2),
    a = Math.PI / 8 + (k * Math.PI) / 4;
  return (i % 2 ? Math.sin : Math.cos)(a) * 20;
});
/** Strike plate radius and the hammer head radius. */
const PLATE = 9,
  HAMMER = 7.8,
  CROWN_R = 5.5;
/** Hydraulic legs: ground angle of each foot (left, right, back), the foot radius and the crown radius they reach. */
const LEGS = [Math.PI, 0, -Math.PI / 2],
  FOOT_R = 16.5,
  TOP_R = 4.5,
  RISE = CROWN0 + 0.5;
const legPitch = Math.atan2(RISE, FOOT_R - TOP_R),
  legLength = Math.sqrt(RISE * RISE + (FOOT_R - TOP_R) ** 2);
/** Knuckle footprint at each foot. */
const KNUCKLE = [-2.6, -2.6, 2.6, -2.6, 2.6, 2.6, -2.6, 2.6];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 6, 25, 21, 0x050b10, 0.22);
    oval(g, 2, 2, 20, 19, 0x050b10, 0.35);
  });
  let n = turn(OCT, 0, FOOT);
  turn(OCT, 0, INSET, 0.9);
  block(g, x, y0, FOOT, INSET, n, 0, SLAB - 1, 1, WALL, TOP, METAL);
  // The strike plate: a dark ring, a bronze-tinted plate, cracks running out of it, bolts and from level 4 an inlay.
  onGround(g, x, y0, SLAB, () => {
    disc(g, 0, 0, PLATE + 1.4, DEEP, 0.95);
    disc(g, 0, 0, PLATE, shade(c, -0.55));
    ring(g, 0, 0, PLATE - 2.5, 0.8, shade(c, -0.7), 0.9);
    for (const lip of [0.7, 0]) {
      g.lineStyle(lip ? 0.8 : 1.3, lip ? shade(TOP, 0.35) : DEEP, 0.9);
      for (const [a, b, r1] of [
        [-0.5, 0.15, 16],
        [0.9, -0.2, 15.5],
        [2.5, 0.2, 16],
        [3.8, -0.15, 15],
      ]) {
        const r0 = PLATE + 1.4;
        g.beginPath();
        g.moveTo(Math.cos(a) * r0 + lip, Math.sin(a) * r0 + lip);
        g.lineTo(Math.cos(a + b) * (r0 + 3) + lip, Math.sin(a + b) * (r0 + 3) + lip);
        g.lineTo(Math.cos(a - b) * r1 + lip, Math.sin(a - b) * r1 + lip);
        g.strokePath();
      }
    }
    if (level >= 4) ring(g, 0, 0, PLATE + 2.6, 0.8, shade(color, -0.2), 0.95);
    const bolts = level >= 3 ? [1, 3, 5, 7] : [1, 3];
    for (const k of bolts) {
      const a = (k * Math.PI) / 4,
        bx = Math.cos(a) * 16.5,
        by = Math.sin(a) * 16.5;
      disc(g, bx, by, 1.4, shade(WALL, -0.45));
      disc(g, bx - 0.35, by - 0.35, 0.6, METAL, 0.9);
    }
  });
  // Hydraulic legs, the back one first: a knuckle on the plinth, a dark cylinder (armoured from level 5) and a
  // chrome rod up into the crown.
  for (const t of [LEGS[2], LEGS[0], LEGS[1]]) {
    const fu = Math.cos(t) * FOOT_R,
      fv = Math.sin(t) * FOOT_R,
      a = t + Math.PI,
      px = X(x, fu),
      py = y0 + fv * SQUASH;
    n = turn(KNUCKLE, t, FOOT, 1, 0, fu, fv);
    block(g, x, y0, FOOT, FOOT, n, SLAB - 0.5, SLAB + 2.5, 0, shade(WALL, -0.1), TOP, METAL);
    tube(g, px, py, a, SLAB + 1.5, 0, legLength * 0.55, level >= 5 ? 2.5 : 2, level >= 5 ? shade(c, -0.45) : WALL, 1, true, legPitch);
    tube(g, px, py, a, SLAB + 1.5, legLength * 0.5, legLength * 0.56, level >= 5 ? 2.7 : 2.2, shade(c, -0.1), 1, false, legPitch);
    tube(g, px, py, a, SLAB + 1.5, legLength * 0.55, legLength - 1, 1.1, CHROME, 1, true, legPitch);
  }
  // The crown over the plate, with a trim band in the tower's (from level 6 the path's) colour.
  drum(g, x, y0, CROWN_R + 1, CROWN0 - 1, CROWN0, shade(WALL, -0.2), shade(WALL, 0), 10);
  drum(g, x, y0, CROWN_R, CROWN0, CROWN1, WALL, TOP, 10);
  for (let i = 0; i < 10; i++) {
    const t0 = (i / 10) * Math.PI,
      t1 = ((i + 1) / 10) * Math.PI,
      h = CROWN0 + 1.2;
    quad(
      g,
      X(x, Math.cos(t0) * CROWN_R), Y(y0, Math.sin(t0) * CROWN_R, h),
      X(x, Math.cos(t1) * CROWN_R), Y(y0, Math.sin(t1) * CROWN_R, h),
      X(x, Math.cos(t1) * CROWN_R), Y(y0, Math.sin(t1) * CROWN_R, h + 0.9),
      X(x, Math.cos(t0) * CROWN_R), Y(y0, Math.sin(t0) * CROWN_R, h + 0.9),
      shade(level >= 6 ? color : c, -0.1 + 0.25 * facing((t0 + t1) / 2)),
    );
  }
  disc(g, x, Y(y0, 0, CROWN1), 1.6, shade(WALL, -0.4));
}

/** Height of the hammer's bottom: hanging raised at rest, down on the plate right after a strike. */
const headBottom = (kick: number) => STRUCK + (RAISED - STRUCK) * (1 - kick);

function turret({ g, x, y, definition, level, kick, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    h0 = headBottom(kick),
    h1 = h0 + HEAD,
    k = (h0 - STRUCK) / (RAISED - STRUCK),
    trim = level >= 6 ? color : shade(c, 0.15);
  // The hammer's shadow on the plate, sharper and closer the lower it hangs.
  onGround(g, x, y0, SLAB, () => oval(g, 1.5 + 3 * k, 1.5 + 3.5 * k, HAMMER - 0.5 * k, HAMMER - 0.5 * k, 0x050b10, 0.5 - 0.2 * k));
  // The piston, then the head: a dark striking shoe, the bronze body with hazard stripes on its front and a trim rim.
  tube(g, x, y0, 0, h1, 0, PISTON_TOP - h1, 1.8, CHROME, 1, true, Math.PI / 2);
  tube(g, x, y0, 0, h1, 0, 1.4, 2.6, shade(WALL, -0.1), 1, false, Math.PI / 2);
  drum(g, x, y0, HAMMER + 0.4, h0, h0 + 1.4, DEEP, shade(DEEP, 0.25), 14);
  drum(g, x, y0, HAMMER, h0 + 1.4, h1, shade(c, -0.2), shade(c, 0.08), 14);
  for (const t of [0.75, 1.2, 1.65, 2.1, 2.55]) {
    const t1 = t + 0.18;
    quad(
      g,
      X(x, Math.cos(t) * (HAMMER + 0.05)), Y(y0, Math.sin(t) * HAMMER, h0 + 1.7),
      X(x, Math.cos(t1) * (HAMMER + 0.05)), Y(y0, Math.sin(t1) * HAMMER, h0 + 1.7),
      X(x, Math.cos(t1 + 0.22) * (HAMMER + 0.05)), Y(y0, Math.sin(t1 + 0.22) * HAMMER, h1 - 0.5),
      X(x, Math.cos(t + 0.22) * (HAMMER + 0.05)), Y(y0, Math.sin(t + 0.22) * HAMMER, h1 - 0.5),
      DEEP,
    );
  }
  oval(g, x, Y(y0, 0, h1), HAMMER - 0.6, (HAMMER - 0.6) * SQUASH, trim);
  oval(g, x, Y(y0, 0, h1), HAMMER - 1.8, (HAMMER - 1.8) * SQUASH, shade(c, 0.08));
  if (level >= 3)
    for (const t of [Math.PI * 0.85, Math.PI * 0.15, -Math.PI / 2]) {
      const bx = X(x, Math.cos(t) * (HAMMER - 1.2)),
        by = Y(y0, Math.sin(t) * (HAMMER - 1.2), h1);
      oval(g, bx, by, 0.9, 0.9, shade(c, -0.6));
      oval(g, bx - 0.3, by - 0.3, 0.4, 0.4, METAL);
    }
  // The piston collar on the head's top.
  tube(g, x, y0, 0, h1, 0, 1, 2.4, shade(WALL, 0.1), 1, false, Math.PI / 2);
}

/**
 * Live, under the turret: pressure lights on the crown's front (one more per fifth of the charge), the crown lamp from
 * level 2, the plinth's chasing lights from level 4, and the ring running out over the plate on a strike (under the
 * hammer that just landed).
 */
function below({ g, glow, x, y, definition, level, kick, charge, energy, clock, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    lit = Math.floor(charge * 5 + 0.001);
  for (let i = 0; i < 5; i++) {
    const t = Math.PI * (0.2 + 0.15 * i),
      lx = X(x, Math.cos(t) * (CROWN_R + 0.1)),
      ly = Y(y0, Math.sin(t) * CROWN_R, (CROWN0 + CROWN1) / 2 + 0.4),
      on = i < lit;
    disc(g, lx, ly, 0.75, on ? shade(c, 0.35) : shade(c, -0.65));
    if (on) disc(glow, lx, ly, 2, c, Math.min(0.45, 0.2 + energy + 0.1 * charge));
  }
  if (level >= 2) {
    const ly = Y(y0, 0, CROWN1) - 0.6;
    disc(g, x, ly, 1.2, OUTLINE);
    disc(g, x, ly, 0.75, shade(color, 0.2));
    disc(glow, x, ly, 2.4, color, 0.35);
  }
  if (level >= 4)
    [-6, 0, 6].forEach((u, i) => {
      const on = 0.25 + 0.75 * Math.max(0, Math.sin(4 * clock - i * 1.3)),
        lx = X(x, u),
        ly = Y(y0, 18.5, SLAB / 2);
      quad(g, lx - 1.2, ly - 0.6, lx + 1.2, ly - 0.6, lx + 1.2, ly + 0.6, lx - 1.2, ly + 0.6, shade(color, -0.6 + 0.7 * on));
      if (on > 0.5) disc(glow, lx, ly, 2.2, color, 0.3 * on);
    });
  if (kick > 0) onGround(g, x, y0, SLAB, () => ring(g, 0, 0, 11 + 10 * (1 - kick), 1 + 1.5 * kick, shade(c, 0.4), 0.7 * kick));
}

/** Live, over the turret: on a strike the plate flares and dust puffs out round the hammer. */
function above({ g, glow, x, y, definition, kick }: TurretContext) {
  if (kick <= 0) return;
  const y0 = y + DROP,
    c = definition.color,
    spread = 1 - kick;
  onGround(glow, x, y0, SLAB, () => halo(glow, 0, 0, 11 + 6 * spread, c, 0.4 * kick));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2,
      r = 11 + 7 * spread;
    disc(g, X(x, Math.cos(a) * r), Y(y0, Math.sin(a) * r, SLAB + 2 * spread), 1.6 + 2.6 * spread, 0x9c8f82, 0.5 * kick);
  }
}

/** Quake's Hydraulic Press in the four parts of a tilted tower (`tilted.ts`). */
export const hydraulicPress: TiltedArt = { base, below, turret, above };
