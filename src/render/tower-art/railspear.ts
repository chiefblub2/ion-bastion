import type { TiltedArt } from "./tilted";
import { MUZZLES, TILTS } from "../muzzles";
import { halo } from "../material";
import { disc, oval, shade, strokeOval } from "../shapes";
import type { TurretContext } from "./kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround, quad } from "./tilt";
import { GUN, SHADOW_INK, castShadow, depth, framer, lampInk, lampLight, paint, part, rect } from "./tilt-parts";

/**
 * Railspear: Lance's look in the slight 3/4 tilt (see `tilt.ts`): two long rails on a low cradle with a capacitor block
 * at the back and coils clamping the rails, over a round plinth ringed with capacitor cells. The projection lives in
 * `TILTS.rail` and the reach in `MUZZLES.rail`, so the beam leaves between the rails' ends. The plinth (`base`) bakes per
 * level and trim colour; the turret's ink is cached per aim step (`turret`); the capacitor cells (`below`) and the
 * block's lamps, the coils' lights, the charge running between the rails and the muzzle flare (`above`) are live.
 */
const TILT = TILTS.rail,
  SPEC = MUZZLES.rail,
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = SPEC.recoil,
  reach = SPEC.reach;
const PLINTH_R = 19,
  PLINTH_TOP = 3.5,
  RING_TOP = 5.5;
/** Capacitor cells round the back half of the plinth, back to front. */
const CELLS = [Math.PI * 1.5, Math.PI * 1.25, Math.PI * 1.75, Math.PI, 0];
const CELL_R = 15.5,
  CELL_TOP = 10;
const CRADLE = [-10, -5, -7, -6.5, 9, -6.5, 9, 6.5, -7, 6.5, -10, 5],
  CRADLE_TOP = 8.6,
  CAP = rect(-10.5, -4.5, -4.8, 4.8),
  CAP_TOP = 13,
  SKIRTS = [rect(-6, 7, 6.5, 7.6), rect(-6, 7, -7.6, -6.5)];
const RAIL_Q = 3.4,
  RAIL_W = 1.15,
  RAIL_LOW = 8.6,
  RAIL_TOP = 11.2;
const coils = (level: number) => (level >= 3 ? [2.5, 10, 17.5] : [4, 12.5]);

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, PLINTH_R + 8, PLINTH_R + 3, SHADOW_INK, 0.2);
    oval(g, 1.5, 2.5, PLINTH_R + 1, PLINTH_R, SHADOW_INK, 0.36);
  });
  drum(g, x, y0, PLINTH_R, 0, PLINTH_TOP, GUN.side, shade(GUN.top, -0.08), 20);
  onGround(g, x, y0, PLINTH_TOP, () => {
    // A grille in front of the bearing, bolts from level 3, a trim ring from level 4.
    g.fillStyle(GUN.deep, 0.9);
    for (let i = -2; i <= 2; i++) g.fillRect(i * 2.6 - 0.7, 10.5, 1.4, 5);
    if (level >= 4) {
      g.lineStyle(0.8, shade(color, -0.2), 0.9);
      strokeOval(g, 0, 0, 2 * (PLINTH_R - 2.5), 2 * (PLINTH_R - 2.5));
    }
    if (level >= 3)
      for (const t of [Math.PI / 4, (3 * Math.PI) / 4]) disc(g, Math.cos(t) * 16, Math.sin(t) * 16, 1, GUN.deep);
  });
  // Capacitor cells: dark cans with glass tops (lit live).
  for (const t of CELLS) {
    const cx = X(x, Math.cos(t) * CELL_R),
      cy = Y(y0, Math.sin(t) * CELL_R, 0);
    drum(g, cx, cy, 2.9, PLINTH_TOP, CELL_TOP, shade(c, -0.7), shade(c, -0.55), 10);
    oval(g, cx, cy - CELL_TOP, 1.9, 1.9 * SQUASH, shade(c, -0.4));
  }
  drum(g, x, y0, 8.5, PLINTH_TOP, RING_TOP, GUN.deep, shade(GUN.deep, 0.18), 14);
}

/** The turret's ink (cached per aim step and recoil): skirts, cradle, both rails, the capacitor block and the coils. */
function turret(ctx: TurretContext) {
  const { g, x, y, tower, definition, level, kick, tip, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    back = -6 - kick * RECOIL,
    end = reach(level) - kick * RECOIL;
  castShadow(g, x, y0, a, rect(-10.5, end, -6.5, 6.5), PLINTH_TOP, 0.24);
  if (level >= 5) for (const skirt of SKIRTS) part(g, x, y0, a, skirt, RING_TOP, CRADLE_TOP - 0.8, 0, shade(c, -0.6), shade(c, -0.35), c);
  part(g, x, y0, a, CRADLE, RING_TOP, CRADLE_TOP - 1, 1, GUN.side, GUN.top, GUN.metal);
  const parts: [number, () => void][] = [];
  for (const q of [-RAIL_Q, RAIL_Q])
    parts.push([
      depth(a, 0, q) - 100,
      () => {
        part(g, x, y0, a, rect(back, end, q - RAIL_W, q + RAIL_W), RAIL_LOW, RAIL_TOP, 0, shade(c, -0.62), shade(c, -0.32), 0xffffff);
        // Dark band at the muzzle end; the hot tip from level 5.
        part(g, x, y0, a, rect(end - 2.4, end, q - RAIL_W - 0.3, q + RAIL_W + 0.3), RAIL_LOW - 0.3, RAIL_TOP + 0.3, 0, GUN.side, tip ?? GUN.top, GUN.metal);
      },
    ]);
  // The capacitor block on the back of the cradle and the coils clamping both rails.
  parts.push([
    depth(a, -7.5, 0),
    () => {
      part(g, x, y0, a, CAP, CRADLE_TOP - 1, CAP_TOP, 1, shade(c, -0.68), shade(c, -0.5), shade(c, 0.1));
      if (level >= 6) {
        const s = [P(-9.8, -1, CAP_TOP + 1), P(-5.2, -1, CAP_TOP + 1), P(-5.2, 1, CAP_TOP + 1), P(-9.8, 1, CAP_TOP + 1)];
        quad(g, ...s[0], ...s[1], ...s[2], ...s[3], color);
      }
      // The block's lamp from level 2 (its light is live).
      if (level >= 2) lampInk(g, ...lampAt(P, a), color);
    },
  ]);
  // A collar round each rail per coil, so the channel between the rails stays open.
  for (const p of coils(level))
    for (const q of [-RAIL_Q, RAIL_Q])
      parts.push([
        depth(a, p, q),
        () => {
          part(g, x, y0, a, rect(p - 1.1, p + 1.1, q - 2, q + 2), RAIL_LOW - 0.6, RAIL_TOP + 1, 0, GUN.deep, GUN.side, shade(GUN.metal, -0.2));
          if (level >= 3) {
            const [bx, by] = P(p, q + (q > 0 ? 1.1 : -1.1), RAIL_TOP + 1);
            disc(g, bx, by, 0.55, OUTLINE);
          }
        },
      ]);
  paint(parts);
}

/** The block lamp's spot at its back edge, on the side turned to the viewer. */
const lampAt = (P: ReturnType<typeof framer>, a: number) => P(-10.4, Math.cos(a) > 0 ? -3.6 : 3.6, CAP_TOP);

/** Live, under the turret: the capacitor cells' glass, dim at rest and lit with the charge (the rails sweep over them). */
function below({ g, glow, x, y, definition, level, charge, clock }: TurretContext) {
  const c = definition.color,
    y0 = y + DROP;
  // Dim at rest, lit with the charge; from level 4 the light chases round the cells.
  CELLS.forEach((t, i) => {
    const chase = level >= 4 ? 0.4 * Math.max(0, Math.sin(4 * clock - i * 1.3)) : 0,
      on = Math.min(1, 0.2 + 0.8 * Math.max(0, Math.min(1, charge * 5 - i)) * 0.7 + chase),
      cx = X(x, Math.cos(t) * CELL_R),
      cy = Y(y0, Math.sin(t) * CELL_R, CELL_TOP);
    oval(g, cx, cy, 1.5, 1.5 * SQUASH, shade(c, -0.6 + 0.6 * on));
    if (on > 0.35) disc(glow, cx, cy, 2.8, c, 0.25 * on);
  });
}

/**
 * Live, over the turret: three lamps per side on the capacitor block's roof (the highest face) and the coils' lights
 * fill with the charge, the charge runs between the rails, their fronts flare on a shot; the block lamp's light.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, kick, charge, energy, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    back = -6 - kick * RECOIL,
    end = reach(level) - kick * RECOIL;
  // Three lamps per side on the capacitor block fill with the charge; the coils glow one after another.
  for (let i = 0; i < 3; i++) {
    const on = Math.min(1, Math.max(0, charge * 3 - i));
    for (const q of [-3.2, 3.2]) {
      const [lx, ly] = P(-9.3 + i * 1.9, q, CAP_TOP + 1);
      disc(g, lx, ly, 0.6, on > 0 ? shade(c, -0.7 * (1 - on)) : OUTLINE);
    }
  }
  coils(level).forEach((p, i, all) => {
    const on = Math.min(1, Math.max(0, charge * all.length - i));
    if (on <= 0.05) return;
    for (const q of [-RAIL_Q, RAIL_Q]) {
      const [lx, ly] = P(p, q, RAIL_TOP + 1.1);
      disc(g, lx, ly, 0.7, shade(c, -0.5 + 0.5 * on));
      disc(glow, lx, ly, 2.2, c, 0.25 * on);
    }
  });
  // The charge runs between the rails; their fronts flare on a shot.
  const run = back + 2 + (end - back - 4) * charge,
    [r0x, r0y] = P(back + 2, 0, HB),
    [r1x, r1y] = P(run, 0, HB);
  glow.lineStyle(2, c, Math.min(0.5, 0.12 + 0.3 * charge + energy));
  glow.lineBetween(r0x, r0y, r1x, r1y);
  const [mx, my] = P(end, 0, HB);
  if (kick > 0) {
    const [fx, fy] = P(end - 0.3 * (end - back), 0, HB);
    glow.lineStyle(6, c, 0.45 * kick);
    glow.lineBetween(fx, fy, mx, my);
    halo(glow, mx, my, 5 * (1 + kick), c, 0.3 * kick);
  }
  if (energy > 0) disc(glow, mx, my, 2.6, c, energy);
  if (level >= 2) lampLight(glow, ...lampAt(P, a), color);
}

/** Lance's Railspear in the four parts of a tilted tower (`tilted.ts`). */
export const railspear: TiltedArt = { base, below, turret, above };
