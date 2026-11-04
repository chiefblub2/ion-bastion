import { CELL, fillRound, type Ink, polygon, shade } from "../shapes";
import { flow, type Theme } from "./kit";

/** Strapped supply crate of side `s` with a lit lid and a stencil mark. */
function crate(g: Ink, x: number, y: number, s: number) {
  const strap = Math.max(3, s / 8),
    lid = s * 0.22;
  g.fillStyle(0x050b10, 0.5);
  g.fillRoundedRect(x + 2, y + 4, s, s, 4);
  g.fillStyle(0x1d2b34);
  g.fillRoundedRect(x, y, s, s, 4);
  g.fillStyle(shade(0x1d2b34, 0.12));
  g.fillRect(x + 3, y + 1, s - 6, lid - 1);
  g.fillStyle(0x26363f);
  g.fillRect(x + s * 0.25 - strap / 2, y + lid, strap, s - lid);
  g.fillRect(x + s * 0.75 - strap / 2, y + lid, strap, s - lid);
  g.lineStyle(1, 0x3a4a54);
  g.strokeRoundedRect(x, y, s, s, 4);
  g.lineBetween(x, y + lid, x + s, y + lid);
  polygon(g, x + s / 2, y + s * 0.62, s * 0.1, 3, 0x41604c, -Math.PI / 2);
}
export const outpost: Theme = {
    backdrop: 0x0d1820,
    ground: [0x111f27, 0x101c24],
    grid: 0x33434a,
    path: { edge: 0x36504b, bed: 0x233b37, line: 0x638c70, arrow: 0x719b7b },
    accent: 0x93f5b8,
    // Supply crate, a stack of two, or a fuel drum. The first draw matches `hash`, so ambient knows the variant.
    obstacle: (g, x, y, rand) => {
      const kind = rand(),
        ox = x + 8 + (rand() - 0.5) * 4,
        oy = y + 8 + (rand() - 0.5) * 4;
      if (kind < 0.25) {
        const cx = ox + 20,
          cy = oy + 22;
        g.fillStyle(0x050b10, 0.5);
        g.fillCircle(cx + 2, cy + 4, 17);
        g.fillStyle(0x24382e);
        g.fillCircle(cx, cy, 17);
        g.lineStyle(2, 0x36503f);
        g.strokeCircle(cx, cy, 12);
        g.fillStyle(0x4c6a57);
        g.fillCircle(cx - 6, cy - 6, 3);
        g.fillStyle(0x0b1410);
        g.fillCircle(cx + 6, cy + 5, 2.5);
      } else if (kind < 0.55) {
        crate(g, ox + 16, oy - 2, 24);
        crate(g, ox - 2, oy + 14, 26);
      } else {
        crate(g, ox, oy, 40);
        // Socket for the beacon that ambient lights.
        if (kind > 0.7) {
          g.fillStyle(0x0a1418);
          g.fillCircle(x + 40, y + 12, 3.5);
        }
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.35) {
        g.fillStyle(0x1a2a30);
        for (let i = 0; i < 3; i++) g.fillCircle(x + 10 + rand() * 36, y + 10 + rand() * 36, 1.5 + rand());
      } else if (kind < 0.65) {
        const bx = x + 12 + rand() * 32,
          by = y + 16 + rand() * 30;
        g.lineStyle(1.5, 0x2a4636, 0.9);
        for (const dx of [-3, 0, 3]) g.lineBetween(bx, by, bx + dx, by - 6 + Math.abs(dx));
      } else if (kind < 0.85) {
        // Rock with a lit top edge.
        const rx = x + 14 + rand() * 28,
          ry = y + 16 + rand() * 26,
          w = 8 + rand() * 6;
        g.fillStyle(0x16242b);
        g.fillEllipse(rx, ry, w, w * 0.7);
        g.fillStyle(0x2c3d44);
        g.fillEllipse(rx - 1, ry - 1.5, w * 0.6, w * 0.3);
      } else {
        // Tyre tracks.
        const ty = y + 14 + rand() * 28;
        g.fillStyle(0x0c161c, 0.8);
        for (let i = 0; i < 5; i++) {
          g.fillRect(x + 4 + i * 10, ty, 5, 2);
          g.fillRect(x + 4 + i * 10, ty + 8, 5, 2);
        }
      }
    },
    // Chevrons drifting towards the reactor, beacons blinking on some crates.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      g.lineStyle(2, 0x93f5b8, 0.22);
      flow(path, clock, 3, 0.5, (p) => {
        for (const sign of [-1, 1])
          g.lineBetween(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, p.x - Math.cos(p.angle + sign * 0.7) * 6, p.y - Math.sin(p.angle + sign * 0.7) * 6);
      });
      for (const b of blocked) {
        const h = hash(b.x, b.y);
        if (h <= 0.7) continue;
        const on = Math.max(0, Math.sin(clock * 2.4 + h * 50));
        glow.fillStyle(0x93f5b8, 0.22 * on * lit);
        fillRound(glow, b.x * CELL + 40, b.y * CELL + 12, 8);
        g.fillStyle(0x93f5b8, 0.3 + 0.7 * on);
        fillRound(g, b.x * CELL + 40, b.y * CELL + 12, 2);
      }
    },
};
