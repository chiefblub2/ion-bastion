import { halo, LIGHT } from "../render/material";
import { arcBand, disc, oval, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround, quad, towardViewer, tube, endFace } from "../render/tower-art/tilt";
import type { Concept } from "./types";
import { GUN, SHADOW_INK, castShadow, depth, framer, lamp, paint, part, rect } from "./flak";

// Shrapnel: the Scattergun, a squat fan-fronted housing on a round pedestal, its short barrels spread in a fan and fed
// by a revolver drum at the back that turns one chamber per salvo.
const TILT = { drop: 5, squash: SQUASH, height: 11, deck: 5 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 3,
  reach = (l: number) => 15 + l,
  fan = (l: number) => ({ count: l >= 4 ? 5 : 3, step: 0.32 });
const PED_R = 18,
  PED_TOP = 5,
  BEAR_TOP = 7;
/** Vent slots on the pedestal's front wall (angles on the ground). */
const VENTS = [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => Math.PI * f);
/** The housing: narrow at the back, spreading into the wide front the barrels leave from. */
const HOUSING = [-7, -6.5, 4, -10.5, 8.5, -9, 8.5, 9, 4, 10.5, -7, 6.5];
const H_BASE = BEAR_TOP,
  H_TOP = 13.5;
const PLATES = [
  [1, -11.6, 7.5, -10.2, 7.5, -9.2, 1, -10.4],
  [1, 10.4, 7.5, 9.2, 7.5, 10.2, 1, 11.6],
];
const DRUM_AT = -8.5,
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
  parts.push([
    depth(a, 1, 0),
    () => {
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, H_BASE + 1, H_TOP - 1.5, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.35));
      part(g, x, y0, a, HOUSING, H_BASE, H_TOP, 1.5, shade(c, -0.5), shade(c, -0.15), shade(c, 0.4));
      const ht = H_TOP + 1.5;
      // A seam across the roof, bolts from level 3 and a trim stripe in the path colour from level 6.
      const s0 = P(-2, -6.8, ht),
        s1 = P(-2, 6.8, ht);
      g.lineStyle(0.7, shade(c, -0.75), 0.9);
      g.lineBetween(s0[0], s0[1], s1[0], s1[1]);
      if (level >= 3)
        for (const q of [-5.5, 5.5]) {
          const [bx, by] = P(4.5, q, ht);
          disc(g, bx, by, 0.8, OUTLINE);
          disc(g, bx - 0.3, by - 0.3, 0.35, GUN.metal);
        }
      if (level >= 6) {
        const t = [P(5.6, -7.4, ht), P(6.6, -7.8, ht), P(6.6, 7.8, ht), P(5.6, 7.4, ht)];
        quad(g, ...t[0], ...t[1], ...t[2], ...t[3], color);
      }
    },
  ]);
  for (let i = 0; i < count; i++) {
    const b = a + (i - (count - 1) / 2) * step;
    parts.push([
      depth(b, end * 0.6, 0) + 0.01 * i,
      () => {
        tube(g, x, y0, b, HB, 5 + back, end - 2.6, 1.95, shade(c, -0.15), 1, true);
        if (level >= 3) tube(g, x, y0, b, HB, (5 + end) / 2 - 0.5, (5 + end) / 2 + 0.5, 2.05, shade(c, -0.55), 1, false);
        tube(g, x, y0, b, HB, end - 2.6, end, 2.45, shade(GUN.side, -0.05), 1, true);
        if (tip !== undefined) tube(g, x, y0, b, HB, end - 1, end, 2.45, tip, 1, false);
        if (towardViewer(b) > 0.05) {
          endFace(g, x, y0, b, HB, end, 2.45, shade(GUN.side, -0.4));
          endFace(g, x, y0, b, HB, end, 1.2, OUTLINE);
        }
      },
    ]);
  }
  paint(parts);
}

function live(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, kick, charge, energy, clock, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    { count, step } = fan(level);
  // Pedestal vents: hot after a salvo; from level 4 a light chases along them.
  VENTS.forEach((t, i) => {
    const vx = X(x, Math.cos(t) * (PED_R + 0.2)),
      vy = Y(y0, Math.sin(t) * (PED_R + 0.2), PED_TOP / 2),
      chase = level >= 4 ? 0.6 * Math.max(0, Math.sin(4 * clock - i * 1.1)) : 0,
      on = Math.min(1, Math.max(kick, chase * 0.8, 0.15));
    quad(g, vx - 1, vy - 0.5, vx + 1, vy - 0.5, vx + 1, vy + 0.5, vx - 1, vy + 0.5, shade(kick > chase ? c : color, -0.6 + 0.7 * on));
    if (on > 0.4) disc(glow, vx, vy, 2.6, kick > chase ? c : color, 0.3 * on);
  });
  // The revolver drum's chambers on its top, turning one chamber per salvo with the charge; the loaded one glows.
  const [dx, dy] = P(DRUM_AT, 0, DRUM_TOP);
  for (let k = 0; k < 6; k++) {
    const t = a + charge * (Math.PI / 3) + (k * Math.PI) / 3,
      cx = dx + Math.cos(t) * 2.6,
      cy = dy + Math.sin(t) * 2.6 * SQUASH;
    disc(g, cx, cy, 0.75, k === 0 && charge > 0.9 ? shade(c, 0.4) : OUTLINE);
  }
  if (charge > 0.9) disc(glow, dx, dy, 3, c, 0.25);
  if (level >= 2) {
    const [lx, ly] = P(-6, Math.cos(a) > 0 ? 5 : -5, H_TOP + 1.6);
    lamp(g, glow, lx, ly, color);
  }
  for (let i = 0; i < count; i++) {
    const b = a + (i - (count - 1) / 2) * step,
      mx = X(x, Math.cos(b) * end),
      my = Y(y0, Math.sin(b) * end, HB);
    if (kick > 0) halo(glow, mx, my, 3.5 * (1 + kick), c, 0.28 * kick);
    if (energy > 0) disc(glow, mx, my, 2, c, energy);
  }
}

export const concept: Concept = {
  tower: "shrapnel",
  name: "Scattergun",
  idea: "Fan-fronted housing on a round pedestal: 3 (L4: 5) short barrels in a fan, a revolver drum at the back turns a chamber per salvo; vents flare.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  fan,
  base,
  turret,
  live,
};
