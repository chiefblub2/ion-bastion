import { CELL, disc, fillRound, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, Y } from "../tower-art/tilt";
import { cellRandom, plateAt, type Random, type Theme } from "./kit";
import { CHANNEL_STEP, channelOf } from "../coast";
import { halo } from "../material";
import { fnv } from "../../core/hash";
import type { MapDefinition } from "../../core/types";
import { flame } from "./ember-props";
import {
  apartmentShadow, BARREL, billboardShadow, BLOCK, carOf, carShadow, columnOf, columnShadow, drawApartment, drawBillboard, drawCar, drawColumn,
  drawHeap, drawLamp, drawWall, headlights, heapOf, heapShadow, lampHead, lampOf, lampShadow, NEON, wallOf, wallShadow, type Car, type Column,
  type Heap, type Lamp, type Wall,
} from "./ruin-props";

// Ruined City: a bombed-out district at dusk under drifting ash. A cracked asphalt street instead of the sunken track:
// broken kerbs, a crack network, potholes holding water and faded lane paint; props in the towers' 3/4 tilt
// (`Theme.tilted`, `ruin-props.ts`): broken brick walls, fallen columns, burnt-out cars, rubble heaps with fire barrels
// and bent streetlamps; a gutted apartment block with a few lit windows and a torn billboard with flickering neon as
// landmarks. Its maps pack rubble against the board edges, so the theme keeps every obstacle a prop (no `sea`).

/** Teal, not sand, so the reactor stands apart from the amber entry. */
const ACCENT = 0x9ad8c0;
/** Kind thresholds of the first `cellRandom` draw. */
const WALL = 0.34,
  COLUMN = 0.5,
  CAR = 0.68,
  HEAP = 0.88;

type Piece =
  | { kind: "wall"; wall: Wall }
  | { kind: "column"; column: Column }
  | { kind: "car"; car: Car }
  | { kind: "heap"; heap: Heap }
  | { kind: "lamp"; lamp: Lamp; heap: Heap };
function pieceOf(rand: Random): Piece {
  const kind = rand();
  if (kind < WALL) return { kind: "wall", wall: wallOf(rand) };
  if (kind < COLUMN) return { kind: "column", column: columnOf(rand) };
  if (kind < CAR) return { kind: "car", car: carOf(rand) };
  if (kind < HEAP) return { kind: "heap", heap: heapOf(rand) };
  const lamp = lampOf(rand),
    heap = heapOf(rand);
  return { kind: "lamp", lamp, heap: { chunks: heap.chunks.slice(0, 3).map((c) => ({ ...c, u: c.u * 0.5 + 6, v: c.v * 0.4 + 8, r: c.r * 0.7 })), barrel: false } };
}
const groundOf = (x: number, y: number) => ({ gx: x + CELL / 2, gy: y + 36 });
/** A lamp stands at the back of its cell, its rubble in front. */
const LAMP_AT = { u: -6, v: -6 } as const;
/** A cell's piece rolled once per map for the ambient, from the same stream as its baked body. */
const PIECES = new Map<string, Piece>();
function pieceAt(map: MapDefinition, x: number, y: number) {
  const key = `${map.id}:${x}:${y}`;
  let p = PIECES.get(key);
  if (!p) PIECES.set(key, (p = pieceOf(cellRandom(map, x, y))));
  return p;
}

// ── Street ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const ASPHALT = 0x2a2724;
/**
 * The path as a ruined street with rounded bends (`coast.ts` `channelOf`): a broken concrete kerb, asphalt patched in
 * tones and split by a crack network, potholes with standing water, faded and broken lane paint, and scattered grit.
 */
function drawStreet(g: Ink, map: MapDefinition) {
  const samples = channelOf(map),
    seed = fnv(`${map.id}:street`),
    layer = (r: number, color: number) => {
      for (let i = 0; i < samples.length; i += 2) disc(g, samples[i].x, samples[i].y, r, color);
    };
  layer(25.5, 0x4a4640);
  layer(23.5, 0x6a655c);
  layer(22, ASPHALT);
  // Broken kerb: gaps and chunks knocked out along both edges.
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i],
      h = hash01(seed, i);
    if (h < 0.18) for (const side of [-1, 1]) if (hash01(seed, i, side) < 0.5) disc(g, p.x + p.nx * side * 23.5, p.y + p.ny * side * 23.5, 2.6 + h * 6, ASPHALT);
  }
  // Patched asphalt and the crack network.
  const done = new Set<number>();
  for (let i = 0; i < samples.length; i += 3) {
    const p = samples[i];
    for (let ty = Math.floor(p.y - 21); ty <= Math.floor(p.y + 21); ty++)
      for (let tx = Math.floor(p.x - 21); tx <= Math.floor(p.x + 21); tx++) {
        const key = ty * 100000 + tx,
          x = tx + 0.5,
          y = ty + 0.5;
        if (done.has(key) || (x - p.x) ** 2 + (y - p.y) ** 2 > 21 ** 2) continue;
        done.add(key);
        const { id, edge } = plateAt(seed, x, y, 34);
        if (edge < 0.8 && hash01(seed, id, 3) < 0.7) {
          g.fillStyle(0x100e0c, 0.9);
          g.fillRect(tx, ty, 1, 1);
        } else if (hash01(seed, id) < 0.3) {
          g.fillStyle(hash01(seed, id, 1) < 0.5 ? 0x34302c : 0x221f1c, 0.6);
          g.fillRect(tx, ty, 1, 1);
        }
      }
  }
  // Faded lane paint down the middle, broken where the road is.
  for (let i = 0; i + 4 < samples.length; i += 8) {
    if (hash01(seed, i, 4) < 0.35) continue;
    const p = samples[i],
      q = samples[i + 4];
    g.lineStyle(2, 0xc8b070, 0.28 + hash01(seed, i, 5) * 0.2);
    g.lineBetween(p.x, p.y, q.x, q.y);
  }
  // Potholes, some holding water that catches the sky.
  for (let i = 17; i < samples.length; i += 37) {
    const p = samples[i],
      o = (hash01(seed, i, 6) - 0.5) * 24,
      x = p.x + p.nx * o,
      y = p.y + p.ny * o,
      r = 4 + hash01(seed, i, 7) * 4;
    oval(g, x, y + 0.6, r + 1.4, (r + 1.4) * 0.6, 0x4a4640, 0.9);
    oval(g, x, y, r, r * 0.6, 0x0e0c0a);
    if (hash01(seed, i, 8) < 0.6) {
      oval(g, x, y + 0.4, r * 0.8, r * 0.45, 0x1e2a32);
      g.lineStyle(0.8, 0x6a7a84, 0.5);
      g.lineBetween(x - r * 0.4, y - 0.4, x + r * 0.2, y - 0.6);
    }
  }
  // Grit and small debris.
  for (let i = 0; i < samples.length; i += 2) {
    if (hash01(seed, i, 9) > 0.3) continue;
    const p = samples[i],
      o = (hash01(seed, i, 10) - 0.5) * 38;
    disc(g, p.x + p.nx * o, p.y + p.ny * o, 0.7 + hash01(seed, i, 11) * 1.1, hash01(seed, i, 12) < 0.3 ? 0x6e4c3a : 0x5a5650, 0.9);
  }
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
function scaled(g: Ink, x: number, y0: number, k: number, draw: () => void) {
  g.save();
  g.translateCanvas(x, y0);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
}
const landmarkGround = (x: number, y: number, s: number) => ({ y0: y + s * 0.3, k: s / CELL });

// ── Theme ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ruin: Theme = {
  backdrop: 0x12100e,
  ground: [0x1d1b19, 0x1a1816],
  grid: 0x423a31,
  path: { edge: 0x6a655c, bed: ASPHALT, line: 0xd8b98a, arrow: 0xe2c79c },
  accent: ACCENT,
  drawPath: drawStreet,
  obstacle: (g, x, y, rand) => {
    const p = pieceOf(rand),
      { gx, gy } = groundOf(x, y);
    if (p.kind === "wall") drawWall(g, gx, gy - 4, p.wall);
    else if (p.kind === "column") drawColumn(g, gx, gy, p.column);
    else if (p.kind === "car") drawCar(g, gx, gy - 2, p.car);
    else if (p.kind === "heap") drawHeap(g, gx, gy, p.heap);
    else {
      drawLamp(g, gx + LAMP_AT.u, gy + LAMP_AT.v * SQUASH, p.lamp);
      drawHeap(g, gx, gy, p.heap);
    }
  },
  tilted: {
    shadow: (g, x, y, rand) => {
      const p = pieceOf(rand),
        { gx, gy } = groundOf(x, y);
      if (p.kind === "wall") wallShadow(g, gx, gy - 4, p.wall);
      else if (p.kind === "column") columnShadow(g, gx, gy, p.column);
      else if (p.kind === "car") carShadow(g, gx, gy - 2, p.car);
      else if (p.kind === "heap") heapShadow(g, gx, gy, p.heap);
      else {
        lampShadow(g, gx + LAMP_AT.u, gy + LAMP_AT.v * SQUASH);
        heapShadow(g, gx, gy, p.heap);
      }
    },
    landmark: (g, x, y, s, variant) => {
      const { y0, k } = landmarkGround(x, y, s);
      scaled(g, x, y0, k, () => (variant ? billboardShadow(g) : apartmentShadow(g)));
      scaled(g, x, y0, k, () => (variant ? drawBillboard(g) : drawApartment(g)));
    },
    // A few windows of the apartment block still hold a lamp, one flickering; the billboard's neon stutters pink.
    landmarkLight: (g, glow, x, y, s, variant, clock, lit) => {
      const { y0, k } = landmarkGround(x, y, s);
      if (variant) {
        const on = Math.sin(clock * 11 + x) + Math.sin(clock * 3.7) > 0.2 ? 1 : 0.1;
        g.lineStyle(1.6 * k, 0xff6ad8, 0.4 + 0.6 * on);
        g.strokePoints(NEON.map(([u, h]) => ({ x: x + u * k, y: Y(y0, 6 * k, h * k) })), false);
        glow.lineStyle(5 * k, 0xff4ac8, 0.22 * on * lit);
        glow.strokePoints(NEON.map(([u, h]) => ({ x: x + u * k, y: Y(y0, 6 * k, h * k) })), false);
        return;
      }
      [[0, 1, 0.6], [1, 2, 0.25], [2, 0, 0.9]].forEach(([col, floor, ph], i) => {
        const wx = x + (-30 + col * 10 + 5) * k,
          wy = Y(y0, 18 * k, (BLOCK.floors[floor] + 4) * k),
          on = i === 1 ? (Math.sin(clock * 17 + ph * 10) > -0.3 ? 1 : 0.2) : 1;
        g.fillStyle(0xffd890, 0.75 * on);
        g.fillRect(wx - 2.5 * k, wy - 4 * k, 5 * k, 8 * k);
        halo(glow, wx, wy, 9 * k, 0xffc870, 0.18 * on * lit);
      });
    },
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
    } else if (kind < 0.5) {
      // Weeds out of a crack.
      g.lineStyle(1, 0x0e0c0a, 0.9);
      g.lineBetween(cx - 8, cy + 2, cx + 8, cy - 2);
      g.lineStyle(1.2, 0x4f6630);
      for (const dx of [-4, -1, 2, 5]) g.lineBetween(cx, cy, cx + dx, cy - 5 - rand() * 5);
    } else if (kind < 0.68) {
      // Puddle catching a cold sky.
      oval(g, cx, cy, 10 + rand() * 5, 4 + rand() * 2, 0x121517);
      g.lineStyle(1, 0x5a6a70, 0.45);
      g.lineBetween(cx - 6, cy - 1.5, cx + 3, cy - 2);
    } else if (kind < 0.9) {
      for (let i = 0; i < 4; i++) disc(g, x + 8 + rand() * 38, y + 8 + rand() * 38, 1 + rand() * 1.5, rand() < 0.5 ? 0x4a3328 : 0x3a3833, 0.9);
    } else {
      // A scorch mark.
      oval(g, cx, cy, 12 + rand() * 6, 6 + rand() * 3, 0x0e0c0a, 0.6);
    }
  },
  // Ash drifting down, fire in the barrels, streetlamps flickering, a wreck's headlights stuttering.
  ambient: ({ g, glow, lit, map, clock, hash, blocked }) => {
    for (const b of blocked) {
      const p = pieceAt(map, b.x, b.y),
        { gx, gy } = groundOf(b.x * CELL, b.y * CELL);
      if (p.kind === "heap" && p.heap.barrel) {
        const fx = gx + BARREL.u,
          fy = Y(gy + BARREL.v * SQUASH, 0, BARREL.h);
        flame(g, fx, fy, 0.9, clock, b.x * 3 + b.y);
        halo(glow, fx, fy - 4, 16, 0xff8a3a, (0.18 + 0.06 * Math.sin(clock * 11 + b.x)) * lit);
        for (let e = 0; e < 2; e++) {
          const life = (clock * 0.5 + hash01(b.x, b.y, e)) % 1;
          disc(g, fx + Math.sin(life * 6 + e) * 4, fy - 6 - life * 26, 1, life < 0.5 ? 0xffd27a : 0xff7a3a, 1 - life);
        }
      } else if (p.kind === "lamp") {
        const head = lampHead(p.lamp),
          lx = gx + LAMP_AT.u + head.u,
          ly = Y(gy + LAMP_AT.v * SQUASH, 0, head.h),
          on = Math.sin(clock * 9 + b.x * 2) + Math.sin(clock * 2.3 + b.y) > -0.6 ? 1 : 0.1;
        disc(g, lx, ly + 1, 1.6, 0xfff0c0, 0.4 + 0.6 * on);
        glow.fillStyle(0xffe0a0, 0.08 * on * lit);
        glow.fillTriangle(lx - 2, ly + 1, lx - 12, ly + head.h * 0.9, lx + 12, ly + head.h * 0.9);
        halo(glow, lx, ly + head.h * 0.9, 14, 0xffe0a0, 0.1 * on * lit);
      } else if (p.kind === "car" && hash01(b.x, b.y, 3) < 0.35) {
        const on = Math.sin(clock * 13 + b.x) + Math.sin(clock * 5.3 + b.y) > 0.4 ? 1 : 0.15;
        for (const l of headlights(p.car)) {
          disc(g, gx + l.x, gy - 2 + l.y, 1.4, 0xfff0c8, 0.3 + 0.7 * on);
          disc(glow, gx + l.x, gy - 2 + l.y, 6, 0xfff0c8, 0.2 * on * lit);
        }
      }
    }
    // Ash falling over the whole board.
    if (!map.columns) return;
    const w = map.columns * CELL,
      height = map.rows * CELL;
    for (let k = 0; k < map.columns * 2; k++) {
      const s = hash(k, 2),
        fy = ((clock * (8 + s * 6) + s * height * 3) % (height + 20)) - 10,
        fx = (s * w * 7 + clock * 6 + Math.sin(clock * 0.7 + k) * 10) % w;
      g.fillStyle(0xb8b0a4, 0.15 + s * 0.25);
      fillRound(g, fx, fy, 0.7 + s);
    }
    // A slow sweep of dust along the street.
    const samples = channelOf(map),
      total = samples[samples.length - 1].s;
    for (let k = 0; k * 260 < total; k++) {
      const s = (k * 260 + clock * 20) % total,
        p = samples[Math.min(samples.length - 1, Math.floor(s / CHANNEL_STEP))];
      oval(g, p.x, p.y, 18, 7, shade(0xb8a07c, -0.2), 0.06);
    }
  },
};
