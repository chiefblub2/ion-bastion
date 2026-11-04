import type { TiltedArt } from "./tilted";
import { MUZZLES, TILTS } from "../muzzles";
import { halo, LIGHT } from "../material";
import { arcBand, disc, oval, shade } from "../shapes";
import type { TurretContext } from "./kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround, quad, towardViewer, tube, endFace } from "./tilt";
import { GUN, SHADOW_INK, castShadow, depth, framer, lampInk, lampLight, paint, part } from "./tilt-parts";

/**
 * Scattergun: Shrapnel's look in the slight 3/4 tilt (see `tilt.ts`): a breech block with a revolver drum at the back and
 * a low fan-shaped deck in front, its short barrels spread in a fan (3, from level 4 five), on a round pedestal. The
 * projection lives in `TILTS.scatter` and the fan in `MUZZLES.scatter`, so every barrel flashes. The pedestal (`base`)
 * bakes per level and trim colour; the turret's ink is cached per aim step (`turret`); the pedestal's vents (`below`)
 * and the drum's chambers, the lamp's light and the hot muzzles (`above`) are live.
 */
const TILT = TILTS.scatter,
  SPEC = MUZZLES.scatter,
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = SPEC.recoil,
  reach = SPEC.reach,
  fan = SPEC.fan!;
const PED_R = 18,
  PED_TOP = 5,
  BEAR_TOP = 7;
/** Vent slots on the pedestal's front wall (angles on the ground). */
const VENTS = [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => Math.PI * f);
/** The housing: a tall breech block at the back, then a low fan-shaped deck the barrels lie on, so the fan shows. */
const HOUSING = [-7, -6.5, -1, -8.5, 2.5, -8.5, 2.5, 8.5, -1, 8.5, -7, 6.5];
const DECK = [2, -8.5, 7, -11.5, 10, -9.5, 10, 9.5, 7, 11.5, 2, 8.5];
const H_BASE = BEAR_TOP,
  H_TOP = 12.5,
  DECK_TOP = 8.6;
/** Barrel radius, the muzzle collar's and where the barrels leave the breech. */
const BR = 2.3,
  COLLAR = 2.9,
  FROM = 1.5;
const PLATES = [
  [-5, -9.6, 1.5, -9.6, 1.5, -8.6, -5, -8],
  [-5, 8, 1.5, 8.6, 1.5, 9.6, -5, 9.6],
];
const DRUM_AT = -9,
  DRUM_R = 5.2,
  DRUM_TOP = 16;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, PED_R + 7, PED_R + 3, SHADOW_INK, 0.2);
    oval(g, 1.5, 2.5, PED_R + 1, PED_R, SHADOW_INK, 0.36);
  });
  drum(g, x, y0, PED_R, 0, PED_TOP, GUN.side, shade(GUN.top, -0.05), 20);
  // Vent sockets in the front wall; they glow after a salvo (live).
  for (const t of VENTS) {
    const vx = X(x, Math.cos(t) * (PED_R + 0.1)),
      vy = Y(y0, Math.sin(t) * (PED_R + 0.1), PED_TOP / 2);
    quad(g, vx - 1.6, vy - 1.1, vx + 1.6, vy - 1.1, vx + 1.6, vy + 1.1, vx - 1.6, vy + 1.1, GUN.deep);
  }
  onGround(g, x, y0, PED_TOP, () => {
    // A steel ring with the tower's colour around the bearing; bolts from level 3, a trim inlay from level 4.
    arcBand(g, 0, 0, PED_R - 2.5, 1.8, 0, Math.PI * 2, shade(c, -0.35), 0.9);
    arcBand(g, 0, 0, PED_R - 2.3, 0.7, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.35), 0.8);
    if (level >= 4) arcBand(g, 0, 0, PED_R - 5.2, 0.8, 0, Math.PI * 2, shade(color, -0.2), 0.9);
    const bolts = level >= 3 ? 8 : 4;
    for (let i = 0; i < bolts; i++) {
      const t = Math.PI / 8 + (i * Math.PI * 2) / bolts;
      disc(g, Math.cos(t) * (PED_R - 2.5), Math.sin(t) * (PED_R - 2.5), 1.1, GUN.deep);
    }
  });
  drum(g, x, y0, 10, PED_TOP, BEAR_TOP, GUN.deep, shade(GUN.deep, 0.18), 14);
}

/** The turret's ink (cached per aim step and recoil): the drum, deck, breech block and the fanned barrels, back to front. */
function turret(ctx: TurretContext) {
  const { g, x, y, tower, definition, level, kick, tip, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    back = -kick * RECOIL,
    end = reach(level) + back,
    { count, step } = fan(level);
  castShadow(g, x, y0, a, HOUSING, BEAR_TOP, 0.24);
  const parts: [number, () => void][] = [];
  // The revolver drum at the back: an upright cylinder.
  parts.push([
    depth(a, DRUM_AT, 0),
    () => {
      const [dx, dy] = P(DRUM_AT, 0, 0);
      drum(g, dx, dy, DRUM_R, H_BASE, DRUM_TOP, GUN.side, shade(GUN.top, 0.05), 14);
      onGround(g, dx, dy, DRUM_TOP, () => {
        disc(g, 0, 0, DRUM_R - 1.2, shade(GUN.deep, 0.1));
        disc(g, 0, 0, 1.4, shade(c, -0.3));
      });
    },
  ]);
  // The low fan deck in front, lighter than the breech: the barrels lie along it.
  parts.push([
    depth(a, 5, 0) - 0.5,
    () => {
      part(g, x, y0, a, DECK, H_BASE, DECK_TOP, 0.8, shade(c, -0.4), shade(c, 0.12), shade(c, 0.5));
      if (level >= 6) {
        const t = [P(8.6, -9.8, DECK_TOP + 0.8), P(9.6, -9.6, DECK_TOP + 0.8), P(9.6, 9.6, DECK_TOP + 0.8), P(8.6, 9.8, DECK_TOP + 0.8)];
        quad(g, ...t[0], ...t[1], ...t[2], ...t[3], color);
      }
    },
  ]);
  parts.push([
    depth(a, -3, 0),
    () => {
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, H_BASE + 1, H_TOP - 1.5, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.35));
      part(g, x, y0, a, HOUSING, H_BASE, H_TOP, 1.5, shade(c, -0.5), shade(c, -0.15), shade(c, 0.4));
      const ht = H_TOP + 1.5;
      // A seam across the roof, bolts from level 3 and a trim stripe in the path colour from level 6.
      const s0 = P(-3, -7, ht),
        s1 = P(-3, 7, ht);
      g.lineStyle(0.7, shade(c, -0.75), 0.9);
      g.lineBetween(s0[0], s0[1], s1[0], s1[1]);
      if (level >= 3)
        for (const q of [-5.5, 5.5]) {
          const [bx, by] = P(0.5, q, ht);
          disc(g, bx, by, 0.8, OUTLINE);
          disc(g, bx - 0.3, by - 0.3, 0.35, GUN.metal);
        }
      // The housing's lamp from level 2 (its light is live).
      if (level >= 2) lampInk(g, ...lampAt(P, a), color);
    },
  ]);
  for (let i = 0; i < count; i++) {
    const b = a + (i - (count - 1) / 2) * step;
    parts.push([
      depth(b, end * 0.6, 0) + 0.01 * i,
      () => {
        tube(g, x, y0, b, HB, FROM + back, end - 3, BR, shade(GUN.side, 0.35), 1, true);
        if (level >= 3) tube(g, x, y0, b, HB, (FROM + end) / 2 - 0.6, (FROM + end) / 2 + 0.6, BR + 0.2, shade(GUN.deep, 0.1), 1, false);
        // A collar in the tower's colour at every muzzle, so the fan reads at a glance.
        tube(g, x, y0, b, HB, end - 3, end, COLLAR, shade(c, 0.2), 1, true);
        if (tip !== undefined) tube(g, x, y0, b, HB, end - 1, end, COLLAR, tip, 1, false);
        if (towardViewer(b) > 0.05) {
          endFace(g, x, y0, b, HB, end, COLLAR, shade(c, -0.25));
          endFace(g, x, y0, b, HB, end, 1.3, OUTLINE);
        }
      },
    ]);
  }
  paint(parts);
}

/** The housing lamp's spot on the roof, on the side turned to the viewer. */
const lampAt = (P: ReturnType<typeof framer>, a: number) => P(-6, Math.cos(a) > 0 ? 5 : -5, H_TOP + 1.6);

/** Live, under the turret: the pedestal's vents, hot after a salvo; from level 4 a light chases along them. */
function below({ g, glow, x, y, definition, level, kick, clock, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  VENTS.forEach((t, i) => {
    const vx = X(x, Math.cos(t) * (PED_R + 0.2)),
      vy = Y(y0, Math.sin(t) * (PED_R + 0.2), PED_TOP / 2),
      chase = level >= 4 ? 0.6 * Math.max(0, Math.sin(4 * clock - i * 1.1)) : 0,
      on = Math.min(1, Math.max(kick, chase * 0.8, 0.15));
    quad(g, vx - 1, vy - 0.5, vx + 1, vy - 0.5, vx + 1, vy + 0.5, vx - 1, vy + 0.5, shade(kick > chase ? c : color, -0.6 + 0.7 * on));
    if (on > 0.4) disc(glow, vx, vy, 2.6, kick > chase ? c : color, 0.3 * on);
  });
}

/**
 * Live, over the turret: the revolver drum's chambers on its top (the highest face), turning one chamber per salvo
 * with the charge, the loaded one glowing; the lamp's light and the hot muzzles.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, kick, charge, energy, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    { count, step } = fan(level);
  const [dx, dy] = P(DRUM_AT, 0, DRUM_TOP);
  for (let k = 0; k < 6; k++) {
    const t = a + charge * (Math.PI / 3) + (k * Math.PI) / 3,
      cx = dx + Math.cos(t) * 2.6,
      cy = dy + Math.sin(t) * 2.6 * SQUASH;
    disc(g, cx, cy, 0.75, k === 0 && charge > 0.9 ? shade(c, 0.4) : OUTLINE);
  }
  if (charge > 0.9) disc(glow, dx, dy, 3, c, 0.25);
  if (level >= 2) lampLight(glow, ...lampAt(P, a), color);
  for (let i = 0; i < count; i++) {
    const b = a + (i - (count - 1) / 2) * step,
      mx = X(x, Math.cos(b) * end),
      my = Y(y0, Math.sin(b) * end, HB);
    if (kick > 0) halo(glow, mx, my, 3.5 * (1 + kick), c, 0.28 * kick);
    if (energy > 0) disc(glow, mx, my, 2, c, energy);
  }
}

/** Shrapnel's Scattergun in the four parts of a tilted tower (`tilted.ts`). */
export const scattergun: TiltedArt = { base, below: below, turret: turret, above: above };
