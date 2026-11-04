import { CELL, fillRound, polygon, strokeOval } from "../shapes";
import { along, flow, zigzagPoints, type Theme } from "./kit";

// Crystal Cave: turquoise cave, clear quartz columns and cut-open amethyst geodes.
export const geode: Theme = {
    backdrop: 0x081a1d,
    ground: [0x0f2a2e, 0x0d2528],
    grid: 0x1c474c,
    path: { edge: 0x2a8a86, bed: 0x07181b, line: 0x5ef2e0, arrow: 0xa86cf0 },
    accent: 0x5ef2e0,
    obstacle: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 28;
      g.fillStyle(0x020c0e, 0.55);
      g.fillEllipse(cx + 2, y + 47, 42, 11);
      if (kind < 0.55) {
        // Clear hexagonal quartz columns with pointed tips and bright edges.
        const cols: [number, number, number][] = [
          [-10, 26, 13],
          [9, 20, 11],
          [0, 34, 12],
        ];
        for (const [dx, h, w] of cols) {
          const bx = cx + dx + (rand() - 0.5) * 3,
            by = y + 47,
            top = by - h;
          g.fillStyle(0x7ad8d8, 0.85);
          g.fillRect(bx - w / 2, top, w, h);
          g.fillPoints([{ x: bx - w / 2, y: top }, { x: bx - w / 4, y: top - 7 }, { x: bx + w / 4, y: top - 7 }, { x: bx + w / 2, y: top }], true);
          g.fillStyle(0xe8ffff, 0.75);
          g.fillRect(bx - w / 2, top, w * 0.32, h);
          g.fillPoints([{ x: bx - w / 2, y: top }, { x: bx - w / 4, y: top - 7 }, { x: bx, y: top - 7 }, { x: bx, y: top }], true);
          g.fillStyle(0x3a9aa0, 0.8);
          g.fillRect(bx + w * 0.18, top, w * 0.32, h);
          g.lineStyle(1, 0xf4ffff, 0.95);
          g.strokePoints([{ x: bx - w / 2, y: by }, { x: bx - w / 2, y: top }, { x: bx - w / 4, y: top - 7 }, { x: bx + w / 4, y: top - 7 }, { x: bx + w / 2, y: top }, { x: bx + w / 2, y: by }], false);
          g.lineBetween(bx, top, bx, by);
        }
      } else {
        // Cut-open geode: grey rock shell around an amethyst crystal bed.
        const cy = y + 34;
        g.fillStyle(0x5a6064);
        g.fillCircle(cx, cy, 17);
        g.fillStyle(0x7a8286);
        g.fillCircle(cx - 2, cy - 2, 14);
        g.fillStyle(0xd8d4f0);
        g.fillCircle(cx, cy, 12);
        g.fillStyle(0x7a3cc0);
        g.fillCircle(cx, cy, 10);
        g.fillStyle(0xa86cf0);
        g.fillCircle(cx, cy + 1, 7);
        g.fillStyle(0xd2a8ff);
        for (let i = 0; i < 6; i++) {
          const a = rand() * Math.PI * 2,
            r = 2 + rand() * 6;
          polygon(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 3, 0xd2a8ff, a);
        }
        g.fillStyle(0xf0e0ff, 0.9);
        g.fillCircle(cx - 3, cy - 3, 1.4);
        g.lineStyle(1, 0x3a4044);
        g.strokeCircle(cx, cy, 17);
      }
    },
    decor: (g, x, y, rand) => {
      const cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (rand() < 0.55) {
        // Thin glowing mineral vein.
        const pts = zigzagPoints(cx - 10, cy, rand, 22, 4);
        g.lineStyle(3, 0x5ef2e0, 0.1);
        g.strokePoints(pts, false);
        g.lineStyle(1, 0x5ef2e0, 0.5);
        g.strokePoints(pts, false);
      } else {
        // Tiny glow-mushrooms.
        for (let i = 0; i < 2; i++) {
          const mx = cx + i * 6 - 3,
            my = cy + (rand() - 0.5) * 4;
          g.fillStyle(0x5ef2e0, 0.12);
          g.fillCircle(mx, my, 6);
          g.fillStyle(0x1a5a60);
          g.fillRect(mx - 0.5, my, 1, 3);
          g.fillStyle(0x5ef2e0, 0.9);
          g.fillEllipse(mx, my, 5, 3);
        }
      }
    },
    // Twinkling glints on the quartz and geodes, light caustics drifting along the path.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      for (const b of blocked) {
        const o = hash(b.x, b.y),
          quartz = o < 0.55,
          tw = Math.sin(clock * 2.2 + o * 40),
          gx = b.x * CELL + 20 + hash(b.y, b.x) * 18,
          gy = b.y * CELL + (quartz ? 14 : 26) + hash(b.x, b.y + 9) * 12;
        if (!quartz) {
          glow.fillStyle(0xa86cf0, (0.06 + 0.06 * (0.5 + 0.5 * tw)) * lit);
          fillRound(glow, b.x * CELL + 28, b.y * CELL + 34, 22);
        }
        if (tw < 0.4) continue;
        const r = 2 + 4 * tw;
        g.lineStyle(1.2, quartz ? 0xf4ffff : 0xe8d0ff, 0.9 * tw);
        g.lineBetween(gx - r, gy, gx + r, gy);
        g.lineBetween(gx, gy - r, gx, gy + r);
      }
      flow(path, clock, 1.5, 0.3, (p, k) => {
        const s = 0.5 + 0.5 * Math.sin(clock * 0.9 + k * 2.3),
          ox = Math.sin(clock * 0.5 + k * 1.3) * 10,
          oy = Math.cos(clock * 0.45 + k * 2.1) * 6;
        g.lineStyle(1.5, 0x9ffcf0, 0.05 + 0.1 * s);
        strokeOval(g, p.x + ox, p.y + oy, 22 + 10 * s, 9 + 4 * s);
        g.lineStyle(1, 0xc8b0ff, 0.04 + 0.07 * (1 - s));
        strokeOval(g, p.x - ox, p.y - oy, 14 + 8 * s, 6 + 3 * s);
      });
    },
};
