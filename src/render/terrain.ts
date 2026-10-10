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
  // Dune Sea: sandstone spires and half-buried wrecks in rippled sand. First draw of `obstacle` picks the variant (ambient reads it from `hash`).
  dune: {
    backdrop: 0x1a1206,
    ground: [0x2a1f10, 0x261c0e],
    grid: 0x4a3818,
    path: { edge: 0xc98a3a, bed: 0x3a2a12, line: 0xffc46b, arrow: 0xffd48a },
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
    ambient: ({ g, map, path, clock, hash }) => {
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
      for (const b of map.blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        // Wrecks only: a sheen drifting over the hot plate.
        g.fillStyle(0xffc46b, 0.05 + 0.04 * Math.sin(clock * 1.6 + o * 20));
        g.fillEllipse(px(b.x), b.y * CELL + 30, 44, 18);
      }
    },
  },
  // Deep Sea: coral and hydrothermal vents, kelp and shells, bubbles and slow light rays. First draw of `obstacle` picks the variant.
  abyss: {
    backdrop: 0x020a14,
    ground: [0x061424, 0x051220],
    grid: 0x0f3050,
    path: { edge: 0x1f8fa8, bed: 0x072236, line: 0x3df2e0, arrow: 0x7af8ea },
    accent: 0x3df2e0,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x010408, 0.55);
      g.fillEllipse(x + 28, y + 47, 38, 10);
      if (kind < 0.55) {
        // Branching coral with glowing tips.
        const base = x + 28,
          arms = 3 + Math.floor(rand() * 2);
        for (let i = 0; i < arms; i++) {
          const lean = (i - (arms - 1) / 2) * 9 + (rand() - 0.5) * 4,
            h = 20 + rand() * 12,
            tx = base + lean,
            ty = y + 46 - h;
          g.lineStyle(5, 0x1f5a6e);
          g.strokePoints([{ x: base + lean * 0.2, y: y + 47 }, { x: base + lean * 0.6, y: y + 46 - h * 0.5 }, { x: tx, y: ty }], false);
          g.lineStyle(2, 0x3a8aa0, 0.8);
          g.strokePoints([{ x: base + lean * 0.2 - 1, y: y + 47 }, { x: base + lean * 0.6 - 1, y: y + 46 - h * 0.5 }, { x: tx - 1, y: ty }], false);
          g.fillStyle(0xff7aa8);
          g.fillCircle(tx, ty, 3);
          g.fillStyle(0xffc0d4, 0.8);
          g.fillCircle(tx - 0.8, ty - 0.8, 1.2);
        }
      } else {
        // Hydrothermal vent: a dark chimney with a glowing mouth.
        const cx = x + 28 + (rand() - 0.5) * 6,
          h = 22 + rand() * 8;
        g.fillStyle(0x16222e);
        g.fillPoints([{ x: cx - 13, y: y + 47 }, { x: cx - 6, y: y + 46 - h }, { x: cx + 6, y: y + 46 - h }, { x: cx + 13, y: y + 47 }], true);
        g.fillStyle(0x24384a);
        g.fillPoints([{ x: cx - 13, y: y + 47 }, { x: cx - 6, y: y + 46 - h }, { x: cx - 1, y: y + 46 - h }, { x: cx - 3, y: y + 47 }], true);
        g.fillStyle(0x7a3a1a, 0.7);
        for (let i = 0; i < 3; i++) g.fillRect(cx - 8 + i * 6 + rand() * 2, y + 30 + rand() * 12, 3, 2);
        g.fillStyle(0xff9a4a, 0.85);
        g.fillEllipse(cx, y + 46 - h, 12, 4);
        g.fillStyle(0xffe0a0, 0.9);
        g.fillEllipse(cx, y + 46 - h, 6, 2);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.55) {
        // Seaweed fronds.
        for (let i = 0; i < 3; i++) {
          const bx = cx + (i - 1) * 4,
            lean = (rand() - 0.5) * 8,
            h = 12 + rand() * 8;
          g.lineStyle(1.5, i === 1 ? 0x2a8a5a : 0x1f6a48, 0.85);
          g.strokePoints([{ x: bx, y: cy + 6 }, { x: bx + lean, y: cy + 6 - h * 0.5 }, { x: bx - lean * 0.4, y: cy + 6 - h }], false);
        }
      } else if (kind < 0.85) {
        // Shell: a fan with ribs.
        g.fillStyle(0x3a6a7a, 0.9);
        g.fillTriangle(cx - 5, cy + 3, cx + 5, cy + 3, cx, cy - 4);
        g.lineStyle(1, 0x9ad8e0, 0.6);
        for (const dx of [-2.5, 0, 2.5]) g.lineBetween(cx, cy + 3, cx + dx * 1.2, cy - 3);
      } else {
        // Pale pebbles on the seabed.
        for (let i = 0; i < 3; i++) {
          g.fillStyle(0x1a4658, 0.9);
          g.fillCircle(cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 1.5 + rand() * 1.5);
        }
      }
    },
    // Slow light rays from above, bubbles rising from vents and the channel, bioluminescent pulses at the obstacles.
    ambient: ({ g, map, path, clock, hash }) => {
      const h = map.rows * CELL;
      for (let k = 0; k < Math.ceil(map.columns / 2); k++) {
        const s = hash(k, 5),
          sway = Math.sin(clock * 0.25 + s * 20) * 14,
          x0 = s * map.columns * CELL + sway;
        g.fillStyle(0x7af8ea, 0.025 + 0.015 * Math.sin(clock * 0.5 + s * 9));
        g.fillPoints([{ x: x0, y: 0 }, { x: x0 + 22, y: 0 }, { x: x0 + 70, y: h }, { x: x0 + 30, y: h }], true);
      }
      for (const b of map.blocked) {
        const o = hash(b.x, b.y),
          bx = b.x * CELL,
          by = b.y * CELL,
          vent = o >= 0.55;
        g.fillStyle(vent ? 0xff9a4a : 0x3df2e0, 0.06 + 0.06 * Math.sin(clock * 2 + o * 25));
        g.fillCircle(px(b.x), by + 30, vent ? 20 : 26);
        for (let i = 0; i < (vent ? 3 : 1); i++) {
          const life = (clock * (vent ? 0.7 : 0.4) + o * 5 + i / 3) % 1;
          g.lineStyle(1.2, 0xbff8ff, 0.6 * (1 - life));
          g.strokeCircle(bx + 24 + o * 12 + Math.sin(life * 7 + i) * 3, by + (vent ? 28 : 34) - life * 36, 1.5 + life * 2.5);
        }
      }
      flow(path, clock, 1.7, 0.45, (p, k) => {
        const life = (clock * 0.5 + k * 0.31) % 1;
        g.lineStyle(1, 0xbff8ff, 0.4 * (1 - life));
        g.strokeCircle(p.x + ((k % 3) - 1) * 9, p.y + 6 - life * 18, 1.5 + (k % 2));
      });
    },
  },
  // Gewitterplateau: basalt needles and lightning rods, rain and flashes.
  storm: {
    backdrop: 0x0b0f18,
    ground: [0x141a26, 0x121722],
    grid: 0x24304a,
    path: { edge: 0x4a6a8a, bed: 0x0e1420, line: 0x9fd8ff, arrow: 0xcfeaff },
    accent: 0x9fd8ff,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x04060c, 0.55);
      g.fillEllipse(x + 28, y + 47, 36, 10);
      if (kind < 0.55) {
        // Jagged basalt needles.
        const needles = 2 + Math.floor(rand() * 2);
        for (let i = 0; i < needles; i++) {
          const cx = x + 28 + (i - (needles - 1) / 2) * 11 + (rand() - 0.5) * 4,
            h = 18 + rand() * 18,
            w = 6 + rand() * 3,
            lean = (rand() - 0.5) * 6;
          g.fillStyle(0x232c3e);
          g.fillPoints([{ x: cx - w, y: y + 47 }, { x: cx - w * 0.5 + lean * 0.5, y: y + 47 - h * 0.6 }, { x: cx + lean, y: y + 47 - h }, { x: cx + w * 0.6, y: y + 47 - h * 0.5 }, { x: cx + w, y: y + 47 }], true);
          g.fillStyle(0x3a4a64);
          g.fillPoints([{ x: cx - w, y: y + 47 }, { x: cx - w * 0.5 + lean * 0.5, y: y + 47 - h * 0.6 }, { x: cx + lean, y: y + 47 - h }, { x: cx - 1, y: y + 47 }], true);
          g.lineStyle(1, 0x6a86a8, 0.5);
          g.lineBetween(cx - w * 0.5 + lean * 0.5, y + 47 - h * 0.6, cx + lean, y + 47 - h);
        }
      } else {
        // Lightning rod: a pole on a stone footing with a glowing tip.
        const cx = x + 28,
          h = 30 + rand() * 8;
        g.fillStyle(0x2a3448);
        g.fillPoints([{ x: cx - 14, y: y + 47 }, { x: cx - 9, y: y + 39 }, { x: cx + 9, y: y + 39 }, { x: cx + 14, y: y + 47 }], true);
        g.fillStyle(0x4a5a78);
        g.fillRect(cx - 9, y + 39, 18, 2);
        g.lineStyle(3, 0x7a8aa4);
        g.lineBetween(cx, y + 39, cx, y + 47 - h);
        g.lineStyle(1.5, 0x9fb0c8, 0.9);
        for (const d of [-5, 5]) g.lineBetween(cx, y + 47 - h * 0.55, cx + d, y + 47 - h * 0.7);
        g.fillStyle(0x9fd8ff, 0.3);
        g.fillCircle(cx, y + 47 - h, 6);
        g.fillStyle(0xe6f6ff);
        g.fillCircle(cx, y + 47 - h, 2.5);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.45) {
        // Puddle with a highlight.
        g.fillStyle(0x0a1020, 0.8);
        g.fillEllipse(cx, cy, 16 + rand() * 8, 7);
        g.lineStyle(1, 0x7ab8e0, 0.45);
        g.lineBetween(cx - 4, cy - 1, cx + 2, cy - 1);
      } else if (kind < 0.8) {
        // Cracked stone.
        g.lineStyle(1, 0x05080e, 0.85);
        zigzag(g, cx - 6, cy, rand, 14, 3);
        zigzag(g, cx, cy, rand, 9, 2);
      } else {
        // Scorch mark with a few embers.
        g.fillStyle(0x05070c, 0.7);
        g.fillEllipse(cx, cy, 14, 9);
        g.fillStyle(0x9fd8ff, 0.7);
        for (let i = 0; i < 3; i++) g.fillRect(cx + (rand() - 0.5) * 10, cy + (rand() - 0.5) * 6, 1.5, 1.5);
      }
    },
    // Slanted rain, flashes at the rods, crackle along the channel.
    ambient: ({ g, map, path, clock, hash }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      g.lineStyle(1, 0x9fc8e8, 0.22);
      for (let k = 0; k < Math.ceil(map.columns * 2.5); k++) {
        const s = hash(k, 91),
          life = (clock * 1.3 + s * 7) % 1,
          x0 = ((s * 13.7) % 1) * (w + 60) - 30 + life * 40,
          y0 = life * (h + 20) - 10;
        g.lineBetween(x0, y0, x0 - 5, y0 + 12);
      }
      for (const b of map.blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        const t = (clock * 0.22 + o * 11) % 1;
        if (t > 0.06) continue;
        const f = 1 - t / 0.06,
          flick = f * (0.6 + 0.4 * Math.sin(clock * 90)),
          tipX = px(b.x),
          tipY = b.y * CELL + 12;
        g.fillStyle(0xcfeaff, 0.3 * flick);
        g.fillCircle(tipX, tipY, 26);
        g.fillStyle(0xffffff, 0.12 * flick);
        g.fillRect(0, 0, w, h);
        g.lineStyle(2, 0xe6f6ff, 0.9 * flick);
        g.strokePoints([{ x: tipX, y: tipY - 40 }, { x: tipX + 6, y: tipY - 24 }, { x: tipX - 4, y: tipY - 12 }, { x: tipX, y: tipY }], false);
      }
      flow(path, clock, 1.9, 0.6, (p, k) => {
        const on = Math.sin(clock * 11 + k * 3.1);
        if (on < 0.3) return;
        const side = ((k % 3) - 1) * 6,
          nx = -Math.sin(p.angle) * side,
          ny = Math.cos(p.angle) * side,
          dx = Math.cos(p.angle) * 9,
          dy = Math.sin(p.angle) * 9;
        g.lineStyle(1.2, 0xcfeaff, 0.55 * on);
        g.strokePoints([{ x: p.x + nx - dx, y: p.y + ny - dy }, { x: p.x + nx + (k % 2 ? 3 : -3), y: p.y + ny + (k % 2 ? -3 : 3) }, { x: p.x + nx + dx, y: p.y + ny + dy }], false);
      });
    },
  },
  // Jungle: dense trees and mossy temple stones, fireflies and mist.
  jungle: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      for (let k = 0; k < Math.ceil(map.columns / 2); k++) {
        const s = hash(k, 77),
          sway = Math.sin(clock * 0.5 + s * 20) * 10,
          cx = s * w + sway,
          cy = hash(k, 78) * h;
        g.fillStyle(0x020a04, 0.07);
        g.fillEllipse(cx, cy, 70, 26);
        g.fillEllipse(cx + 20 + sway * 0.5, cy + 14, 40, 16);
      }
      flow(path, clock, 2.2, 0.25, (p, k) => {
        const swell = 0.5 + 0.5 * Math.sin(clock * 0.6 + k * 1.7);
        g.fillStyle(0xcfffd0, 0.035 + 0.03 * swell);
        g.fillEllipse(p.x + Math.sin(clock * 0.4 + k) * 8, p.y + 4, 46, 18);
      });
      for (let k = 0; k < Math.ceil(map.columns * 1.2); k++) {
        const s = hash(k, 55),
          t = clock * (0.15 + s * 0.1) + s * 30,
          fx = ((s * 7.3) % 1) * w + Math.sin(t) * 22,
          fy = hash(k, 56) * h + Math.cos(t * 0.8) * 16,
          glow = 0.5 + 0.5 * Math.sin(clock * 1.6 + s * 40);
        g.fillStyle(0xd8ff7a, 0.1 * glow);
        g.fillCircle(fx, fy, 6);
        g.fillStyle(0xf4ffb0, 0.35 + 0.5 * glow);
        g.fillCircle(fx, fy, 1.6);
      }
    },
  },
  // Volcano Chain: light-grey ash ground, sulphur yellow, lava glow; obsidian spikes and sulphur craters.
  volcano: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      flow(path, clock, 2.4, 0.35, (p, k) => {
        const pulse = 0.5 + 0.5 * Math.sin(clock * 1.3 + k * 1.9);
        g.fillStyle(0xff5a1a, 0.04 + 0.05 * pulse);
        g.fillEllipse(p.x, p.y, 52, 30);
        g.fillStyle(0xff8a3a, 0.05 + 0.06 * pulse);
        g.fillCircle(p.x, p.y, 9);
      });
      for (const b of map.blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        for (let i = 0; i < 3; i++) {
          const life = (clock * 0.25 + o * 7 + i / 3) % 1;
          g.fillStyle(0xd8d4c8, 0.12 * (1 - life));
          g.fillCircle(b.x * CELL + 28 + Math.sin(life * 4 + o * 9) * 6 + life * 8, b.y * CELL + 30 - life * 30, 5 + life * 8);
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
  },
  // Crystal Cave: turquoise cave, clear quartz columns and cut-open amethyst geodes.
  geode: {
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
    ambient: ({ g, map, path, clock, hash }) => {
      for (const b of map.blocked) {
        const o = hash(b.x, b.y),
          quartz = o < 0.55,
          tw = Math.sin(clock * 2.2 + o * 40),
          gx = b.x * CELL + 20 + hash(b.y, b.x) * 18,
          gy = b.y * CELL + (quartz ? 14 : 26) + hash(b.x, b.y + 9) * 12;
        if (!quartz) {
          g.fillStyle(0xa86cf0, 0.05 + 0.05 * (0.5 + 0.5 * tw));
          g.fillCircle(b.x * CELL + 28, b.y * CELL + 34, 22);
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
        g.strokeEllipse(p.x + ox, p.y + oy, 22 + 10 * s, 9 + 4 * s);
        g.lineStyle(1, 0xc8b0ff, 0.04 + 0.07 * (1 - s));
        g.strokeEllipse(p.x - ox, p.y - oy, 14 + 8 * s, 6 + 3 * s);
      });
    },
  },
  // Gearworks: brass gears and copper rivets, a slow glint rolling along the path.
  gear: {
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
    ambient: ({ g, map, clock, path, hash }) => {
      flow(path, clock, 2.2, 0.8, (p, k) => {
        const s = 0.5 + 0.5 * Math.sin(clock * 2.2 + k * 1.9),
          len = 7 + 4 * s;
        g.fillStyle(0xe8c273, 0.05 + 0.07 * s);
        g.fillEllipse(p.x, p.y, 20 + 8 * s, 9);
        g.lineStyle(1.2, 0xfff0b8, 0.2 + 0.25 * s);
        g.lineBetween(p.x - Math.cos(p.angle) * len, p.y - Math.sin(p.angle) * len, p.x + Math.cos(p.angle) * len, p.y + Math.sin(p.angle) * len);
      });
      for (const b of map.blocked) {
        if (hash(b.x, b.y) >= 0.55) continue;
        const a = clock * 0.5 + hash(b.x, b.y + 7) * 6.28,
          cx = px(b.x),
          cy = px(b.y);
        g.fillStyle(0xfff0b8, 0.45);
        g.fillCircle(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 1.6);
      }
    },
  },
  // Moon Lake: moonlit rocks with shells and tidepools, foam drifting along the path.
  tide: {
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
    ambient: ({ g, map, clock, path, hash }) => {
      flow(path, clock, 1.6, 0.45, (p, k) => {
        const s = 0.5 + 0.5 * Math.sin(clock * 1.1 + k * 2.1),
          ox = Math.sin(clock * 0.7 + k * 1.7) * 9,
          oy = Math.cos(clock * 0.6 + k * 2.4) * 6;
        g.lineStyle(1.2, 0xdceaf8, 0.07 + 0.12 * s);
        g.strokeEllipse(p.x + ox, p.y + oy, 16 + 8 * s, 6 + 3 * s);
        g.fillStyle(0xf0f8ff, 0.12 + 0.2 * (1 - s));
        g.fillCircle(p.x - ox, p.y - oy, 1.3);
        g.fillCircle(p.x - ox * 0.5 + 4, p.y + oy * 0.6, 0.9);
      });
      for (const b of map.blocked) {
        const o = hash(b.x, b.y);
        if (o < 0.55) continue;
        const s = 0.5 + 0.5 * Math.sin(clock * 1.6 + o * 20);
        g.lineStyle(1, 0xdceaf8, 0.12 + 0.28 * s);
        g.strokeEllipse(px(b.x) + (s - 0.5) * 6, px(b.y) + 4, 8 + 6 * s, 3 + 2 * s);
      }
    },
  },
};
const themeOf = (map: MapDefinition) => THEMES[map.theme ?? "outpost"];
/** Reactor colour of the map's theme. */
export const themeAccent = (map: MapDefinition) => themeOf(map).accent;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Path in pixels; a ring repeats its first cell at the end so lines and markers close the loop. */
const pixelPath = (map: MapDefinition) =>
  (map.loop ? [...map.path, map.path[0]] : map.path).map((p) => ({ x: px(p.x), y: px(p.y) }));
/** Reactor in the theme's accent; scene.ts pulses a ring between the two outlines. */
function drawReactor(g: Phaser.GameObjects.Graphics, end: Point, accent: number, backdrop: number) {
  g.lineStyle(1, accent, 0.3);
  g.strokeCircle(end.x, end.y, 31);
  g.fillStyle(backdrop);
  g.fillCircle(end.x, end.y, 24);
  g.lineStyle(2, accent);
  g.strokeCircle(end.x, end.y, 22);
  polygon(g, end.x, end.y, 13, 6, accent, Math.PI / 6);
  polygon(g, end.x, end.y, 7, 6, shade(accent, -0.65), Math.PI / 6);
}
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
  const path = pixelPath(map);
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
  // A ring has no reactor; its entry portal glows in the accent colour instead.
  const portal = map.loop ? accent : 0xf0cf87;
  // Entry: amber in every theme, pointing along the path, inside a dashed ring.
  g.fillStyle(theme.backdrop, 0.6);
  g.fillCircle(start.x, start.y, 25);
  g.lineStyle(2, portal, 0.5);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    g.beginPath();
    g.arc(start.x, start.y, 24, a, a + Math.PI / 8);
    g.strokePath();
  }
  g.fillStyle(theme.backdrop);
  g.fillCircle(start.x, start.y, 19);
  g.lineStyle(2, portal);
  g.strokeCircle(start.x, start.y, 18);
  polygon(g, start.x, start.y, 8, 3, portal, Math.atan2(path[1].y - start.y, path[1].x - start.x));
  if (!map.loop) drawReactor(g, end, accent, theme.backdrop);
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
  place(
    label(0, 0, map.loop ? "PORTAL" : "EINTRITT", map.loop ? hex(accent) : "#efd297"),
    start.x,
    start.y < CELL * 2 ? start.y + 26 : start.y - 54,
  );
  // Below the reactor unless it sits in the bottom row.
  if (!map.loop) place(label(0, 0, "REAKTOR", hex(accent)), end.x, end.y + 32 + 30 < height ? end.y + 32 : end.y - 58);
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
    path: pixelPath(map),
    clock,
    hash: (x, y) => cellRandom(map, x, y)(),
  });
}
