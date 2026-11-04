import { CELL, fillOval, polygon, px } from "../shapes";
import { flow, zigzag, type Theme } from "./kit";

export const rift: Theme = {
    backdrop: 0x0d0814,
    ground: [0x170f22, 0x140d1e],
    grid: 0x3d2a58,
    path: { edge: 0x8a3fc8, bed: 0x22123a, line: 0xf08aff, arrow: 0xf5a4ff },
    accent: 0xf08aff,
    // Floating shard over a glowing fissure.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x05020a, 0.55);
      g.fillEllipse(x + 28, y + 46, 34, 10);
      g.lineStyle(2, 0xc060ff, 0.7);
      zigzag(g, x + 12, y + 46, rand, 34, 4);
      const cx = x + 28 + (rand() - 0.5) * 8,
        h = 18 + rand() * 8;
      g.fillStyle(0x3a1f5c);
      g.fillPoints([{ x: cx, y: y + 34 - h }, { x: cx + 9, y: y + 26 }, { x: cx, y: y + 38 }, { x: cx - 9, y: y + 26 }], true);
      g.fillStyle(0x7a4ab8);
      g.fillPoints([{ x: cx, y: y + 34 - h }, { x: cx, y: y + 38 }, { x: cx - 9, y: y + 26 }], true);
    },
    decor: (g, x, y, rand) => {
      if (rand() < 0.5) {
        g.lineStyle(1, 0x4e2a78, 0.8);
        zigzag(g, x + 12 + rand() * 32, y + 12 + rand() * 32, rand, 18, 3);
      } else {
        polygon(g, x + 12 + rand() * 32, y + 12 + rand() * 32, 2 + rand() * 2, 4, 0x3e2464, rand() * 3);
      }
    },
    // Pulsing fissures and a slow ripple running toward the reactor.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      for (const b of blocked) {
        const h = hash(b.x, b.y);
        glow.fillStyle(0xc060ff, (0.1 + 0.1 * Math.sin(clock * 2.2 + h * 25)) * lit);
        fillOval(glow, px(b.x), b.y * CELL + 46, 32, 10);
      }
      flow(path, clock, 2.5, 1.4, (p) => {
        const nx = -Math.sin(p.angle) * 15,
          ny = Math.cos(p.angle) * 15;
        g.lineStyle(2, 0xf08aff, 0.35);
        g.lineBetween(p.x - nx, p.y - ny, p.x + nx, p.y + ny);
      });
    },
};
