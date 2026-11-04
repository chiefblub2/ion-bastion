import { CELL, fillRound, shade, strokeRound } from "../shapes";
import { flow, type Theme } from "./kit";

export const core: Theme = {
    backdrop: 0x0e1114,
    ground: [0x161b20, 0x13181c],
    grid: 0x39424b,
    path: { edge: 0x8a6a2a, bed: 0x23282e, line: 0xe0b84a, arrow: 0xe8c25a },
    // Mint, not gold, so the reactor stands apart from the amber entry.
    accent: 0x93f5b8,
    // Machinery block with a vented panel and flanged pipes; its status light is animated.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x050709, 0.5);
      g.fillRoundedRect(x + 9, y + 11, 42, 42, 4);
      g.fillStyle(0x232b33);
      g.fillRoundedRect(x + 7, y + 7, 42, 42, 4);
      g.lineStyle(1, shade(0x232b33, 0.2));
      g.lineBetween(x + 10, y + 8, x + 46, y + 8);
      g.fillStyle(0x2c3640);
      g.fillRect(x + 12, y + 12, 22, 32);
      g.lineStyle(1, 0x3a4652);
      g.strokeRect(x + 12, y + 12, 22, 32);
      g.lineStyle(1.5, 0x161b20);
      for (let i = 0; i < 3; i++) g.lineBetween(x + 16, y + 15 + i * 3, x + 30, y + 15 + i * 3);
      g.lineStyle(3, 0x3d4a55);
      const pipe = y + 20 + Math.floor(rand() * 2) * 8;
      g.lineBetween(x + 7, pipe, x + 49, pipe);
      g.lineBetween(x + 7, pipe + 12, x + 49, pipe + 12);
      g.fillStyle(0x55636f);
      for (const py of [pipe, pipe + 12]) {
        g.fillRect(x + 7, py - 3.5, 3, 7);
        g.fillRect(x + 46, py - 3.5, 3, 7);
      }
      g.fillStyle(0x0b0e11);
      g.fillCircle(x + 42, y + 14, 3);
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.35) {
        g.lineStyle(1, 0x1f262d, 0.9);
        g.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
        g.fillStyle(0x262e36);
        for (const [dx, dy] of [[8, 8], [CELL - 8, 8], [8, CELL - 8], [CELL - 8, CELL - 8]]) g.fillCircle(x + dx, y + dy, 1.3);
      } else if (kind < 0.7) {
        const vx = x + 14 + rand() * 18,
          vy = y + 14 + rand() * 22;
        g.lineStyle(2, 0x0c0f12);
        for (let i = 0; i < 3; i++) g.lineBetween(vx, vy + i * 5, vx + 12, vy + i * 5);
      } else {
        // Cable from the left edge to the bottom edge.
        const a = { x, y: y + 10 + rand() * 30 },
          b = { x: x + 10 + rand() * 30, y: y + CELL },
          c = { x: x + 20 + rand() * 20, y: y + 10 + rand() * 20 },
          cable = Array.from({ length: 7 }, (_, i) => {
            const t = i / 6;
            return {
              x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
              y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
            };
          });
        g.lineStyle(3, 0x0a0d10);
        g.strokePoints(cable, false);
        g.lineStyle(1, 0x2a333c);
        g.strokePoints(cable, false);
      }
    },
    // Blinking status lights, energy pulses running to the reactor and a scan pulse from it.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      for (const b of blocked) {
        const h = hash(b.x, b.y),
          on = Math.floor(clock * 1.5 + h * 4) % 2 === 0;
        g.fillStyle(h < 0.7 ? 0x93f5b8 : 0xffc857, on ? 1 : 0.2);
        fillRound(g, b.x * CELL + 42, b.y * CELL + 14, 2);
      }
      flow(path, clock, 4, 1.8, (p) => {
        glow.fillStyle(0xffc857, 0.2 * lit);
        fillRound(glow, p.x, p.y, 7);
        g.fillStyle(0xffe6a0, 0.6);
        fillRound(g, p.x, p.y, 2.5);
      });
      const end = path[path.length - 1],
        reach = Math.hypot(map.columns, map.rows) * CELL,
        r = ((clock * 90) % reach) + 30;
      // A big piece's own call has no path and no board.
      if (!end || !reach) return;
      glow.lineStyle(2, 0xffc857, 0.16 * (1 - r / reach) * lit);
      strokeRound(glow, end.x, end.y, r);
    },
};
