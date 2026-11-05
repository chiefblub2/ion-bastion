import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, endFace, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Ruined City (`ruin.ts`), a bombed-out district at dusk, drawn in the towers' 3/4 tilt: broken brick
// walls with rebar, fallen columns beside their stubs, burnt-out cars, rubble heaps with fire barrels and bent
// streetlamps; a gutted apartment block and a torn billboard as landmarks. Every prop stands on a ground point (gx, gy)
// in pixels and is rolled up front into a plain record; fire, lamps and neon live in the theme's ambient.

export const SHADE = 0x050403;
export const SUN = { x: 0.5, y: 0.3 } as const;
const BRICK = [0x6e4c3a, 0x5e4536, 0x7a5842] as const,
  CONCRETE = 0x6a665e,
  RUST = 0x8a4a22,
  MOSS = 0x4f6630;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
type F = ReturnType<typeof frame>;
/** A quad on a frame's +q face (p0…p1, z0…z1). */
function face(g: Ink, gx: number, gy: number, f: F, q: number, p0: number, p1: number, z0: number, z1: number, color: number, alpha = 1) {
  project(gx, gy, f, p0, q, z0, 0);
  project(gx, gy, f, p1, q, z0, 1);
  project(gx, gy, f, p1, q, z1, 2);
  project(gx, gy, f, p0, q, z1, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color, alpha);
}
const RF = new Float64Array(16),
  RI = new Float64Array(16);
/** A broken chunk of concrete or brick: a lumpy block of five corners. */
export function chunk(g: Ink, x: number, y: number, r: number, h: number, seed: number, color: number) {
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2 + hash01(seed) * 2,
      k = 0.7 + hash01(seed, i) * 0.3;
    RF[2 * i] = Math.cos(t) * r * k;
    RF[2 * i + 1] = Math.sin(t) * r * k;
    RI[2 * i] = RF[2 * i] * 0.65;
    RI[2 * i + 1] = RF[2 * i + 1] * 0.65;
  }
  block(g, x, y, RF, RI, 5, 0, h * 0.6, h * 0.4, shade(color, -0.15), color, shade(color, 0.25));
}

// ── Broken wall ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Wall { a: number; tops: number[]; rebar: boolean; hole: number }
export function wallOf(rand: Random): Wall {
  const fromLeft = rand() < 0.5,
    notch = 1 + Math.floor(rand() * 5),
    tops = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6,
        slope = fromLeft ? t : 1 - t;
      return Math.max(4, 6 + 16 * slope + (rand() - 0.3) * 7 - (i === notch ? 8 : 0));
    });
  return { a: (rand() - 0.5) * 0.7, tops, rebar: rand() < 0.65, hole: Math.floor(rand() * 7) };
}
/** A broken brick wall: columns of brick knocked down to a ragged top, a window hole, rebar bent out of the break, moss. */
export function drawWall(g: Ink, gx: number, gy: number, w: Wall) {
  const f = frame(w.a, 0, 0),
    step = 6,
    n = w.tops.length;
  for (let i = 0; i < n; i++) {
    const p0 = -21 + i * step,
      h = w.tops[i],
      c = BRICK[i % 3];
    box(g, gx, gy, f, p0, p0 + step, -3.5, 3.5, 0, h, c);
    // Brick courses on the front face.
    for (let z = 3; z < h - 1; z += 3) {
      project(gx, gy, f, p0, 3.55, z, 0);
      project(gx, gy, f, p0 + step, 3.55, z, 1);
      g.lineStyle(0.5, 0x2e2620, 0.8);
      g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
    }
    if (i === w.hole && h > 15) face(g, gx, gy, f, 3.6, p0 + 1, p0 + step - 1, 7, 12, 0x120e0b);
  }
  // Loose bricks lying on the broken top.
  for (let i = 1; i < n; i += 2) {
    project(gx, gy, f, -21 + i * step + 1, 0, w.tops[i], 0);
    chunk(g, SX[0], SY[0] + w.tops[i], 1.8, 1.6, i * 13 + n, BRICK[i % 3]);
  }
  if (w.rebar) {
    const top = Math.max(...w.tops),
      i = w.tops.indexOf(top);
    for (const d of [1.5, 4.5]) {
      project(gx, gy, f, -21 + i * step + d, 0, top - 1, 0);
      project(gx, gy, f, -21 + i * step + d + (i < 3 ? -4 : 4), 0, top + 8, 1);
      g.lineStyle(1.2, RUST);
      g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
    }
  }
  for (let i = 0; i < 3; i++) oval(g, X(gx, -16 + i * 14), Y(gy, 4.5, 0), 3.5, 1.6, MOSS, 0.9);
}
export function wallShadow(g: Ink, gx: number, gy: number, w: Wall) {
  boxShadow(g, gx, gy, w.a, 21, 4, Math.max(...w.tops) * 0.8, 0.34);
}

// ── Fallen column ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Column { a: number; stub: { u: number; v: number; h: number } }
export const columnOf = (rand: Random): Column => {
  const a = (rand() < 0.5 ? 1 : -1) * (0.25 + rand() * 0.35);
  return { a, stub: { u: a > 0 ? 12 : -12, v: -9, h: 14 + rand() * 8 } };
};
const STONE = 0x8a8276;
/** A fluted column lying across the cell, broken across its end, and its stub still standing on the plinth behind. */
export function drawColumn(g: Ink, gx: number, gy: number, c: Column) {
  const s = c.stub,
    sx = gx + s.u,
    sy = gy + s.v * SQUASH;
  box(g, sx, sy, frame(0, 0, 0), -6, 6, -6, 6, 0, 3, shade(STONE, -0.1));
  drum(g, sx, sy, 4.6, 3, s.h, shade(STONE, -0.06), STONE, 12);
  for (let i = 0; i < 5; i++) {
    const t = Math.PI * (0.15 + i * 0.17);
    g.lineStyle(0.6, shade(STONE, -0.35), 0.8);
    g.lineBetween(X(sx, Math.cos(t) * 4.6), Y(sy, Math.sin(t) * 4.6, 4), X(sx, Math.cos(t) * 4.6), Y(sy, Math.sin(t) * 4.6, s.h - 1));
  }
  // The broken top: a jagged lighter face.
  g.fillStyle(shade(STONE, 0.15));
  g.fillPoints([{ x: sx - 4.6, y: Y(sy, 0, s.h) }, { x: sx - 2, y: Y(sy, 0, s.h + 3) }, { x: sx + 1, y: Y(sy, 0, s.h + 0.5) }, { x: sx + 4.6, y: Y(sy, 0, s.h + 2.5) }, { x: sx + 4.6, y: Y(sy, 2, s.h) }, { x: sx - 4.6, y: Y(sy, 2, s.h) }], true);
  // The fallen drum.
  tube(g, gx, gy + 3, c.a, 5.5, -19, 19, 5.5, STONE);
  for (const d of [-11, -3, 5, 13]) tube(g, gx, gy + 3, c.a, 5.5, d - 0.4, d + 0.4, 5.6, shade(STONE, -0.3), 1, false);
  const end = Math.sin(c.a) >= 0 ? 19 : -19;
  endFace(g, gx, gy + 3, c.a, 5.5, end, 5.5, shade(STONE, 0.18));
  endFace(g, gx, gy + 3, c.a, 5.5, end, 2, shade(STONE, 0.05));
  chunk(g, gx - 14, gy + 9, 3, 3, 7, CONCRETE);
  chunk(g, gx + 10, gy + 11, 2.4, 2.4, 9, STONE);
}
export function columnShadow(g: Ink, gx: number, gy: number, c: Column) {
  boxShadow(g, gx, gy + 3, c.a, 19, 5.5, 8, 0.3);
  roundShadow(g, gx + c.stub.u, gy + c.stub.v * SQUASH, 6, c.stub.h);
}

// ── Burnt-out car ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Car { a: number; color: number; flat: number }
const CARS = [0x5a3a28, 0x3a4a5a, 0x6a5a3a, 0x4a3a3a] as const;
export const carOf = (rand: Random): Car => ({ a: (rand() - 0.5) * 1.2, color: CARS[Math.floor(rand() * CARS.length)], flat: Math.floor(rand() * 4) });
/** Where a car's headlights sit (screen offsets from its ground point). */
export function headlights(c: Car) {
  const f = frame(c.a, 0, 0);
  return [-4, 4].map((q) => {
    project(0, 0, f, 17.1, q, 7, 0);
    return { x: SX[0], y: SY[0] };
  });
}
/** A burnt-out car: a rusted body on its wheels (one flat), a cabin with empty windows, scorched bonnet, a door ajar. */
export function drawCar(g: Ink, gx: number, gy: number, c: Car) {
  const f = frame(c.a, 0, 0);
  // Wheels under the body (a flat one sunk to its rim); the body's overhang hides most of them.
  [[-11, -7], [11, -7], [-11, 7], [11, 7]].forEach(([p, q], i) => box(g, gx, gy, f, p - 3.4, p + 3.4, q - 1.6, q + 1.6, 0, i === c.flat ? 4 : 6, 0x141210));
  box(g, gx, gy, f, -17, 17, -7.5, 7.5, 2, 9, c.color);
  box(g, gx, gy, f, -8, 7, -6.5, 6.5, 9, 15, shade(c.color, -0.05));
  // Empty windows on the cabin, rust blooms and the scorched bonnet.
  face(g, gx, gy, f, 6.55, -6.5, -1, 10, 14, 0x101618);
  face(g, gx, gy, f, 6.55, 0, 5.5, 10, 14, 0x101618);
  face(g, gx, gy, f, 7.55, 8, 16, 2.5, 8.5, shade(c.color, -0.25));
  for (let i = 0; i < 3; i++) {
    project(gx, gy, f, -14 + i * 9, 7.6, 3 + (i % 2) * 3, 0);
    oval(g, SX[0], SY[0], 2.2, 1.6, RUST, 0.85);
  }
  project(gx, gy, f, 12, 0, 9.1, 0);
  oval(g, SX[0], SY[0], 5, 3, 0x1a1210, 0.85);
}
export function carShadow(g: Ink, gx: number, gy: number, c: Car) {
  boxShadow(g, gx, gy, c.a, 17, 8, 12, 0.34);
}

// ── Rubble heap with a fire barrel ──────────────────────────────────────────────────────────────────────────────────
export interface Heap { chunks: { u: number; v: number; r: number; seed: number; color: number }[]; barrel: boolean }
export function heapOf(rand: Random): Heap {
  return {
    chunks: Array.from({ length: 6 }, () => ({ u: (rand() - 0.5) * 26, v: (rand() - 0.5) * 18, r: 4 + rand() * 4, seed: Math.floor(rand() * 1e6), color: rand() < 0.3 ? BRICK[Math.floor(rand() * 3)] : CONCRETE })).sort((p, q) => p.v - q.v),
    barrel: rand() < 0.7,
  };
}
/** Height of a fire barrel's rim, and where it stands. */
export const BARREL = { u: 12, v: -8, h: 14 } as const;
/** Slabs of concrete and brick heaped up with a twist of rebar, and on some a rusted oil drum burning. */
export function drawHeap(g: Ink, gx: number, gy: number, h: Heap) {
  if (h.barrel) {
    const x = gx + BARREL.u,
      y = gy + BARREL.v * SQUASH;
    drum(g, x, y, 5, 0, BARREL.h, 0x5a3020, 0x6a3a24, 12);
    for (const z of [4, 9]) drum(g, x, y, 5.2, z, z + 0.9, RUST, RUST, 12);
    oval(g, x, Y(y, 0, BARREL.h), 4.4, 4.4 * SQUASH, 0x1a0c06);
    oval(g, x, Y(y, 0, BARREL.h) + 0.4, 3, 3 * SQUASH, 0xc8501a);
  }
  for (const c of h.chunks) chunk(g, gx + c.u, gy + c.v * SQUASH, c.r, c.r * 1.2, c.seed, c.color);
  rod(g, gx, gy, -6, 2, 3, -2, 0, 12, 0.9, RUST);
  rod(g, gx, gy, -2, 0, 12, 3, 1, 14, 0.9, RUST);
}
export function heapShadow(g: Ink, gx: number, gy: number, h: Heap) {
  oval(g, gx + 4, gy + 3, 20, 10, SHADE, 0.24);
  if (h.barrel) roundShadow(g, gx + BARREL.u, gy + BARREL.v * SQUASH, 5, BARREL.h);
}

// ── Streetlamp ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Lamp { lean: number; dir: number }
export const lampOf = (rand: Random): Lamp => ({ lean: (rand() - 0.5) * 0.5, dir: rand() < 0.5 ? -1 : 1 });
/** Where the lamp's head hangs (ground u, v, height). */
export function lampHead(l: Lamp) {
  const tu = l.lean * 30,
    h = 34;
  return { u: tu + l.dir * 9, v: 0, h: h - 3 };
}
/** A streetlamp bent over by a blast: a concrete footing, a leaning post with an arm and a lamp hood still hanging on. */
export function drawLamp(g: Ink, gx: number, gy: number, l: Lamp) {
  box(g, gx, gy, frame(0, 0, 0), -3.5, 3.5, -3.5, 3.5, 0, 3, CONCRETE);
  const tu = l.lean * 30,
    head = lampHead(l);
  rod(g, gx, gy, 0, 0, 3, tu, 0, 34, 1.8, 0x3a3e40);
  rod(g, gx, gy, tu, 0, 34, head.u, 0, head.h + 2, 1.4, 0x3a3e40);
  const hx = X(gx, head.u),
    hy = Y(gy, 0, head.h);
  g.fillStyle(OUTLINE, 0.9);
  g.fillTriangle(hx - 4.2, hy + 1, hx + 4.2, hy + 1, hx, hy - 3.4);
  g.fillStyle(0x4a4e50);
  g.fillTriangle(hx - 3.6, hy + 0.6, hx + 3.6, hy + 0.6, hx, hy - 2.8);
  oval(g, hx, hy + 0.8, 2.6, 1, 0x8a8a70);
}
export function lampShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(2, SHADE, 0.24);
  g.lineBetween(gx, gy, gx + 34 * SUN.x, gy + 34 * SUN.y);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The apartment block's floors (heights at full size) and which windows still hold a light. */
export const BLOCK = { floors: [8, 22, 36, 50], top: 62 } as const;
/**
 * A gutted apartment block: a concrete shell of four storeys whose upper corner has collapsed, rows of black window
 * holes, exposed floor slabs at the break, rebar, and a heap of its own rubble at its foot.
 */
export function drawApartment(g: Ink) {
  const f = frame(0, 0, 0),
    W = 30,
    D = 18;
  // The shell: the left part standing to the roof, the right part broken down in steps.
  const tops = [62, 62, 58, 46, 36, 28];
  for (let i = 0; i < 6; i++) {
    const p0 = -W + i * 10;
    box(g, 0, 0, f, p0, p0 + 10, -D, D, 0, tops[i], i % 2 ? 0x7a7268 : 0x726a60);
    // Window holes on the front face, a row per floor.
    for (const z of BLOCK.floors) if (z + 9 < tops[i]) face(g, 0, 0, f, D + 0.05, p0 + 2.5, p0 + 7.5, z, z + 8, 0x16120f);
    // Floor slab edges where the wall broke.
    if (i >= 3) for (const z of [14, 28, 42, 56]) if (z < tops[i] + 10 && z > tops[i] - 2) box(g, 0, 0, f, p0 + 1, p0 + 9, -D + 2, D + 2, z, z + 2, 0x8a8278);
  }
  for (const [p, q] of [[16, D + 1], [24, D + 1]]) {
    project(0, 0, f, p, q, 36, 0);
    project(0, 0, f, p + 3, q + 2, 44, 1);
    g.lineStyle(1.2, RUST);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  for (let i = 0; i < 7; i++) chunk(g, X(0, 6 + i * 5), Y(0, D + 6 + (i % 3) * 3, 0), 4 + (i % 3), 5, 31 + i, i % 3 ? CONCRETE : BRICK[1]);
}
export function apartmentShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 30, 18, 50, 0.3);
}
/** The billboard's neon tube (screen offsets at full size): a zigzag across the panel. */
export const NEON = [[-22, 44], [-12, 36], [-2, 44], [8, 36], [18, 44]] as const;
/** A torn billboard on two steel legs: a frame with a catwalk, a faded poster hanging in strips, a broken neon tube. */
export function drawBillboard(g: Ink) {
  for (const u of [-18, 18]) {
    box(g, 0, 0, frame(0, 0, 0, u, 4), -3, 3, -3, 3, 0, 3, CONCRETE);
    rod(g, 0, 0, u, 4, 3, u, 4, 30, 2.8, 0x3a3e40);
  }
  rod(g, 0, 0, -18, 4, 14, 18, 4, 28, 1, 0x3a3e40);
  rod(g, 0, 0, 18, 4, 14, -18, 4, 28, 1, 0x3a3e40);
  const f = frame(0, 0, 0, 0, 4);
  box(g, 0, 0, f, -30, 30, -1.5, 1.5, 30, 56, 0x2a2826);
  // The poster: faded bands, torn into strips at the bottom right.
  face(g, 0, 0, f, 1.55, -28, 28, 32, 54, 0x8a6a4a);
  face(g, 0, 0, f, 1.56, -28, 28, 46, 54, 0x4a6a7a);
  face(g, 0, 0, f, 1.57, -20, -4, 34, 44, 0xc8b080);
  for (let i = 0; i < 4; i++) face(g, 0, 0, f, 1.58, 8 + i * 5, 11 + i * 5, 32 - (i % 2) * 4, 40, i % 2 ? 0x2a2826 : 0x6a5a40);
  face(g, 0, 0, f, 1.59, 4, 28, 32, 36, 0x2a2826);
  // Catwalk under the panel.
  box(g, 0, 0, frame(0, 0, 28, 0, 7), -30, 30, -2.5, 2.5, 0, 1, 0x4a4e50);
  for (let u = -28; u <= 28; u += 7) rod(g, 0, 0, u, 9.5, 29, u, 9.5, 33, 0.5, 0x6a6e70);
  // The dead neon tube.
  g.lineStyle(1.6, 0x3a2a40);
  g.strokePoints(NEON.map(([u, h]) => ({ x: X(0, u), y: Y(0, 6, h) })), false);
}
export function billboardShadow(g: Ink) {
  boxShadow(g, 0, 4, 0, 30, 2, 56, 0.28);
}
