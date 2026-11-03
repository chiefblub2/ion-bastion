import { halo } from "../render/material";
import { arcBand, disc, ring, shade } from "../render/shapes";
import { OUTLINE, SQUASH, X, Y, drum, onGround } from "../render/tower-art/tilt";
import { DROP, STEEL, armedLight, chasers, contact, lampSocket } from "./kit-traps-a";
import type { Concept } from "./types";

const R = 13,
  H = 2.2,
  TOP = H,
  COPPER = 0xb8743a;

/** Sticky Mine: a magnetic puck with a copper coil; field lines turn round it and the next bomb clamps on once armed. */
export const concept: Concept = {
  tower: "limpet",
  name: "Mag Clamp",
  idea: "A dark magnetic puck with a copper coil in its top; field lines turn around it, and once re-armed a red limpet bomb clamps onto its centre and blinks.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level, color } = ctx,
      c = d.color,
      y0 = y + DROP;
    contact(g, x, y0, R + 1, R + 1);
    drum(g, x, y0, R, 0, H, STEEL.wall, STEEL.top, 18);
    onGround(g, x, y0, TOP, () => {
      // The coil: copper windings round a dark pole.
      ring(g, 0, 0, R - 3, 3, shade(COPPER, -0.35));
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        g.lineStyle(0.6, shade(COPPER, 0.25), 0.9);
        g.lineBetween(Math.cos(a) * (R - 4.4), Math.sin(a) * (R - 4.4), Math.cos(a) * (R - 1.6), Math.sin(a) * (R - 1.6));
      }
      disc(g, 0, 0, 6, STEEL.deep);
      disc(g, -0.4, -0.4, 4.6, shade(STEEL.wall, -0.2));
      if (level >= 3) for (let i = 0; i < 3; i++) disc(g, Math.cos(i * 2.09 + 0.5) * (R - 0.8), Math.sin(i * 2.09 + 0.5) * (R - 0.8), 0.7, STEEL.metal);
      if (level >= 5) ring(g, 0, 0, R - 0.4, 0.8, level >= 6 ? color : shade(c, -0.1), 0.9);
    });
    lampSocket(ctx, 11, TOP);
  },
  below: (ctx) => chasers(ctx, R - 2, H),
  turret: () => {},
  above: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge, kick } = ctx,
      c = d.color,
      y0 = y + DROP;
    // Field lines turning round the puck, stronger as the next bomb nears.
    onGround(glow, x, y0, TOP, () => {
      for (let i = 0; i < 3; i++) {
        const b = clock * 0.8 + (i * Math.PI * 2) / 3;
        arcBand(glow, 0, 0, R + 1.6, 1, b, b + 0.9, c, 0.1 + 0.1 * charge);
      }
    });
    // Armed: the bomb clamped on the pole, its lamp blinking.
    if (charge >= 1) {
      drum(g, x, y0, 4.2, TOP, TOP + 2.2, shade(c, -0.45), shade(c, -0.2), 12);
      onGround(g, x, y0, TOP + 2.2, () => {
        disc(g, 0, 0, 2.4, shade(c, -0.1));
        disc(g, 0, 0, 1, OUTLINE);
      });
      const blink = 0.5 + 0.5 * Math.sin(clock * 8);
      disc(g, X(x, 0), Y(y0, 0, TOP + 2.6), 0.8, shade(c, -0.4 + 0.8 * blink));
      disc(glow, X(x, 0), Y(y0, 0, TOP + 2.6), 2.4, c, 0.35 * blink);
    }
    if (kick > 0) halo(glow, X(x, 0), Y(y0, 0, TOP + 2), 9 * (0.6 + kick), c, 0.3 * kick);
    armedLight(ctx, 11, TOP);
  },
};
