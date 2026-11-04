import { fillRound, polygon, px, strokeOval } from "../shapes";
import { along, flow, zigzag, type Theme } from "./kit";

// Moon Lake: moonlit rocks with shells and tidepools, foam drifting along the path.
export const tide: Theme = {
    backdrop: 0x081322,
    ground: [0x14263a, 0x1a2f47],
    grid: 0x2c4663,
    path: { edge: 0x3a5a7c, bed: 0x0c1c30, line: 0xbcd6f0, arrow: 0xdceaf8 },
    accent: 0xbcd6f0,
    // Rock with a shell (kind < 0.55) or a tidepool ringed by stones. The first draw matches `hash`.
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x020812, 0.55);
      g.fillEllipse(x + 29, y + 46, 42, 11);
      if (kind < 0.55) {
        const cx = x + 28;
        g.fillStyle(0x34485e);
        g.fillPoints([{ x: cx - 19, y: y + 46 }, { x: cx - 16, y: y + 28 }, { x: cx - 6, y: y + 15 + rand() * 4 }, { x: cx + 8, y: y + 17 }, { x: cx + 18, y: y + 30 }, { x: cx + 20, y: y + 46 }], true);
        g.fillStyle(0x56708c);
        g.fillPoints([{ x: cx - 16, y: y + 28 }, { x: cx - 6, y: y + 15 }, { x: cx + 1, y: y + 18 }, { x: cx - 6, y: y + 32 }, { x: cx - 12, y: y + 40 }], true);
        g.lineStyle(1, 0xcfe2f4, 0.5);
        g.lineBetween(cx - 6, y + 15, cx + 8, y + 17);
        g.lineStyle(1, 0x1c2c40, 0.8);
        zigzag(g, cx + 4, y + 26, rand, 12, 3);
        // Spiral shell on the ledge.
        const sx = cx + 9,
          sy = y + 41;
        g.fillStyle(0xdbe7f2);
        g.fillCircle(sx, sy, 4.5);
        g.lineStyle(1, 0x8aa4bc);
        g.strokeCircle(sx, sy, 2.8);
        g.strokeCircle(sx + 0.6, sy, 1.2);
      } else {
        const cx = x + 28,
          cy = y + 32;
        g.fillStyle(0x34485e);
        g.fillEllipse(cx, cy, 44, 28);
        g.fillStyle(0x56708c);
        g.fillEllipse(cx - 2, cy - 3, 40, 22);
        g.fillStyle(0x0c2036);
        g.fillEllipse(cx, cy, 28, 15);
        g.fillStyle(0x1f4668, 0.9);
        g.fillEllipse(cx, cy + 1, 22, 10);
        g.fillStyle(0xdceaf8, 0.5);
        g.fillEllipse(cx - 5, cy - 1, 8, 2);
        g.fillStyle(0xe6c0b8);
        g.fillCircle(cx + 5, cy + 2, 1.5);
        for (let i = 0; i < 3; i++) polygon(g, x + 10 + i * 18, y + 41 + rand() * 4, 3 + rand() * 2, 5, 0x6f8aa6, rand() * 3);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 12 + rand() * 32;
      if (kind < 0.5) {
        // Small scallop shell.
        g.fillStyle(0x020812, 0.5);
        g.fillEllipse(cx + 1, cy + 2, 9, 4);
        g.fillStyle(0xdbe7f2, 0.9);
        g.fillPoints([{ x: cx - 4, y: cy + 2 }, { x: cx - 3, y: cy - 2 }, { x: cx, y: cy - 3.5 }, { x: cx + 3, y: cy - 2 }, { x: cx + 4, y: cy + 2 }], true);
        g.lineStyle(1, 0x8aa4bc, 0.8);
        g.lineBetween(cx, cy + 2, cx, cy - 3);
        g.lineBetween(cx, cy + 2, cx - 3, cy - 2);
        g.lineBetween(cx, cy + 2, cx + 3, cy - 2);
      } else {
        // Foam specks.
        g.fillStyle(0xdceaf8, 0.55);
        for (let i = 0; i < 4; i++) g.fillCircle(cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 0.8 + rand() * 1.2);
        g.lineStyle(1, 0xbcd6f0, 0.25);
        g.strokeEllipse(cx, cy, 16, 6);
      }
    },
    // Foam rings drifting along the path, shimmer on the tidepools.
    ambient: ({ g, map, clock, path, hash, blocked }) => {
      flow(path, clock, 1.6, 0.45, (p, k) => {
        const s = 0.5 + 0.5 * Math.sin(clock * 1.1 + k * 2.1),
          ox = Math.sin(clock * 0.7 + k * 1.7) * 9,
          oy = Math.cos(clock * 0.6 + k * 2.4) * 6;
        g.lineStyle(1.2, 0xdceaf8, 0.07 + 0.12 * s);
        strokeOval(g, p.x + ox, p.y + oy, 16 + 8 * s, 6 + 3 * s);
        g.fillStyle(0xf0f8ff, 0.12 + 0.2 * (1 - s));
        fillRound(g, p.x - ox, p.y - oy, 1.3);
        fillRound(g, p.x - ox * 0.5 + 4, p.y + oy * 0.6, 0.9);
      });
      for (const b of blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        const s = 0.5 + 0.5 * Math.sin(clock * 1.6 + o * 20);
        g.lineStyle(1, 0xdceaf8, 0.12 + 0.28 * s);
        strokeOval(g, px(b.x) + (s - 0.5) * 6, px(b.y) + 4, 8 + 6 * s, 3 + 2 * s);
      }
    },
};
