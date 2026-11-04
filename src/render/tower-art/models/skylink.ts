import { halo } from "../../material";
import { disc, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { SQUASH, X, Y, drum } from "../tilt";
import { lampInk, lampLight } from "../tilt-parts";
import { SX, SY, frame, plane, project, rod } from "../tilt-frame";
import { DEEP, METAL, STEEL, STEEL_TOP, ball, contact, flatRing, ngon, post, slab } from "./kit-support-b";
import type { TiltedConcept as Concept } from "../tilted";

// Skylink: the Sky Relay. A hexagonal plinth with three strut feet (base); a mast, three struts and a dish tipped
// skywards with its feed horn (turret: never aims, so one picture per look); chevrons of light rising off the feed
// horn, one more per level (above, live).
const DROP = 6,
  H = 4.5,
  MAST = H + 9,
  DISH = H + 13,
  PITCH = 1.38;
const PLINTH = ngon(6, 20, Math.PI / 6),
  PLINTH_IN = ngon(6, 18.8, Math.PI / 6);
/** Strut feet at the back and the two front corners. */
const FEET = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
/** The dish faces the sky, tipped a little toward the viewer, so it shows as a lit bowl. */
const DISH_FRAME = frame(Math.PI / 2, PITCH, DISH);
const FEED = 9;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 20);
  slab(g, x, y0, PLINTH, PLINTH_IN, 0, H, STEEL, STEEL_TOP, METAL, 1);
  if (level >= 4) flatRing(g, x, y0, H + 1, 16.5, 0.9, color, 0.95);
  // Strut feet with a status lamp each, lit one per level (the light is live).
  for (const a of [...FEET].sort((p, q) => Math.sin(p) - Math.sin(q))) {
    const u = Math.cos(a) * 14,
      v = Math.sin(a) * 14;
    post(g, x, y0, u, v, 2.6, H, H + 2.4, shade(c, -0.5), shade(c, -0.25));
  }
  // Level 3: cable trays on the deck, from the feet to the mast.
  if (level >= 3)
    for (const a of FEET) {
      g.lineStyle(1.4, DEEP, 0.9);
      g.lineBetween(X(x, Math.cos(a) * 11), Y(y0, Math.sin(a) * 11, H + 1), X(x, Math.cos(a) * 4), Y(y0, Math.sin(a) * 4, H + 1));
    }
  FEET.forEach((a, i) => lampInk(g, X(x, Math.cos(a) * 14), Y(y0, Math.sin(a) * 14, H + 2.7), c, i < level ? 1 : 0.1));
}

/** The mast, struts and dish: still, so cached once per look. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  drum(g, x, y0, 3.4, H, MAST, STEEL, STEEL_TOP, 10);
  // Struts from the feet up under the dish, back one first.
  for (const a of [...FEET].sort((p, q) => Math.sin(p) - Math.sin(q))) rod(g, x, y0, Math.cos(a) * 13, Math.sin(a) * 13, H + 2.4, Math.cos(a) * 4, Math.sin(a) * 4, DISH - 2, 1.3, METAL);
  // The dish: rim, face and the shaded hollow; a trim ring from level 4 in the path colour.
  plane(g, x, y0, DISH_FRAME, 0, 13, shade(c, -0.55));
  plane(g, x, y0, DISH_FRAME, 0.1, 12, shade(METAL, 0.15));
  plane(g, x, y0, DISH_FRAME, 0.2, 8.5, shade(METAL, -0.15));
  if (level >= 4) plane(g, x, y0, DISH_FRAME, 0.25, 6.8, color);
  plane(g, x, y0, DISH_FRAME, 0.3, level >= 4 ? 6 : 5, shade(METAL, -0.3));
  // Feed horn on a boom along the dish's axis.
  project(x, y0, DISH_FRAME, 0.3, 0, 0, 0);
  project(x, y0, DISH_FRAME, FEED, 0, 0, 1);
  g.lineStyle(2.2, DEEP, 1);
  g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  g.lineStyle(0.9, METAL, 0.9);
  g.lineBetween(SX[0] - 0.4, SY[0], SX[1] - 0.4, SY[1]);
  ball(g, SX[1], SY[1], 2.2, c);
}

function below() {}

/** The feed horn's light, chevrons rising off it (one more per level), the feet lamps' light. */
function above({ g, glow, x, y, tower, level, clock, energy, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  project(x, y0, DISH_FRAME, FEED, 0, 0, 0);
  const fx = SX[0],
    fy = SY[0];
  halo(glow, fx, fy, 6, c, 0.3 + energy);
  for (let i = 0; i < level + 1; i++) {
    const k = (clock * 0.8 + tower.id * 0.21 + i / (level + 1)) % 1,
      cy = fy - 4 - k * 13,
      fade = Math.sin(k * Math.PI),
      w = 3.5 + 1.5 * k;
    g.lineStyle(1.5, shade(c, 0.4), 0.85 * fade);
    g.beginPath();
    g.moveTo(fx - w, cy + 2.6);
    g.lineTo(fx, cy);
    g.lineTo(fx + w, cy + 2.6);
    g.strokePath();
    glow.lineStyle(3, c, 0.22 * fade);
    glow.beginPath();
    glow.moveTo(fx - w, cy + 2.6);
    glow.lineTo(fx, cy);
    glow.lineTo(fx + w, cy + 2.6);
    glow.strokePath();
  }
  FEET.forEach((a, i) => {
    if (i < level) lampLight(glow, X(x, Math.cos(a) * 14), Y(y0, Math.sin(a) * 14, H + 2.7), c);
  });
  disc(glow, fx, fy, 2, c, 0.2);
}

export const concept: Concept = {
  tower: "skylink",
  name: "Sky Relay",
  idea: "Hex plinth with three strut feet; a dish tipped skywards on mast and struts, feed horn on a boom; light chevrons rise off it, one more per level.",
  tilt: { drop: DROP, squash: SQUASH, height: DISH, deck: H + 1 },
  base,
  below,
  turret,
  above,
};
