import { halo } from "../render/material";
import { arcBand, disc, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, fillPoints, onGround, point } from "../render/tower-art/tilt";
import { rod } from "../render/tower-art/tilt-frame";
import { GUN, lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { bolts, chase, contact, frontArc } from "./kit-control-a";
import type { Concept } from "./types";

// Stasis: the Chrono Glass, an hourglass of teal glass in a four-post cage on a round dais. Energy runs from the upper
// bulb into the lower one as the stun charges; on a stun it freezes white and frost rings the dais.
const DROP = 6,
  DAIS = 3.5,
  /** Glass from its foot to its head, narrowest at the waist. */
  FOOT = 5.5,
  HEAD = 23.5,
  WAIST = (FOOT + HEAD) / 2,
  CAP = 2.2,
  /** Cage posts on the diagonals. */
  CAGE = 10,
  EMIT = WAIST;
const POSTS = [(5 * Math.PI) / 4, (7 * Math.PI) / 4, (3 * Math.PI) / 4, Math.PI / 4];
/** Half width of the glass at height h: wide bulbs, a narrow waist. */
const width = (h: number) => 1.4 + 6.6 * Math.abs((h - WAIST) / (HEAD - WAIST)) ** 0.75;
/** Fills the glass profile between heights h0 < h1 (front view: the glass is round, so the outline never turns). */
function profile(g: Ink, x: number, y0: number, h0: number, h1: number, color: number, alpha = 1, inset = 0) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const h = h1 - ((h1 - h0) * i) / (n - 1);
    point(i, X(x, -width(h) + inset), Y(y0, 0, h));
  }
  for (let i = 0; i < n; i++) {
    const h = h0 + ((h1 - h0) * i) / (n - 1);
    point(n + i, X(x, width(h) - inset), Y(y0, 0, h));
  }
  fillPoints(g, 2 * n, color, alpha);
}
const post = (g: Ink, x: number, y0: number, t: number, color: number) =>
  rod(g, x, y0, Math.cos(t) * CAGE, Math.sin(t) * CAGE, FOOT - CAP, Math.cos(t) * CAGE, Math.sin(t) * CAGE, HEAD + CAP, 2, color);

/** Dais, foot cap and the two back posts of the cage. */
function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 18);
  drum(g, x, y0, 17.5, 0, DAIS, GUN.side, GUN.top, 20);
  onGround(g, x, y0, DAIS, () => disc(g, 0, 0, 11.5, GUN.deep, 0.8));
  if (level >= 3) bolts(g, x, y0, 15, DAIS, 12, 0.26);
  if (level >= 6) frontArc(g, x, y0, 16.4, DAIS, 1.1, color, 0.9);
  // The foot cap the glass stands in, the two back posts of the cage.
  drum(g, x, y0, 10.8, DAIS, FOOT, GUN.side, GUN.top, 16);
  for (const t of POSTS.slice(0, 2)) post(g, x, y0, t, level >= 5 ? shade(c, -0.45) : GUN.side);
}

/** Lamps chasing round the dais; the glass, the energy running through it and its shine (the front posts cover them). */
function below({ g, glow, x, y, level, clock, color, charge, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  chase(g, glow, x, y0, 16.6, DAIS + 0.3, 6, clock, color, level);
  // The glass: a dark outline, a light teal rim, then the dark tinted body inside it.
  profile(g, x, y0, FOOT, HEAD, OUTLINE, 0.95);
  profile(g, x, y0, FOOT, HEAD, shade(c, -0.1), 0.95, 0.6);
  profile(g, x, y0, FOOT, HEAD, shade(c, -0.55), 0.9, 1.4);
  // Energy: the upper bulb drains into the lower one as the stun charges; a thin stream through the waist.
  const fill = Math.min(1, charge),
    low = FOOT + 0.8 + (WAIST - FOOT - 2) * fill,
    high = WAIST + 0.6 + (HEAD - WAIST - 2) * (1 - fill);
  profile(g, x, y0, FOOT + 0.8, low, shade(c, -0.05), 1, 2);
  if (fill < 0.98) profile(g, x, y0, WAIST + 0.6, high, shade(c, -0.05), 1, 2);
  if (fill > 0.02 && fill < 0.98) {
    g.lineStyle(0.9, shade(c, 0.3), 1);
    g.lineBetween(X(x, 0), Y(y0, 0, WAIST + 0.6), X(x, 0), Y(y0, 0, low));
  }
  // Shine down the glass on the side turned to the light.
  g.lineStyle(0.8, shade(c, 0.55), 0.7);
  g.lineBetween(X(x, -width(HEAD - 2) + 1.6), Y(y0, 0, HEAD - 2), X(x, -width(WAIST + 3) + 0.9), Y(y0, 0, WAIST + 3));
  g.lineBetween(X(x, -width(WAIST - 3) + 0.9), Y(y0, 0, WAIST - 3), X(x, -width(FOOT + 1.5) + 1.6), Y(y0, 0, FOOT + 1.5));
}

/** The two front posts of the cage and the head cap with its lamp socket (still: Stasis never aims). */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  for (const t of POSTS.slice(2)) post(g, x, y0, t, level >= 5 ? shade(c, -0.45) : GUN.side);
  drum(g, x, y0, 10.8, HEAD, HEAD + CAP, GUN.side, GUN.top, 16);
  // Level 5: a band in the tower's colour round the head cap; level 2: the lamp on its top.
  if (level >= 5) frontArc(g, x, y0, 10.9, HEAD + CAP / 2, 1, level >= 6 ? color : shade(c, -0.2), 1);
  if (level >= 2) lampInk(g, X(x, 0), Y(y0, 0, HEAD + CAP + 0.4), color);
}

/** The glass glowing with the charge, the lamp's light, and the freeze: a white flash and frost on the dais. */
function above({ g, glow, x, y, level, charge, kick, color, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    [wx, wy] = [X(x, 0), Y(y0, 0, WAIST)];
  halo(glow, wx, Y(y0, 0, FOOT + 4), 9, c, 0.1 + 0.18 * charge + energy);
  disc(glow, wx, wy, 2.4, c, 0.2 + 0.25 * charge);
  if (level >= 2) lampLight(glow, X(x, 0), Y(y0, 0, HEAD + CAP + 0.4), color);
  if (kick > 0) {
    // Frozen: the glass flashes white and frost spreads round the dais.
    profile(g, x, y0, FOOT + 0.8, HEAD - 0.8, 0xe8fffb, 0.55 * kick, 1.2);
    onGround(glow, x, y0, DAIS, () => arcBand(glow, 0, 0, 12 + 6 * (1 - kick), 2.2, 0, Math.PI * 2, 0xffffff, 0.3 * kick));
  }
}

export const concept: Concept = {
  tower: "stasis",
  name: "Chrono Glass",
  idea: "An hourglass of teal glass in a four-post cage on a round dais: energy runs from the upper bulb into the lower as the stun charges, then the glass freezes white and frost rings the dais.",
  tilt: { drop: DROP, squash: 0.65, height: EMIT, deck: DAIS, emit: EMIT },
  base,
  below,
  turret,
  above,
};
