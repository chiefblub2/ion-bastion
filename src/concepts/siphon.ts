import { halo } from "../render/material";
import { disc, oval, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, endFace, onGround, towardViewer, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, framer, lampInk, lampLight, part, rect } from "../render/tower-art/tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { Concept } from "./types";

// Siphon: the Drain Tank. An octagonal plinth carries a tall glass reservoir on the pivot; round its foot turns a
// collar with an arm that ends in a flared drain nozzle. The drained fluid swirls in the glass and sinks as the beam
// reloads (drawn under the glass, so it shows through).
const TILT = { drop: 5, squash: 0.65, height: 10.5, deck: 4.8 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 1,
  reach = (l: number) => 16 + l;
const R = 18,
  PLINTH = 4,
  DECK = 4.8,
  COLLAR = 8,
  TANK_R = 6,
  TANK0 = 6.5,
  TANK1 = 21,
  FLUID_R = 5.2;
const PLINTH_SHAPE = ngon(8, R, Math.PI / 8);
const COLLAR_SHAPE = rect(-7.5, 7.5, -7.5, 7.5);
const ARM = rect(6, 11, -2.6, 2.6);
const PLATES = [rect(6.5, 10.5, 2.6, 3.6), rect(6.5, 10.5, -3.6, -2.6)];
/** Gauge lights down the plinth's front faces. */
const GAUGE = [-8, -4, 0, 4, 8];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, R);
  slab(g, x, y0, PLINTH_SHAPE, 0, PLINTH, 1, GUN.side, GUN.top, GUN.metal);
  for (const u of GAUGE) {
    const gx = X(x, u),
      gy = Y(y0, R * 0.92, PLINTH / 2);
    g.fillStyle(OUTLINE);
    g.fillRect(gx - 1.3, gy - 1, 2.6, 2);
    g.fillStyle(shade(c, -0.55));
    g.fillRect(gx - 0.8, gy - 0.5, 1.6, 1);
  }
  onGround(g, x, y0, DECK, () => {
    // Drain channels running in toward the tank.
    g.lineStyle(1.2, GUN.deep, 0.9);
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2 + Math.PI / 4;
      g.lineBetween(Math.cos(t) * 9, Math.sin(t) * 9, Math.cos(t) * 15.5, Math.sin(t) * 15.5);
    }
    if (level >= 3)
      for (let i = 0; i < 4; i++) {
        const t = (i * Math.PI) / 2;
        disc(g, Math.cos(t) * 15, Math.sin(t) * 15, 0.9, OUTLINE);
        disc(g, Math.cos(t) * 15 - 0.3, Math.sin(t) * 15 - 0.3, 0.4, GUN.metal);
      }
    if (level >= 4) oval(g, 0, 0, 12, 12, shade(color, -0.4), 0.5);
  });
}

/** The fluid in the reservoir (under the glass, which is turret ink), swirling and sinking as the beam reloads. */
function below({ g, glow, x, y, level, charge, kick, clock, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    // Full right after a drain, sinking as the next one charges.
    fill = TANK0 + 1 + (TANK1 - TANK0 - 3) * Math.min(1, 0.45 + 0.55 * (1 - charge) + kick * 0.3);
  drum(g, x, y0, FLUID_R, TANK0 + 0.5, fill, shade(c, -0.05), shade(c, 0.35), 14);
  onGround(g, x, y0, fill, () => {
    const t = clock * 2.2;
    g.lineStyle(0.7, shade(c, 0.45), 0.8);
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const s = i / 14,
        r = FLUID_R * 0.85 * s,
        b = t + s * 5;
      if (i === 0) g.moveTo(Math.cos(b) * r, Math.sin(b) * r);
      else g.lineTo(Math.cos(b) * r, Math.sin(b) * r);
    }
    g.strokePath();
  });
  onGround(glow, x, y0, fill, () => disc(glow, 0, 0, FLUID_R, c, 0.15 + 0.1 * kick));
  // From level 4 the gauge lights fill from the left with the fluid level.
  if (level >= 4)
    GAUGE.forEach((u, i) => {
      const on = (fill - TANK0) / (TANK1 - TANK0) * GAUGE.length > i ? 1 : 0.2,
        gx = X(x, u),
        gy = Y(y0, R * 0.92, PLINTH / 2);
      g.fillStyle(shade(color, -0.55 + 0.75 * on));
      g.fillRect(gx - 0.8, gy - 0.5, 1.6, 1);
      if (on > 0.5) disc(glow, gx, gy, 2.2, color, 0.25);
    });
}

/** The turning collar, the glass reservoir and its bands, the arm with the flared drain nozzle, back to front. Ink only. */
function turret({ g, x, y, tower, level, kick, tip, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  castShadow(g, x, y0, a, rect(-7, end, -4, 4), DECK, 0.24);
  const collar = () => {
      part(g, x, y0, a, COLLAR_SHAPE, DECK, COLLAR, 1, GUN.side, GUN.top, GUN.metal, 0.85);
      if (level >= 2) lampInk(g, ...P(-6.2, Math.cos(a) > 0 ? 5.5 : -5.5, COLLAR + 1), color);
    },
    tank = () => {
      // Glass: a pale translucent body over the fluid, steel bands at the foot and the top, a dome cap.
      drum(g, x, y0, TANK_R + 0.6, COLLAR, TANK0 + 1.5, GUN.deep, GUN.side, 14);
      const glass = shade(c, 0.55);
      onGround(g, x, y0, TANK0, () => oval(g, 0, 0, TANK_R + 0.7, TANK_R + 0.7, OUTLINE, 0.6));
      g.fillStyle(glass, 0.14);
      g.fillRect(X(x, -TANK_R), Y(y0, 0, TANK1), TANK_R * 2, TANK1 - TANK0);
      onGround(g, x, y0, TANK0 + 0.1, () => oval(g, 0, 0, TANK_R, TANK_R, glass, 0.22));
      g.lineStyle(0.9, OUTLINE, 0.8);
      g.lineBetween(X(x, -TANK_R), Y(y0, 0, TANK0 + 1), X(x, -TANK_R), Y(y0, 0, TANK1));
      g.lineBetween(X(x, TANK_R), Y(y0, 0, TANK0 + 1), X(x, TANK_R), Y(y0, 0, TANK1));
      // A highlight down the glass on the lit side.
      g.lineStyle(1.2, 0xffffff, 0.35);
      g.lineBetween(X(x, -TANK_R + 1.6), Y(y0, 0, TANK0 + 3), X(x, -TANK_R + 1.6), Y(y0, 0, TANK1 - 2));
      drum(g, x, y0, TANK_R + 0.5, TANK1 - 1, TANK1 + 0.6, GUN.side, GUN.top, 14);
      if (level >= 6) drum(g, x, y0, TANK_R + 0.55, TANK1 - 2.4, TANK1 - 1, color, shade(color, 0.25), 14);
      drum(g, x, y0, 2.8, TANK1 + 0.6, TANK1 + 2.2, GUN.deep, GUN.top, 10);
    },
    nozzle = () => {
      part(g, x, y0, a, ARM, COLLAR - 2, COLLAR + 0.5, 0, GUN.side, GUN.top, GUN.metal);
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, COLLAR - 1.5, COLLAR, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.3));
      tube(g, x, y0, a, HB, 7, end - 4, 1.8, GUN.side);
      // The flared mouth: widening rings to the tip.
      tube(g, x, y0, a, HB, end - 4, end - 2, 2.4, shade(c, -0.45));
      tube(g, x, y0, a, HB, end - 2, end, 3.4, tip ?? shade(c, -0.3));
      if (towardViewer(a) > 0.05) {
        endFace(g, x, y0, a, HB, end, 3.4, shade(c, -0.55));
        endFace(g, x, y0, a, HB, end, 2.2, OUTLINE);
      }
    };
  const away = Math.sin(a) < 0;
  collar();
  if (away) {
    nozzle();
    tank();
  } else {
    tank();
    nozzle();
  }
}

/** The nozzle's mouth drawing light in as it charges, a glint on the glass, the lamp's light. */
function above({ glow, x, y, tower, level, charge, kick, energy, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  if (level >= 2) lampLight(glow, ...P(-6.2, Math.cos(a) > 0 ? 5.5 : -5.5, COLLAR + 1), color);
  const [mx, my] = P(end, 0, HB);
  disc(glow, mx, my, 3 + 1.5 * charge, c, 0.12 + 0.25 * charge + energy);
  if (kick > 0) halo(glow, mx, my, 6 * (1 + kick), c, 0.3 * kick);
}

export const concept: Concept = {
  tower: "siphon",
  name: "Drain Tank",
  idea: "A tall glass reservoir on the pivot of an octagonal plinth; a turning collar carries an arm with a flared drain nozzle, the drained fluid swirls in the glass and sinks as the beam reloads.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
