import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import { lamp } from "../render/tower-art/tilt-parts";
import { SQUASH } from "../render/tower-art/tilt";
import { STEEL, at, contact, face, gear, roof, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Overclock: a small clock tower on a plinth; a dial on its front ticks round, a gear ring turns behind it. */
const DROP = 5,
  PLINTH = 4,
  WALL = 24,
  APEX = 33,
  DIAL = 16;
const OLIVE = 0x85b21b;

export const concept: Concept = {
  tower: "overclock",
  name: "Clock Tower",
  idea: "A square clock tower on a plinth with a pyramid roof; the dial on its front ticks round, a gear ring turns behind it.",
  tilt: { drop: DROP, squash: SQUASH, height: DIAL, deck: PLINTH },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 18, 15);
    slab(g, x, y0, [-16, -13, 16, -13, 16, 13, -16, 13], 0, PLINTH, 1, STEEL.side, STEEL.top);
    slab(g, x, y0, [-9, -8, 9, -8, 9, 8, -9, 8], PLINTH, WALL, 0, shade(OLIVE, -0.62), shade(OLIVE, -0.4));
    roof(g, x, y0, 10, WALL, APEX, shade(OLIVE, -0.35));
    // Corner pilasters and a cornice band; from level 3 a second, smaller dial on the east wall.
    for (const u of [-9, 9]) g.lineStyle(1.2, shade(OLIVE, -0.25), 1), g.lineBetween(...P(u, 8, PLINTH + 0.5), ...P(u, 8, WALL - 0.5));
    g.lineStyle(1.4, level >= 4 ? color : shade(OLIVE, -0.2), 1);
    g.lineBetween(...P(-9, 8, WALL - 1.2), ...P(9, 8, WALL - 1.2));
    // The dial: a bezel and a pale face on the front wall (its hands are live).
    const [dx, dy] = P(0, 8, DIAL);
    face(g, dx, dy, 7.2, STEEL.deep);
    face(g, dx, dy, 6.2, 0xe9efd9);
    g.fillStyle(STEEL.deep);
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2,
        r0 = i % 3 ? 5.2 : 4.6;
      g.fillRect(dx + Math.cos(t) * r0 - 0.4, dy + Math.sin(t) * r0 - 0.4, 0.8, 0.8);
    }
    if (level >= 3) {
      const [ex, ey] = P(9, 0, DIAL + 2);
      // A small gauge on the east wall: squashed, it sits on a wall seen from the side.
      face(g, ex + 0.4, ey, 2.4, STEEL.deep, 1, 1);
      face(g, ex + 0.4, ey, 1.7, shade(OLIVE, 0.3));
    }
  },
  below: () => {},
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const P = at(x, y + DROP),
      [dx, dy] = P(0, 8, DIAL),
      // The hand ticks a step a second; it grows with each level.
      tick = Math.floor(clock + tower.id) * ((Math.PI * 2) / 12) - Math.PI / 2,
      len = 3.6 + Math.min(level, 3) * 0.6;
    // A thin gear ring behind the dial edge, turning faster with each level.
    gear(g, dx, dy, 8.6, 12, clock * (0.4 + 0.25 * level), shade(OLIVE, -0.1));
    face(g, dx, dy, 7.2, STEEL.deep);
    face(g, dx, dy, 6.2, 0xe9efd9);
    g.lineStyle(1.4, STEEL.deep, 1);
    g.lineBetween(dx, dy, dx + Math.cos(tick) * len, dy + Math.sin(tick) * len);
    g.lineStyle(1, shade(OLIVE, -0.3), 1);
    g.lineBetween(dx, dy, dx + Math.cos(tick / 12) * 2.8, dy + Math.sin(tick / 12) * 2.8);
    disc(g, dx, dy, 0.9, color);
    halo(glow, dx, dy, 9, OLIVE, 0.12 + 0.1 * Math.max(0, Math.cos((clock % 1) * Math.PI)));
    if (level >= 2) lamp(g, glow, ...P(0, 0, APEX + 1.4), color, 0.5 + 0.5 * Math.max(0, Math.sin(clock * Math.PI * 2)));
  },
};
