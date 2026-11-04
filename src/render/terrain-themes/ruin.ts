import { CELL, fillOval, fillRound, type Ink, polygon, shade } from "../shapes";
import { along, wreck, wreckPoint, zigzag, type Random, type Theme } from "./kit";

const RUST = 0x8a4a22;
/** Brick wall with a knocked-off side, missing bricks, bent rebar and moss at its foot. */
function brokenWall(g: Ink, x: number, y: number, rand: Random) {
  const bricks = [0x6e4c3a, 0x5e4536, 0x7a5842],
    fromLeft = rand() < 0.5,
    drop = 14 + rand() * 14;
  g.fillStyle(0x070605, 0.5);
  g.fillRect(x + 11, y + 16, 40, 38);
  for (let r = 0; r < 5; r++) {
    const by = y + 42 - r * 8;
    for (let bx = x + 8 - (r % 2) * 6; bx < x + 48; bx += 12) {
      const left = Math.max(bx, x + 8),
        right = Math.min(bx + 11, x + 48),
        t = (left + right - 2 * x - 16) / 80;
      if (right - left < 4 || by < y + 8 + drop * (fromLeft ? 1 - t : t) + rand() * 6) continue;
      const c = shade(bricks[Math.floor(rand() * 3)], (rand() - 0.5) * 0.16);
      g.fillStyle(0x2e2620);
      g.fillRect(left, by - 1, right - left + 1, 9);
      if (rand() < 0.08) {
        g.fillStyle(0x120e0b);
        g.fillRect(left, by, right - left, 7);
        continue;
      }
      g.fillStyle(c);
      g.fillRect(left, by, right - left, 7);
      g.fillStyle(shade(c, 0.18));
      g.fillRect(left, by, right - left, 1);
      g.fillStyle(shade(c, -0.35));
      g.fillRect(left, by + 6, right - left, 1);
    }
  }
  if (rand() < 0.6) {
    const rx = x + (fromLeft ? 12 : 38),
      ry = y + 14 + drop;
    g.lineStyle(1.5, RUST);
    for (let i = 0; i < 2; i++) {
      const bend = (fromLeft ? -1 : 1) * (3 + rand() * 6);
      g.strokePoints([{ x: rx + i * 6, y: ry + 4 }, { x: rx + i * 6, y: ry - 6 }, { x: rx + i * 6 + bend, y: ry - 11 - rand() * 4 }], false);
    }
  }
  for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) {
    const mx = x + 10 + rand() * 36;
    g.fillStyle(0x3d4f24);
    g.fillEllipse(mx, y + 50, 8 + rand() * 6, 4);
    g.lineStyle(1, 0x62782f);
    g.lineBetween(mx - 2, y + 50, mx - 4, y + 44 - rand() * 3);
    g.lineBetween(mx + 1, y + 50, mx + 2, y + 43 - rand() * 3);
  }
}
/** Fluted column lying across the cell, with its broken stub still standing behind it. */
function fallenPillar(g: Ink, x: number, y: number, rand: Random) {
  const a = (rand() < 0.5 ? 1 : -1) * (0.3 + rand() * 0.3),
    cx = x + 28,
    cy = y + 36,
    dx = Math.cos(a) * 20,
    dy = Math.sin(a) * 20,
    nx = -Math.sin(a),
    ny = Math.cos(a),
    sx = a > 0 ? x + 42 : x + 14,
    sy = y + 18,
    along = (o: number, w: number, color: number, alpha = 1) => {
      g.lineStyle(w, color, alpha);
      g.lineBetween(cx - dx + nx * o, cy - dy + ny * o, cx + dx + nx * o, cy + dy + ny * o);
    };
  g.fillStyle(0x070605, 0.5);
  g.fillEllipse(sx + 2, sy + 8, 16, 6);
  g.fillStyle(0x6e675c);
  g.fillRect(sx - 6, sy - 8, 12, 15);
  g.fillStyle(0x8a8276);
  g.fillRect(sx - 6, sy - 8, 4, 15);
  g.lineStyle(1, 0x4e483f);
  for (const o of [-1, 3]) g.lineBetween(sx + o, sy - 6, sx + o, sy + 7);
  g.fillStyle(0x9a9285);
  g.fillPoints([{ x: sx - 6, y: sy - 8 }, { x: sx - 2, y: sy - 11 }, { x: sx + 2, y: sy - 7 }, { x: sx + 6, y: sy - 10 }, { x: sx + 6, y: sy - 6 }, { x: sx - 6, y: sy - 6 }], true);
  along(4, 14, 0x070605, 0.5);
  along(0, 13, 0x6e675c);
  along(-3.5, 5, 0x8a8276);
  along(1.5, 1, 0x4e483f);
  along(4.5, 1, 0x4e483f);
  polygon(g, cx - dx, cy - dy, 9.5, 4, 0x5f594f, a + Math.PI / 4);
  g.fillStyle(0x7d766a);
  g.fillCircle(cx + dx, cy + dy, 6.5);
  g.lineStyle(1, 0x3a3631);
  zigzag(g, cx + dx, cy + dy, rand, 6, 2);
  for (let i = 0; i < 3; i++) polygon(g, x + 8 + rand() * 40, y + 44 + rand() * 8, 2 + rand() * 2, 4 + Math.floor(rand() * 2), 0x5a554d, rand() * 3);
}
/** Concrete slabs piled around a fire barrel; ambient lights the fire. */
function rubbleHeap(g: Ink, x: number, y: number, rand: Random) {
  const bx = x + 40,
    by = y + 16;
  g.fillStyle(0x070605, 0.5);
  g.fillEllipse(x + 28, y + 42, 48, 18);
  g.fillEllipse(bx + 2, by + 10, 18, 6);
  g.fillStyle(0x4a2e1e);
  g.fillRoundedRect(bx - 7, by - 6, 14, 15, 2);
  g.fillStyle(0x7a4422);
  g.fillRect(bx - 7, by - 1, 14, 2);
  g.fillRect(bx - 7, by + 5, 14, 2);
  g.fillStyle(0x0e0806);
  g.fillEllipse(bx, by - 6, 14, 5);
  g.fillStyle(0x6a2a10);
  g.fillEllipse(bx, by - 6, 10, 3);
  for (let k = 0; k < 6; k++) {
    const cx = x + 10 + rand() * 28,
      cy = y + 28 + rand() * 18,
      r = 6 + rand() * 6,
      rot = rand() * 3,
      c = rand() < 0.25 ? 0x6e4c3a : [0x5a5650, 0x4c4843, 0x6a655d][Math.floor(rand() * 3)];
    polygon(g, cx + 1, cy + 2, r, 4, 0x0c0b0a, rot);
    polygon(g, cx, cy, r, 4, c, rot);
    polygon(g, cx - 1.5, cy - 1.5, r * 0.55, 4, shade(c, 0.15), rot);
  }
  g.lineStyle(1.5, RUST);
  const rx = x + 14 + rand() * 20;
  g.strokePoints([{ x: rx, y: y + 34 }, { x: rx + 3, y: y + 24 }, { x: rx + 9, y: y + 21 }], false);
}
export const ruin: Theme = {
    backdrop: 0x12100e,
    ground: [0x1d1b19, 0x1a1816],
    grid: 0x423a31,
    path: { edge: 0x7a6248, bed: 0x2a231c, line: 0xd8b98a, arrow: 0xe2c79c },
    // Teal, not sand, so the reactor stands apart from the amber entry.
    accent: 0x9ad8c0,
    // Broken wall, fallen pillar, car wreck or rubble with a fire barrel. The first draw matches `hash`, so ambient knows the variant.
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.4) brokenWall(g, x, y, rand);
      else if (kind < 0.6) fallenPillar(g, x, y, rand);
      else if (kind < 0.8) wreck(g, x, y, kind, rand);
      else rubbleHeap(g, x, y, rand);
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 30;
      if (kind < 0.3) {
        // Paving slabs, one sunk and cracked.
        const sx = x + 6 + rand() * 10,
          sy = y + 6 + rand() * 10;
        g.fillStyle(0x151311);
        g.fillRect(sx + 20, sy + 20, 20, 20);
        g.lineStyle(1, 0x2c2925, 0.9);
        for (const [dx, dy] of [[0, 0], [20, 0], [0, 20], [20, 20]]) g.strokeRect(sx + dx, sy + dy, 20, 20);
        g.lineStyle(1, 0x0b0908, 0.9);
        zigzag(g, sx + 30, sy + 30, rand, 12, 3);
      } else if (kind < 0.5) {
        // Weeds out of a crack.
        g.lineStyle(1, 0x0e0c0a, 0.9);
        zigzag(g, cx, cy, rand, 16, 3);
        g.lineStyle(1.2, 0x4f6630);
        for (const dx of [-4, -1, 2, 5]) g.lineBetween(cx, cy, cx + dx, cy - 5 - rand() * 5);
      } else if (kind < 0.68) {
        // Puddle catching a cold sky.
        g.fillStyle(0x121517);
        g.fillEllipse(cx, cy, 20 + rand() * 10, 8 + rand() * 4);
        g.lineStyle(1, 0x5a6a70, 0.45);
        g.lineBetween(cx - 6, cy - 1.5, cx + 3, cy - 2);
      } else if (kind < 0.9) {
        for (let i = 0; i < 4; i++) {
          g.fillStyle(rand() < 0.5 ? 0x4a3328 : 0x3a3833);
          g.fillRect(x + 8 + rand() * 38, y + 8 + rand() * 38, 3 + rand() * 3, 2 + rand() * 2);
        }
      } else {
        // Faded lane marking.
        const ly = y + 24 + rand() * 8;
        g.fillStyle(0x8a7a4a, 0.35);
        for (let i = 0; i < 2; i++) g.fillRect(x + 6 + i * 26, ly, 16, 3);
      }
    },
    // Ash drifting down, dust off the walls, fire in the barrels and stuttering headlights on some wrecks.
    ambient: ({ g, map, clock, hash, blocked, glow, lit }) => {
      const w = map.columns * CELL,
        height = map.rows * CELL;
      for (let k = 0; k < map.columns; k++) {
        const s = hash(k, 2),
          fy = ((clock * (8 + s * 6) + s * height * 3) % (height + 20)) - 10,
          fx = (s * w * 7 + clock * 6 + Math.sin(clock * 0.7 + k) * 10) % w;
        g.fillStyle(0xb8b0a4, 0.15 + s * 0.2);
        fillRound(g, fx, fy, 0.8 + s);
      }
      for (const b of blocked) {
        const h = hash(b.x, b.y),
          x = b.x * CELL,
          y = b.y * CELL;
        if (h < 0.4) {
          const life = (clock * 0.25 + h * 7) % 1;
          g.fillStyle(0xb8a07c, 0.1 * (1 - life));
          fillRound(g, x + 28 + life * 24, y + 14 - life * 18, 5 + life * 10);
        } else if (h >= 0.8) {
          const fx = x + 40,
            fy = y + 10,
            f = 0.6 + 0.25 * Math.sin(clock * 9 + h * 30) + 0.15 * Math.sin(clock * 23 + h * 70),
            sway = Math.sin(clock * 7 + h * 9) * 2;
          glow.fillStyle(0xff8a3a, 0.16 * f * lit);
          fillRound(glow, fx, fy, 18);
          g.fillStyle(0xff7a2a, 0.55 * f);
          fillOval(g, fx, fy, 10, 4);
          g.fillStyle(0xffb44a, 0.8 * f);
          g.fillTriangle(fx - 4, fy, fx + 4, fy, fx + sway, fy - 6 - 4 * f);
          g.fillStyle(0xffe08a, 0.9 * f);
          g.fillTriangle(fx - 2, fy, fx + 2, fy, fx + sway * 0.5, fy - 3 - 2 * f);
          for (let e = 0; e < 2; e++) {
            const life = (clock * 0.5 + h * 10 + e * 0.5) % 1;
            g.fillStyle(life < 0.5 ? 0xffd27a : 0xff7a3a, 1 - life);
            g.fillRect(fx + Math.sin(life * 6 + h * 30 + e) * 5 - 1, fy - 6 - life * 28, 2, 2);
          }
        } else if (h >= 0.6 && h < 0.7) {
          const on = Math.sin(clock * 13 + h * 40) + Math.sin(clock * 5.3 + h * 17) > 0.4 ? 1 : 0.15;
          for (const hy of [-7, 7]) {
            const l = wreckPoint(x, y, h, 21, hy),
              f0 = wreckPoint(x, y, h, 40, hy * 2.4),
              f1 = wreckPoint(x, y, h, 40, hy * 0.4);
            glow.fillStyle(0xfff0c8, 0.08 * on * lit);
            glow.fillTriangle(l.x, l.y, f0.x, f0.y, f1.x, f1.y);
            g.fillStyle(0xfff0c8, 0.3 + 0.7 * on);
            fillRound(g, l.x, l.y, 1.8);
          }
        }
      }
    },
};
