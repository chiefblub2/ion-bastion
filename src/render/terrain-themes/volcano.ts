import { CELL, fillOval, fillRound } from "../shapes";
import { along, flow, zigzagPoints, type Theme } from "./kit";

// Volcano Chain: light-grey ash ground, sulphur yellow, lava glow; obsidian spikes and sulphur craters.
export const volcano: Theme = {
    backdrop: 0x2a2726,
    ground: [0x4a4542, 0x433f3c],
    grid: 0x5f5954,
    path: { edge: 0x7a6a3a, bed: 0x2c2826, line: 0xff5a1a, arrow: 0xf2d23c },
    accent: 0xf2d23c,
    obstacle: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 28;
      g.fillStyle(0x0c0a09, 0.55);
      g.fillEllipse(cx + 2, y + 47, 42, 11);
      if (kind < 0.55) {
        // Obsidian spires: black glossy shards with a pale highlight edge.
        const spires: [number, number, number][] = [
          [-11, 24, 17],
          [10, 20, 14],
          [0, 36, 8],
        ];
        for (const [dx, h, w] of spires) {
          const bx = cx + dx + (rand() - 0.5) * 3,
            by = y + 47,
            lean = (rand() - 0.5) * 6;
          g.fillStyle(0x0d0c0e);
          g.fillPoints([{ x: bx - w / 2, y: by }, { x: bx - w * 0.3 + lean, y: by - h * 0.7 }, { x: bx + lean, y: by - h - 8 }, { x: bx + w * 0.35 + lean, y: by - h * 0.6 }, { x: bx + w / 2, y: by }], true);
          g.fillStyle(0x2c2a33);
          g.fillPoints([{ x: bx - w * 0.3 + lean, y: by - h * 0.7 }, { x: bx + lean, y: by - h - 8 }, { x: bx + w * 0.05 + lean, y: by - h * 0.4 }, { x: bx - w * 0.2, y: by - 2 }], true);
          g.lineStyle(1, 0x9a96ac, 0.7);
          g.lineBetween(bx + lean, by - h - 8, bx - w * 0.3 + lean, by - h * 0.7);
        }
        g.fillStyle(0xff5a1a, 0.4);
        g.fillEllipse(cx, y + 47, 22, 4);
      } else {
        // Sulfur vent: yellow-crusted crater rim with a faint plume.
        g.fillStyle(0x3a3532);
        g.fillEllipse(cx, y + 40, 40, 17);
        g.fillStyle(0xc9a92c);
        g.fillEllipse(cx, y + 38, 36, 14);
        g.fillStyle(0xf2d23c);
        g.fillEllipse(cx - 3, y + 36, 28, 9);
        g.fillStyle(0x4a3a10);
        g.fillEllipse(cx, y + 38, 18, 6);
        g.fillStyle(0xff5a1a, 0.55);
        g.fillEllipse(cx, y + 38.5, 9, 3);
        for (let i = 0; i < 4; i++) {
          g.fillStyle(0xfff08a, 0.9);
          g.fillCircle(cx - 15 + rand() * 30, y + 38 + (rand() - 0.5) * 10, 1.2);
        }
        g.fillStyle(0xd8d4c8, 0.14);
        g.fillEllipse(cx + 3, y + 24, 14, 12);
        g.fillEllipse(cx + 6, y + 13, 18, 12);
      }
    },
    decor: (g, x, y, rand) => {
      const cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (rand() < 0.55) {
        // Pale ash drift.
        g.fillStyle(0xaaa49b, 0.35);
        g.fillEllipse(cx, cy, 18 + rand() * 10, 6 + rand() * 3);
        g.fillStyle(0xd0cac0, 0.3);
        g.fillEllipse(cx - 2, cy - 1, 10 + rand() * 6, 3);
      } else {
        // Cooled lava streak with a dim orange core.
        const pts = zigzagPoints(cx - 8, cy, rand, 16, 3);
        g.lineStyle(4, 0x1c1816, 0.8);
        g.strokePoints(pts, false);
        g.lineStyle(1.5, 0xc2441a, 0.55);
        g.strokePoints(pts, false);
      }
    },
    // Ash flakes falling slowly, a lava glow pulsing along the path and vent plumes.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      flow(path, clock, 2.4, 0.35, (p, k) => {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 1.3 + k * 1.9);
        glow.fillStyle(0xff5a1a, (0.05 + 0.06 * pulse) * lit);
        fillOval(glow, p.x, p.y, 52, 30);
        glow.fillStyle(0xff8a3a, (0.06 + 0.07 * pulse) * lit);
        fillRound(glow, p.x, p.y, 10);
      });
      for (const b of blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        for (let i = 0; i < 3; i++) {
          const life = (clock * 0.25 + o * 7 + i / 3) % 1;
          g.fillStyle(0xd8d4c8, 0.12 * (1 - life));
          fillRound(g, b.x * CELL + 28 + Math.sin(life * 4 + o * 9) * 6 + life * 8, b.y * CELL + 30 - life * 30, 5 + life * 8);
        }
      }
      for (let k = 0; k < Math.ceil(map.columns * 2.2); k++) {
        const s = hash(k, 91),
          life = (clock * (0.035 + s * 0.03) + hash(k, 92)) % 1,
          fx = s * w + Math.sin(clock * 0.6 + s * 30) * 14 + life * 30,
          fy = life * (h + 20) - 10;
        g.fillStyle(0xb8b2a8, 0.28 + 0.2 * s);
        g.fillRect(fx, fy, 2 + s * 1.5, 1.6);
      }
    },
};
