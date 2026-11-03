import { halo } from "../render/material";
import { ring, shade } from "../render/shapes";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { box, frame, plane, rod } from "../render/tower-art/tilt-frame";
import { SQUASH, onGround, quad } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Fire Control: a low command bunker with a window slit; a rangefinder bar scans slowly on its roof. */
const DROP = 5,
  WALL = 9,
  ROOF = 11.5,
  TABLE = 13.5,
  BAR = 16;
const BUNKER = [-17, -9, -12, -13, 12, -13, 17, -9, 17, 10, 13, 13, -13, 13, -17, 10];
const PINK = 0xf285a4;

export const concept: Concept = {
  tower: "firectl",
  name: "Range Bunker",
  idea: "A low command bunker with a lit window slit; a rangefinder bar with two lenses scans on its roof over a reticle.",
  tilt: { drop: DROP, squash: SQUASH, height: BAR, deck: ROOF },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 19, 15);
    slab(g, x, y0, BUNKER, 0, WALL, 2.5, STEEL.side, STEEL.top);
    // The window slit along the front, glowing faintly pink.
    quad(g, ...P(-10, 13, 5.2), ...P(10, 13, 5.2), ...P(10, 13, 3.6), ...P(-10, 13, 3.6), STEEL.deep);
    quad(g, ...P(-9.4, 13, 4.8), ...P(9.4, 13, 4.8), ...P(9.4, 13, 4), ...P(-9.4, 13, 4), shade(PINK, -0.45));
    // Sandbags on the front corners from level 3, the trim colour on the roof edge once specialized.
    if (level >= 3)
      for (const u of [-14.5, 14.5]) for (let k = 0; k < 2; k++) drumAt(g, x, y0, u, 11.5, 2.4, k * 1.8, k * 1.8 + 1.8, 0x7d6a48, 0x9c8760, 8);
    if (level >= 4) {
      g.lineStyle(1, color, 1);
      g.lineBetween(...P(-12, 10, ROOF - 0.2), ...P(12, 10, ROOF - 0.2));
    }
    drumAt(g, x, y0, 0, 0, 6, ROOF - 0.5, TABLE, STEEL.deep, STEEL.side, 12);
    // An antenna whip at the back corner, its lamp from level 2.
    rod(g, x, y0, 12, -9, ROOF - 1, 12, -9, ROOF + 14, 0.8, STEEL.metal);
    if (level >= 2) lampInk(g, ...P(12, -9, ROOF + 14.5), color);
  },
  below: ({ glow, x, y, level, color }) => {
    if (level >= 2) lampLight(glow, ...at(x, y + DROP)(12, -9, ROOF + 14.5), color, 0.9);
  },
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      // It looks out over the field in front, sweeping slowly to and fro.
      a = Math.PI / 2 + Math.sin(clock * 0.35 + tower.id) * 0.9,
      f = frame(a + Math.PI / 2, 0, BAR);
    // A reticle on the ground ahead, tightening with each level.
    const [rx, ry] = P(Math.cos(a) * 15, Math.sin(a) * 15, 0),
      r = 7 - Math.min(level, 3);
    onGround(glow, rx, ry, 0, () => {
      ring(glow, 0, 0, r, 1, PINK, 0.4);
      glow.lineStyle(1, PINK, 0.4);
      glow.lineBetween(-r - 2, 0, r + 2, 0);
      glow.lineBetween(0, -r - 2, 0, r + 2);
    });
    // The rangefinder bar across the aim, a lens at each end facing forward.
    rod(g, x, y0, 0, 0, TABLE, 0, 0, BAR - 1.5, 2.4, STEEL.side);
    const front = box(g, x, y0, f, -11, 11, -2, 2, -1.8, 1.8, STEEL.top, shade(STEEL.top, 0.2));
    box(g, x, y0, f, -3.5, 3.5, -2.6, 2.6, -2.6, 2.4, STEEL.side, STEEL.top);
    for (const p of [-11, 11]) {
      const lens = frame(a, 0, BAR, Math.cos(a + Math.PI / 2) * p, Math.sin(a + Math.PI / 2) * p);
      plane(g, x, y0, lens, 2.1, 2.8, STEEL.deep);
      plane(g, x, y0, lens, 2.2, 2, shade(PINK, 0.25));
      if (front || Math.sin(a) > -0.3) {
        const [lx, ly] = P(Math.cos(a + Math.PI / 2) * p + Math.cos(a) * 2, Math.sin(a + Math.PI / 2) * p + Math.sin(a) * 2, BAR);
        halo(glow, lx, ly, 3.5, PINK, 0.3);
      }
    }
  },
};
