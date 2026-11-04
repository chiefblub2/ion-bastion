import type { Point } from "../../core/types";
import { fillOval, fillRound, type Ink, px, shade } from "../shapes";
import { along, flow, type Theme } from "./kit";

/** Toothed wheel: `teeth` trapezoid teeth around a body of radius `r`, with a darker rim line. */
function cog(g: Ink, cx: number, cy: number, r: number, teeth: number, rot: number, color: number) {
  const pts: Point[] = [],
    step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    for (const [da, rr] of [[-0.3, 0.8], [-0.2, 1.12], [0.2, 1.12], [0.3, 0.8]] as const) pts.push({ x: cx + Math.cos(a + da * step * 2) * r * rr, y: cy + Math.sin(a + da * step * 2) * r * rr });
  }
  g.fillStyle(shade(color, -0.45));
  g.fillPoints(pts.map((q) => ({ x: q.x + 1.5, y: q.y + 2 })), true);
  g.fillStyle(color);
  g.fillPoints(pts, true);
  g.lineStyle(1, shade(color, -0.35));
  g.strokePoints(pts, true);
  g.fillStyle(shade(color, 0.18));
  g.fillCircle(cx, cy, r * 0.72);
}
// Gearworks: brass gears and copper rivets, a slow glint rolling along the path.
export const gear: Theme = {
    backdrop: 0x1a1208,
    ground: [0x3a2a14, 0x46331a],
    grid: 0x5a4424,
    path: { edge: 0x6b4e22, bed: 0x2a1d0c, line: 0xd9a441, arrow: 0xe8c273 },
    accent: 0xd9a441,
    // Large toothed wheel (kind < 0.55) or a meshing gear pair. The first draw matches `hash`, so ambient knows the variant.
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.55) {
        g.fillStyle(0x0a0603, 0.55);
        g.fillEllipse(x + 30, y + 46, 40, 11);
        cog(g, x + 28, y + 28, 19, 10, rand() * 0.6, 0xb98a32);
        g.lineStyle(1.5, 0x7a5a1e);
        g.strokeCircle(x + 28, y + 28, 12);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + 0.4;
          g.lineStyle(3, 0x9a7226);
          g.lineBetween(x + 28 + Math.cos(a) * 6, y + 28 + Math.sin(a) * 6, x + 28 + Math.cos(a) * 12, y + 28 + Math.sin(a) * 12);
        }
        g.fillStyle(0xe6c06a, 0.55);
        g.fillCircle(x + 22, y + 21, 3);
        g.fillStyle(0x2a1d0c);
        g.fillCircle(x + 28, y + 28, 5);
        g.fillStyle(0xb8742e);
        g.fillCircle(x + 28, y + 28, 2.5);
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5;
          g.fillStyle(0xe6a070);
          g.fillCircle(x + 28 + Math.cos(a) * 14.5, y + 28 + Math.sin(a) * 14.5, 1.2);
        }
      } else {
        g.fillStyle(0x0a0603, 0.55);
        g.fillEllipse(x + 28, y + 46, 46, 10);
        cog(g, x + 20, y + 33, 13, 8, rand() * 0.8, 0x9a7226);
        cog(g, x + 38, y + 21, 10, 7, rand() * 0.8 + 0.3, 0xd9a441);
        for (const [cx, cy, r] of [[20, 33, 3.5], [38, 21, 3]]) {
          g.fillStyle(0x2a1d0c);
          g.fillCircle(x + cx, y + cy, r);
          g.fillStyle(0xb8742e);
          g.fillCircle(x + cx, y + cy, r * 0.5);
        }
        g.fillStyle(0xf0d488, 0.5);
        g.fillCircle(x + 16, y + 29, 2.5);
        g.fillCircle(x + 35, y + 18, 2);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 12 + rand() * 32;
      if (kind < 0.55) {
        // Copper rivet with a highlight.
        g.fillStyle(0x1a1208, 0.6);
        g.fillCircle(cx + 1, cy + 1.5, 3);
        g.fillStyle(0xb8742e);
        g.fillCircle(cx, cy, 2.6);
        g.fillStyle(0xe6a070, 0.8);
        g.fillCircle(cx - 0.8, cy - 0.8, 1);
      } else if (kind < 0.85) {
        // Oil stain.
        g.fillStyle(0x0c0804, 0.6);
        g.fillEllipse(cx, cy, 14 + rand() * 8, 7 + rand() * 3);
        g.fillStyle(0x3a2a14, 0.7);
        g.fillEllipse(cx - 2, cy - 1, 6, 2.5);
      } else {
        // Loose cotter pin.
        g.lineStyle(1.5, 0x8a6a2a, 0.8);
        g.strokeCircle(cx, cy, 2.5);
        g.lineBetween(cx + 2.5, cy, cx + 8, cy + 2);
      }
    },
    // A slow glint of light rolling along the path, and a turning highlight on the large wheels.
    ambient: ({ g, map, clock, path, hash, blocked, glow, lit }) => {
      flow(path, clock, 2.2, 0.8, (p, k) => {
        const s = 0.5 + 0.5 * Math.sin(clock * 2.2 + k * 1.9),
          len = 7 + 4 * s;
        glow.fillStyle(0xe8c273, (0.05 + 0.07 * s) * lit);
        fillOval(glow, p.x, p.y, 20 + 8 * s, 9);
        g.lineStyle(1.2, 0xfff0b8, 0.2 + 0.25 * s);
        g.lineBetween(p.x - Math.cos(p.angle) * len, p.y - Math.sin(p.angle) * len, p.x + Math.cos(p.angle) * len, p.y + Math.sin(p.angle) * len);
      });
      for (const b of blocked) {
        if (hash(b.x, b.y) >= 0.55) continue;
        const a = clock * 0.5 + hash(b.x, b.y + 7) * 6.28,
          cx = px(b.x),
          cy = px(b.y);
        g.fillStyle(0xfff0b8, 0.45);
        fillRound(g, cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 1.6);
      }
    },
};
