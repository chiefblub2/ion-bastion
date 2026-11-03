import { halo } from "../render/material";
import { disc, hash01, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, onGround } from "../render/tower-art/tilt";
import { rod } from "../render/tower-art/tilt-frame";
import { GUN, part, rect } from "../render/tower-art/tilt-parts";
import { chase, contact, frontArc, plinth } from "./kit-control-a";
import { arcBand } from "../render/shapes";
import type { Concept } from "./types";

// Jammer: the Signal Mast, a three-legged lattice mast on a square plinth held by guy wires, two dish rings on it and
// a glowing tip; signal rings radiate from the tip and glitch pixels flicker round it.
const DROP = 5,
  PLINTH = 4,
  FOOT_R = 6.5,
  TOP_R = 1.4,
  MAST = 31,
  TIP = 33.5;
/** The legs: one at the back, two at the front corners, so none hides the others. */
const LEGS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const ANCHORS = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const legAt = (t: number, h: number) => {
  const r = FOOT_R + (TOP_R - FOOT_R) * ((h - PLINTH) / (MAST - PLINTH));
  return [Math.cos(t) * r, Math.sin(t) * r] as const;
};

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 18);
  plinth(g, x, y0, 4, 19, 0, PLINTH, Math.PI / 4);
  // Guy-wire anchors on the corners (wires are part of the mast).
  for (const t of ANCHORS) {
    const u = Math.cos(t) * 13,
      v = Math.sin(t) * 13;
    part(g, x, y0, 0, rect(u - 1.6, u + 1.6, v - 1.6, v + 1.6), PLINTH, PLINTH + 2, 0, GUN.side, GUN.top, GUN.metal);
  }
  if (level >= 5)
    for (const t of [Math.PI / 2, 0, Math.PI]) {
      const u = Math.cos(t) * 15,
        v = Math.sin(t) * 15;
      part(g, x, y0, 0, rect(u - 2.4, u + 2.4, v - 2.4, v + 2.4), PLINTH, PLINTH + 1.2, 0, GUN.deep, GUN.side, shade(c, -0.1));
    }
  if (level >= 6) frontArc(g, x, y0, 10, PLINTH + 0.6, 1, color, 0.9, 0.3, Math.PI - 0.3);
  onGround(g, x, y0, PLINTH + 0.6, () => disc(g, 0, 0, FOOT_R + 1.5, GUN.deep));
}

/** The lattice mast with its braces, guy wires and dish rings (radial: one picture per recoil step). */
function turret({ g, x, y, definition, level }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    back = LEGS[0],
    front = LEGS.slice(1);
  const leg = (t: number) => {
    const [u0, v0] = legAt(t, PLINTH),
      [u1, v1] = legAt(t, MAST);
    rod(g, x, y0, u0, v0, PLINTH, u1, v1, MAST, 1.3, GUN.top);
  };
  // Guy wires behind, then the back leg, the braces on the front face, the front legs.
  g.lineStyle(0.6, GUN.metal, 0.75);
  for (const t of ANCHORS) {
    const [u, v] = legAt(t, MAST - 7);
    g.lineBetween(X(x, Math.cos(t) * 13), Y(y0, Math.sin(t) * 13, PLINTH + 2), X(x, u), Y(y0, v, MAST - 7));
  }
  leg(back);
  const [fa, fb] = front;
  g.lineStyle(0.7, GUN.side, 1);
  for (let h = PLINTH + 3, k = 0; h < MAST - 3; h += 4.5, k++) {
    const [au, av] = legAt(k % 2 ? fa : fb, h),
      [bu, bv] = legAt(k % 2 ? fb : fa, h + 4.5);
    g.lineBetween(X(x, au), Y(y0, av, h), X(x, bu), Y(y0, bv, h + 4.5));
  }
  for (const t of front) leg(t);
  // Dish rings: flat discs round the mast, the upper one from level 3.
  for (const [h, r] of level >= 3 ? [[17, 7], [25, 5.4]] : [[17, 7]]) {
    onGround(g, x, y0, h, () => {
      disc(g, 0, 0, r + 0.7, OUTLINE, 0.9);
      disc(g, 0, 0, r, GUN.side);
      disc(g, -0.6, -0.6, r - 1.6, GUN.top);
      disc(g, 0, 0, 2.2, shade(c, -0.4));
    });
  }
  // The tip: a ball in the tower's colour on a short spike.
  rod(g, x, y0, 0, 0, MAST, 0, 0, TIP - 1, 0.9, GUN.metal);
  disc(g, X(x, 0), Y(y0, 0, TIP), 2.3, OUTLINE);
  disc(g, X(x, 0), Y(y0, 0, TIP), 1.7, shade(c, -0.2));
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 15, PLINTH + 0.5, 5, clock, color, level);
}

/** The tip's glow and signal rings radiating from it, glitch pixels round the mast, a burst on a disruption. */
function above({ g, glow, x, y, level, kick, charge, clock, color, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    tx = X(x, 0),
    ty = Y(y0, 0, TIP);
  disc(g, tx - 0.5, ty - 0.5, 0.7 + 0.6 * charge, shade(c, 0.6));
  halo(glow, tx, ty, 5 + 3 * charge, c, 0.2 + 0.2 * charge + energy);
  for (let i = 0; i < 2; i++) {
    const t = (clock * 0.9 + i / 2) % 1;
    onGround(glow, x, y0, TIP - 2, () => arcBand(glow, 0, 0, 3 + 12 * t, 1.1, 0, Math.PI * 2, c, (0.12 + 0.2 * charge) * (1 - t)));
  }
  const step = Math.floor(clock * 10);
  for (let i = 0; i < 4 + (level >= 4 ? 3 : 0); i++) {
    if (hash01(i, step, 5) > 0.55) continue;
    const u = (hash01(i, step, 1) - 0.5) * 24,
      h = 8 + hash01(i, step, 2) * 24;
    g.fillStyle(hash01(i, step, 3) > 0.5 ? c : 0xffffff, 0.7).fillRect(X(x, u), Y(y0, 0, h), 1.6, 1.2);
  }
  if (level >= 2) disc(glow, X(x, 0), Y(y0, 0, 25), 1.6, color, 0.35 + 0.25 * Math.sin(clock * 5));
  if (kick > 0) onGround(glow, x, y0, TIP - 2, () => arcBand(glow, 0, 0, 4 + 20 * (1 - kick), 2.2, 0, Math.PI * 2, 0xffffff, 0.35 * kick));
}

export const concept: Concept = {
  tower: "jammer",
  name: "Signal Mast",
  idea: "Three-legged lattice mast on a square plinth with guy wires and dish rings; signal rings radiate from the glowing tip, glitch pixels flicker round it.",
  tilt: { drop: DROP, squash: 0.65, height: TIP, deck: PLINTH + 0.6, emit: TIP },
  base,
  below,
  turret,
  above,
};
