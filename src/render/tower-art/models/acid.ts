import { halo } from "../../material";
import { disc, oval, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { X, Y, drum, endFace, onGround, towardViewer, tube } from "../tilt";
import { GUN, castShadow, depth, framer, paint, part, rect } from "../tilt-parts";
import { rod } from "../tilt-frame";
import { bolts, chase, contact, frontArc, plinth } from "./kit-control-a";
import type { TiltedConcept as Concept } from "../tilted";

// Korrosion: the Acid Sprayer, a glass acid tank on a turntable behind a valve block and a long nozzle; the plinth's
// drain grate is stained green.
const DROP = 5,
  PLINTH = 4,
  TABLE = 6,
  HB = 10,
  TANK_P = -6.5,
  TANK_R = 5.6,
  TANK_TOP = 19,
  RECOIL = 4,
  reach = (l: number) => 17 + l;
const VALVE = rect(-1, 5, -3.2, 3.2),
  PLATES = [rect(-1, 5, 3.2, 4.4), rect(-1, 5, -4.4, -3.2)];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 19);
  plinth(g, x, y0, 8, 19, 0, PLINTH, Math.PI / 8);
  // Drain grate and acid stains on the deck.
  onGround(g, x, y0, PLINTH + 1, () => {
    for (let i = -2; i <= 2; i++) g.fillStyle(GUN.deep, 0.9).fillRect(i * 3.2 - 0.8, 10.5, 1.6, 5);
    oval(g, -10, 8, 4, 2.6, shade(c, -0.45), 0.6);
    oval(g, 9, -9, 3, 2, shade(c, -0.5), 0.5);
  });
  if (level >= 3) bolts(g, x, y0, 16.5, PLINTH + 1, 8, 0);
  if (level >= 6) frontArc(g, x, y0, 14.5, PLINTH + 1, 1, color, 0.9);
  drum(g, x, y0, 10, PLINTH + 1, TABLE, GUN.deep, GUN.side, 14);
}

/** The tank, the hose, the valve block and the nozzle, back to front for the aim (cached per aim step and recoil). */
function turret({ g, x, y, tower, definition, level, kick, tip }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    tu = Math.cos(a) * TANK_P,
    tv = Math.sin(a) * TANK_P;
  castShadow(g, x, y0, a, rect(-12, end, -5, 5), TABLE, 0.22);
  paint([
    [
      depth(a, TANK_P, 0),
      () => {
        // The glass tank: steel foot and cap, dark green glass with a lit streak.
        drum(g, X(x, tu), Y(y0, tv, 0), TANK_R + 0.6, TABLE, TABLE + 1.6, GUN.side, GUN.top, 12);
        drum(g, X(x, tu), Y(y0, tv, 0), TANK_R, TABLE + 1.6, TANK_TOP - 1.6, shade(c, -0.62), shade(c, -0.5), 12);
        const [sx0, sy0] = [X(x, tu - TANK_R * 0.55), Y(y0, tv + TANK_R * 0.5, TABLE + 3)],
          [, sy1] = [0, Y(y0, tv + TANK_R * 0.5, TANK_TOP - 3)];
        g.lineStyle(1, shade(c, 0.2), 0.55);
        g.lineBetween(sx0, sy0, sx0, sy1);
        drum(g, X(x, tu), Y(y0, tv, 0), TANK_R + 0.6, TANK_TOP - 1.6, TANK_TOP, GUN.side, GUN.top, 12);
        if (level >= 3) disc(g, X(x, tu), Y(y0, tv, TANK_TOP + 0.4), 1.2, GUN.metal);
      },
    ],
    [
      depth(a, 2, 0),
      () => {
        rod(g, x, y0, tu * 0.6, tv * 0.6, TANK_TOP - 4, Math.cos(a) * 1, Math.sin(a) * 1, HB + 2, 1.6, shade(c, -0.4));
        if (level >= 5) for (const pl of PLATES) part(g, x, y0, a, pl, TABLE, HB + 1.5, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.2));
        part(g, x, y0, a, VALVE, TABLE, HB + 2.5, 0.8, GUN.side, GUN.top, GUN.metal);
        const [vx, vy] = P(2, 0, HB + 3.4);
        disc(g, vx, vy, 1.6, GUN.deep);
        disc(g, vx - 0.3, vy - 0.3, 0.9, shade(c, -0.2));
      },
    ],
    [
      depth(a, (5 + end) / 2, 0),
      () => {
        tube(g, x, y0, a, HB, 5, end - 2.5, 1.7, GUN.side);
        if (level >= 4) tube(g, x, y0, a, HB, end - 7, end - 6, 2.1, shade(c, -0.35), 1, false);
        tube(g, x, y0, a, HB, end - 2.5, end, 2.3, tip ?? shade(c, -0.45));
        if (towardViewer(a) > 0.05) endFace(g, x, y0, a, HB, end, 1.4, 0x0b1a08);
      },
    ],
  ]);
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 17.2, PLINTH + 0.5, 5, clock, color, level);
}

/** The acid's glow rising in the tank, bubbles, the drip growing at the nozzle and the spray's flare after a shot. */
function above({ g, glow, x, y, tower, level, kick, charge, clock, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    tu = Math.cos(a) * TANK_P,
    tv = Math.sin(a) * TANK_P,
    level0 = TABLE + 2 + (TANK_TOP - TABLE - 5) * (0.35 + 0.65 * charge),
    lx = X(x, tu),
    ly = Y(y0, tv, level0);
  // Light only (the glass may sit behind the valve): the acid's level and a few bubbles.
  oval(glow, lx, ly, TANK_R * 0.9, TANK_R * 0.9 * 0.65, c, 0.3);
  for (let i = 0; i < 3; i++) {
    const t = (clock * 0.8 + i / 3) % 1;
    disc(glow, lx + (i - 1) * 2, Y(y0, tv, TABLE + 3 + (level0 - TABLE - 3) * t), 0.8, shade(c, 0.4), 0.5);
  }
  const P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    [mx, my] = P(end, 0, HB);
  if (kick === 0 && charge > 0.2) {
    const r = 0.6 + 1.2 * charge;
    disc(g, mx, my + 1.4 + r, r, shade(c, 0.1));
    disc(glow, mx, my + 1.4 + r, r + 1, c, 0.3);
  }
  if (kick > 0) halo(glow, mx, my, 5 * (1 + kick), c, 0.35 * kick);
  if (level >= 2) disc(glow, ...P(2, 0, HB + 3.4), 2.4, color, 0.35);
}

export const concept: Concept = {
  tower: "acid",
  name: "Acid Sprayer",
  idea: "Glass acid tank behind a valve block and a long nozzle on a turntable; the acid glows higher with the charge and a drip swells at the nozzle.",
  tilt: { drop: DROP, squash: 0.65, height: HB, deck: PLINTH + 1 },
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
