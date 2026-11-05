import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Rift (`rift.ts`), ground torn by a breach in reality, drawn in the towers' 3/4 tilt: rock torn
// loose and hovering, standing tears in the air, pylons twisted by warped space, containment cages holding an anomaly
// and slabs heaved up out of the ground; a ring portal on a dais and a shattered monolith whose pieces float apart as
// landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record; its
// glow, swirl and motes live in the theme's ambient.

export const SHADE = 0x040108;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const VOID = 0x0a0414;
export const RIFT = 0xd060ff;
export const HOT = 0xf4d0ff;
const ROCK = { wall: 0x3e3252, top: 0x605278 } as const;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A lumpy rock block of six corners from h0 to h1. */
function rock(g: Ink, x: number, y: number, r: number, h0: number, h1: number, seed: number, wall: number = ROCK.wall, top: number = ROCK.top) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + hash01(seed) * 2,
      k = 0.72 + hash01(seed, i) * 0.28;
    F[2 * i] = Math.cos(t) * r * k;
    F[2 * i + 1] = Math.sin(t) * r * k;
    I[2 * i] = F[2 * i] * 0.6;
    I[2 * i + 1] = F[2 * i + 1] * 0.6;
  }
  block(g, x, y, F, I, 6, h0, h1, (h1 - h0) * 0.35, wall, top, shade(top, 0.3));
}
/** The jagged underside of a floating rock: a dark cone of broken stone hanging below it. */
function underside(g: Ink, x: number, y: number, r: number, h: number, seed: number) {
  const pts = [] as { x: number; y: number }[];
  for (let i = 0; i <= 6; i++) {
    const t = (i / 6) * Math.PI;
    pts.push({ x: X(x, Math.cos(t) * r * 0.9), y: Y(y, Math.sin(t) * r * 0.9, h) });
  }
  const tip = { x: x + (hash01(seed, 9) - 0.5) * r * 0.4, y: Y(y, 0, h - r * (0.9 + hash01(seed, 8) * 0.5)) };
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints([...pts.map((p) => ({ x: p.x, y: p.y + 0.6 })), { x: tip.x, y: tip.y + 0.8 }], true);
  g.fillStyle(0x261c34);
  g.fillPoints([...pts, tip], true);
  g.fillStyle(0x382c4a);
  g.fillPoints([pts[4], pts[5], pts[6], tip], true);
}

// ── Floating debris ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface Shard { u: number; v: number; r: number; h: number; seed: number }
export function debrisOf(rand: Random): Shard[] {
  const n = 2 + Math.floor(rand() * 2);
  return Array.from({ length: n }, (_, i) => ({
    u: i ? (rand() - 0.5) * 24 : 0,
    v: i ? (rand() - 0.5) * 16 : 0,
    r: i ? 4 + rand() * 3 : 9 + rand() * 3,
    h: i ? 18 + rand() * 18 : 12 + rand() * 8,
    seed: Math.floor(rand() * 1e6),
  })).sort((p, q) => p.v - q.v);
}
/** Where each hovering rock's underglow sits (screen offsets): the ground spot under it and the rock's base. */
export const debrisGlows = (list: readonly Shard[]) => list.map((s) => ({ x: s.u, y: s.v * SQUASH, r: s.r, base: Y(s.v * SQUASH, 0, s.h) }));
/** Rock torn out of the ground and hovering: a crater pit where it came from, the chunks floating above, jagged undersides. */
export function drawDebris(g: Ink, gx: number, gy: number, list: readonly Shard[]) {
  const big = list.find((s) => s.r > 8) ?? list[0];
  oval(g, gx + big.u, gy + big.v * SQUASH + 1, big.r + 3, (big.r + 3) * SQUASH, 0x2a2036);
  oval(g, gx + big.u, gy + big.v * SQUASH + 1.5, big.r + 1, (big.r + 1) * SQUASH * 0.85, 0x0c0814);
  for (const s of list) {
    const x = gx + s.u,
      y = gy + s.v * SQUASH;
    underside(g, x, y, s.r, s.h, s.seed);
    rock(g, x, y, s.r, s.h, s.h + s.r * 0.7, s.seed);
  }
}
export function debrisShadow(g: Ink, gx: number, gy: number, list: readonly Shard[]) {
  for (const s of list) oval(g, gx + s.u + 2, gy + s.v * SQUASH + 1, s.r * 0.9, s.r * 0.5, SHADE, 0.28);
}

// ── Standing tear ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a tear's centre and its half height. */
export const TEAR = { h: 22, half: 15 } as const;
/** The tear's outline: a lens standing upright, its points top and bottom (screen offsets from the ground point). */
export function tearOutline(lean: number, grow = 0) {
  return Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2,
      sx = Math.sin(t),
      hy = Math.cos(t) * (TEAR.half + grow);
    return { x: (5.5 + grow) * sx * Math.abs(sx) ** 0.5 + hy * lean, y: -TEAR.h - hy };
  });
}
/** A tear in the air over cracked ground: a black lens of void with a burning violet rim, chips of rock lifting round it. */
export function drawTear(g: Ink, gx: number, gy: number, lean: number) {
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    g.lineStyle(1, 0x1a0e28, 0.9);
    g.lineBetween(gx, gy, gx + Math.cos(a) * 13, gy + Math.sin(a) * 13 * SQUASH);
  }
  const at = (grow: number) => tearOutline(lean, grow).map((p) => ({ x: gx + p.x, y: gy + p.y }));
  g.fillStyle(0x6a20a8);
  g.fillPoints(at(2.2), true);
  g.fillStyle(RIFT);
  g.fillPoints(at(1), true);
  g.fillStyle(VOID);
  g.fillPoints(at(-0.6), true);
  for (let i = 0; i < 4; i++) {
    const s = 31 + i * 7,
      x = gx + (hash01(s) - 0.5) * 20,
      y = gy + (hash01(s, 1) - 0.5) * 6;
    rock(g, x, y, 1.6 + hash01(s, 2) * 1.2, 4 + hash01(s, 3) * 14, 6 + hash01(s, 3) * 14 + 1.4, s);
  }
}
export function tearShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 4, gy + 2, 12, 5, SHADE, 0.24);
}

// ── Twisted pylon ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pylon { twist: number; h: number }
export const pylonOf = (rand: Random): Pylon => ({ twist: (rand() < 0.5 ? 1 : -1) * (0.25 + rand() * 0.2), h: 30 + rand() * 10 });
const SQ = [5, 5, -5, 5, -5, -5, 5, -5];
/** An obelisk wrenched by warped space: square stone sections, each turned further than the one below, a rune seam glowing. */
export function drawPylon(g: Ink, gx: number, gy: number, p: Pylon) {
  const n = 6,
    seg = p.h / n;
  box(g, gx, gy, frame(0, 0, 0), -8, 8, -8, 8, 0, 3, ROCK.wall, ROCK.top);
  for (let i = 0; i < n; i++) {
    const a = p.twist * i,
      k = 1 - i * 0.07,
      c = Math.cos(a),
      s = Math.sin(a);
    for (let j = 0; j < 4; j++) {
      F[2 * j] = (SQ[2 * j] * c - SQ[2 * j + 1] * s) * k;
      F[2 * j + 1] = (SQ[2 * j] * s + SQ[2 * j + 1] * c) * k;
      I[2 * j] = F[2 * j] * 0.85;
      I[2 * j + 1] = F[2 * j + 1] * 0.85;
    }
    // Clockwise order on the screen: the square turned by any angle stays clockwise.
    block(g, gx, gy, F, I, 4, 3 + i * seg, 3 + (i + 1) * seg - 0.6, 0.6, shade(ROCK.wall, i * 0.02), shade(ROCK.top, i * 0.03), 0x8a7aa8);
  }
  // Pointed cap.
  const top = Y(gy, 0, 3 + p.h);
  g.fillStyle(OUTLINE, 0.9);
  g.fillTriangle(gx - 4.6, top + 1, gx + 4.6, top + 1, gx, top - 8);
  g.fillStyle(ROCK.top);
  g.fillTriangle(gx - 4, top + 0.5, gx + 4, top + 0.5, gx, top - 7);
  g.fillStyle(shade(ROCK.top, 0.25));
  g.fillTriangle(gx - 4, top + 0.5, gx, top + 0.5, gx, top - 7);
}
/** Where the rune seam runs up the pylon's face (screen offsets). */
export const pylonRunes = (p: Pylon) => Array.from({ length: 6 }, (_, i) => ({ x: Math.sin(p.twist * i) * 3, y: Y(5 * (1 - i * 0.07) * SQUASH, 0, 3 + (i + 0.5) * (p.h / 6)) }));
export function pylonShadow(g: Ink, gx: number, gy: number, p: Pylon) {
  g.lineStyle(7, SHADE, 0.24);
  g.lineBetween(gx, gy, gx + p.h * SUN.x, gy + p.h * SUN.y);
}

// ── Containment cage ────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the anomaly held in the cage. */
export const CAGE = { h: 18, r: 7 } as const;
/** A containment frame: a ring base, four bent struts round a held anomaly, a cap with an emitter, a fallen cable. */
export function drawCage(g: Ink, gx: number, gy: number) {
  drum(g, gx, gy, 11, 0, 3, 0x3a3448, 0x4a4458, 16);
  drum(g, gx, gy, 9, 3, 4.5, 0x24202e, 0x2e2a38, 16);
  const post = (a: number) => {
    const u = Math.cos(a) * 9,
      v = Math.sin(a) * 9;
    rod(g, gx, gy, u, v, 4, u * 1.15, v * 1.15, CAGE.h, 1.6, 0x6a6478);
    rod(g, gx, gy, u * 1.15, v * 1.15, CAGE.h, u * 0.6, v * 0.6, CAGE.h + 11, 1.6, 0x6a6478);
  };
  const angles = [0.8, 2.35, 3.9, 5.5];
  for (const a of angles) if (Math.sin(a) < 0) post(a);
  // The anomaly: a dark core with a bright rim (its light is ambient).
  const cy = Y(gy, 0, CAGE.h);
  disc(g, gx, cy, CAGE.r + 1.6, 0x6a20a8);
  disc(g, gx, cy, CAGE.r, VOID);
  disc(g, gx - 2, cy - 2, 1.6, HOT);
  for (const a of angles) if (Math.sin(a) >= 0) post(a);
  drum(g, gx, gy, 5, CAGE.h + 10, CAGE.h + 13, 0x3a3448, 0x4a4458, 12);
  disc(g, gx, Y(gy, 0, CAGE.h + 13), 1.6, RIFT);
  g.lineStyle(1.4, 0x1a1622);
  g.strokePoints([{ x: X(gx, 10), y: Y(gy, 4, 2) }, { x: gx + 16, y: gy + 8 }, { x: gx + 22, y: gy + 4 }], false);
}
export function cageShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 12, 20);
}

// ── Heaved slabs ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Slab { a: number; pitch: number; p: number; q: number; w: number; l: number }
export function slabsOf(rand: Random): Slab[] {
  const n = 2 + Math.floor(rand() * 2);
  return Array.from({ length: n }, (_, i) => ({ a: rand() * Math.PI * 2, pitch: 0.4 + rand() * 0.6, p: (i - (n - 1) / 2) * 11, q: (rand() - 0.5) * 10, w: 6 + rand() * 3, l: 12 + rand() * 6 })).sort((s, t) => s.q - t.q);
}
/** Slabs of the ground heaved up on end by the breach, a glowing crack between them. */
export function drawSlabs(g: Ink, gx: number, gy: number, list: readonly Slab[]) {
  g.lineStyle(2.4, 0x2a0e40, 0.9);
  g.lineBetween(gx - 16, gy + 2, gx + 16, gy - 2);
  g.lineStyle(1, RIFT, 0.85);
  g.lineBetween(gx - 15, gy + 2, gx + 15, gy - 2);
  for (const s of list) box(g, gx, gy, frame(s.a, s.pitch, 0, s.p, s.q), 0, s.l, -s.w, s.w, -2, 2, ROCK.wall, ROCK.top);
}
export function slabsShadow(g: Ink, gx: number, gy: number, list: readonly Slab[]) {
  for (const s of list) oval(g, gx + s.p + 5, gy + s.q * SQUASH + 3, s.l * 0.7, s.w * 0.7, SHADE, 0.24);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The portal ring: centre height and radius at full size. */
export const PORTAL = { h: 40, r: 26 } as const;
/** A ring portal: a stepped stone dais and a ring of dark stone blocks standing on it, rune plates round its rim. */
export function drawPortal(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -40, 40, -22, 22, 0, 4, ROCK.wall, ROCK.top);
  box(g, 0, 0, frame(0, 0, 0), -32, 32, -16, 16, 4, 8, shade(ROCK.wall, 0.05), shade(ROCK.top, 0.05));
  // The ring: 14 stone blocks round the opening, in the plane of the screen (x, height).
  const n = 14,
    seg = (Math.PI * 2) / n;
  // The void inside the ring.
  g.fillStyle(VOID);
  g.fillPoints(Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * Math.PI * 2;
    return { x: Math.cos(t) * (PORTAL.r - 3), y: Y(0, 0, 8 + PORTAL.h - 8) + Math.sin(t) * (PORTAL.r - 3) };
  }), true);
  for (let i = 0; i < n; i++) {
    const t0 = i * seg + 0.02,
      t1 = (i + 1) * seg - 0.02,
      cy = Y(0, 0, PORTAL.h),
      pt = (t: number, r: number) => ({ x: Math.cos(t) * r, y: cy + Math.sin(t) * r }),
      a = pt(t0, PORTAL.r - 4),
      b = pt(t1, PORTAL.r - 4),
      c = pt(t1, PORTAL.r + 4),
      d = pt(t0, PORTAL.r + 4),
      lit = Math.cos((t0 + t1) / 2 + 2.3);
    g.fillStyle(OUTLINE, 0.9);
    g.fillPoints([a, b, c, d].map((p) => ({ x: p.x * 1.03, y: cy + (p.y - cy) * 1.03 })), true);
    g.fillStyle(shade(0x3a3048, 0.2 * lit));
    g.fillPoints([a, b, c, d], true);
    // The ring's depth on its lower half: a dark band beneath each block.
    if (Math.sin((t0 + t1) / 2) > 0.2) {
      g.fillStyle(0x1a1424);
      g.fillPoints([d, c, { x: c.x, y: c.y + 4 }, { x: d.x, y: d.y + 4 }], true);
    }
    if (i % 2 === 0) {
      const m = pt((t0 + t1) / 2, PORTAL.r);
      disc(g, m.x, m.y, 1.2, 0x8a50c0);
    }
  }
}
export function portalShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 40, 22, 8, 0.3);
  g.fillStyle(SHADE, 0.16);
  g.fillPoints([{ x: -26, y: 6 }, { x: 26, y: 6 }, { x: 56, y: 24 }, { x: 4, y: 24 }], true);
}
/** The shattered monolith's floating pieces: base height and size of each section (at full size). */
export const MONOLITH = [
  { h0: 4, h1: 22, k: 1, a: 0, du: 0 },
  { h0: 28, h1: 42, k: 0.92, a: 0.12, du: 2 },
  { h0: 48, h1: 58, k: 0.84, a: -0.1, du: -1 },
  { h0: 64, h1: 70, k: 0.74, a: 0.22, du: 3 },
] as const;
/** A monolith broken across in four and held apart in the air: its stump on a cracked plinth, the pieces hanging above. */
export function drawMonolith(g: Ink) {
  rock(g, 0, 4, 26, 0, 4, 77, 0x342a46, 0x4a3e62);
  box(g, 0, 0, frame(0.1, 0, 0), -16, 16, -12, 12, 0, 4, ROCK.wall, ROCK.top);
  for (const m of MONOLITH) {
    if (m.h0 > 4) underside(g, m.du, 0, 9 * m.k, m.h0, m.h0 * 3);
    box(g, 0, 0, frame(m.a, 0, m.h0, m.du, 0), -9 * m.k, 9 * m.k, -6 * m.k, 6 * m.k, 0, m.h1 - m.h0, ROCK.wall, ROCK.top);
  }
}
export function monolithShadow(g: Ink) {
  boxShadow(g, 0, 0, 0.1, 16, 12, 5, 0.3);
  g.lineStyle(10, SHADE, 0.16);
  g.lineBetween(0, 0, 70 * SUN.x, 70 * SUN.y);
}
