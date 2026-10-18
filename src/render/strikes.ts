import type { ContentPack, Strike } from "../core/types";
import { glowLine, halo } from "./material";
import { arcBand, CELL, disc, px, ring, shade, strip, type Ink } from "./shapes";
const TAU = Math.PI * 2;
/**
 * Orbital strikes on their way down, read from the state: a target reticle on the ground over the blast radius,
 * brackets turning in, a countdown arc that closes as the strike nears, and a thin targeting beam from above that
 * thickens. The reticle blinks faster towards the end, so a player can see where and when it lands. `g` lies below
 * the towers and enemies, `glow` is the tower light.
 */
export function drawStrikes(g: Ink, glow: Ink, strikes: readonly Strike[], time: number, clock: number, content: ContentPack) {
  for (const k of strikes) {
    const c = content.towers[k.source.type].color,
      x = px(k.at.x),
      y = px(k.at.y),
      R = k.radius * CELL,
      p = 1 - Math.min(1, Math.max(0, k.due - time) / k.delay),
      blink = 0.55 + 0.45 * Math.sin(clock * (6 + 18 * p));
    disc(g, x, y, R, c, 0.05 + 0.1 * p);
    ring(g, x, y, R, 1.4, c, 0.45 + 0.35 * blink);
    for (let i = 0; i < 4; i++) {
      const a = clock * 1.5 + (i * Math.PI) / 2;
      arcBand(g, x, y, R - 3, 2.2, a, a + 0.5, shade(c, 0.3), 0.8);
    }
    arcBand(g, x, y, R * 0.55, 2.2, -Math.PI / 2, -Math.PI / 2 + TAU * p, c, 0.85);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      strip(g, x, y, Math.cos(a), Math.sin(a), R * 0.12, R * 0.38, -0.7, 0.7, -0.7, 0.7, c, 0.75);
    }
    glowLine(glow, x, y - 240, x, y, c, 1 + 2 * p, 0.06 + 0.22 * p);
    halo(glow, x, y, R * 0.6, c, 0.1 + 0.15 * p * blink);
  }
}
