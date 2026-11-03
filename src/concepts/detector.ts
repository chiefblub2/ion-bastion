import { halo } from "../render/material";
import { arcBand, disc, shade } from "../render/shapes";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { frame, plane, rod } from "../render/tower-art/tilt-frame";
import { SQUASH, onGround } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, ngon, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Detector: a hexagonal bunker with a lattice mast; a radar dish turns on top and its scan fan sweeps the ground. */
const DROP = 5,
  BUNKER = 6,
  MAST = 22,
  DISH = 25;
const HEX = ngon(6, 17, 0);
const CYAN = 0x6fd3ff;

export const concept: Concept = {
  tower: "detector",
  name: "Radar Mast",
  idea: "A hexagonal bunker with a lattice mast; a radar dish turns on top while its scan fan sweeps the ground around it.",
  tilt: { drop: DROP, squash: SQUASH, height: DISH, deck: BUNKER },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 18, 14);
    slab(g, x, y0, HEX, 0, BUNKER, 1.6, STEEL.side, STEEL.top);
    // Lattice mast: three legs and cross braces, back leg first.
    const legs = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map((a) => [Math.cos(a) * 5, Math.sin(a) * 5] as const);
    drumAt(g, x, y0, 0, 0, 6.2, BUNKER, BUNKER + 1.5, STEEL.deep, STEEL.side, 12);
    for (const [u, v] of legs) rod(g, x, y0, u, v, BUNKER + 1.5, u * 0.3, v * 0.3, MAST, 1.4, STEEL.top);
    for (const h of [11, 16]) {
      const k = 1 - ((h - BUNKER) / (MAST - BUNKER)) * 0.7;
      rod(g, x, y0, legs[1][0] * k, legs[1][1] * k, h, legs[2][0] * k, legs[2][1] * k, h + 2, 0.7, STEEL.metal);
    }
    drumAt(g, x, y0, 0, 0, 2.6, MAST - 1, MAST + 1, STEEL.deep, STEEL.side, 10);
    // Bunker vents and, from level 3, plates; the trim colour round the bunker's top once specialized.
    if (level >= 3) for (const u of [-9, 9]) slab(g, x, y0, [u - 3, 12.5, u + 3, 12.5, u + 3, 14, u - 3, 14], 0.8, BUNKER - 1, 0, STEEL.deep, STEEL.side);
    if (level >= 4) {
      g.lineStyle(1, color, 1);
      g.lineBetween(...P(-8.5, 14.7, BUNKER - 0.6), ...P(8.5, 14.7, BUNKER - 0.6));
    }
    if (level >= 2) lampInk(g, ...P(-12, 7, BUNKER + 0.6), color);
  },
  below: ({ glow, x, y, level, color }) => {
    if (level >= 2) lampLight(glow, ...at(x, y + DROP)(-12, 7, BUNKER + 0.6), color);
  },
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      a = clock * (0.8 + 0.25 * level) + tower.id;
    // The scan fan on the ground, trailing the dish.
    onGround(glow, x, y0, 0, () => {
      for (let i = 0; i < 3; i++) arcBand(glow, 0, 0, 14 + i * 4, 4, a - 0.35 * (i + 1), a, CYAN, 0.05 + 0.03 * i);
    });
    // The dish faces along the sweep: its back when it turns away.
    const f = frame(a, 0.35, DISH),
      facing = Math.sin(a) * Math.cos(0.35) * 0.76 + Math.sin(0.35) * SQUASH > 0;
    rod(g, x, y0, 0, 0, MAST + 1, Math.cos(a) * 1.5, Math.sin(a) * 1.5, DISH, 1.4, STEEL.side);
    plane(g, x, y0, f, 0, 9.6, 0x081217, 1, 6.4);
    plane(g, x, y0, f, 0.3, 8.8, facing ? shade(STEEL.metal, 0.1) : STEEL.side, 1, 5.8);
    if (facing) {
      plane(g, x, y0, f, 0.5, 5.6, shade(STEEL.metal, -0.12), 1, 3.6);
      plane(g, x, y0, f, 0.6, 2.4, shade(CYAN, -0.3), 1, 1.6);
    }
    const [hx, hy] = P(Math.cos(a) * 4 * Math.cos(0.35), Math.sin(a) * 4 * Math.cos(0.35), DISH + 4 * Math.sin(0.35));
    disc(g, hx, hy, 1, CYAN);
    halo(glow, hx, hy, 5, CYAN, 0.3);
    if (level >= 4) disc(glow, hx, hy, 2.4, color, 0.3);
  },
};
