import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, endFace, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Jungle (`jungle.ts`), a rainforest at dusk over the ruins of an old temple city, drawn in the towers'
// 3/4 tilt: rainforest trees on buttress roots, giant-leaved plants, mossy temple blocks with glowing glyphs, fallen
// logs with fungus, carved stone heads and bamboo; a stepped temple pyramid and a giant strangler fig as landmarks.
// Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record; glyph light and
// fireflies live in the theme's ambient.

export const SHADE = 0x010602;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const GLYPH = 0xb6ff6a;
const BARK = 0x3a2a1a,
  STONE = { wall: 0x4a5448, top: 0x66745e } as const,
  MOSS = 0x2f7a34,
  LEAF = [0x14391a, 0x1f5a26, 0x2a7a32, 0x3a9a40] as const;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A leafy clump of radius r at screen point (x, y): a dark underside, a lit mass to the upper left and a few glints. */
export function foliage(g: Ink, x: number, y: number, r: number, seed: number, tint = 0) {
  disc(g, x, y + 1, r + 0.8, OUTLINE, 0.6);
  disc(g, x, y, r, shade(LEAF[0], tint));
  for (let i = 0; i < 5; i++) {
    const a = hash01(seed, i) * Math.PI * 2,
      d = r * 0.45 * hash01(seed, i, 1);
    disc(g, x + Math.cos(a) * d - r * 0.12, y + Math.sin(a) * d * 0.7 - r * 0.15, r * (0.45 + 0.2 * hash01(seed, i, 2)), shade(LEAF[1], tint));
  }
  disc(g, x - r * 0.3, y - r * 0.32, r * 0.42, shade(LEAF[2], tint));
  disc(g, x - r * 0.42, y - r * 0.42, r * 0.18, shade(LEAF[3], tint));
}

// ── Rainforest tree ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface Tree { h: number; r: number; clumps: { u: number; v: number; h: number; r: number }[]; seed: number; vines: number }
export function treeOf(rand: Random, size = 1): Tree {
  const h = (24 + rand() * 8) * size,
    r = (17 + rand() * 3) * size;
  return {
    h,
    r,
    clumps: Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.6;
      return { u: Math.cos(a) * r * 0.62, v: Math.sin(a) * r * 0.55, h: h + (rand() - 0.5) * 5 * size, r: r * (0.5 + rand() * 0.15) };
    }).sort((p, q) => p.v - q.v || q.h - p.h),
    seed: Math.floor(rand() * 1e6),
    vines: 2 + Math.floor(rand() * 3),
  };
}
/** A rainforest giant: a pale trunk on flaring buttress roots, hanging lianas, and a broad crown of leafy clumps. */
export function drawTree(g: Ink, gx: number, gy: number, t: Tree) {
  for (const a of [0.6, 2.2, 3.6, 5]) {
    const u = Math.cos(a) * 5.5,
      v = Math.sin(a) * 5.5;
    rod(g, gx, gy, u, v, 0, u * 0.2, v * 0.2, 7, 3.2, shade(BARK, 0.1));
  }
  rod(g, gx, gy, 0, 0, 0, 0.5, 0, t.h, 5.2, 0x5a4a38);
  // Lianas hanging from the crown.
  for (let i = 0; i < t.vines; i++) {
    const u = (hash01(t.seed, i) - 0.5) * t.r * 1.4,
      v = hash01(t.seed, i, 3) * 4,
      top = Y(gy, v, t.h - 2),
      bottom = Y(gy, v, t.h * (0.2 + 0.3 * hash01(t.seed, i, 4)));
    g.lineStyle(1, 0x2a5a24, 0.9);
    g.strokePoints([{ x: X(gx, u), y: top }, { x: X(gx, u) + 1.5, y: (top + bottom) / 2 }, { x: X(gx, u) - 0.5, y: bottom }], false);
  }
  for (const c of t.clumps) foliage(g, X(gx, c.u), Y(gy, c.v, c.h), c.r, t.seed + c.u * 7);
  foliage(g, gx - 1, Y(gy, -1, t.h + t.r * 0.3), t.r * 0.62, t.seed + 3, 0.04);
}
export function treeShadow(g: Ink, gx: number, gy: number, t: Tree) {
  oval(g, gx + t.h * SUN.x * 0.8, gy + t.h * SUN.y * 0.8, t.r * 1.1, t.r * 0.6, SHADE, 0.28);
  roundShadow(g, gx, gy, 6, 6);
}

// ── Giant-leaved plant ──────────────────────────────────────────────────────────────────────────────────────────────
export interface Leafy { leaves: { a: number; len: number; lift: number; w: number }[]; flower: boolean }
export function leafyOf(rand: Random): Leafy {
  const n = 6 + Math.floor(rand() * 3);
  return {
    leaves: Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + rand() * 0.5, len: 14 + rand() * 8, lift: 6 + rand() * 10, w: 5 + rand() * 2.5 })),
    flower: rand() < 0.45,
  };
}
/** One broad leaf from the stem's foot out along ground angle a, arching up to `lift` and down at its tip. */
function leaf(g: Ink, gx: number, gy: number, a: number, len: number, lift: number, w: number, color: number) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    pt = (t: number, side: number) => {
      const d = len * t,
        h = lift * Math.sin(Math.PI * t * 0.85) + 2,
        half = w * Math.sin(Math.PI * Math.min(1, t * 1.1)) * side;
      return { x: X(gx, ca * d - sa * half), y: Y(gy, sa * d + ca * half, h) };
    },
    ts = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const outline = [...ts.map((t) => pt(t, 1)), ...ts.slice().reverse().map((t) => pt(t, -1))];
  g.fillStyle(OUTLINE, 0.6);
  g.fillPoints(outline.map((p) => ({ x: p.x, y: p.y + 0.8 })), true);
  g.fillStyle(color);
  g.fillPoints(outline, true);
  g.fillStyle(shade(color, 0.18));
  g.fillPoints([...ts.map((t) => pt(t, 1)), ...ts.slice().reverse().map((t) => pt(t, 0))], true);
  g.lineStyle(0.7, shade(color, 0.35), 0.9);
  g.strokePoints(ts.map((t) => pt(t, 0)), false);
}
/** A giant-leaved understorey plant: broad arching leaves round a short stem, back leaves first, a red flower on some. */
export function drawLeafy(g: Ink, gx: number, gy: number, p: Leafy) {
  const order = [...p.leaves].sort((a, b) => Math.sin(a.a) - Math.sin(b.a));
  for (const l of order) leaf(g, gx, gy, l.a, l.len, l.lift, l.w, Math.sin(l.a) > 0 ? LEAF[2] : LEAF[1]);
  if (p.flower) {
    rod(g, gx, gy, 0, 0, 2, 1, 1, 16, 1, 0x2a5a24);
    disc(g, X(gx, 1), Y(gy, 1, 16), 2.6, 0xd83a3a);
    disc(g, X(gx, 0.4), Y(gy, 1, 16.6), 1.2, 0xffb04a);
  }
}
export function leafyShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 5, gy + 3, 20, 10, SHADE, 0.24);
}

// ── Temple blocks ───────────────────────────────────────────────────────────────────────────────────────────────────
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A squared stone block (half sizes hp, hq, turned by a), its top bevelled and dressed with moss. */
export function stone(g: Ink, x: number, y: number, a: number, hp: number, hq: number, h0: number, h1: number, mossy = true) {
  const c = Math.cos(a),
    s = Math.sin(a),
    pts = [[hp, hq], [-hp, hq], [-hp, -hq], [hp, -hq]];
  pts.forEach(([p, q], i) => {
    F[2 * i] = p * c - q * s;
    F[2 * i + 1] = p * s + q * c;
    I[2 * i] = (p - Math.sign(p) * 1.2) * c - (q - Math.sign(q) * 1.2) * s;
    I[2 * i + 1] = (p - Math.sign(p) * 1.2) * s + (q - Math.sign(q) * 1.2) * c;
  });
  block(g, x, y, F, I, 4, h0, h1 - 1.2, 1.2, STONE.wall, STONE.top, 0x8a9a80);
  if (mossy) {
    oval(g, X(x, -hp * 0.3), Y(y, -hq * 0.2, h1), hp * 0.6, hq * 0.5 * SQUASH, MOSS, 0.85);
    oval(g, X(x, hp * 0.2), Y(y, hq * 0.3, h1), hp * 0.3, hq * 0.3 * SQUASH, 0x3a9a40, 0.7);
  }
}
export interface Ruin { a: number; stack: boolean; glyph: boolean }
export const ruinOf = (rand: Random): Ruin => ({ a: (rand() - 0.5) * 0.5, stack: rand() < 0.55, glyph: rand() < 0.75 });
/** Where a temple block's glyph glows (screen offset from its ground point). */
export const glyphOf = (r: Ruin) => {
  project(0, 0, frame(r.a, 0, 0), 0, 9.1, 8, 0);
  return { x: SX[0], y: SY[0] };
};
/** Mossy temple blocks: a carved block with a glyph on its face, one more block toppled on it or beside it, a vine. */
export function drawRuin(g: Ink, gx: number, gy: number, r: Ruin) {
  if (!r.stack) stone(g, gx + 13, gy - 6, r.a + 0.4, 6, 5, 0, 8);
  stone(g, gx, gy, r.a, 11, 9, 0, 15);
  if (r.stack) stone(g, gx - 2, gy - 15, r.a - 0.25, 8, 6.5, 0, 9);
  if (r.glyph) {
    const p = glyphOf(r),
      x = gx + p.x,
      y = gy + p.y;
    g.lineStyle(1.2, 0x1a2a18, 0.9);
    g.strokePoints(Array.from({ length: 13 }, (_, i) => ({ x: x + Math.cos((i / 12) * Math.PI * 2) * 3.4, y: y + Math.sin((i / 12) * Math.PI * 2) * 3.4 })), false);
    g.lineBetween(x, y - 3.4, x, y + 3.4);
    g.lineBetween(x - 3.4, y, x + 3.4, y);
  }
  // A vine creeping up the front.
  g.lineStyle(1.2, 0x2a6a2a, 0.95);
  const vx = X(gx, -7);
  g.strokePoints([{ x: vx, y: Y(gy, 9, 0) }, { x: vx + 2, y: Y(gy, 9, 5) }, { x: vx - 1, y: Y(gy, 9, 10) }, { x: vx + 3, y: Y(gy, 9, 15) }], false);
  for (const h of [4, 9, 13]) disc(g, vx + (h % 2 ? 2 : -1), Y(gy, 9, h), 1.4, 0x3a9a40);
}
export function ruinShadow(g: Ink, gx: number, gy: number, r: Ruin) {
  boxShadow(g, gx, gy, r.a, 11, 9, r.stack ? 24 : 15, 0.32);
}

// ── Fallen log ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Log { a: number; caps: number }
export const logOf = (rand: Random): Log => ({ a: (rand() - 0.5) * 1.2, caps: 2 + Math.floor(rand() * 3) });
/** Where the log's fungus caps glow (ground u, v, height). */
export function capsOf(l: Log) {
  return Array.from({ length: l.caps }, (_, i) => ({ u: Math.cos(l.a) * (-10 + i * 7), v: Math.sin(l.a) * (-10 + i * 7) + 4.5, h: 5 }));
}
/** A fallen trunk furred with moss, its broken end turned to the viewer, pale fungus shelves along its side. */
export function drawLog(g: Ink, gx: number, gy: number, l: Log) {
  tube(g, gx, gy, l.a, 5, -18, 18, 5.4, 0x4a3826);
  tube(g, gx, gy, l.a, 7.8, -14, 10, 2.4, MOSS, 0.9, false);
  const end = Math.sin(l.a) >= 0 ? 18 : -18;
  endFace(g, gx, gy, l.a, 5, end, 5.4, 0x7a5a3a);
  endFace(g, gx, gy, l.a, 5, end, 3.4, 0x5a4028);
  endFace(g, gx, gy, l.a, 5, end, 1.2, 0x3a2818);
  for (const c of capsOf(l)) {
    oval(g, X(gx, c.u), Y(gy, c.v, c.h) + 0.6, 3.2, 1.6, OUTLINE, 0.6);
    oval(g, X(gx, c.u), Y(gy, c.v, c.h), 3, 1.4, 0xd8e0a0);
  }
  for (let i = 0; i < 3; i++) leaf(g, gx + (i - 1) * 9, gy + 7, -Math.PI / 2 + (i - 1) * 0.8, 8, 4, 2.4, LEAF[1]);
}
export function logShadow(g: Ink, gx: number, gy: number, l: Log) {
  boxShadow(g, gx, gy, l.a, 18, 5, 8, 0.32);
}

// ── Carved head ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the head's eyes (where their inlays glow). */
export const HEAD_EYES = 17;
/** A colossal carved stone head half sunk in the earth: a helmet band, heavy brows, inlaid eyes, moss on its crown. */
export function drawHead(g: Ink, gx: number, gy: number, a: number) {
  const f = frame(a, 0, 0);
  box(g, gx, gy, f, -10, 10, -9, 9, 0, 24, STONE.wall, shade(STONE.wall, 0.08));
  box(g, gx, gy, f, -11, 11, -10, 10, 21, 27, STONE.top);
  // Features on the face (+q side): brows, eyes, nose, mouth.
  const feature = (p0: number, p1: number, z0: number, z1: number, color: number, out = 0.2) => {
    project(gx, gy, f, p0, 9 + out, z0, 0);
    project(gx, gy, f, p1, 9 + out, z0, 1);
    project(gx, gy, f, p1, 9 + out, z1, 2);
    project(gx, gy, f, p0, 9 + out, z1, 3);
    g.fillStyle(color);
    g.fillPoints([0, 1, 2, 3].map((i) => ({ x: SX[i], y: SY[i] })), true);
  };
  feature(-8, -1.5, 19, 20.5, shade(STONE.top, 0.1), 0.6);
  feature(1.5, 8, 19, 20.5, shade(STONE.top, 0.1), 0.6);
  feature(-7, -2.5, 16, 18, 0x1a2018);
  feature(2.5, 7, 16, 18, 0x1a2018);
  feature(-2, 2, 10, 15, shade(STONE.top, -0.05), 1.2);
  feature(-5, 5, 6, 8, 0x2a3228);
  oval(g, X(gx, -4), Y(gy, -3, 27), 8, 3.4, MOSS, 0.9);
  oval(g, X(gx, 5), Y(gy, 2, 27), 4, 2, 0x3a9a40, 0.8);
}
export const eyesOf = (a: number) =>
  [-4.75, 4.75].map((p) => {
    project(0, 0, frame(a, 0, 0), p, 9.25, HEAD_EYES, 0);
    return { x: SX[0], y: SY[0] };
  });
export function headShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 11, 10, 27, 0.34);
}

// ── Bamboo ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Bamboo { stalks: { u: number; v: number; h: number; lean: number }[] }
export const bambooOf = (rand: Random): Bamboo => ({
  stalks: Array.from({ length: 6 + Math.floor(rand() * 4) }, () => {
    const a = rand() * Math.PI * 2,
      d = rand() * 8;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, h: 26 + rand() * 18, lean: (rand() - 0.5) * 8 };
  }).sort((p, q) => p.v - q.v),
});
/** A stand of bamboo: jointed green stalks leaning a little, sprays of narrow leaves at their tops. */
export function drawBamboo(g: Ink, gx: number, gy: number, b: Bamboo) {
  for (const s of b.stalks) {
    rod(g, gx, gy, s.u, s.v, 0, s.u + s.lean, s.v, s.h, 1.8, 0x7a9a3a);
    for (let h = 6; h < s.h; h += 7) {
      const t = h / s.h;
      disc(g, X(gx, s.u + s.lean * t), Y(gy, s.v, h), 1.3, 0x5a7a2a);
    }
    const tx = X(gx, s.u + s.lean),
      ty = Y(gy, s.v, s.h);
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.7;
      g.lineStyle(1.6, k % 2 ? LEAF[2] : LEAF[1], 0.95);
      g.lineBetween(tx, ty, tx + Math.cos(a) * 7, ty + Math.sin(a) * 4 + 3);
    }
  }
}
export function bambooShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(6, SHADE, 0.18);
  g.lineBetween(gx, gy, gx + 34 * SUN.x, gy + 34 * SUN.y);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The pyramid's top shrine doorway, where a glyph fire glows (height at full size). */
export const SHRINE = { h: 56 } as const;
/**
 * A stepped temple pyramid: five shrinking terraces of mossy stone, a steep stair up its front, a shrine on top with a
 * dark doorway, vines over its corners and the forest crowding its foot.
 */
export function drawPyramid(g: Ink) {
  const steps = [[40, 0, 10], [33, 10, 20], [26, 20, 30], [19, 30, 40], [13, 40, 48]];
  for (const [r, h0, h1] of steps) {
    stone(g, 0, -h0, 0, r, r * 0.8, 0, h1 - h0, true);
    // Masonry courses on the front.
    g.lineStyle(0.6, shade(STONE.wall, -0.4), 0.8);
    for (let u = -r + 6; u < r; u += 7) g.lineBetween(X(0, u), Y(-h0, r * 0.8, 1), X(0, u), Y(-h0, r * 0.8, h1 - h0 - 1));
  }
  // The stair: a strip of steps up the middle of the front.
  for (let i = 0; i < 12; i++) {
    const h = i * 4,
      v = 32 - i * 1.6;
    box(g, 0, 0, frame(0, 0, h), -5, 5, v - 2.4, v, 0, 4, shade(STONE.top, -0.05));
  }
  // The shrine: walls, a dark door with the glyph fire, a roof comb.
  box(g, 0, 0, frame(0, 0, 48), -9, 9, -7, 7, 0, 12, STONE.wall);
  project(0, 0, frame(0, 0, 48), -3, 7.05, 1, 0);
  project(0, 0, frame(0, 0, 48), 3, 7.05, 1, 1);
  project(0, 0, frame(0, 0, 48), 3, 7.05, 8, 2);
  project(0, 0, frame(0, 0, 48), -3, 7.05, 8, 3);
  g.fillStyle(0x0a120a);
  g.fillPoints([0, 1, 2, 3].map((i) => ({ x: SX[i], y: SY[i] })), true);
  box(g, 0, 0, frame(0, 0, 60), -10, 10, -8, 8, 0, 2, STONE.top);
  box(g, 0, 0, frame(0, 0, 62), -6, 6, -1, 1, 0, 6, STONE.wall);
  // Vines down the corners and tree crowns crowding the foot.
  for (const u of [-38, 38]) {
    g.lineStyle(1.4, 0x2a6a2a);
    g.strokePoints([{ x: X(0, u), y: Y(0, 30, 10) }, { x: X(0, u * 0.9), y: Y(0, 28, 6) }, { x: X(0, u * 1.02), y: Y(0, 32, 0) }], false);
  }
  foliage(g, X(0, -44), Y(0, 26, 10), 12, 11);
  foliage(g, X(0, 44), Y(0, 28, 8), 11, 12);
}
export function pyramidShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 40, 32, 56, 0.3);
}
/** A giant strangler fig: a trunk of braided roots spreading over a rock, a vast crown, lianas, glowing fungus at its foot. */
export function drawFig(g: Ink) {
  stone(g, 6, 4, 0.3, 14, 10, 0, 10, true);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2,
      u = Math.cos(a) * 24,
      v = Math.sin(a) * 18;
    rod(g, 0, 0, u * 0.6, v * 0.6, 0, u * 0.15, v * 0.15, 16, 4.4, shade(BARK, 0.15 - (i % 2) * 0.1));
  }
  for (let i = 0; i < 5; i++) rod(g, 0, 0, (i - 2) * 3, 0, 4, (i - 2) * 1.8 + (i % 2), 0, 44, 3.6, shade(0x5a4a38, (i % 3) * 0.06));
  for (let i = 0; i < 6; i++) {
    const u = -30 + i * 12;
    g.lineStyle(1.2, 0x2a5a24, 0.9);
    g.strokePoints([{ x: X(0, u), y: Y(0, 6, 44) }, { x: X(0, u) + 2, y: Y(0, 6, 30) }, { x: X(0, u) - 1, y: Y(0, 6, 14 + (i % 3) * 6) }], false);
  }
  const clumps = [[-28, -12, 46, 17], [26, -10, 48, 16], [-14, 8, 44, 17], [16, 10, 43, 16], [0, -16, 52, 18], [-36, 6, 40, 13], [36, 4, 40, 13], [2, 2, 48, 16]];
  for (const [u, v, h, r] of clumps.sort((p, q) => p[1] - q[1])) foliage(g, X(0, u), Y(0, v, h), r, u * 13 + v);
  foliage(g, X(0, -4), Y(0, -6, 60), 16, 99, 0.05);
}
export function figShadow(g: Ink) {
  oval(g, 30, 20, 46, 24, SHADE, 0.24);
  oval(g, 6, 4, 28, 16, SHADE, 0.2);
}
/** Where the fig's glowing fungus sits (screen offsets at full size). */
export const FIG_FUNGUS = [[-18, 14], [10, 18], [22, 10]] as const;
