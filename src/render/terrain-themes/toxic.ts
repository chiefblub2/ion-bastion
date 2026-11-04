import { CELL, fillRound, strokeRound } from "../shapes";
import { flow, type Theme } from "./kit";

export const toxic: Theme = {
    backdrop: 0x0f140c,
    ground: [0x182014, 0x151c11],
    grid: 0x3a4a2c,
    path: { edge: 0x5e7a22, bed: 0x1f2a12, line: 0xb6f04a, arrow: 0xc4f562 },
    accent: 0xb6f04a,
    // Sunken waste barrel in a pool of sludge.
    obstacle: (g, x, y, rand) => {
      const tilt = (rand() - 0.5) * 8;
      g.fillStyle(0x2c3b14, 0.9);
      g.fillEllipse(x + 28, y + 40, 46, 18);
      g.fillStyle(0x6f8f2a, 0.6);
      g.fillEllipse(x + 26, y + 39, 30, 9);
      g.fillStyle(0x3c3a2a);
      g.fillRoundedRect(x + 16 + tilt, y + 10, 24, 30, 3);
      g.fillStyle(0x4c4936);
      g.fillRect(x + 16 + tilt, y + 18, 24, 3);
      g.fillRect(x + 16 + tilt, y + 30, 24, 3);
      g.fillStyle(0xe0c040);
      g.fillTriangle(x + 28 + tilt, y + 21, x + 23 + tilt, y + 29, x + 33 + tilt, y + 29);
    },
    decor: (g, x, y, rand) => {
      const cx = x + 10 + rand() * 36,
        cy = y + 10 + rand() * 36;
      if (rand() < 0.5) {
        g.fillStyle(0x24321a);
        g.fillEllipse(cx, cy, 16 + rand() * 12, 8 + rand() * 4);
      } else {
        g.fillStyle(0x3a4a22);
        for (let i = 0; i < 3; i++) g.fillCircle(cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 10, 1.5 + rand());
      }
    },
    // Gas bubbles rise from the sludge pools and from the channel.
    ambient: ({ g, map, path, clock, hash, blocked }) => {
      for (const b of blocked) {
        const h = hash(b.x, b.y),
          life = (clock * 0.6 + h * 5) % 1;
        g.lineStyle(1.5, 0xb6f04a, 0.7 * (1 - life));
        strokeRound(g, b.x * CELL + 12 + h * 30, b.y * CELL + 40 - life * 26, 2 + life * 3);
      }
      flow(path, clock, 1.3, 0.5, (p, k) => {
        const pop = (clock * 0.9 + k * 0.37) % 1;
        g.fillStyle(0xc4f562, 0.45 * (1 - pop));
        fillRound(g, p.x + ((k % 3) - 1) * 9, p.y + (((k * 2) % 3) - 1) * 7, 1.5 + pop * 3);
      });
    },
};
