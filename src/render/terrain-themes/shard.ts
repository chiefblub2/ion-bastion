import { CELL, fillRound, polygon } from "../shapes";
import { zigzag, type Theme } from "./kit";

export const shard: Theme = {
    backdrop: 0x120f1c,
    ground: [0x1a1628, 0x171324],
    grid: 0x3e3658,
    path: { edge: 0x5d5288, bed: 0x2e2848, line: 0xb9a8ff, arrow: 0xc6b8ff },
    accent: 0xd8ccff,
    // Cluster of faceted crystal shards over a faint glow, lit from the left.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x07050c, 0.45);
      g.fillEllipse(x + 28, y + 40, 40, 16);
      g.fillStyle(0x8f7fff, 0.12);
      g.fillEllipse(x + 28, y + 38, 48, 20);
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const cx = x + 28 + (rand() - 0.5) * 24,
          cy = y + 36 + (rand() - 0.5) * 12,
          h = 16 + rand() * 12,
          w = 5 + rand() * 3,
          tilt = (rand() - 0.5) * 0.7,
          p = (dx: number, dy: number) => ({
            x: cx + dx * Math.cos(tilt) - dy * Math.sin(tilt),
            y: cy + dx * Math.sin(tilt) + dy * Math.cos(tilt),
          });
        g.fillStyle(0x3e3570);
        g.fillPoints([p(0, -h), p(w, 0), p(0, h * 0.2)], true);
        g.fillStyle(0x5a4f94);
        g.fillPoints([p(0, -h), p(w * 0.45, -h * 0.05), p(0, h * 0.2)], true);
        g.fillStyle(0x9f94e0);
        g.fillPoints([p(0, -h), p(0, h * 0.2), p(-w, 0)], true);
        const tip = p(0, -h),
          edge = p(-w * 0.45, -h * 0.5);
        g.lineStyle(1, 0xffffff, 0.45);
        g.lineBetween(tip.x, tip.y, edge.x, edge.y);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.4) {
        for (let i = 0; i < 2; i++) polygon(g, x + 10 + rand() * 36, y + 10 + rand() * 36, 2.5 + rand() * 1.5, 3, 0x4a4278, rand() * 6);
      } else if (kind < 0.75) {
        g.lineStyle(1, 0x0d0b16, 0.9);
        zigzag(g, x + 14 + rand() * 28, y + 14 + rand() * 28, rand, 16, 3);
      } else {
        // Small crystal with a bright tip.
        const sx = x + 12 + rand() * 32,
          sy = y + 16 + rand() * 30;
        g.fillStyle(0x6a5fb0);
        g.fillTriangle(sx, sy - 8, sx + 3, sy + 2, sx - 3, sy + 2);
        g.fillStyle(0xd8ccff);
        g.fillCircle(sx, sy - 6, 1.2);
      }
    },
    // Glints on the crystals, each cell on its own phase, and motes drifting up from them.
    ambient: ({ g, map, clock, hash, blocked }) => {
      for (const b of blocked) {
        const h = hash(b.x, b.y),
          s = Math.max(0, Math.sin(clock * 1.1 + h * 40)) ** 12;
        if (h < 0.6) {
          const life = (clock * 0.3 + h * 9) % 1;
          g.fillStyle(0xd8ccff, 0.5 * (1 - life) * Math.min(1, life * 5));
          fillRound(g, b.x * CELL + 16 + h * 24 + Math.sin(life * 5 + h * 20) * 4, b.y * CELL + 36 - life * 34, 1.3);
        }
        if (s < 0.05) continue;
        const gx = b.x * CELL + 18 + h * 20,
          gy = b.y * CELL + 18 + ((h * 7) % 1) * 14,
          r = 2 + s * 4;
        g.lineStyle(1.5, 0xffffff, s);
        g.lineBetween(gx - r, gy, gx + r, gy);
        g.lineBetween(gx, gy - r, gx, gy + r);
      }
    },
};
