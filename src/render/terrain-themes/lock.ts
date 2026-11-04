import { CELL, fillRound, shade } from "../shapes";
import { flow, type Theme } from "./kit";

export const lock: Theme = {
    backdrop: 0x0b1522,
    ground: [0x112033, 0x0f1c2d],
    grid: 0x2f4560,
    path: { edge: 0x2f6f8f, bed: 0x10304a, line: 0x5fc8e8, arrow: 0x6ad3f0 },
    accent: 0x7fe3ff,
    // Bulkhead block with a split panel, rivets, a warning lamp and a hazard stripe.
    obstacle: (g, x, y) => {
      g.fillStyle(0x050b10, 0.5);
      g.fillRoundedRect(x + 8, y + 10, 44, 44, 3);
      g.fillStyle(0x1c2a3a);
      g.fillRoundedRect(x + 6, y + 6, 44, 44, 3);
      g.lineStyle(1, shade(0x1c2a3a, 0.25));
      g.lineBetween(x + 9, y + 7, x + 47, y + 7);
      g.lineBetween(x + 7, y + 9, x + 7, y + 47);
      g.fillStyle(0x243548);
      g.fillRect(x + 12, y + 12, 32, 24);
      g.lineStyle(1, 0x14202d);
      g.lineBetween(x + 26, y + 12, x + 26, y + 36);
      g.fillStyle(0x0b121a);
      g.fillCircle(x + 37, y + 19, 3.5);
      g.fillStyle(0x6b5420);
      g.fillCircle(x + 37, y + 19, 2);
      g.fillStyle(0x4a6680);
      for (const [dx, dy] of [[10, 10], [46, 10], [10, 46], [46, 46]]) g.fillCircle(x + dx, y + dy, 1.5);
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 ? 0x1c2a3a : 0xe0b84a, 0.85);
        g.fillPoints([
          { x: x + 12 + i * 8, y: y + 46 },
          { x: x + 16 + i * 8, y: y + 40 },
          { x: x + 24 + i * 8, y: y + 40 },
          { x: x + 20 + i * 8, y: y + 46 },
        ], true);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        gx = x + 8 + rand() * 26,
        gy = y + 8 + rand() * 30;
      if (kind < 0.4) {
        g.lineStyle(1, 0x1f3248, 0.9);
        g.strokeRect(gx, gy, 16, 10);
        for (let i = 1; i < 4; i++) g.lineBetween(gx + i * 4, gy, gx + i * 4, gy + 10);
      } else if (kind < 0.65) {
        // Floor hatch with a handle.
        g.fillStyle(0x0d1826);
        g.fillRoundedRect(gx, gy, 18, 14, 2);
        g.lineStyle(1, 0x24384f);
        g.strokeRoundedRect(gx, gy, 18, 14, 2);
        g.lineStyle(2, 0x2f4762);
        g.lineBetween(gx + 6, gy + 7, gx + 12, gy + 7);
      } else if (kind < 0.85) {
        // Pipe across the cell with a clamp.
        const py = y + 12 + rand() * 32;
        g.lineStyle(4, 0x18283a);
        g.lineBetween(x, py, x + CELL, py);
        g.lineStyle(1, 0x2c435c);
        g.lineBetween(x, py - 1, x + CELL, py - 1);
        g.fillStyle(0x2a4058);
        g.fillRect(x + 10 + rand() * 30, py - 3, 3, 6);
      } else {
        g.fillStyle(0x2a4058);
        g.fillCircle(gx, gy, 1.5);
        g.fillCircle(gx + 9, gy, 1.5);
      }
    },
    // Ripples flowing down the channel, shimmer on its walls, warning lamps on some bulkheads.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      g.lineStyle(1.5, 0x7fe3ff, 0.35);
      flow(path, clock, 0.75, 0.9, (p, k) => {
        const side = ((k % 3) - 1) * 9,
          nx = -Math.sin(p.angle) * side,
          ny = Math.cos(p.angle) * side,
          dx = Math.cos(p.angle) * 4,
          dy = Math.sin(p.angle) * 4;
        g.lineBetween(p.x + nx - dx, p.y + ny - dy, p.x + nx + dx, p.y + ny + dy);
      });
      g.lineStyle(1, 0x7fe3ff, 0.18);
      flow(path, clock, 1.5, 0.6, (p) => {
        const nx = -Math.sin(p.angle) * 19,
          ny = Math.cos(p.angle) * 19,
          dx = Math.cos(p.angle) * 6,
          dy = Math.sin(p.angle) * 6;
        for (const sign of [-1, 1]) g.lineBetween(p.x + sign * nx - dx, p.y + sign * ny - dy, p.x + sign * nx + dx, p.y + sign * ny + dy);
      });
      for (const b of blocked) {
        const h = hash(b.x, b.y);
        if (h >= 0.5) continue;
        const s = 0.5 + 0.5 * Math.sin(clock * 3 + h * 30);
        glow.fillStyle(0xffb84a, 0.2 * s * lit);
        fillRound(glow, b.x * CELL + 37, b.y * CELL + 19, 9);
        g.fillStyle(0xffc857, 0.35 + 0.65 * s);
        fillRound(g, b.x * CELL + 37, b.y * CELL + 19, 2);
      }
    },
};
