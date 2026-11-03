import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, endFace, onGround, towardViewer, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, depth, framer, lampInk, lampLight, paint, part, rect } from "../render/tower-art/tilt-parts";
import { contact, crossTube, ground, slab } from "./kit-control-b";
import type { Concept } from "./types";

// Tether: the Grapple Winch. A square deck with two mooring bollards; on it turns a carriage with a big winch drum of
// green chain across its back and a launch barrel whose three-pronged claw flies off on a shot (the chain pays out).
const TILT = { drop: 5, squash: 0.65, height: 11, deck: 4.6 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 4,
  reach = (l: number) => 17 + l;
const DECK = 4,
  CARRIAGE = 8.5,
  DRUM_P = -6,
  DRUM_H = 12.5,
  DRUM_R = 3.6;
const SQUARE = [-18, -15, -15, -18, 15, -18, 18, -15, 18, 15, 15, 18, -15, 18, -18, 15];
const CARRIAGE_SHAPE = [-10, -6.5, 5, -6.5, 7, -4, 7, 4, 5, 6.5, -10, 6.5];
const CHEEKS = [rect(-9.5, -2.5, 5.2, 6.6), rect(-9.5, -2.5, -6.6, -5.2)];
const PLATES = [rect(-1, 5, 6.5, 7.6), rect(-1, 5, -7.6, -6.5)];
/** Bollards at the deck's back corners and the deck's front lights. */
const BOLLARDS = [
  [-12.5, -12.5],
  [12.5, -12.5],
];
const LIGHTS = [-9, -3, 3, 9];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 19);
  slab(g, x, y0, SQUARE, 0, DECK, 1, GUN.side, GUN.top, GUN.metal);
  // Hazard stripes along the front edge, the tower's green on dark.
  onGround(g, x, y0, DECK + 1, () => {
    for (let i = -3; i <= 3; i++) {
      g.fillStyle(i % 2 ? GUN.deep : shade(c, -0.35));
      g.fillRect(i * 3.6 - 1.8, 13.2, 3.6, 2);
    }
  });
  for (const [u, v] of BOLLARDS) {
    const [bx, by] = ground(x, y0, u, v);
    drum(g, bx, by, 2.2, DECK + 1, DECK + 4.5, GUN.side, GUN.top, 10);
    drum(g, bx, by, 2.9, DECK + 4.5, DECK + 5.4, GUN.deep, shade(GUN.side, 0.2), 10);
  }
  for (const u of LIGHTS) {
    const lx = X(x, u),
      ly = Y(y0, 18, DECK / 2);
    disc(g, lx, ly, 1.1, OUTLINE);
    disc(g, lx, ly, 0.7, shade(color, -0.55));
  }
  if (level >= 3)
    onGround(g, x, y0, DECK + 1, () => {
      for (const [u, v] of [[-15, 15], [15, 15], [-15, -15], [15, -15]]) {
        disc(g, u * 0.86, v * 0.86, 0.9, OUTLINE);
        disc(g, u * 0.86 - 0.3, v * 0.86 - 0.3, 0.4, GUN.metal);
      }
    });
  if (level >= 4) onGround(g, x, y0, DECK + 1, () => {
    g.lineStyle(0.8, shade(color, -0.3), 0.9);
    g.strokeRect(-13.5, -13.5, 27, 27);
  });
}

/** From level 4 the lights on the deck's front face chase (the carriage may swing over them). */
function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP;
  LIGHTS.forEach((u, i) => {
    const on = Math.max(0, Math.sin(4 * clock - i * 1.2)),
      lx = X(x, u),
      ly = Y(y0, 18, DECK / 2);
    disc(g, lx, ly, 0.7, shade(color, -0.55 + 0.75 * on));
    if (on > 0.4) disc(glow, lx, ly, 2.4, color, 0.3 * on);
  });
}

/** The carriage, the chain drum across its back and the launch barrel with its claw, back to front. Ink only. */
function turret({ g, x, y, tower, level, kick, tip, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  castShadow(g, x, y0, a, CARRIAGE_SHAPE, DECK, 0.28);
  const carriage = () => {
      part(g, x, y0, a, CARRIAGE_SHAPE, DECK + 0.5, CARRIAGE, 1, GUN.side, GUN.top, GUN.metal);
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, DECK + 1.5, CARRIAGE - 0.5, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.3));
      if (level >= 2) lampInk(g, ...P(3, Math.cos(a) > 0 ? 4.6 : -4.6, CARRIAGE + 1), color);
    },
    winch = () => {
      // Cheeks hold the drum; the chain is wound in green bands, the drum's ends are steel.
      const cheeks = Math.cos(a) > 0 ? [1, 0] : [0, 1];
      part(g, x, y0, a, CHEEKS[cheeks[0]], CARRIAGE, DRUM_H + 2.5, 0, GUN.side, GUN.top, GUN.metal);
      crossTube(g, x, y0, a, DRUM_P, DRUM_H, -5, 5, DRUM_R, shade(c, -0.25), GUN.metal);
      for (const q of [-3.5, -1.2, 1.2, 3.5]) crossTube(g, x, y0, a, DRUM_P, DRUM_H, q - 0.5, q + 0.5, DRUM_R + 0.35, shade(c, -0.55), shade(c, -0.55), false);
      part(g, x, y0, a, CHEEKS[cheeks[1]], CARRIAGE, DRUM_H + 2.5, 0, GUN.side, GUN.top, GUN.metal);
    },
    barrel = () => {
      tube(g, x, y0, a, HB, 2, end - 2, 2.2, GUN.side);
      tube(g, x, y0, a, HB, end - 3.5, end - 2, 2.7, shade(c, -0.4));
      if (tip !== undefined) tube(g, x, y0, a, HB, end - 2.6, end - 2, 2.7, tip, 1, false);
      if (towardViewer(a) > 0.05) endFace(g, x, y0, a, HB, end - 2, 2.2, OUTLINE);
      // The claw: three prongs on the muzzle; it is gone right after a shot (it flew off on its chain).
      if (kick < 0.5) {
        const [hx, hy] = P(end - 2, 0, HB);
        g.lineStyle(2.4, OUTLINE, 0.95);
        for (const [q, h] of [[2.2, 0], [-2.2, 0], [0, 2.4]]) {
          const [mx, my] = P(end + 0.5, q * 1.2, HB + h * 1.2),
            [tx, ty] = P(end + 2.5, q * 0.6, HB + h * 0.6);
          g.lineBetween(hx, hy, mx, my);
          g.lineBetween(mx, my, tx, ty);
        }
        g.lineStyle(1.2, level >= 6 ? color : GUN.metal, 1);
        for (const [q, h] of [[2.2, 0], [-2.2, 0], [0, 2.4]]) {
          const [mx, my] = P(end + 0.5, q * 1.2, HB + h * 1.2),
            [tx, ty] = P(end + 2.5, q * 0.6, HB + h * 0.6);
          g.lineBetween(hx, hy, mx, my);
          g.lineBetween(mx, my, tx, ty);
        }
      }
    };
  paint([
    [depth(a, -2, 0) - 100, carriage],
    [depth(a, DRUM_P, 0), winch],
    [depth(a, 9, 0), barrel],
  ]);
}

/** The chain links glinting as the winch tensions, the lamp's light, the muzzle's flare after a launch. */
function above({ g, glow, x, y, tower, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  if (level >= 2) lampLight(glow, ...P(3, Math.cos(a) > 0 ? 4.6 : -4.6, CARRIAGE + 1), color);
  // A glint runs over the drum's top as the winch tensions.
  const run = ((clock * (1 + 2 * charge)) % 1) * 10 - 5,
    [gx, gy] = P(DRUM_P, run, DRUM_H + DRUM_R * 0.9);
  disc(glow, gx, gy, 2.2, c, 0.15 + 0.25 * charge + energy);
  // After a launch the chain pays out from the drum to beyond the muzzle.
  if (kick > 0) {
    const [dx, dy] = P(DRUM_P + 2, 0, DRUM_H + 1),
      [mx, my] = P(end + 6 * (1 - kick) + 2, 0, HB);
    g.lineStyle(1.4, OUTLINE, 0.9 * kick);
    g.lineBetween(dx, dy, mx, my);
    g.lineStyle(0.8, shade(c, 0.2), kick);
    g.lineBetween(dx, dy, mx, my);
    halo(glow, mx, my, 4 * (1 + kick), c, 0.28 * kick);
  }
}

export const concept: Concept = {
  tower: "tether",
  name: "Grapple Winch",
  idea: "A turning carriage on a moored deck: a big winch drum of green chain across its back, a launch barrel whose three-pronged claw flies off on its chain.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
