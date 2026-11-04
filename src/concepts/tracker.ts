import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import { lamp } from "../render/tower-art/tilt-parts";
import { box, frame, plane, rod } from "../render/tower-art/tilt-frame";
import { SQUASH, onGround } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, ngon, slab } from "./kit-support-a";
import type { Concept } from "./types";

/**
 * Tracker: the Target Scope. A solid chamfered pad and a stout pillar braced by three short struts (base); a chunky
 * targeting head with a scope tube and a red lens sweeps the field and paints a marker dot on the ground (above, live).
 */
const DROP = 5,
  PAD_H = 4,
  PILLAR = 13,
  HEAD = 17;
const PAD = [-15, -9, -9, -14, 9, -14, 15, -9, 15, 9, 9, 13, -9, 13, -15, 9];
/** Brace feet round the pillar: the back one first. */
const BRACES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const RED = 0xff5f6d,
  OUTLINE_RED = 0x2a0d12;

export const concept: Concept = {
  tower: "tracker",
  name: "Target Scope",
  idea: "A solid pad and a braced pillar carrying a chunky targeting head with a scope tube; its red laser sweeps the field and paints a marker dot on the ground.",
  tilt: { drop: DROP, squash: SQUASH, height: HEAD, deck: PAD_H },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      brace = (a: number) => rod(g, x, y0, Math.cos(a) * 10, Math.sin(a) * 8, PAD_H, Math.cos(a) * 3.2, Math.sin(a) * 3.2, PILLAR - 3, 2.6, STEEL.top);
    contact(g, x, y0, 17, 14);
    slab(g, x, y0, PAD, 0, PAD_H, 1, STEEL.side, STEEL.top);
    // Hazard corners on the pad's front from level 3, the trim colour on its rim from level 4.
    if (level >= 3) {
      const P = at(x, y0);
      for (const u of [-11, 8]) {
        g.lineStyle(1.6, RED, 0.9);
        g.lineBetween(...P(u, 12, PAD_H + 1), ...P(u + 3, 12, PAD_H + 1));
      }
    }
    if (level >= 4) slab(g, x, y0, ngon(8, 6.4, Math.PI / 8), PAD_H, PAD_H + 0.6, 0, color, shade(color, 0.2));
    brace(BRACES[0]);
    drumAt(g, x, y0, 0, 0, 3.6, PAD_H, PILLAR, STEEL.side, STEEL.top, 12);
    drumAt(g, x, y0, 0, 0, 4.6, PILLAR - 1.5, PILLAR, STEEL.deep, STEEL.side, 12);
    brace(BRACES[1]);
    brace(BRACES[2]);
  },
  below: () => {},
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      a = clock * 0.9 + tower.id,
      f = frame(a, 0.1, HEAD);
    // The head: a chunky housing, the scope tube on its roof and the lens on its front, all turning with the sweep.
    const front = box(g, x, y0, f, -6, 6, -4.2, 4.2, -3.2, 3.2, STEEL.side, STEEL.top);
    box(g, x, y0, f, -4.5, 5, -1.9, 1.9, 3.2, 6, shade(RED, -0.45), shade(RED, -0.15));
    if (level >= 5) box(g, x, y0, f, -5, -2, -4.6, 4.6, -2, 2, shade(RED, -0.6), shade(RED, -0.4));
    if (front) {
      plane(g, x, y0, f, 6.1, 2.8, OUTLINE_RED);
      plane(g, x, y0, f, 6.2, 2, shade(RED, 0.25));
    }
    // The beam to a marker dot sweeping round the field.
    const r = 22,
      [tx, ty] = P(Math.cos(a) * r, Math.sin(a) * r, 0),
      [lx, ly] = P(Math.cos(a) * 6 * Math.cos(0.1), Math.sin(a) * 6 * Math.cos(0.1), HEAD + 6 * Math.sin(0.1));
    glow.lineStyle(1.3, RED, 0.32);
    glow.lineBetween(lx, ly, tx, ty);
    onGround(glow, tx, ty, 0, () => disc(glow, 0, 0, 3.4, RED, 0.5));
    onGround(g, tx, ty, 0, () => disc(g, 0, 0, 1.4, shade(RED, 0.3), 0.9));
    halo(glow, lx, ly, 4.5, RED, 0.32);
    if (level >= 2) lamp(g, glow, ...P(0, 0, HEAD + 7.2), color, 0.5 + 0.5 * Math.max(0, Math.sin(clock * 5)));
  },
};
