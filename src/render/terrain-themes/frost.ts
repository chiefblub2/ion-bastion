import { CELL, fillRound } from "../shapes";
import { along, flow, type Theme } from "./kit";

export const frost: Theme = {
    backdrop: 0x0c1620,
    ground: [0x16242f, 0x14212b],
    grid: 0x3a5466,
    path: { edge: 0x5a8aa8, bed: 0x1c3344, line: 0xc8ecff, arrow: 0xd6f2ff },
    accent: 0xbfe9ff,
    // Ice block with a snow cap and a bright facet.
    obstacle: (g, x, y, rand) => {
      const lean = (rand() - 0.5) * 6;
      g.fillStyle(0x04080c, 0.45);
      g.fillEllipse(x + 30, y + 46, 42, 12);
      g.fillStyle(0x3b6680);
      g.fillPoints([{ x: x + 10, y: y + 46 }, { x: x + 14 + lean, y: y + 14 }, { x: x + 40 + lean, y: y + 10 }, { x: x + 48, y: y + 44 }], true);
      g.fillStyle(0x7fb6d4);
      g.fillPoints([{ x: x + 14 + lean, y: y + 14 }, { x: x + 40 + lean, y: y + 10 }, { x: x + 30, y: y + 30 }], true);
      g.fillStyle(0xe8f6ff);
      g.fillEllipse(x + 27 + lean, y + 13, 28, 7);
    },
    decor: (g, x, y, rand) => {
      const cx = x + 12 + rand() * 32,
        cy = y + 12 + rand() * 32;
      if (rand() < 0.55) {
        // Snow crystal.
        g.lineStyle(1, 0x5d7f95, 0.9);
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          g.lineBetween(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
        }
      } else {
        g.fillStyle(0x223747);
        g.fillEllipse(cx, cy, 18 + rand() * 10, 6);
      }
    },
    // Snow drifting across the field, slightly faster along the path.
    ambient: ({ g, map, path, clock, hash, blocked, still }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      for (let k = 0; k < map.columns * 2; k++) {
        const s = hash(k, 0),
          fy = ((clock * (14 + s * 10) + s * h * 3) % (h + 20)) - 10,
          fx = (s * w * 7 + Math.sin(clock * 0.8 + k) * 12) % w;
        g.fillStyle(0xeaf7ff, 0.25 + s * 0.35);
        fillRound(g, fx, fy, 1 + s * 1.2);
      }
      g.fillStyle(0xd6f2ff, 0.3);
      flow(path, clock, 1.6, 1.1, (p, k) => fillRound(g, p.x + ((k % 3) - 1) * 8, p.y + (((k + 1) % 3) - 1) * 8, 1.5));
    },
};
