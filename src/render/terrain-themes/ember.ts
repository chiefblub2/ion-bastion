import { fillRound, px } from "../shapes";
import { flow, zigzag, zigzagPoints, type Theme } from "./kit";

export const ember: Theme = {
    backdrop: 0x140d0a,
    ground: [0x1e1512, 0x1a1310],
    grid: 0x3e2d25,
    path: { edge: 0x8a3d1c, bed: 0x2d1a12, line: 0xff8a4a, arrow: 0xff9a5a },
    accent: 0xff7a3a,
    // Basalt rock on a molten rim, split by glowing cracks.
    obstacle: (g, x, y, rand) => {
      const cx = x + 28 + (rand() - 0.5) * 6,
        cy = y + 28 + (rand() - 0.5) * 6,
        n = 5 + Math.floor(rand() * 3),
        rock = Array.from({ length: n }, (_, i) => {
          const a = (i * Math.PI * 2) / n + rand() * 0.4,
            r = 18 + rand() * 6;
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        });
      g.fillStyle(0x060302, 0.5);
      g.fillPoints(rock.map((p) => ({ x: p.x + 2, y: p.y + 4 })), true);
      g.fillStyle(0x9a3a14);
      g.fillPoints(rock.map((p) => ({ x: p.x, y: p.y + 2.5 })), true);
      g.fillStyle(0x2b211d);
      g.fillPoints(rock, true);
      g.fillStyle(0x3a2d27);
      g.fillPoints(rock.map((p) => ({ x: cx + (p.x - cx) * 0.6 - 3, y: cy + (p.y - cy) * 0.6 - 4 })), true);
      const crack = zigzagPoints(cx, cy, rand, 18, 3);
      g.lineStyle(3.5, 0xff7a3a, 0.3);
      g.strokePoints(crack, false);
      g.lineStyle(1, 0xffd27a, 0.85);
      g.strokePoints(crack, false);
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.5) {
        g.fillStyle(0x2e2622);
        for (let i = 0; i < 4; i++) g.fillCircle(x + 8 + rand() * 40, y + 8 + rand() * 40, 1 + rand());
      } else if (kind < 0.85) {
        g.lineStyle(1, 0x6a2a14, 0.9);
        zigzag(g, x + 12 + rand() * 32, y + 12 + rand() * 32, rand, 20, 4);
      } else {
        // Small lava pool with a dark crust.
        const lx = x + 16 + rand() * 24,
          ly = y + 16 + rand() * 24;
        g.fillStyle(0x0e0806);
        g.fillEllipse(lx, ly, 18, 10);
        g.fillStyle(0xff7a3a, 0.75);
        g.fillEllipse(lx, ly, 12, 6);
        g.fillStyle(0xffd27a, 0.6);
        g.fillEllipse(lx - 1, ly - 1, 5, 2);
      }
    },
    // Rocks breathe heat and shed sparks; heat shimmers over the path.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      for (const b of blocked) {
        const h = hash(b.x, b.y),
          cx = px(b.x),
          cy = px(b.y);
        glow.fillStyle(0xff7a3a, (0.1 + 0.08 * Math.sin(clock * 1.6 + h * 20)) * lit);
        fillRound(glow, cx, cy, 11);
        if (h > 0.35) continue;
        const life = (clock * 0.45 + h * 10) % 1;
        g.fillStyle(life < 0.5 ? 0xffd27a : 0xff7a3a, 1 - life);
        g.fillRect(cx + Math.sin(life * 6 + h * 30) * 5 - 1, cy - 6 - life * 30, 2, 2);
      }
      g.lineStyle(1.5, 0xff8a4a, 0.16);
      flow(path, clock, 1.2, 0.35, (p, k) => {
        const side = ((k % 3) - 1) * 10,
          wobble = Math.sin(clock * 4 + k) * 2,
          nx = -Math.sin(p.angle),
          ny = Math.cos(p.angle),
          dx = Math.cos(p.angle),
          dy = Math.sin(p.angle);
        g.strokePoints(
          [-6, -2, 2, 6].map((t, i) => {
            const o = side + (i % 2 ? wobble : -wobble);
            return { x: p.x + nx * o + dx * t, y: p.y + ny * o + dy * t };
          }),
          false,
        );
      });
    },
};
