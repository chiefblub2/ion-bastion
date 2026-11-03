import { arcBand, oval, ring, shade } from "../render/shapes";
import { facing } from "../render/material";
import { OUTLINE, SQUASH, onGround } from "../render/tower-art/tilt";
import { part, rect } from "../render/tower-art/tilt-parts";
import { DROP, armedLight, chasers, contact, lampSocket } from "./kit-traps-a";
import type { Concept } from "./types";

const R = 19,
  HOLE = 14,
  H = 1.8,
  TOP = H;
/** Stone blocks of the rim, at eight angles. */
const STONES = Array.from({ length: 8 }, (_, i) => Math.PI / 8 + (i * Math.PI) / 4);

/** Pitfall: a dark shaft in a ring of stones; wooden planks slide back over it while it re-arms. */
export const concept: Concept = {
  tower: "pit",
  name: "Stone Shaft",
  idea: "A deep shaft in a low ring of eight dressed stones, its far inner wall lit; while it re-arms, wooden planks slide back over the opening.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level, color } = ctx,
      c = d.color,
      y0 = y + DROP;
    contact(g, x, y0, R, R);
    // The shaft: black, with its far inner wall catching the light and dropping away.
    onGround(g, x, y0, 0, () => {
      oval(g, 0, 0, HOLE + 1, HOLE + 1, OUTLINE);
      oval(g, 0, 0, HOLE, HOLE, 0x07090a);
      arcBand(g, 0, -1, HOLE - 1, 3.4, Math.PI * 1.1, Math.PI * 1.9, shade(c, -0.45));
      arcBand(g, 0, -2, HOLE - 3.6, 2.4, Math.PI * 1.15, Math.PI * 1.85, shade(c, -0.7));
    });
    // The rim stones, back ones first.
    const order = [...STONES].sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of order)
      part(g, x, y0, a, rect(HOLE + 0.5, R, -3.6, 3.6), 0, H, 0.5, shade(c, -0.4 + 0.2 * facing(a)), shade(c, -0.05 + 0.2 * facing(a)), shade(c, 0.35), 0.85);
    onGround(g, x, y0, TOP, () => {
      if (level >= 5) ring(g, 0, 0, R + 0.6, 0.8, level >= 6 ? color : shade(c, 0.35), 0.9);
    });
    lampSocket(ctx, 15, TOP);
  },
  below: (ctx) => chasers(ctx, R - 3, H),
  turret: () => {},
  // Planks slide over the shaft from the west while it re-arms and are gone once it is ready.
  above: (ctx) => {
    const { g, x, y, definition: d, charge, level } = ctx,
      c = d.color,
      y0 = y + DROP,
      cover = 1 - charge;
    if (cover > 0.02)
      for (const v of [-8, 0, 8]) {
        const u0 = -HOLE - 1,
          u1 = u0 + (2 * HOLE + 2) * cover;
        part(g, x, y0, 0, rect(u0, u1, v - 3.2, v + 3.2), TOP - 0.4, TOP + 0.6, 0, shade(c, -0.25), shade(c, 0.12), shade(c, 0.4));
        if (level >= 3) onGround(g, x, y0, TOP + 0.6, () => oval(g, u1 - 1.4, v, 0.6, 0.6, shade(c, -0.6)));
      }
    armedLight(ctx, 15, TOP);
  },
};
