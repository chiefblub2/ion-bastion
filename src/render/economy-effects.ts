import type { GameEvent } from "../core/types";
import { glowLine, halo } from "./material";
import { disc, hash01, polygon, px, ring, shade, star, strip, type Ink, type Pen } from "./shapes";
// Effects of the economy support towers (Recycler, Shield Generator, Workshop); `effects.ts` hands them over.

type EconomyEvent = Extract<GameEvent, { type: "recycle" | "barrier" | "discount" }>;
const WHITE = 0xffffff,
  LIFE = 0.45;
/** Hexagon outline of six strips, `w` wide. */
function hexOutline(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha: number, rot = 0) {
  for (let i = 0; i < 6; i++) {
    const a0 = rot + (i * Math.PI) / 3,
      a1 = a0 + Math.PI / 3,
      x0 = x + Math.cos(a0) * r,
      y0 = y + Math.sin(a0) * r,
      dx = Math.cos(a1) * r - Math.cos(a0) * r,
      dy = Math.sin(a1) * r - Math.sin(a0) * r,
      len = Math.hypot(dx, dy);
    strip(g, x0, y0, dx / len, dy / len, -w / 2, len + w / 2, -w / 2, w / 2, -w / 2, w / 2, color, alpha);
  }
}
/** Point on the lifted arc from (x0, y0) to (x1, y1) at progress `k`. */
const lob = (x0: number, y0: number, x1: number, y1: number, k: number) => ({
  x: x0 + (x1 - x0) * k,
  y: y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * Math.min(26, 0.35 * Math.hypot(x1 - x0, y1 - y0)),
});
export function drawEconomyEffect(pen: Pen, e: EconomyEvent, age: number) {
  const { g, glow } = pen,
    fade = Math.max(0, 1 - age / LIFE);
  switch (e.type) {
    // Recycler: a spinning scrap shard lobs from the dead enemy to the next one and bursts there.
    case "recycle": {
      const x0 = px(e.from.x),
        y0 = px(e.from.y),
        x1 = px(e.to.x),
        y1 = px(e.to.y),
        k = Math.min(1, age / 0.22),
        seed = hash01(e.from.x, e.from.y, e.to.x);
      // Three chevrons turning where the overkill was collected.
      for (let i = 0; i < 3; i++) {
        const a = age * 6 + seed * 6 + (i * Math.PI * 2) / 3;
        polygon(g, x0 + Math.cos(a) * 9, y0 + Math.sin(a) * 9, 3.2, 3, e.color, a + Math.PI / 2, fade * 0.85);
      }
      if (k < 1) {
        for (let i = 3; i >= 0; i--) {
          const p = lob(x0, y0, x1, y1, Math.max(0, k - i * 0.07)),
            size = 4.2 - i * 0.8;
          if (i) disc(glow, p.x, p.y, size * 1.6, e.color, 0.18 * (1 - i / 4));
          else {
            halo(glow, p.x, p.y, 9, e.color, 0.28);
            polygon(g, p.x, p.y, size, 4, shade(e.color, 0.35), age * 22 + seed * 6);
            polygon(g, p.x, p.y, size * 0.45, 4, WHITE, age * 22 + seed * 6);
          }
        }
        return;
      }
      const b = (age - 0.22) / (LIFE - 0.22);
      ring(g, x1, y1, 5 + b * 16, 2 * (1 - b) + 0.6, e.color, 1 - b);
      star(glow, x1, y1, 10 * (1 - b) + 4, 2, 5, e.color, seed * 6, 0.3 * (1 - b));
      return;
    }
    // Shield Generator: a hexagonal shield flares where the enemy reached the reactor, fed by a line from the generator.
    case "barrier": {
      const x = px(e.at.x),
        y = px(e.at.y),
        open = 1 - Math.pow(1 - Math.min(1, age / 0.15), 3),
        r = 14 + 10 * open;
      glowLine(glow, px(e.from.x), px(e.from.y), x, y, e.color, 1.4, 0.3 * fade);
      polygon(g, x, y, r, 6, e.color, Math.PI / 6, 0.22 * fade);
      hexOutline(g, x, y, r, 2.2, shade(e.color, 0.4), 0.9 * fade, Math.PI / 6);
      hexOutline(glow, x, y, r + 2, 4, e.color, 0.25 * fade, Math.PI / 6);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        disc(g, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.8, WHITE, 0.8 * fade);
      }
      return;
    }
    // Workshop: sparks run from the Workshop to the upgraded tower, where a cog of light turns once.
    case "discount": {
      const x0 = px(e.from.x),
        y0 = px(e.from.y),
        x1 = px(e.at.x),
        y1 = px(e.at.y),
        k = Math.min(1, age / 0.2);
      for (let i = 0; i < 5; i++) {
        const t = Math.max(0, k - i * 0.05),
          jx = (hash01(e.at.x, i, 1) - 0.5) * 6,
          jy = (hash01(e.at.y, i, 2) - 0.5) * 6;
        disc(glow, x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy, 2.6 - i * 0.35, shade(e.color, 0.3), 0.35 * fade);
      }
      if (k < 1) return;
      const b = (age - 0.2) / (LIFE - 0.2);
      // A cog rim of eight teeth around the tower, never over its turret.
      for (let i = 0; i < 8; i++) {
        const a = b * 1.5 + (i * Math.PI) / 4;
        strip(g, x1, y1, Math.cos(a), Math.sin(a), 20 + 3 * b, 24 + 3 * b, -2, 2, -1.4, 1.4, e.color, 0.8 * (1 - b));
      }
      ring(g, x1, y1, 20 + 3 * b, 1.6, e.color, 0.7 * (1 - b));
      halo(glow, x1, y1, 18, e.color, 0.25 * (1 - b));
      return;
    }
  }
}
