import { CELL, fillOval, fillRound } from "../shapes";
import { flow, type Theme } from "./kit";

// Jungle: dense trees and mossy temple stones, fireflies and mist.
export const jungle: Theme = {
    backdrop: 0x08140a,
    ground: [0x0f2412, 0x0d2010],
    grid: 0x1c3a20,
    path: { edge: 0x3a7a3a, bed: 0x0a1a0c, line: 0xb6ff6a, arrow: 0xd8ffa0 },
    accent: 0xb6ff6a,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x020804, 0.55);
      g.fillEllipse(x + 28, y + 47, 40, 11);
      if (kind < 0.6) {
        // Dense tree: dark trunk under layered leaf circles.
        const cx = x + 28 + (rand() - 0.5) * 4;
        g.fillStyle(0x2a1c10);
        g.fillRect(cx - 3, y + 30, 6, 17);
        g.fillStyle(0x3a2a18);
        g.fillRect(cx - 3, y + 30, 2, 17);
        const layers: [number, number, number, number][] = [
          [-9, 24, 12, 0x14391a],
          [9, 25, 12, 0x14391a],
          [0, 17, 14, 0x1f5a26],
          [-5, 11, 9, 0x2a7a32],
          [6, 13, 8, 0x2f8a38],
        ];
        for (const [dx, dy, r, color] of layers) {
          g.fillStyle(color);
          g.fillCircle(cx + dx + (rand() - 0.5) * 2, y + dy, r);
        }
        g.fillStyle(0x6ac04a, 0.45);
        g.fillCircle(cx - 4, y + 9, 3);
      } else {
        // Mossy temple stone with a carved glyph.
        const cx = x + 28,
          top = y + 18 + rand() * 4;
        g.fillStyle(0x3c4a3a);
        g.fillPoints([{ x: cx - 15, y: y + 47 }, { x: cx - 13, y: top }, { x: cx + 13, y: top }, { x: cx + 15, y: y + 47 }], true);
        g.fillStyle(0x56685a);
        g.fillRect(cx - 13, top, 26, 3);
        g.fillStyle(0x2f7a34, 0.85);
        g.fillEllipse(cx - 6, top + 1, 14, 6);
        g.fillRect(cx + 7, top + 6, 5, 10);
        g.lineStyle(1.5, 0xb6ff6a, 0.8);
        const gy = top + 16;
        g.strokeCircle(cx, gy, 5);
        g.lineBetween(cx, gy - 5, cx, gy + 5);
        g.lineBetween(cx - 5, gy, cx + 5, gy);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.4) {
        // Fern: radiating fronds.
        g.lineStyle(1.5, 0x3a9a44, 0.85);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          g.lineBetween(cx, cy + 4, cx + Math.cos(a) * 9, cy + 4 + Math.sin(a) * 9);
        }
      } else if (kind < 0.7) {
        // Flower on a stem.
        const petal = rand() < 0.5 ? 0xff8ac0 : 0xffd84a;
        g.lineStyle(1, 0x2f8a38, 0.9);
        g.lineBetween(cx, cy + 5, cx, cy - 1);
        g.fillStyle(petal, 0.9);
        for (let i = 0; i < 4; i++) g.fillCircle(cx + Math.cos(i * 1.57) * 2.2, cy - 1 + Math.sin(i * 1.57) * 2.2, 1.6);
        g.fillStyle(0xfff4c0);
        g.fillCircle(cx, cy - 1, 1);
      } else {
        // Root running over the ground.
        g.lineStyle(2.5, 0x3a2a18, 0.85);
        g.strokePoints([{ x: cx - 10, y: cy + 2 }, { x: cx - 3, y: cy - 2 }, { x: cx + 4, y: cy + 2 }, { x: cx + 11, y: cy - 1 }], false);
        g.lineStyle(1, 0x5a4428, 0.7);
        g.strokePoints([{ x: cx - 10, y: cy + 1 }, { x: cx - 3, y: cy - 3 }, { x: cx + 4, y: cy + 1 }], false);
      }
    },
    // Swaying leaf shadows, fireflies and a faint mist over the path.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      for (let k = 0; k < Math.ceil(map.columns / 2); k++) {
        const s = hash(k, 77),
          sway = Math.sin(clock * 0.5 + s * 20) * 10,
          cx = s * w + sway,
          cy = hash(k, 78) * h;
        g.fillStyle(0x020a04, 0.07);
        fillOval(g, cx, cy, 70, 26);
        fillOval(g, cx + 20 + sway * 0.5, cy + 14, 40, 16);
      }
      flow(path, clock, 2.2, 0.25, (p, k) => {
        const swell = 0.5 + 0.5 * Math.sin(clock * 0.6 + k * 1.7);
        g.fillStyle(0xcfffd0, 0.035 + 0.03 * swell);
        fillOval(g, p.x + Math.sin(clock * 0.4 + k) * 8, p.y + 4, 46, 18);
      });
      for (let k = 0; k < Math.ceil(map.columns * 1.2); k++) {
        const s = hash(k, 55),
          t = clock * (0.15 + s * 0.1) + s * 30,
          fx = ((s * 7.3) % 1) * w + Math.sin(t) * 22,
          fy = hash(k, 56) * h + Math.cos(t * 0.8) * 16,
          on = 0.5 + 0.5 * Math.sin(clock * 1.6 + s * 40);
        glow.fillStyle(0xd8ff7a, 0.16 * on * lit);
        fillRound(glow, fx, fy, 7);
        g.fillStyle(0xf4ffb0, 0.35 + 0.5 * on);
        fillRound(g, fx, fy, 1.6);
      }
    },
};
