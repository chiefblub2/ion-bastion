import { CELL, fillOval, polygon, px } from "../shapes";
import { flow, wreck, type Theme } from "./kit";

// Dune Sea: sandstone spires and half-buried wrecks in rippled sand. First draw of `obstacle` picks the variant (ambient reads it from `hash`).
export const dune: Theme = {
    backdrop: 0x1a1206,
    ground: [0x2a1f10, 0x261c0e],
    grid: 0x4a3818,
    path: { edge: 0xc98a3a, bed: 0x524331, line: 0xffc46b, arrow: 0xffd48a },
    accent: 0xffc46b,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      // Soft shadow, stretched away from the light.
      g.fillStyle(0x0a0602, 0.5);
      g.fillEllipse(x + 32, y + 47, 42, 11);
      if (kind < 0.55) {
        // Sandstone spire with banded strata and a lit left face.
        const lean = (rand() - 0.5) * 6,
          h = 28 + rand() * 12,
          top = y + 46 - h;
        g.fillStyle(0x6b4e28);
        g.fillPoints([{ x: x + 16, y: y + 46 }, { x: x + 21 + lean, y: top + 4 }, { x: x + 27 + lean, y: top }, { x: x + 35 + lean, y: top + 3 }, { x: x + 40, y: y + 46 }], true);
        g.fillStyle(0x8a6a3a);
        g.fillPoints([{ x: x + 16, y: y + 46 }, { x: x + 21 + lean, y: top + 4 }, { x: x + 27 + lean, y: top }, { x: x + 28, y: y + 46 }], true);
        g.lineStyle(1.5, 0x4a3418, 0.8);
        for (let i = 1; i < 4; i++) {
          const ly = top + (h * i) / 4;
          g.lineBetween(x + 18 + lean * (1 - i / 4) + 1, ly, x + 38 + lean * (1 - i / 4) - 1, ly + rand() * 2 - 1);
        }
        g.fillStyle(0xb08850, 0.5);
        g.fillTriangle(x + 21 + lean, top + 4, x + 27 + lean, top, x + 26 + lean, top + 10);
        // Drift of sand banked against the foot.
        g.fillStyle(0xa87c40, 0.8);
        g.fillEllipse(x + 22, y + 46, 22, 6);
      } else {
        // Half-buried wreck: tilted hull plate, ribs and a drift of sand over its lower half.
        const a = (rand() < 0.5 ? -1 : 1) * (0.25 + rand() * 0.25),
          c = Math.cos(a),
          s = Math.sin(a),
          at = (u: number, v: number) => ({ x: x + 28 + u * c - v * s, y: y + 32 + u * s + v * c });
        g.fillStyle(0x4a3a2e);
        g.fillPoints([at(-20, -12), at(18, -14), at(22, 6), at(-16, 10)], true);
        g.fillStyle(0x6a4a30);
        g.fillPoints([at(-20, -12), at(18, -14), at(19, -9), at(-19, -7)], true);
        g.lineStyle(2, 0x2a2018, 0.9);
        for (const u of [-10, 0, 10]) {
          const p = at(u, -8),
            q = at(u + 1, 8);
        g.lineBetween(p.x, p.y, q.x, q.y);
        }
        g.fillStyle(0x8a4a22, 0.8);
        g.fillCircle(at(-6, -3).x, at(-6, -3).y, 2);
        g.fillStyle(0xa87c40);
        g.fillPoints([{ x: x + 6, y: y + 46 }, { x: x + 14, y: y + 36 }, { x: x + 28, y: y + 38 }, { x: x + 44, y: y + 33 }, { x: x + 52, y: y + 46 }], true);
        g.fillStyle(0xc49a5a, 0.6);
        g.fillTriangle(x + 14, y + 36, x + 28, y + 38, x + 20, y + 41);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.5) {
        // Wind ripples: a few shallow arcs.
        g.lineStyle(1, 0x3d2c14, 0.85);
        for (let i = 0; i < 3; i++) {
          const ry = y + 12 + i * 12 + rand() * 4;
          g.beginPath();
          g.arc(x + 28 + (rand() - 0.5) * 6, ry + 14, 18 + rand() * 6, -2.4, -0.8);
          g.strokePath();
        }
        g.lineStyle(1, 0x5a4220, 0.5);
        g.lineBetween(cx - 8, cy + 2, cx + 6, cy + 2);
      } else if (kind < 0.8) {
        // Small stones with a lit edge.
        for (let i = 0; i < 3; i++) {
          const sx = cx + (rand() - 0.5) * 16,
            sy = cy + (rand() - 0.5) * 12,
            sr = 1.5 + rand() * 2;
          g.fillStyle(0x0a0602, 0.4);
          g.fillEllipse(sx + 1, sy + 1.5, sr * 2.4, sr);
          polygon(g, sx, sy, sr, 5, 0x5a4428, rand() * 3);
        }
      } else {
        // Bleached bones: a rib arc over a spine.
        g.lineStyle(1.5, 0xd8c8a0, 0.7);
        g.lineBetween(cx - 8, cy, cx + 8, cy);
        for (const dx of [-5, 0, 5]) {
          g.beginPath();
          g.arc(cx + dx, cy, 5, Math.PI, Math.PI * 2);
          g.strokePath();
        }
        g.fillStyle(0xd8c8a0, 0.8);
        g.fillCircle(cx + 10, cy, 2.2);
      }
    },
    // Sand blowing across the field in streaks, heat shimmer rising off the path, glowing heat haze at the wrecks.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      for (let k = 0; k < map.columns * 2; k++) {
        const s = hash(k, 3),
          t = hash(3, k),
          fx = ((clock * (50 + s * 40) + s * w * 5) % (w + 40)) - 20,
          fy = (t * h + Math.sin(clock * 0.6 + k) * 8) % h;
        g.fillStyle(0xe8c58a, 0.18 + s * 0.2);
        g.fillRect(fx, fy, 3 + s * 5, 1);
      }
      flow(path, clock, 1.1, 0.35, (p, k) => {
        const rise = (clock * 0.5 + k * 0.29) % 1,
          wob = Math.sin(clock * 3 + k * 2) * 3;
        g.lineStyle(1.5, 0xffd9a0, 0.16 * (1 - rise));
        g.lineBetween(p.x + wob - 5, p.y - 8 - rise * 10, p.x + wob + 5, p.y - 10 - rise * 10);
      });
      for (const b of blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        // Wrecks only: a sheen drifting over the hot plate.
        glow.fillStyle(0xffc46b, (0.05 + 0.04 * Math.sin(clock * 1.6 + o * 20)) * lit);
        fillOval(glow, px(b.x), b.y * CELL + 30, 44, 18);
      }
    },
};
