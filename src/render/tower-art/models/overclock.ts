import { halo } from "../../material";
import { disc, shade } from "../../shapes";
import { lamp } from "../tilt-parts";
import { SQUASH, onGround } from "../tilt";
import { STEEL, at, contact, ngon, slab } from "./kit-support-a";
import type { TiltedConcept as Concept } from "../tilted";

/**
 * Overclock: the Overdrive Core. A plinth carrying a dark processor block with a glowing core window on its front and
 * a heat sink of tall cooling fins on its roof (base). In the boost window the core flares, the fins glow from their
 * roots and heat shimmers above them; a cooling fan beside the window spins (above, live).
 */
const DROP = 5,
  PLINTH = 4,
  BLOCK = 11,
  FIN_TOP = 22;
/** Fins across the roof, west to east. */
const FINS = [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5];
/** The boost window: a pulse on the shared clock, sharp to rise and slow to fall. */
const boost = (clock: number) => Math.max(0, Math.sin(clock * 2.2)) ** 2;

export const concept: Concept = {
  tower: "overclock",
  name: "Overdrive Core",
  idea: "A processor block with a glowing core window under a heat sink of tall cooling fins: in the boost window the core flares, the fins glow and heat shimmers off them; a fan beside the window spins.",
  tilt: { drop: DROP, squash: SQUASH, height: BLOCK, deck: PLINTH },
  base: ({ g, x, y, level, color, definition }) => {
    const y0 = y + DROP,
      c = definition.color,
      P = at(x, y0);
    contact(g, x, y0, 18, 14);
    slab(g, x, y0, [-17, -11, -12, -15, 12, -15, 17, -11, 17, 11, 12, 15, -12, 15, -17, 11], 0, PLINTH, 1, STEEL.side, STEEL.top);
    // The processor block: dark, with a trim line round its waist from level 4.
    slab(g, x, y0, [-10.5, -8, 10.5, -8, 10.5, 8, -10.5, 8], PLINTH, BLOCK, 0.8, STEEL.deep, STEEL.side);
    if (level >= 4) {
      g.lineStyle(1, color, 1);
      g.lineBetween(...P(-10.5, 8, PLINTH + 2), ...P(10.5, 8, PLINTH + 2));
    }
    // The core window on the front face (its light is live) with contact pins either side.
    const [wx0, wy0] = P(-5, 8, BLOCK - 1.5),
      [wx1, wy1] = P(5, 8, PLINTH + 1.5);
    g.fillStyle(0x0a1410);
    g.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    g.fillStyle(shade(c, -0.55));
    g.fillRect(wx0 + 1, wy0 + 1, wx1 - wx0 - 2, wy1 - wy0 - 2);
    g.fillStyle(level >= 3 ? 0xc9a25a : STEEL.metal);
    for (const u of [-9, -7.5]) {
      const [px, py] = P(u, 8, PLINTH + 3.2);
      g.fillRect(px - 0.4, py - 1.5, 0.8, 3);
    }
    // The heat sink: tall thin fins standing across the roof, taller from level 3.
    const top = FIN_TOP + (level >= 3 ? 2 : 0);
    for (const u of FINS) slab(g, x, y0, [u - 0.7, -6.5, u + 0.7, -6.5, u + 0.7, 6.5, u - 0.7, 6.5], BLOCK, top, 0, shade(c, -0.5), shade(c, -0.15), shade(c, 0.3));
    // The fan on the front face, right of the window: a round frame (the blades spin live).
    const [fx, fy] = P(7.9, 8, (BLOCK + PLINTH) / 2);
    disc(g, fx, fy, 2.7, STEEL.side);
    disc(g, fx, fy, 2.1, 0x0a1410);
    if (level >= 5) for (const u of [-10.5, 10.5]) slab(g, x, y0, [u - 0.6, -8.6, u + 0.6, -8.6, u + 0.6, 8.6, u - 0.6, 8.6], PLINTH, BLOCK + 1, 0, color, shade(color, 0.2));
  },
  below: () => {},
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color, definition, energy }) => {
    const y0 = y + DROP,
      c = definition.color,
      P = at(x, y0),
      b = boost(clock + tower.id),
      top = FIN_TOP + (level >= 3 ? 2 : 0);
    // The core flares in the boost window.
    const [cx, cy] = P(0, 8, (BLOCK + PLINTH) / 2);
    g.fillStyle(shade(c, -0.3 + 0.6 * b));
    g.fillRect(cx - 3.2, cy - 2, 6.4, 4);
    halo(glow, cx, cy, 8 + 5 * b, c, 0.15 + 0.3 * b + energy);
    // The fins glow from their roots; heat shimmers above them.
    for (const u of FINS) {
      const [fx, fy] = P(u, 6.5, BLOCK + 1),
        [tx, ty] = P(u, 6.5, BLOCK + 1 + (top - BLOCK - 2) * (0.3 + 0.7 * b));
      glow.lineStyle(1.6, c, 0.15 + 0.35 * b);
      glow.lineBetween(fx, fy, tx, ty);
    }
    for (let i = 0; i < 3; i++) {
      const rise = (clock * 0.8 + i / 3 + tower.id * 0.1) % 1,
        [hx, hy] = P(-5 + i * 5, 0, top + 2 + rise * 8);
      glow.lineStyle(1.2, c, 0.25 * b * (1 - rise));
      glow.lineBetween(hx - 2, hy, hx, hy - 1.5);
      glow.lineBetween(hx, hy - 1.5, hx + 2, hy);
    }
    // The fan: blades spinning in their frame, faster in the boost window.
    const [fx, fy] = P(7.9, 8, (BLOCK + PLINTH) / 2),
      spin = clock * (6 + 10 * b) + tower.id;
    g.lineStyle(0.9, STEEL.metal, 1);
    for (let k = 0; k < 4; k++) {
      const t = spin + (k * Math.PI) / 2;
      g.lineBetween(fx, fy, fx + Math.cos(t) * 1.9, fy + Math.sin(t) * 1.9);
    }
    disc(g, fx, fy, 0.6, STEEL.deep);
    if (level >= 2) lamp(g, glow, ...P(-9.5, 8, BLOCK - 1), color, 0.4 + 0.6 * b);
  },
};
