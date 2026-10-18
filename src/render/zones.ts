import type { ContentPack, Zone } from "../core/types";
import { halo } from "./material";
import { arcBand, CELL, disc, hash01, px, ring, shade, type Ink } from "./shapes";
/**
 * Plasma pools, read from the state: a dark scorched bed, the glowing plasma, a shimmering rim and rising
 * bubbles. `g` lies below the towers and enemies, `glow` is the tower light, so units on top are never lit.
 * They swell in over the first 0.25 s and fade out over the last 0.6 s.
 */
export function drawZones(g: Ink, glow: Ink, zones: readonly Zone[], time: number, clock: number, content: ContentPack) {
  for (const [i, z] of zones.entries()) {
    const c = content.towers[z.source.type].color,
      x = px(z.at.x),
      y = px(z.at.y),
      age = z.duration - (z.until - time),
      grow = Math.min(1, age / 0.25),
      fade = Math.min(1, Math.max(0, (z.until - time) / 0.6)),
      r = z.radius * CELL * (0.6 + 0.4 * grow),
      seed = hash01(z.at.x, z.at.y, z.source.tower),
      a = fade * grow;
    if (a <= 0.01) continue;
    disc(g, x, y, r, shade(c, -0.8), 0.4 * a);
    disc(g, x, y, r * 0.86, c, 0.2 * a);
    disc(g, x, y, r * 0.5, shade(c, 0.3), 0.14 * a);
    ring(g, x, y, r, 1.6, shade(c, 0.2), 0.55 * a);
    // Shimmer: rim arcs crawling round in opposite directions.
    for (let k = 0; k < 3; k++) {
      const s = clock * (k % 2 ? -0.9 : 0.7) + seed * 6 + (k * Math.PI * 2) / 3;
      arcBand(g, x, y, r * 0.93, 1.2, s, s + 0.8, shade(c, 0.55), 0.5 * a);
    }
    for (let k = 0; k < 5; k++) {
      const phase = (clock * 0.8 + hash01(seed, k, i)) % 1,
        ang = hash01(seed, k) * Math.PI * 2,
        d = r * 0.7 * hash01(k, seed, 3);
      disc(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d - phase * 4, 1.6 * (1 - phase) + 0.4, shade(c, 0.6), a * (1 - phase));
    }
    halo(glow, x, y, r * 1.1, c, 0.22 * a);
  }
}
