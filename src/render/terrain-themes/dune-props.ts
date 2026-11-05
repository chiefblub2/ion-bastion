import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Dune Sea (`dune.ts`), a desert under a hot dusk sky, drawn in the towers' 3/4 tilt: banded
// sandstone hoodoos, the half-buried hull of a crashed hauler, giant bleached rib cages, shards of fused desert glass,
// wind-carved boulders and caravan caches under an awning; a natural rock arch and a toppled colossus head as
// landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record; heat
// shimmer and glints live in the theme's ambient.

export const SHADE = 0x0a0602;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const SAND = 0xc49a5a;
const STONE = { wall: 0x7a5530, top: 0xa87c48, glint: 0xd8b078 } as const,
  BONE = 0xe0d4b4;
export const GLASS = [0x8ac8b8, 0xb8d890, 0xe0c070, 0x70b0b8] as const;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A drift of sand banked round a foot: a lit mound with a shaded lee. */
export function drift(g: Ink, x: number, y: number, rx: number, ry: number) {
  oval(g, x + 1, y + 0.6, rx, ry, shade(SAND, -0.55), 0.7);
  oval(g, x, y, rx * 0.9, ry * 0.8, shade(SAND, -0.38), 0.85);
  oval(g, x - rx * 0.25, y - ry * 0.25, rx * 0.5, ry * 0.4, shade(SAND, -0.22), 0.8);
}
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A lumpy stone block of `n` corners from h0 to h1, inset by `k` at the top. */
function stone(g: Ink, x: number, y: number, r: number, h0: number, h1: number, seed: number, n = 6, k = 0.75, wall: number = STONE.wall, top: number = STONE.top) {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + hash01(seed) * 1.5,
      j = 0.78 + hash01(seed, i) * 0.22;
    F[2 * i] = Math.cos(t) * r * j;
    F[2 * i + 1] = Math.sin(t) * r * j;
    I[2 * i] = F[2 * i] * k;
    I[2 * i + 1] = F[2 * i + 1] * k;
  }
  block(g, x, y, F, I, n, h0, h1, (h1 - h0) * 0.18, wall, top, STONE.glint);
}

// ── Hoodoo ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Hoodoo { tiers: { r: number; h: number; tone: number }[]; seed: number; cap: boolean }
export function hoodooOf(rand: Random): Hoodoo {
  const n = 3 + Math.floor(rand() * 2),
    tiers = Array.from({ length: n }, (_, i) => ({ r: (12 - i * 2) * (0.85 + rand() * 0.3), h: 8 + rand() * 5, tone: (rand() - 0.5) * 0.18 }));
  return { tiers, seed: Math.floor(rand() * 1e6), cap: rand() < 0.6 };
}
/** A sandstone hoodoo: banded tiers of red rock narrowing upwards, sometimes balancing a darker cap stone. */
export function drawHoodoo(g: Ink, gx: number, gy: number, s: Hoodoo) {
  let h = 0;
  s.tiers.forEach((t, i) => {
    stone(g, gx, gy, t.r, h, h + t.h, s.seed + i, 7, 0.86, shade(STONE.wall, t.tone), shade(STONE.top, t.tone));
    h += t.h;
  });
  if (s.cap) stone(g, gx + 1, gy, s.tiers[s.tiers.length - 1].r + 3, h, h + 4, s.seed + 9, 6, 0.8, 0x5a3c22, 0x7a5636);
  drift(g, gx - 4, gy + 4, 12, 4.5);
}
export function hoodooShadow(g: Ink, gx: number, gy: number, s: Hoodoo) {
  const h = s.tiers.reduce((a, t) => a + t.h, 0);
  g.fillStyle(SHADE, 0.24);
  g.fillPoints([{ x: gx - 9, y: gy + 1 }, { x: gx + 9, y: gy + 3 }, { x: gx + h * SUN.x + 6, y: gy + h * SUN.y + 2 }, { x: gx + h * SUN.x - 4, y: gy + h * SUN.y - 1 }], true);
}
export const hoodooHeight = (s: Hoodoo) => s.tiers.reduce((a, t) => a + t.h, 0) + (s.cap ? 4 : 0);

// ── Crashed hull ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Hull { a: number; sink: number; color: number }
export const hullOf = (rand: Random): Hull => ({ a: (rand() - 0.5) * 1.2, sink: 0.25 + rand() * 0.25, color: rand() < 0.5 ? 0x8a6a4a : 0x6a6e70 });
/** Where the hull's broken engine still glows (screen offset from the ground point). */
export const hullEngine = (h: Hull) => ({ x: X(0, -Math.cos(h.a) * 21), y: Y(0, -Math.sin(h.a) * 21, 7) });
/** The hull of a crashed hauler nosed into the sand: a pitched box with ribs showing through torn plating, a drift over it. */
export function drawHull(g: Ink, gx: number, gy: number, h: Hull) {
  const f = frame(h.a, -0.18, 2);
  box(g, gx, gy, f, -17, 15, -7, 7, -2, 9, h.color);
  // Torn plating with the ribs showing through.
  project(gx, gy, f, -4, -7, 9.1, 0);
  project(gx, gy, f, 8, -7, 9.1, 1);
  project(gx, gy, f, 8, 5, 9.1, 2);
  project(gx, gy, f, -4, 5, 9.1, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x1e1610);
  for (const p of [-2, 2, 6]) {
    project(gx, gy, f, p, -6, 9.2, 0);
    project(gx, gy, f, p, 4.5, 9.2, 1);
    g.lineStyle(1.4, shade(h.color, -0.2));
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  // Faded hazard band and the exhaust bell at the stern.
  for (let i = 0; i < 4; i++) {
    project(gx, gy, f, 10 + i * 1.2, 7.05, 1, 0);
    project(gx, gy, f, 11 + i * 1.2, 7.05, 1, 1);
    project(gx, gy, f, 10 + i * 1.2, 7.05, 8, 2);
    g.lineStyle(1, i % 2 ? 0x2a2018 : 0xc89a3a, 0.8);
    g.lineBetween(SX[0], SY[0], SX[2], SY[2]);
  }
  tube(g, gx, gy, h.a + Math.PI, 7, 17, 21, 3.6, 0x3a3430);
  // The drift burying its nose.
  const nose = { x: X(gx, Math.cos(h.a) * 13), y: Y(gy, Math.sin(h.a) * 13, 0) };
  drift(g, nose.x, nose.y + 2, 14, 6 + h.sink * 8);
}
export function hullShadow(g: Ink, gx: number, gy: number, h: Hull) {
  boxShadow(g, gx, gy, h.a, 17, 7, 9, 0.3);
}

// ── Rib cage ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Ribs { a: number; ribs: number; skull: boolean }
export const ribsOf = (rand: Random): Ribs => ({ a: (rand() - 0.5) * 1.2, ribs: 4 + Math.floor(rand() * 2), skull: rand() < 0.5 });
/** The bleached rib cage of a giant beast: a spine along the sand and curved ribs arching over it, half buried. */
export function drawRibs(g: Ink, gx: number, gy: number, r: Ribs) {
  const ca = Math.cos(r.a),
    sa = Math.sin(r.a),
    at = (p: number, q: number) => ({ u: ca * p - sa * q, v: sa * p + ca * q });
  // Back ribs (far side), the spine, then the near ribs.
  const rib = (p: number, side: number, h: number) => {
    const pts = Array.from({ length: 7 }, (_, i) => {
      const t = i / 6,
        q = side * Math.sin(t * Math.PI * 0.55) * 11,
        z = h * Math.sin(t * Math.PI * 0.9),
        s = at(p + t * 2, q);
      return { x: X(gx, s.u), y: Y(gy, s.v, z) };
    });
    g.lineStyle(3.4, OUTLINE, 0.8);
    g.strokePoints(pts, false);
    g.lineStyle(2.4, BONE);
    g.strokePoints(pts, false);
  };
  const near = ca >= 0 ? 1 : -1;
  for (let i = 0; i < r.ribs; i++) rib(-12 + i * 6, -near, 16 - i * 1.6);
  const s0 = at(-16, 0),
    s1 = at(18, 0);
  rod(g, gx, gy, s0.u, s0.v, 1.5, s1.u, s1.v, 1, 2.6, BONE);
  for (let i = 0; i < r.ribs; i++) rib(-12 + i * 6, near, 16 - i * 1.6);
  if (r.skull) {
    const k = at(-20, 0);
    disc(g, X(gx, k.u), Y(gy, k.v, 4), 5, OUTLINE, 0.8);
    disc(g, X(gx, k.u), Y(gy, k.v, 4), 4.4, BONE);
    disc(g, X(gx, k.u) - 1.4, Y(gy, k.v, 4.5), 1.2, 0x3a2a1a);
    disc(g, X(gx, k.u) + 1.6, Y(gy, k.v, 4.5), 1.2, 0x3a2a1a);
  }
  const d = at(4, 0);
  drift(g, X(gx, d.u) + 6, Y(gy, d.v, 0) + 4, 13, 4);
}
export function ribsShadow(g: Ink, gx: number, gy: number, r: Ribs) {
  oval(g, gx + 6, gy + 4, 20, 8, SHADE, r.skull ? 0.22 : 0.18);
}

// ── Desert glass ────────────────────────────────────────────────────────────────────────────────────────────────────
export function glassOf(rand: Random, size = 1): Crystal[] {
  const n = 3 + Math.floor(rand() * 4),
    tint = GLASS[Math.floor(rand() * GLASS.length)];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(),
      d = i ? (5 + rand() * 7) * size : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: i ? 0.4 + rand() * 0.5 : rand() * 0.25, len: (i ? 6 + rand() * 8 : 16 + rand() * 8) * size, r: (i ? 2.4 + rand() * 1.2 : 4) * size, color: shade(tint, (rand() - 0.5) * 0.2) };
  }).sort((p, q) => p.v - q.v);
}
/** Shards of fused desert glass broken up through the sand, translucent green and amber. */
export function drawGlass(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  oval(g, gx, gy + 1, 15, 6, shade(SAND, -0.2), 0.8);
  for (const c of list) crystal(g, gx, gy, c);
}
export function glassShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystalShadow(g, gx, gy, c);
}

// ── Wind-carved boulders ────────────────────────────────────────────────────────────────────────────────────────────
export interface Boulders { list: { u: number; v: number; r: number; seed: number }[] }
export function bouldersOf(rand: Random): Boulders {
  const n = rand() < 0.5 ? 2 : 3,
    spots = n === 2 ? [[-6, -3], [9, 4]] : [[-9, -4], [8, -5], [1, 6]];
  return { list: spots.map(([u, v]) => ({ u, v, r: 6 + rand() * 6, seed: Math.floor(rand() * 1e6) })).sort((p, q) => p.v - q.v) };
}
/** Boulders scoured smooth by the wind, each with a hollow carved into its flank and sand piled behind it. */
export function drawBoulders(g: Ink, gx: number, gy: number, b: Boulders) {
  for (const s of b.list) {
    const x = gx + s.u,
      y = gy + s.v * SQUASH;
    drift(g, x + s.r * 0.5, y + 2, s.r * 1.1, s.r * 0.4);
    stone(g, x, y, s.r, 0, s.r * 1.1, s.seed, 7, 0.6);
    oval(g, x - s.r * 0.2, Y(y, s.r * 0.5, s.r * 0.45), s.r * 0.35, s.r * 0.2, 0x3a2414, 0.85);
  }
}
export function bouldersShadow(g: Ink, gx: number, gy: number, b: Boulders) {
  for (const s of b.list) roundShadow(g, gx + s.u, gy + s.v * SQUASH, s.r + 1, s.r * 1.1);
}

// ── Caravan cache ───────────────────────────────────────────────────────────────────────────────────────────────────
/** A caravan cache: crates and water jars under a striped awning on two poles, a lantern hanging from one. */
export const LANTERN = { u: 13, v: 8, h: 14 } as const;
export function drawCache(g: Ink, gx: number, gy: number, flip: boolean) {
  const k = flip ? -1 : 1;
  box(g, gx, gy, frame(0.2 * k, 0, 0, -6 * k, -3), -5, 5, -5, 5, 0, 8, 0x8a6a42);
  box(g, gx, gy, frame(-0.1 * k, 0, 8, -6 * k, -3), -4, 4, -4, 4, 0, 6, 0x9a7a4a);
  for (const [u, v] of [[6, -4], [10, 3]]) {
    const x = gx + u * k,
      y = gy + v * SQUASH;
    drum(g, x, y, 3.4, 0, 7, 0xa85a3a, 0xc06a48, 10);
    drum(g, x, y, 2, 7, 9, 0xa85a3a, 0x3a1a10, 8);
  }
  // Awning: two poles and a striped cloth sloping down to the front.
  for (const u of [-14, 14]) rod(g, gx, gy, u, -12, 0, u, -12, 18, 1, 0x5a4028);
  const cloth = (p0: number, p1: number, color: number) => {
    project(gx, gy, frame(0, 0, 0), p0, -12, 18, 0);
    project(gx, gy, frame(0, 0, 0), p1, -12, 18, 1);
    project(gx, gy, frame(0, 0, 0), p1, 10, 15, 2);
    project(gx, gy, frame(0, 0, 0), p0, 10, 15, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color, 0.95);
  };
  for (let i = 0; i < 4; i++) cloth(-14 + i * 7, -7 + i * 7, i % 2 ? 0xe0d0b0 : 0xb84a2a);
  for (const u of [-14, 14]) rod(g, gx, gy, u, 10, 0, u, 10, 15, 1, 0x5a4028);
  rod(g, gx, gy, LANTERN.u * k, LANTERN.v, 15, LANTERN.u * k, LANTERN.v, LANTERN.h - 2, 0.6, 0x2a2018);
}
export function cacheShadow(g: Ink, gx: number, gy: number) {
  boxShadow(g, gx, gy, 0, 15, 9, 20, 0.22);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A natural rock arch: two banded sandstone legs leaning together under a lintel of rock, sand drifted at their feet. */
export function drawArch(g: Ink) {
  const leg = (u: number, seed: number) => {
    let h = 0;
    for (let i = 0; i < 5; i++) {
      const r = 12 - i * 1.2,
        dh = 9 + (i % 2) * 2;
      stone(g, u + (u < 0 ? i * 1.4 : -i * 1.4), 0, r, h, h + dh, seed + i, 7, 0.88, shade(STONE.wall, (i % 2) * 0.08), shade(STONE.top, (i % 2) * 0.08));
      h += dh;
    }
    return h;
  };
  const h = leg(-24, 11);
  leg(24, 23);
  // The lintel: a long lumpy block across the top.
  for (let i = 0; i < 5; i++) stone(g, -18 + i * 9, -2 * Math.sin(i), 9 - Math.abs(i - 2), h - 2 + Math.sin(i) * 2, h + 8 + (2 - Math.abs(i - 2)) * 1.5, 40 + i, 6, 0.8);
  drift(g, -16, 8, 18, 6);
  drift(g, 26, 10, 16, 5);
}
export function archShadow(g: Ink) {
  g.fillStyle(SHADE, 0.2);
  g.fillPoints([{ x: -34, y: 4 }, { x: 34, y: 6 }, { x: 70, y: 32 }, { x: 4, y: 30 }], true);
}
/** A toppled colossus: the head of a giant statue lying on its side in the sand, crowned, its face weathered. */
export function drawColossus(g: Ink) {
  // The head: a big chamfered block, face towards the viewer.
  stone(g, 0, 0, 26, 0, 30, 77, 8, 0.82, 0x8a6638, 0xb08a52);
  const f = frame(0, 0, 0);
  const face = (p0: number, p1: number, z0: number, z1: number, color: number) => {
    project(0, 0, f, p0, 21, z0, 0);
    project(0, 0, f, p1, 21, z0, 1);
    project(0, 0, f, p1, 21, z1, 2);
    project(0, 0, f, p0, 21, z1, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color);
  };
  // Brow, eyes, nose and lips.
  face(-14, 14, 22, 24, 0x6a4a28);
  face(-12, -4, 17, 21, 0x2a1a0e);
  face(4, 12, 17, 21, 0x2a1a0e);
  face(-2.5, 2.5, 9, 18, 0xc09a62);
  face(-7, 7, 4, 7, 0x5a3c20);
  // A crack across the cheek and the drift banked against it.
  g.lineStyle(1.2, 0x3a2414, 0.9);
  g.strokePoints([{ x: 10, y: Y(0, 21, 24) }, { x: 14, y: Y(0, 21, 14) }, { x: 12, y: Y(0, 21, 6) }, { x: 17, y: Y(0, 21, 1) }], false);
  drift(g, 18, 16, 22, 7);
  drift(g, -24, 12, 14, 5);
}
export function colossusShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 22 * k, 13 * k, 40, 22, SHADE, 0.16);
}
