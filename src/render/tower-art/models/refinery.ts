import { halo } from "../../material";
import { disc, hash01, shade } from "../../shapes";
import { lampInk, lampLight } from "../tilt-parts";
import { rod } from "../tilt-frame";
import { SQUASH, quad } from "../tilt";
import { STEEL, at, contact, drumAt, face, gear, slab } from "./kit-support-a";
import type { TiltedConcept as Concept } from "../tilted";

/** Refinery: a gold-trimmed plant block with a smokestack and an ore hopper; a big gear turns on its front wall. */
const DROP = 5,
  WALL = 12,
  STACK = 28,
  GEAR_H = 6.5;
const PLANT = [-16, -11, 14, -11, 16, -8, 16, 12, -16, 12];
const GOLD = 0xf5c542;

export const concept: Concept = {
  tower: "refinery",
  name: "Smelter",
  idea: "A gold-trimmed plant block with a smokestack and an ore hopper; a big gear turns on its front wall, the stack puffs.",
  tilt: { drop: DROP, squash: SQUASH, height: GEAR_H, deck: WALL },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 19, 15);
    // The plant block, the hopper on its roof and the smokestack rising from it at the back left.
    slab(g, x, y0, PLANT, 0, WALL, 1.2, STEEL.side, STEEL.top);
    slab(g, x, y0, [3, -8, 13, -8, 13, 1, 3, 1], WALL, WALL + 5, 0, shade(GOLD, -0.55), shade(GOLD, -0.3));
    drumAt(g, x, y0, -9, -6, 4, WALL + 0.5, STACK, STEEL.side, STEEL.deep, 12);
    for (const h of [STACK - 3, STACK - 6]) drumAt(g, x, y0, -9, -6, 4.3, h, h + 0.9, shade(GOLD, -0.35), shade(GOLD, -0.1), 12);
    // Gold trim along the front wall's top, the gear's dark socket and a pipe along the side from level 3.
    g.lineStyle(1.2, level >= 4 ? color : shade(GOLD, -0.15), 1);
    g.lineBetween(...P(-16, 12, WALL - 1.3), ...P(16, 12, WALL - 1.3));
    const [gx, gy] = P(-4, 12, GEAR_H);
    face(g, gx, gy, 5.8, STEEL.deep);
    quad(g, ...P(5, 12, 8.5), ...P(13, 12, 8.5), ...P(13, 12, 3.5), ...P(5, 12, 3.5), STEEL.deep);
    if (level >= 3) rod(g, x, y0, 16.5, 9, 3, 16.5, -7, 3, 1.8, shade(GOLD, -0.3));
    if (level >= 2) lampInk(g, ...P(-14, 12, WALL - 3.5), color);
  },
  below: ({ g, glow, x, y, clock, color, level }) => {
    const P = at(x, y + DROP);
    // The furnace window on the front: molten gold, flickering.
    const heat = 0.6 + 0.4 * Math.sin(clock * 7) * Math.sin(clock * 3.1);
    quad(g, ...P(5.6, 12, 8), ...P(12.4, 12, 8), ...P(12.4, 12, 4), ...P(5.6, 12, 4), shade(0xff9a3c, -0.35 + 0.3 * heat));
    const [wx, wy] = P(9, 12, 6);
    halo(glow, wx, wy, 6, 0xff9a3c, 0.25 * heat);
    if (level >= 2) lampLight(glow, ...P(-14, 12, WALL - 3.5), color);
  },
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level }) => {
    const P = at(x, y + DROP),
      [gx, gy] = P(-4, 12, GEAR_H);
    // The gear on the front wall turns faster with each level.
    gear(g, gx, gy, 5.6, 10, clock * (0.6 + 0.3 * level), shade(GOLD, -0.2));
    face(g, gx, gy, 2.2, STEEL.deep);
    disc(g, gx - 0.4, gy - 0.4, 0.8, GOLD);
    // Smoke puffs drift up from the stack.
    for (let i = 0; i < 3; i++) {
      const k = (clock * 0.5 + i / 3 + hash01(tower.id, i, 1) * 0.1) % 1,
        [sx, sy] = P(-9 + 4 * k + 2 * Math.sin(i + clock), -6 - 2 * k, STACK + 2 + 14 * k);
      disc(g, sx, sy, 1.8 + 3 * k, 0x8f989e, 0.4 * (1 - k));
    }
    const [tx, ty] = P(-9, -6, STACK);
    halo(glow, tx, ty, 4, GOLD, 0.18);
  },
};
