import { CELL, fillRound } from "../shapes";
import { along, flow, type Theme } from "./kit";

export const orbit: Theme = {
    backdrop: 0x070a14,
    ground: [0x10162a, 0x0e1325],
    grid: 0x2c3a60,
    path: { edge: 0x4a5fa8, bed: 0x141c38, line: 0x8fb0ff, arrow: 0xa4c0ff },
    accent: 0x8fb0ff,
    // Equipment rack with a solar panel grid.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x02030a, 0.5);
      g.fillRect(x + 9, y + 11, 42, 42);
      g.fillStyle(0x1c2440);
      g.fillRect(x + 7, y + 7, 42, 42);
      const vertical = rand() < 0.5;
      g.fillStyle(0x253a78);
      g.fillRect(x + 11, y + 11, 34, 34);
      g.lineStyle(1, 0x5a78c8, 0.8);
      for (let i = 1; i < 4; i++) {
        const o = 11 + (i * 34) / 4;
        if (vertical) g.lineBetween(x + o, y + 11, x + o, y + 45);
        else g.lineBetween(x + 11, y + o, x + 45, y + o);
      }
      g.lineBetween(x + 11, y + 28, x + 45, y + 28);
    },
    decor: (g, x, y, rand) => {
      if (rand() < 0.5) {
        g.lineStyle(1, 0x1a2242, 0.9);
        g.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
        g.fillStyle(0x2a3866);
        for (const [dx, dy] of [[7, 7], [CELL - 7, 7], [7, CELL - 7], [CELL - 7, CELL - 7]]) g.fillCircle(x + dx, y + dy, 1.2);
      } else {
        g.fillStyle(0x6f86c8, 0.6);
        g.fillCircle(x + 8 + rand() * 40, y + 8 + rand() * 40, 0.8 + rand() * 0.6);
      }
    },
    // Twinkling stars, plus guide lights running along the path edges.
    ambient: ({ g, map, path, clock, hash, blocked }) => {
      for (let k = 0; k < map.columns * 2; k++) {
        const s = hash(k, 1),
          t = hash(1, k),
          tw = Math.max(0, Math.sin(clock * (0.8 + s) + t * 30));
        g.fillStyle(0xdbe6ff, tw * 0.7);
        fillRound(g, s * map.columns * CELL, t * map.rows * CELL, 1 + tw);
      }
      flow(path, clock, 1, 2.2, (p) => {
        const nx = -Math.sin(p.angle) * 17,
          ny = Math.cos(p.angle) * 17;
        g.fillStyle(0x8fb0ff, 0.6);
        fillRound(g, p.x + nx, p.y + ny, 1.6);
        fillRound(g, p.x - nx, p.y - ny, 1.6);
      });
    },
};
