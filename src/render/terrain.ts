import type Phaser from "phaser";
import type { MapDefinition, MapTheme, Point } from "../core/types";
import { CELL, polygon, px, shade, type Ink } from "./shapes";
type Random = () => number;
/** Draws into one cell, given by its top-left pixel corner. */
type CellDrawing = (g: Ink, x: number, y: number, rand: Random) => void;
interface AmbientContext {
  g: Ink;
  map: MapDefinition;
  /** Path cell centres in pixels. */
  path: readonly Point[];
  clock: number;
  /** Stable value in [0, 1) per cell, for phases and offsets. */
  hash: (x: number, y: number) => number;
}
interface Theme {
  backdrop: number;
  /** Checkerboard pair. */
  ground: [number, number];
  grid: number;
  path: { edge: number; bed: number; line: number; arrow: number };
  accent: number;
  obstacle: CellDrawing;
  /** Optional ground detail on some free cells; never on the path or obstacles. */
  decor: CellDrawing;
  /** Animated layer, redrawn every frame below towers and enemies. */
  ambient: (ctx: AmbientContext) => void;
}
/** FNV-1a over the map id and cell, so decoration never moves between redraws. */
function seed(id: string, x: number, y: number) {
  let h = 2166136261;
  for (const ch of `${id}:${x}:${y}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function mulberry32(a: number): Random {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cellRandom = (map: MapDefinition, x: number, y: number) => mulberry32(seed(map.id, x, y));
/** Point and direction at fractional cell distance `t` along the path. */
function along(path: readonly Point[], t: number) {
  const i = Math.min(Math.floor(t), path.length - 2),
    f = t - i,
    a = path[i],
    b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
/** `count` markers moving along the path at `speed` cells per second. */
function flow(path: readonly Point[], clock: number, spacing: number, speed: number, draw: (p: ReturnType<typeof along>, k: number) => void) {
  const length = path.length - 1;
  for (let k = 0; k * spacing < length; k++) draw(along(path, (k * spacing + clock * speed) % length), k);
}
function zigzagPoints(x: number, y: number, rand: Random, length: number, segments: number) {
  let a = rand() * Math.PI * 2;
  const points = [{ x, y }];
  for (let i = 0; i < segments; i++) {
    a += (rand() - 0.5) * 1.4;
    const last = points[points.length - 1];
    points.push({ x: last.x + Math.cos(a) * (length / segments), y: last.y + Math.sin(a) * (length / segments) });
  }
  return points;
}
function zigzag(g: Ink, x: number, y: number, rand: Random, length: number, segments: number) {
  g.strokePoints(zigzagPoints(x, y, rand, length, segments), false);
}
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
/** Point on the car wreck in its own frame; the tilt comes from `kind`, so ambient can find the headlights. */
function wreckPoint(x: number, y: number, kind: number, dx: number, dy: number) {
  const tilt = ((kind - 0.6) * 5 - 0.5) * 0.7,
    c = Math.cos(tilt),
    s = Math.sin(tilt);
  return { x: x + 28 + dx * c - dy * s, y: y + 28 + dx * s + dy * c };
}
/** Rusted car with smashed windows and a faded teal stripe. */
function wreck(g: Ink, x: number, y: number, kind: number, rand: Random) {
  const p = (dx: number, dy: number) => wreckPoint(x, y, kind, dx, dy),
    rect = (x0: number, y0: number, x1: number, y1: number) => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
  g.fillStyle(0x070605, 0.5);
  g.fillPoints(rect(-21, -11, 21, 11).map((q) => ({ x: q.x + 2, y: q.y + 4 })), true);
  g.fillStyle(0x141210);
  const flat = Math.floor(rand() * 4);
  [[-13, -12], [12, -12], [-13, 12], [12, 12]].forEach(([tx, ty], i) => {
    if (i !== flat) g.fillPoints(rect(tx - 4, ty - 2.5, tx + 4, ty + 2.5), true);
  });
  g.fillStyle(0x5a3a28);
  g.fillPoints(rect(-21, -11, 21, 11), true);
  g.fillStyle(0x3f6a64, 0.75);
  g.fillPoints(rect(-21, -2, 21, 2), true);
  g.fillStyle(0x7a4422);
  for (let i = 0; i < 3; i++) {
    const r = p(-18 + rand() * 36, -9 + rand() * 18);
    g.fillCircle(r.x, r.y, 1.5 + rand() * 2.5);
  }
  g.fillStyle(0x4a3022);
  g.fillPoints(rect(-8, -9, 9, 9), true);
  g.fillStyle(0x101618);
  g.fillPoints([p(9, -8), p(14, -6.5), p(14, 6.5), p(9, 8)], true);
  g.fillPoints(rect(-13, -7, -8, 7), true);
  const c0 = p(10, -4),
    c1 = p(13, 1),
    c2 = p(11, 5);
  g.lineStyle(1, 0x5a6a70, 0.6);
  g.strokePoints([c0, c1, c2], false);
  g.lineStyle(1, shade(0x5a3a28, 0.25));
  const e0 = p(-21, -11),
    e1 = p(21, -11);
  g.lineBetween(e0.x, e0.y, e1.x, e1.y);
  g.fillStyle(0x2a2620);
  for (const hy of [-7, 7]) {
    const h = p(21, hy);
    g.fillCircle(h.x, h.y, 1.8);
  }
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
/** Map looks by `map.theme`. A new look is one entry here. */
export const THEMES: Record<MapTheme, Theme> = {
  outpost: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      g.lineStyle(2, 0x93f5b8, 0.22);
      flow(path, clock, 3, 0.5, (p) => {
        for (const sign of [-1, 1])
          g.lineBetween(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, p.x - Math.cos(p.angle + sign * 0.7) * 6, p.y - Math.sin(p.angle + sign * 0.7) * 6);
      });
      for (const b of map.blocked) {
        const h = hash(b.x, b.y);
        if (h <= 0.7) continue;
        const on = Math.max(0, Math.sin(clock * 2.4 + h * 50));
        g.fillStyle(0x93f5b8, 0.18 * on);
        g.fillCircle(b.x * CELL + 40, b.y * CELL + 12, 7);
        g.fillStyle(0x93f5b8, 0.3 + 0.7 * on);
        g.fillCircle(b.x * CELL + 40, b.y * CELL + 12, 2);
      }
    },
  },
  lock: {
    backdrop: 0x0b1522,
    ground: [0x112033, 0x0f1c2d],
    grid: 0x2f4560,
    path: { edge: 0x2f6f8f, bed: 0x10304a, line: 0x5fc8e8, arrow: 0x6ad3f0 },
    accent: 0x7fe3ff,
    // Bulkhead block with a split panel, rivets, a warning lamp and a hazard stripe.
    obstacle: (g, x, y) => {
      g.fillStyle(0x050b10, 0.5);
      g.fillRoundedRect(x + 8, y + 10, 44, 44, 3);
      g.fillStyle(0x1c2a3a);
      g.fillRoundedRect(x + 6, y + 6, 44, 44, 3);
      g.lineStyle(1, shade(0x1c2a3a, 0.25));
      g.lineBetween(x + 9, y + 7, x + 47, y + 7);
      g.lineBetween(x + 7, y + 9, x + 7, y + 47);
      g.fillStyle(0x243548);
      g.fillRect(x + 12, y + 12, 32, 24);
      g.lineStyle(1, 0x14202d);
      g.lineBetween(x + 26, y + 12, x + 26, y + 36);
      g.fillStyle(0x0b121a);
      g.fillCircle(x + 37, y + 19, 3.5);
      g.fillStyle(0x6b5420);
      g.fillCircle(x + 37, y + 19, 2);
      g.fillStyle(0x4a6680);
      for (const [dx, dy] of [[10, 10], [46, 10], [10, 46], [46, 46]]) g.fillCircle(x + dx, y + dy, 1.5);
      for (let i = 0; i < 4; i++) {
        g.fillStyle(i % 2 ? 0x1c2a3a : 0xe0b84a, 0.85);
        g.fillPoints([
          { x: x + 12 + i * 8, y: y + 46 },
          { x: x + 16 + i * 8, y: y + 40 },
          { x: x + 24 + i * 8, y: y + 40 },
          { x: x + 20 + i * 8, y: y + 46 },
        ], true);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        gx = x + 8 + rand() * 26,
        gy = y + 8 + rand() * 30;
      if (kind < 0.4) {
        g.lineStyle(1, 0x1f3248, 0.9);
        g.strokeRect(gx, gy, 16, 10);
        for (let i = 1; i < 4; i++) g.lineBetween(gx + i * 4, gy, gx + i * 4, gy + 10);
      } else if (kind < 0.65) {
        // Floor hatch with a handle.
        g.fillStyle(0x0d1826);
        g.fillRoundedRect(gx, gy, 18, 14, 2);
        g.lineStyle(1, 0x24384f);
        g.strokeRoundedRect(gx, gy, 18, 14, 2);
        g.lineStyle(2, 0x2f4762);
        g.lineBetween(gx + 6, gy + 7, gx + 12, gy + 7);
      } else if (kind < 0.85) {
        // Pipe across the cell with a clamp.
        const py = y + 12 + rand() * 32;
        g.lineStyle(4, 0x18283a);
        g.lineBetween(x, py, x + CELL, py);
        g.lineStyle(1, 0x2c435c);
        g.lineBetween(x, py - 1, x + CELL, py - 1);
        g.fillStyle(0x2a4058);
        g.fillRect(x + 10 + rand() * 30, py - 3, 3, 6);
      } else {
        g.fillStyle(0x2a4058);
        g.fillCircle(gx, gy, 1.5);
        g.fillCircle(gx + 9, gy, 1.5);
      }
    },
    // Ripples flowing down the channel, shimmer on its walls, warning lamps on some bulkheads.
    ambient: ({ g, map, path, clock, hash }) => {
      g.lineStyle(1.5, 0x7fe3ff, 0.35);
      flow(path, clock, 0.75, 0.9, (p, k) => {
        const side = ((k % 3) - 1) * 9,
          nx = -Math.sin(p.angle) * side,
          ny = Math.cos(p.angle) * side,
          dx = Math.cos(p.angle) * 4,
          dy = Math.sin(p.angle) * 4;
        g.lineBetween(p.x + nx - dx, p.y + ny - dy, p.x + nx + dx, p.y + ny + dy);
      });
      g.lineStyle(1, 0x7fe3ff, 0.18);
      flow(path, clock, 1.5, 0.6, (p) => {
        const nx = -Math.sin(p.angle) * 19,
          ny = Math.cos(p.angle) * 19,
          dx = Math.cos(p.angle) * 6,
          dy = Math.sin(p.angle) * 6;
        for (const sign of [-1, 1]) g.lineBetween(p.x + sign * nx - dx, p.y + sign * ny - dy, p.x + sign * nx + dx, p.y + sign * ny + dy);
      });
      for (const b of map.blocked) {
        const h = hash(b.x, b.y);
        if (h >= 0.5) continue;
        const s = 0.5 + 0.5 * Math.sin(clock * 3 + h * 30);
        g.fillStyle(0xffb84a, 0.14 * s);
        g.fillCircle(b.x * CELL + 37, b.y * CELL + 19, 8);
        g.fillStyle(0xffc857, 0.35 + 0.65 * s);
        g.fillCircle(b.x * CELL + 37, b.y * CELL + 19, 2);
      }
    },
  },
  shard: {
    backdrop: 0x120f1c,
    ground: [0x1a1628, 0x171324],
    grid: 0x3e3658,
    path: { edge: 0x5d5288, bed: 0x2e2848, line: 0xb9a8ff, arrow: 0xc6b8ff },
    accent: 0xd8ccff,
    // Cluster of faceted crystal shards over a faint glow, lit from the left.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x07050c, 0.45);
      g.fillEllipse(x + 28, y + 40, 40, 16);
      g.fillStyle(0x8f7fff, 0.12);
      g.fillEllipse(x + 28, y + 38, 48, 20);
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const cx = x + 28 + (rand() - 0.5) * 24,
          cy = y + 36 + (rand() - 0.5) * 12,
          h = 16 + rand() * 12,
          w = 5 + rand() * 3,
          tilt = (rand() - 0.5) * 0.7,
          p = (dx: number, dy: number) => ({
            x: cx + dx * Math.cos(tilt) - dy * Math.sin(tilt),
            y: cy + dx * Math.sin(tilt) + dy * Math.cos(tilt),
          });
        g.fillStyle(0x3e3570);
        g.fillPoints([p(0, -h), p(w, 0), p(0, h * 0.2)], true);
        g.fillStyle(0x5a4f94);
        g.fillPoints([p(0, -h), p(w * 0.45, -h * 0.05), p(0, h * 0.2)], true);
        g.fillStyle(0x9f94e0);
        g.fillPoints([p(0, -h), p(0, h * 0.2), p(-w, 0)], true);
        const tip = p(0, -h),
          edge = p(-w * 0.45, -h * 0.5);
        g.lineStyle(1, 0xffffff, 0.45);
        g.lineBetween(tip.x, tip.y, edge.x, edge.y);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.4) {
        for (let i = 0; i < 2; i++) polygon(g, x + 10 + rand() * 36, y + 10 + rand() * 36, 2.5 + rand() * 1.5, 3, 0x4a4278, rand() * 6);
      } else if (kind < 0.75) {
        g.lineStyle(1, 0x0d0b16, 0.9);
        zigzag(g, x + 14 + rand() * 28, y + 14 + rand() * 28, rand, 16, 3);
      } else {
        // Small crystal with a bright tip.
        const sx = x + 12 + rand() * 32,
          sy = y + 16 + rand() * 30;
        g.fillStyle(0x6a5fb0);
        g.fillTriangle(sx, sy - 8, sx + 3, sy + 2, sx - 3, sy + 2);
        g.fillStyle(0xd8ccff);
        g.fillCircle(sx, sy - 6, 1.2);
      }
    },
    // Glints on the crystals, each cell on its own phase, and motes drifting up from them.
    ambient: ({ g, map, clock, hash }) => {
      for (const b of map.blocked) {
        const h = hash(b.x, b.y),
          s = Math.max(0, Math.sin(clock * 1.1 + h * 40)) ** 12;
        if (h < 0.6) {
          const life = (clock * 0.3 + h * 9) % 1;
          g.fillStyle(0xd8ccff, 0.5 * (1 - life) * Math.min(1, life * 5));
          g.fillCircle(b.x * CELL + 16 + h * 24 + Math.sin(life * 5 + h * 20) * 4, b.y * CELL + 36 - life * 34, 1.3);
        }
        if (s < 0.05) continue;
        const gx = b.x * CELL + 18 + h * 20,
          gy = b.y * CELL + 18 + ((h * 7) % 1) * 14,
          r = 2 + s * 4;
        g.lineStyle(1.5, 0xffffff, s);
        g.lineBetween(gx - r, gy, gx + r, gy);
        g.lineBetween(gx, gy - r, gx, gy + r);
      }
    },
  },
  ember: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      for (const b of map.blocked) {
        const h = hash(b.x, b.y),
          cx = px(b.x),
          cy = px(b.y);
        g.fillStyle(0xff7a3a, 0.08 + 0.07 * Math.sin(clock * 1.6 + h * 20));
        g.fillCircle(cx, cy, 9);
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
  },
  core: {
    backdrop: 0x0e1114,
    ground: [0x161b20, 0x13181c],
    grid: 0x39424b,
    path: { edge: 0x8a6a2a, bed: 0x23282e, line: 0xe0b84a, arrow: 0xe8c25a },
    // Mint, not gold, so the reactor stands apart from the amber entry.
    accent: 0x93f5b8,
    // Machinery block with a vented panel and flanged pipes; its status light is animated.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x050709, 0.5);
      g.fillRoundedRect(x + 9, y + 11, 42, 42, 4);
      g.fillStyle(0x232b33);
      g.fillRoundedRect(x + 7, y + 7, 42, 42, 4);
      g.lineStyle(1, shade(0x232b33, 0.2));
      g.lineBetween(x + 10, y + 8, x + 46, y + 8);
      g.fillStyle(0x2c3640);
      g.fillRect(x + 12, y + 12, 22, 32);
      g.lineStyle(1, 0x3a4652);
      g.strokeRect(x + 12, y + 12, 22, 32);
      g.lineStyle(1.5, 0x161b20);
      for (let i = 0; i < 3; i++) g.lineBetween(x + 16, y + 15 + i * 3, x + 30, y + 15 + i * 3);
      g.lineStyle(3, 0x3d4a55);
      const pipe = y + 20 + Math.floor(rand() * 2) * 8;
      g.lineBetween(x + 7, pipe, x + 49, pipe);
      g.lineBetween(x + 7, pipe + 12, x + 49, pipe + 12);
      g.fillStyle(0x55636f);
      for (const py of [pipe, pipe + 12]) {
        g.fillRect(x + 7, py - 3.5, 3, 7);
        g.fillRect(x + 46, py - 3.5, 3, 7);
      }
      g.fillStyle(0x0b0e11);
      g.fillCircle(x + 42, y + 14, 3);
    },
    decor: (g, x, y, rand) => {
      const kind = rand();
      if (kind < 0.35) {
        g.lineStyle(1, 0x1f262d, 0.9);
        g.strokeRect(x + 4, y + 4, CELL - 8, CELL - 8);
        g.fillStyle(0x262e36);
        for (const [dx, dy] of [[8, 8], [CELL - 8, 8], [8, CELL - 8], [CELL - 8, CELL - 8]]) g.fillCircle(x + dx, y + dy, 1.3);
      } else if (kind < 0.7) {
        const vx = x + 14 + rand() * 18,
          vy = y + 14 + rand() * 22;
        g.lineStyle(2, 0x0c0f12);
        for (let i = 0; i < 3; i++) g.lineBetween(vx, vy + i * 5, vx + 12, vy + i * 5);
      } else {
        // Cable from the left edge to the bottom edge.
        const a = { x, y: y + 10 + rand() * 30 },
          b = { x: x + 10 + rand() * 30, y: y + CELL },
          c = { x: x + 20 + rand() * 20, y: y + 10 + rand() * 20 },
          cable = Array.from({ length: 7 }, (_, i) => {
            const t = i / 6;
            return {
              x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
              y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
            };
          });
        g.lineStyle(3, 0x0a0d10);
        g.strokePoints(cable, false);
        g.lineStyle(1, 0x2a333c);
        g.strokePoints(cable, false);
      }
    },
    // Blinking status lights, energy pulses running to the reactor and a scan pulse from it.
    ambient: ({ g, map, path, clock, hash }) => {
      for (const b of map.blocked) {
        const h = hash(b.x, b.y),
          on = Math.floor(clock * 1.5 + h * 4) % 2 === 0;
        g.fillStyle(h < 0.7 ? 0x93f5b8 : 0xffc857, on ? 1 : 0.2);
        g.fillCircle(b.x * CELL + 42, b.y * CELL + 14, 2);
      }
      flow(path, clock, 4, 1.8, (p) => {
        g.fillStyle(0xffc857, 0.18);
        g.fillCircle(p.x, p.y, 6);
        g.fillStyle(0xffe6a0, 0.6);
        g.fillCircle(p.x, p.y, 2.5);
      });
      const end = path[path.length - 1],
        reach = Math.hypot(map.columns, map.rows) * CELL,
        r = ((clock * 90) % reach) + 30;
      g.lineStyle(2, 0xffc857, 0.14 * (1 - r / reach));
      g.strokeCircle(end.x, end.y, r);
    },
  },
  frost: {
    backdrop: 0x0c1620,
    ground: [0x16242f, 0x14212b],
    grid: 0x3a5466,
    path: { edge: 0x5a8aa8, bed: 0x1c3344, line: 0xc8ecff, arrow: 0xd6f2ff },
    accent: 0xbfe9ff,
    // Ice block with a snow cap and a bright facet.
    obstacle: (g, x, y, rand) => {
      const lean = (rand() - 0.5) * 6;
      g.fillStyle(0x04080c, 0.45);
      g.fillEllipse(x + 30, y + 46, 42, 12);
      g.fillStyle(0x3b6680);
      g.fillPoints([{ x: x + 10, y: y + 46 }, { x: x + 14 + lean, y: y + 14 }, { x: x + 40 + lean, y: y + 10 }, { x: x + 48, y: y + 44 }], true);
      g.fillStyle(0x7fb6d4);
      g.fillPoints([{ x: x + 14 + lean, y: y + 14 }, { x: x + 40 + lean, y: y + 10 }, { x: x + 30, y: y + 30 }], true);
      g.fillStyle(0xe8f6ff);
      g.fillEllipse(x + 27 + lean, y + 13, 28, 7);
    },
    decor: (g, x, y, rand) => {
      const cx = x + 12 + rand() * 32,
        cy = y + 12 + rand() * 32;
      if (rand() < 0.55) {
        // Snow crystal.
        g.lineStyle(1, 0x5d7f95, 0.9);
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          g.lineBetween(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5, cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
        }
      } else {
        g.fillStyle(0x223747);
        g.fillEllipse(cx, cy, 18 + rand() * 10, 6);
      }
    },
    // Snow drifting across the field, slightly faster along the path.
    ambient: ({ g, map, path, clock, hash }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      for (let k = 0; k < map.columns * 2; k++) {
        const s = hash(k, 0),
          fy = ((clock * (14 + s * 10) + s * h * 3) % (h + 20)) - 10,
          fx = (s * w * 7 + Math.sin(clock * 0.8 + k) * 12) % w;
        g.fillStyle(0xeaf7ff, 0.25 + s * 0.35);
        g.fillCircle(fx, fy, 1 + s * 1.2);
      }
      g.fillStyle(0xd6f2ff, 0.3);
      flow(path, clock, 1.6, 1.1, (p, k) => g.fillCircle(p.x + ((k % 3) - 1) * 8, p.y + (((k + 1) % 3) - 1) * 8, 1.5));
    },
  },
  toxic: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      for (const b of map.blocked) {
        const h = hash(b.x, b.y),
          life = (clock * 0.6 + h * 5) % 1;
        g.lineStyle(1.5, 0xb6f04a, 0.7 * (1 - life));
        g.strokeCircle(b.x * CELL + 12 + h * 30, b.y * CELL + 40 - life * 26, 2 + life * 3);
      }
      flow(path, clock, 1.3, 0.5, (p, k) => {
        const pop = (clock * 0.9 + k * 0.37) % 1;
        g.fillStyle(0xc4f562, 0.45 * (1 - pop));
        g.fillCircle(p.x + ((k % 3) - 1) * 9, p.y + (((k * 2) % 3) - 1) * 7, 1.5 + pop * 3);
      });
    },
  },
  orbit: {
    backdrop: 0x070a14,
    ground: [0x10162a, 0x0e1325],
    grid: 0x2c3a60,
    path: { edge: 0x4a5fa8, bed: 0x141c38, line: 0x8fb0ff, arrow: 0xa4c0ff },
    accent: 0x8fb0ff,
    // Equipment rack with a solar panel grid.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x02030a, 0.5);
      g.fillRect(x + 9, y + 11, 42, 42);
      g.fillStyle(0x1c2440);
      g.fillRect(x + 7, y + 7, 42, 42);
      const vertical = rand() < 0.5;
      g.fillStyle(0x253a78);
      g.fillRect(x + 11, y + 11, 34, 34);
      g.lineStyle(1, 0x5a78c8, 0.8);
      for (let i = 1; i < 4; i++) {
        const o = 11 + (i * 34) / 4;
        if (vertical) g.lineBetween(x + o, y + 11, x + o, y + 45);
        else g.lineBetween(x + 11, y + o, x + 45, y + o);
      }
      g.lineBetween(x + 11, y + 28, x + 45, y + 28);
    },
    decor: (g, x, y, rand) => {
      if (rand() < 0.5) {
        g.lineStyle(1, 0x1a2242, 0.9);
        g.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);
        g.fillStyle(0x2a3866);
        for (const [dx, dy] of [[7, 7], [CELL - 7, 7], [7, CELL - 7], [CELL - 7, CELL - 7]]) g.fillCircle(x + dx, y + dy, 1.2);
      } else {
        g.fillStyle(0x6f86c8, 0.6);
        g.fillCircle(x + 8 + rand() * 40, y + 8 + rand() * 40, 0.8 + rand() * 0.6);
      }
    },
    // Twinkling stars, plus guide lights running along the path edges.
    ambient: ({ g, map, path, clock, hash }) => {
      for (let k = 0; k < map.columns * 2; k++) {
        const s = hash(k, 1),
          t = hash(1, k),
          tw = Math.max(0, Math.sin(clock * (0.8 + s) + t * 30));
        g.fillStyle(0xdbe6ff, tw * 0.7);
        g.fillCircle(s * map.columns * CELL, t * map.rows * CELL, 1 + tw);
      }
      flow(path, clock, 1, 2.2, (p) => {
        const nx = -Math.sin(p.angle) * 17,
          ny = Math.cos(p.angle) * 17;
        g.fillStyle(0x8fb0ff, 0.6);
        g.fillCircle(p.x + nx, p.y + ny, 1.6);
        g.fillCircle(p.x - nx, p.y - ny, 1.6);
      });
    },
  },
  ruin: {
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
    ambient: ({ g, map, clock, hash }) => {
      const w = map.columns * CELL,
        height = map.rows * CELL;
      for (let k = 0; k < map.columns; k++) {
        const s = hash(k, 2),
          fy = ((clock * (8 + s * 6) + s * height * 3) % (height + 20)) - 10,
          fx = (s * w * 7 + clock * 6 + Math.sin(clock * 0.7 + k) * 10) % w;
        g.fillStyle(0xb8b0a4, 0.15 + s * 0.2);
        g.fillCircle(fx, fy, 0.8 + s);
      }
      for (const b of map.blocked) {
        const h = hash(b.x, b.y),
          x = b.x * CELL,
          y = b.y * CELL;
        if (h < 0.4) {
          const life = (clock * 0.25 + h * 7) % 1;
          g.fillStyle(0xb8a07c, 0.1 * (1 - life));
          g.fillCircle(x + 28 + life * 24, y + 14 - life * 18, 5 + life * 10);
        } else if (h >= 0.8) {
          const fx = x + 40,
            fy = y + 10,
            f = 0.6 + 0.25 * Math.sin(clock * 9 + h * 30) + 0.15 * Math.sin(clock * 23 + h * 70),
            sway = Math.sin(clock * 7 + h * 9) * 2;
          g.fillStyle(0xff8a3a, 0.12 * f);
          g.fillCircle(fx, fy, 16);
          g.fillStyle(0xff7a2a, 0.55 * f);
          g.fillEllipse(fx, fy, 10, 4);
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
            g.fillStyle(0xfff0c8, 0.07 * on);
            g.fillTriangle(l.x, l.y, f0.x, f0.y, f1.x, f1.y);
            g.fillStyle(0xfff0c8, 0.3 + 0.7 * on);
            g.fillCircle(l.x, l.y, 1.8);
          }
        }
      }
    },
  },
  rift: {
    backdrop: 0x0d0814,
    ground: [0x170f22, 0x140d1e],
    grid: 0x3d2a58,
    path: { edge: 0x8a3fc8, bed: 0x22123a, line: 0xf08aff, arrow: 0xf5a4ff },
    accent: 0xf08aff,
    // Floating shard over a glowing fissure.
    obstacle: (g, x, y, rand) => {
      g.fillStyle(0x05020a, 0.55);
      g.fillEllipse(x + 28, y + 46, 34, 10);
      g.lineStyle(2, 0xc060ff, 0.7);
      zigzag(g, x + 12, y + 46, rand, 34, 4);
      const cx = x + 28 + (rand() - 0.5) * 8,
        h = 18 + rand() * 8;
      g.fillStyle(0x3a1f5c);
      g.fillPoints([{ x: cx, y: y + 34 - h }, { x: cx + 9, y: y + 26 }, { x: cx, y: y + 38 }, { x: cx - 9, y: y + 26 }], true);
      g.fillStyle(0x7a4ab8);
      g.fillPoints([{ x: cx, y: y + 34 - h }, { x: cx, y: y + 38 }, { x: cx - 9, y: y + 26 }], true);
    },
    decor: (g, x, y, rand) => {
      if (rand() < 0.5) {
        g.lineStyle(1, 0x4e2a78, 0.8);
        zigzag(g, x + 12 + rand() * 32, y + 12 + rand() * 32, rand, 18, 3);
      } else {
        polygon(g, x + 12 + rand() * 32, y + 12 + rand() * 32, 2 + rand() * 2, 4, 0x3e2464, rand() * 3);
      }
    },
    // Pulsing fissures and a slow ripple running toward the reactor.
    ambient: ({ g, map, path, clock, hash }) => {
      for (const b of map.blocked) {
        const h = hash(b.x, b.y);
        g.fillStyle(0xc060ff, 0.1 + 0.1 * Math.sin(clock * 2.2 + h * 25));
        g.fillEllipse(px(b.x), b.y * CELL + 46, 30, 8);
      }
      flow(path, clock, 2.5, 1.4, (p) => {
        const nx = -Math.sin(p.angle) * 15,
          ny = Math.cos(p.angle) * 15;
        g.lineStyle(2, 0xf08aff, 0.35);
        g.lineBetween(p.x - nx, p.y - ny, p.x + nx, p.y + ny);
      });
    },
  },
};
const themeOf = (map: MapDefinition) => THEMES[map.theme ?? "outpost"];
/** Reactor colour of the map's theme. */
export const themeAccent = (map: MapDefinition) => themeOf(map).accent;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Static terrain, drawn once per mission. */
export function drawTerrain(scene: Phaser.Scene, map: MapDefinition, isBlocked: (x: number, y: number) => boolean) {
  const g = scene.add.graphics(),
    theme = themeOf(map),
    onPath = new Set(map.path.map((p) => `${p.x},${p.y}`));
  g.fillStyle(theme.backdrop);
  g.fillRect(0, 0, CELL * map.columns, CELL * map.rows);
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) {
      g.fillStyle(theme.ground[(x + y) % 2]);
      g.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
      g.fillStyle(theme.grid, 0.65);
      g.fillCircle(x * CELL, y * CELL, 1);
    }
  // Decoration before obstacles, so rock and crystal shadows sit on top of it.
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) {
      if (onPath.has(`${x},${y}`) || isBlocked(x, y)) continue;
      const rand = cellRandom(map, x, y);
      if (rand() < 0.25) theme.decor(g, x * CELL, y * CELL, rand);
    }
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) if (isBlocked(x, y)) theme.obstacle(g, x * CELL, y * CELL, cellRandom(map, x, y));
  const path = map.path.map((p) => ({ x: px(p.x), y: px(p.y) }));
  g.lineStyle(54, theme.path.line, 0.06);
  g.strokePoints(path, false);
  g.lineStyle(42, theme.path.edge);
  g.strokePoints(path, false);
  g.lineStyle(38, theme.path.bed);
  g.strokePoints(path, false);
  g.lineStyle(20, shade(theme.path.bed, 0.06));
  g.strokePoints(path, false);
  g.lineStyle(2, theme.path.line, 0.4);
  g.strokePoints(path, false);
  for (let i = 2; i < path.length - 1; i += 3) {
    const p = path[i],
      n = path[i + 1],
      a = Math.atan2(n.y - p.y, n.x - p.x);
    g.lineStyle(2, theme.path.arrow, 0.55);
    for (const sign of [-1, 1])
      g.lineBetween(p.x, p.y, p.x - Math.cos(a + sign * 0.65) * 7, p.y - Math.sin(a + sign * 0.65) * 7);
  }
  const start = path[0],
    end = path[path.length - 1],
    accent = theme.accent;
  // Entry: amber in every theme, pointing along the path, inside a dashed ring.
  g.fillStyle(theme.backdrop, 0.6);
  g.fillCircle(start.x, start.y, 25);
  g.lineStyle(2, 0xf0cf87, 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.arc(start.x, start.y, 24, a, a + Math.PI / 8);
    g.strokePath();
  }
  g.fillStyle(theme.backdrop);
  g.fillCircle(start.x, start.y, 19);
  g.lineStyle(2, 0xf0cf87);
  g.strokeCircle(start.x, start.y, 18);
  polygon(g, start.x, start.y, 8, 3, 0xf0cf87, Math.atan2(path[1].y - start.y, path[1].x - start.x));
  // Reactor in the theme's accent; scene.ts pulses a ring between the two outlines.
  g.lineStyle(1, accent, 0.3);
  g.strokeCircle(end.x, end.y, 31);
  g.fillStyle(theme.backdrop);
  g.fillCircle(end.x, end.y, 24);
  g.lineStyle(2, accent);
  g.strokeCircle(end.x, end.y, 22);
  polygon(g, end.x, end.y, 13, 6, accent, Math.PI / 6);
  polygon(g, end.x, end.y, 7, 6, shade(accent, -0.65), Math.PI / 6);
  const label = (x: number, y: number, text: string, color: string) =>
    scene.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "13px",
      fontStyle: "bold",
      color,
      backgroundColor: hex(theme.backdrop),
      padding: { x: 7, y: 5 },
    });
  const width = CELL * map.columns,
    height = CELL * map.rows;
  // Centred on `x`, kept inside the board.
  const place = (text: Phaser.GameObjects.Text, x: number, y: number) =>
    text.setPosition(
      Math.min(Math.max(x - text.width / 2, 4), width - text.width - 4),
      Math.min(Math.max(y, 4), height - text.height - 4),
    );
  // Below the entry when the map name label occupies the space above it.
  place(label(0, 0, "EINTRITT", "#efd297"), start.x, start.y < CELL * 2 ? start.y + 26 : start.y - 54);
  // Below the reactor unless it sits in the bottom row.
  place(label(0, 0, "REAKTOR", hex(accent)), end.x, end.y + 32 + 30 < height ? end.y + 32 : end.y - 58);
  // Map name in the top-left corner, or in the first corner the path keeps clear.
  const name = label(0, 0, map.name.toUpperCase(), hex(shade(theme.grid, 0.35))),
    clear = (row: number, fromRight: boolean) =>
      !map.path.some((p) => p.y === row && (fromRight ? p.x >= map.columns - 4 : p.x < 4));
  if (clear(0, false)) name.setPosition(20, 22);
  else if (clear(map.rows - 1, false)) name.setPosition(20, height - name.height - 22);
  else name.setPosition(width - name.width - 20, clear(0, true) ? 22 : height - name.height - 22);
}
/** Animated terrain details, redrawn every frame. */
export function drawAmbient(g: Ink, map: MapDefinition, clock: number) {
  themeOf(map).ambient({
    g,
    map,
    path: map.path.map((p) => ({ x: px(p.x), y: px(p.y) })),
    clock,
    hash: (x, y) => cellRandom(map, x, y)(),
  });
}
