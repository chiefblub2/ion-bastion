import { arcBand, disc, oval, ring, shade } from "../render/shapes";
import { OUTLINE, SQUASH, onGround } from "../render/tower-art/tilt";
import { part } from "../render/tower-art/tilt-parts";
import { DROP, armedLight, chasers, contact, lampSocket, octagon } from "./kit-traps-a";
import type { Concept } from "./types";

const R = 19,
  H = 1.8,
  TOP = H + 0.6,
  POOL = 15;

/** Tar Pit: a basin of glossy tar sunk into a low rim of tarred stone; bubbles swell and pop, a sheen drifts over it. */
export const concept: Concept = {
  tower: "tar",
  name: "Tar Basin",
  idea: "A low octagonal rim of tar-stained stone around a sunken pool of glossy purple-black tar; bubbles swell and pop, a sheen drifts across.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level, color } = ctx,
      c = d.color,
      y0 = y + DROP;
    contact(g, x, y0, R, R);
    part(g, x, y0, 0, octagon(R), 0, H + 0.4, 0.8, shade(c, -0.4), shade(c, -0.08), shade(c, 0.35), 0.93);
    onGround(g, x, y0, TOP, () => {
      // The pool sits a little below the rim: its far inner wall shows as a dark band.
      oval(g, 0, 0, POOL + 0.8, POOL + 0.8, OUTLINE, 0.9);
      oval(g, 0, 1.4, POOL, POOL - 0.6, shade(c, -0.62));
      arcBand(g, 0, 0, POOL - 0.6, 1.6, Math.PI * 1.08, Math.PI * 1.92, shade(c, -0.78));
      // A fixed gloss on the upper left of the surface.
      oval(g, -5.5, -4.5, 5.5, 1.6, shade(c, 0.35), 0.35, -0.5);
      // Rim stones' seams, and studs from L3.
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.lineStyle(0.7, shade(c, -0.7), 0.8);
        g.lineBetween(Math.cos(a) * (POOL + 1), Math.sin(a) * (POOL + 1), Math.cos(a) * (R - 0.5), Math.sin(a) * (R - 0.5));
        if (level >= 3) disc(g, Math.cos(a + 0.39) * (R - 2), Math.sin(a + 0.39) * (R - 2), 0.8, shade(c, 0.15));
      }
      if (level >= 5) ring(g, 0, 0, POOL + 1.6, 0.8, level >= 6 ? color : shade(c, 0.4), 0.85);
    });
    lampSocket(ctx, 15, TOP);
  },
  below: (ctx) => chasers(ctx, R - 3, H),
  turret: () => {},
  above: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      y0 = y + DROP;
    onGround(g, x, y0, TOP, () => {
      // Three bubbles swell, then pop into a widening ring.
      for (let i = 0; i < 3; i++) {
        const phase = (clock * 0.6 + i / 3 + t.id * 0.2) % 1,
          bx = -6 + i * 6,
          by = 3 - (i % 2) * 6;
        if (phase < 0.7) disc(g, bx, by, 0.8 + 2.4 * (phase / 0.7), shade(c, -0.2 + 0.3 * phase), 0.9);
        else ring(g, bx, by, 2.8 + (phase - 0.7) * 10, 0.7, shade(c, 0.3), (1 - phase) * 3);
      }
      // A slow sheen drifting over the pool.
      const sx = Math.sin(clock * 0.4 + t.id) * 6;
      oval(g, sx, 4, 4, 1, shade(c, 0.45), 0.25);
      // A splash ring as it catches an enemy.
      if (kick > 0) ring(glow, 0, 1, POOL * (1 - kick * 0.4), 1.4, c, 0.3 * kick);
    });
    armedLight(ctx, 15, TOP);
  },
};
