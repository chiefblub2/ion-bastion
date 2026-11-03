import { halo } from "../render/material";
import { disc, hash01, shade } from "../render/shapes";
import { lamp } from "../render/tower-art/tilt-parts";
import { rod } from "../render/tower-art/tilt-frame";
import { SQUASH, onGround, quad } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Repair Dock: a landing pad with a repair cross; a gantry crane over it lowers a welding head. */
const DROP = 5,
  PAD = 3,
  POST = 19,
  HEAD = 12;
const PAD_SHAPE = [-19, -12, -14, -16, 14, -16, 19, -12, 19, 12, 14, 16, -14, 16, -19, 12];
const MINT = 0x6dff9e;
/** Pad corner lights, back to front. */
const CORNERS = [
  [-15, -12],
  [15, -12],
  [-15, 12],
  [15, 12],
];

export const concept: Concept = {
  tower: "dock",
  name: "Gantry Dock",
  idea: "Chamfered landing pad with a lit repair cross; a gantry crane at the back lowers a welding head that throws sparks.",
  tilt: { drop: DROP, squash: SQUASH, height: HEAD, deck: PAD },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 20, 16);
    slab(g, x, y0, PAD_SHAPE, 0, PAD, 1, STEEL.side, STEEL.top);
    // The repair cross painted on the pad, hazard stripes along its front edge.
    onGround(g, x, y0, PAD + 1, () => {
      g.fillStyle(shade(MINT, -0.55));
      g.fillRect(-9, -2.8, 18, 5.6);
      g.fillRect(-2.8, -9, 5.6, 18);
      g.fillStyle(shade(MINT, -0.25));
      g.fillRect(-8, -1.8, 16, 3.6);
      g.fillRect(-1.8, -8, 3.6, 16);
    });
    for (let i = 0; i < 6; i++) {
      const u = -12 + i * 5;
      quad(g, ...P(u, 12.5, PAD + 1), ...P(u + 2.2, 12.5, PAD + 1), ...P(u + 3.4, 14.5, PAD + 1), ...P(u + 1.2, 14.5, PAD + 1), 0xd9b23a);
    }
    // The gantry: two posts at the back, a beam across and a trolley rail forward to the centre.
    for (const u of [-13, 13]) drumAt(g, x, y0, u, -11, 1.9, PAD, POST, STEEL.side, STEEL.top, 8);
    rod(g, x, y0, -13, -11, POST, 13, -11, POST, 2.6, STEEL.top);
    rod(g, x, y0, 0, -11, POST, 0, 0, POST, 2.2, STEEL.side);
    // Tool crates beside the pad from level 3, a stripe in the trim colour once specialized.
    if (level >= 3) {
      slab(g, x, y0, [-17, 4, -11, 4, -11, 9, -17, 9], PAD, PAD + 4, 0.8, 0x5b4a33, 0x7a6544);
      slab(g, x, y0, [11, 4, 17, 4, 17, 9, 11, 9], PAD, PAD + 3, 0.8, 0x5b4a33, 0x7a6544);
    }
    if (level >= 4) rod(g, x, y0, -13, -11, POST - 2.5, 13, -11, POST - 2.5, 1, color);
  },
  below: ({ g, glow, x, y, clock, level, color }) => {
    const P = at(x, y + DROP);
    // Pad lights: steady from level 2, chasing round from level 4.
    if (level < 2) return;
    CORNERS.forEach(([u, v], i) => lamp(g, glow, ...P(u, v, PAD + 0.6), color, level >= 4 ? 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.6)) : 0.8));
  },
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, charge, color }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      // The head lowers and lifts on its own rhythm.
      dip = 2.5 * (0.5 + 0.5 * Math.sin(clock * 1.6 + tower.id)),
      h = HEAD + dip;
    rod(g, x, y0, 0, 0, POST, 0, 0, h + 2, 0.9, STEEL.metal);
    const [hx, hy] = P(0, 0, h);
    disc(g, hx, hy - 1, 2.6, STEEL.deep);
    disc(g, hx, hy - 1.4, 1.8, STEEL.side);
    disc(g, hx, hy + 1.2, 1, 0xfff3c4);
    // Sparks from the weld, more while the dock is close to its repair.
    const n = 3 + Math.round(3 * charge);
    for (let i = 0; i < n; i++) {
      const t = Math.floor(clock * 12) + i * 7,
        a = hash01(tower.id, i, t) * Math.PI * 2,
        d = 2 + 5 * hash01(i, t, 3);
      disc(g, hx + Math.cos(a) * d, hy + 1.5 + Math.sin(a) * d * SQUASH, 0.5, 0xfff3c4);
    }
    halo(glow, hx, hy + 1, 6, MINT, 0.25);
    // The cross breathes with the repair.
    const [cx, cy] = P(0, 0, PAD + 1);
    halo(glow, cx, cy, 10, color, 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(clock * 2)));
  },
};
