import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, endFace, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of Moon Lake (`tide.ts`), a tidal flat under a full moon, drawn in the towers' 3/4 tilt: barnacled sea
// stacks, tidepools ringed by stones, bleached driftwood, mooring posts hung with weed and a lantern, lobster creels
// and beached rowboats; a stone lighthouse and a fisher's hut on stilts as landmarks. Every prop stands on a ground
// point (gx, gy) in pixels and is rolled up front into a plain record; moonlight glints and lamps live in the ambient.

export const SHADE = 0x02060e;
/** The moon stands high in the upper left: short, cool shadows. */
export const SUN = { x: 0.4, y: 0.25 } as const;
export const MOON = 0xdceaf8;
const STONE = { wall: 0x34485e, top: 0x56708c } as const,
  WOOD = 0x8a8478,
  WEED = 0x2a5a4a;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
const RF = new Float64Array(16),
  RI = new Float64Array(16);
/** A weathered stone of six corners, its top lit by the moon. */
export function stone(g: Ink, x: number, y: number, r: number, h: number, seed: number) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + hash01(seed) * 2,
      k = 0.78 + hash01(seed, i) * 0.22;
    RF[2 * i] = Math.cos(t) * r * k;
    RF[2 * i + 1] = Math.sin(t) * r * k;
    RI[2 * i] = RF[2 * i] * 0.6;
    RI[2 * i + 1] = RF[2 * i + 1] * 0.6;
  }
  block(g, x, y, RF, RI, 6, 0, h * 0.6, h * 0.4, STONE.wall, STONE.top, 0xcfe2f4);
}

// ── Sea stack ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Stack { tiers: { r: number; h: number; du: number; dv: number }[]; seed: number }
export function stackOf(rand: Random): Stack {
  const n = 2 + Math.floor(rand() * 2);
  return { tiers: Array.from({ length: n }, (_, i) => ({ r: 13 - i * 3.5 + rand() * 2, h: 9 + rand() * 4, du: (rand() - 0.5) * 4, dv: (rand() - 0.5) * 3 })), seed: Math.floor(rand() * 1e6) };
}
/** A sea stack: weathered blocks piled in tiers, a waterline of dark weed and white barnacles round its foot. */
export function drawStack(g: Ink, gx: number, gy: number, s: Stack) {
  let z = 0;
  s.tiers.forEach((t, i) => {
    stone(g, gx + t.du, gy + t.dv * SQUASH - z, t.r, t.h, s.seed + i);
    z += t.h * 0.85;
  });
  // Weed and barnacles at the waterline.
  const base = s.tiers[0];
  for (let i = 0; i < 9; i++) {
    const t = Math.PI * (0.05 + 0.9 * (i / 8)),
      x = X(gx + base.du, Math.cos(t) * base.r * 0.9),
      y = Y(gy + base.dv * SQUASH, Math.sin(t) * base.r * 0.9, 1.5);
    disc(g, x, y, 1.6, WEED, 0.9);
    if (hash01(s.seed, i) < 0.6) disc(g, x + 1, y - 2.4, 0.8, 0xe8f0f6);
  }
}
export function stackShadow(g: Ink, gx: number, gy: number, s: Stack) {
  roundShadow(g, gx, gy, s.tiers[0].r + 2, s.tiers.reduce((a, t) => a + t.h * 0.85, 0));
}

// ── Tidepool ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pool { stones: { a: number; r: number }[]; star: number; seed: number }
export function poolOf(rand: Random): Pool {
  return { stones: Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * Math.PI * 2 + rand() * 0.4, r: 3 + rand() * 2.5 })), star: rand() < 0.6 ? 0xd85a3a : 0xc8a03a, seed: Math.floor(rand() * 1e6) };
}
/** The pool's water (screen offset and radii), for the moon glint in the ambient. */
export const POOL = { rx: 13, ry: 7 } as const;
/** A tidepool: still dark water ringed by moonlit stones, a starfish and an anemone in it, weed on the rim. */
export function drawPool(g: Ink, gx: number, gy: number, p: Pool) {
  oval(g, gx, gy, POOL.rx + 4, POOL.ry + 3, 0x2a3a4c);
  oval(g, gx, gy + 0.6, POOL.rx, POOL.ry, 0x0c2036);
  oval(g, gx, gy + 1.2, POOL.rx - 3, POOL.ry - 2, 0x14304a);
  // Starfish and anemone under the water.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    g.lineStyle(1.6, p.star, 0.9);
    g.lineBetween(gx - 4, gy + 1, gx - 4 + Math.cos(a) * 3.6, gy + 1 + Math.sin(a) * 3.6 * SQUASH);
  }
  disc(g, gx + 5, gy + 1.5, 1.8, 0xd88ab0, 0.85);
  for (const s of [...p.stones].sort((a, b) => Math.sin(a.a) - Math.sin(b.a))) {
    if (Math.sin(s.a) > 0.3) continue;
    stone(g, X(gx, Math.cos(s.a) * (POOL.rx + 2)), Y(gy, Math.sin(s.a) * (POOL.rx + 2) / SQUASH * 0.6, 0), s.r, s.r * 0.9, p.seed + Math.round(s.a * 10));
  }
  for (const s of p.stones) {
    if (Math.sin(s.a) <= 0.3) continue;
    stone(g, X(gx, Math.cos(s.a) * (POOL.rx + 2)), Y(gy, Math.sin(s.a) * (POOL.rx + 2) / SQUASH * 0.6, 0), s.r, s.r * 0.9, p.seed + Math.round(s.a * 10));
  }
}
export function poolShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 2, gy + 2, POOL.rx + 6, POOL.ry + 4, SHADE, 0.2);
}

// ── Driftwood ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Drift { a: number; len: number; r: number; branch: number }
export const driftOf = (rand: Random): Drift => ({ a: (rand() - 0.5) * 1.6, len: 15 + rand() * 6, r: 3 + rand() * 1.4, branch: rand() < 0.6 ? (rand() < 0.5 ? -1 : 1) : 0 });
/** A bleached driftwood log half sunk in the sand, a broken branch stub, kelp tangled round it, a scatter of shells. */
export function drawDrift(g: Ink, gx: number, gy: number, d: Drift) {
  tube(g, gx, gy, d.a, d.r * 0.7, -d.len, d.len, d.r, WOOD);
  const end = Math.sin(d.a) >= 0 ? d.len : -d.len;
  endFace(g, gx, gy, d.a, d.r * 0.7, end, d.r, shade(WOOD, 0.15));
  endFace(g, gx, gy, d.a, d.r * 0.7, end, d.r * 0.5, shade(WOOD, -0.1));
  g.lineStyle(0.6, shade(WOOD, -0.3), 0.8);
  for (const off of [-0.4, 0.4]) {
    const c = Math.cos(d.a),
      s = Math.sin(d.a);
    g.lineBetween(X(gx, -c * d.len * 0.8), Y(gy, -s * d.len * 0.8, d.r * 0.7 + off * d.r), X(gx, c * d.len * 0.8), Y(gy, s * d.len * 0.8, d.r * 0.7 + off * d.r));
  }
  if (d.branch) {
    const p = d.len * 0.3 * d.branch;
    rod(g, gx, gy, Math.cos(d.a) * p, Math.sin(d.a) * p, d.r * 1.2, Math.cos(d.a) * p - Math.sin(d.a) * 6, Math.sin(d.a) * p + Math.cos(d.a) * 6 * -1, d.r * 1.2 + 9, 1.8, WOOD);
  }
  g.lineStyle(1.4, WEED, 0.9);
  g.strokePoints([{ x: gx - 6, y: gy + 3 }, { x: gx - 2, y: gy - 2 }, { x: gx + 3, y: gy + 1 }, { x: gx + 7, y: gy - 1 }], false);
  for (let i = 0; i < 3; i++) disc(g, gx - 10 + i * 9, gy + 6 + (i % 2) * 2, 1.2, 0xe8eef4, 0.9);
}
export function driftShadow(g: Ink, gx: number, gy: number, d: Drift) {
  boxShadow(g, gx + 2, gy + 2, d.a, d.len, d.r, 4, 0.3);
}

// ── Mooring post ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Posts { list: { u: number; v: number; h: number }[]; lantern: boolean }
export function postsOf(rand: Random): Posts {
  const n = 2 + Math.floor(rand() * 2);
  return { list: Array.from({ length: n }, (_, i) => ({ u: -10 + i * (20 / (n - 1)) + (rand() - 0.5) * 3, v: (i % 2 ? 4 : -3) + (rand() - 0.5) * 3, h: 16 + rand() * 12 })).sort((p, q) => p.v - q.v), lantern: rand() < 0.6 };
}
/** Where the lantern hangs (ground u, v, height), on the tallest post. */
export function postLantern(p: Posts) {
  const t = p.list.reduce((a, b) => (b.h > a.h ? b : a));
  return { u: t.u + 3, v: t.v, h: t.h - 3 };
}
/** Old mooring posts: weathered timber piles, green weed and barnacles to the tide line, a rope slung between, a lantern. */
export function drawPosts(g: Ink, gx: number, gy: number, p: Posts) {
  for (const q of p.list) {
    const x = gx + q.u,
      y = gy + q.v * SQUASH;
    drum(g, x, y, 2.6, 0, q.h, 0x5a5448, 0x7a7266, 10);
    drum(g, x, y, 2.75, 0, 7, WEED, shade(WEED, 0.1), 10);
    for (let i = 0; i < 4; i++) disc(g, x + Math.cos(i * 1.4) * 2, Y(y, 1.5, 3 + i * 1.2), 0.7, 0xe8f0f6);
  }
  const [a, b] = p.list;
  g.lineStyle(1, 0xa89a7a, 0.9);
  g.strokePoints([{ x: X(gx + a.u, 0), y: Y(gy + a.v * SQUASH, 0, a.h - 4) }, { x: (gx + a.u + gx + b.u) / 2, y: Y(gy + ((a.v + b.v) / 2) * SQUASH, 0, Math.min(a.h, b.h) - 10) }, { x: X(gx + b.u, 0), y: Y(gy + b.v * SQUASH, 0, b.h - 4) }], false);
  if (p.lantern) {
    const l = postLantern(p);
    rod(g, gx, gy, l.u - 3, l.v, l.h + 3, l.u, l.v, l.h + 3, 0.8, 0x2a2a2a);
    box(g, gx, gy, frame(0, 0, l.h - 3, l.u, l.v), -1.5, 1.5, -1.5, 1.5, 0, 4, 0x2a2a26);
  }
}
export function postsShadow(g: Ink, gx: number, gy: number, p: Posts) {
  for (const q of p.list) {
    g.lineStyle(3, SHADE, 0.22);
    g.lineBetween(gx + q.u, gy + q.v * SQUASH, gx + q.u + q.h * SUN.x, gy + q.v * SQUASH + q.h * SUN.y);
  }
}

// ── Creels and rowboat ──────────────────────────────────────────────────────────────────────────────────────────────
export interface Boat { a: number; paint: number; creels: number }
const PAINT = [0x3a6a8a, 0x8a3a3a, 0xc8b070, 0x4a7a5a] as const;
export const boatOf = (rand: Random): Boat => ({ a: (rand() - 0.5) * 0.9, paint: PAINT[Math.floor(rand() * PAINT.length)], creels: Math.floor(rand() * 3) });
/** A creel: a domed trap of netting on a slatted base. */
function creel(g: Ink, x: number, y: number) {
  box(g, x, y, frame(0.3, 0, 0), -4.5, 4.5, -3.5, 3.5, 0, 1.4, 0x5a4a3a);
  g.fillStyle(0x1e2a3a, 0.7);
  g.fillPoints(Array.from({ length: 9 }, (_, i) => {
    const t = Math.PI + (i / 8) * Math.PI;
    return { x: x + Math.cos(t) * 4.5, y: Y(y, 0, 1.4) + Math.sin(t) * 6 };
  }), true);
  g.lineStyle(0.6, 0xa89a7a, 0.8);
  for (const k of [-2.2, 0, 2.2]) g.lineBetween(x + k, Y(y, 0, 1.4), x + k * 0.6, Y(y, 0, 7));
  g.lineBetween(x - 4.5, Y(y, 0, 4), x + 4.5, Y(y, 0, 4));
}
/** A rowboat hauled up on the sand, tipped a little on its keel, oars inside, a few lobster creels stacked beside it. */
export function drawBoat(g: Ink, gx: number, gy: number, b: Boat) {
  const f = frame(b.a, 0, 0),
    side = (q: number) =>
      Array.from({ length: 9 }, (_, i) => {
        const t = i / 8,
          p = -15 + 30 * t,
          w = q * 6.5 * Math.sin(Math.PI * (0.08 + 0.84 * t)) ** 0.6;
        project(gx, gy, f, p, w, 6 + 2 * t * t, 0);
        return { x: SX[0], y: SY[0] };
      });
  for (let i = 0; i < b.creels; i++) creel(g, gx - 14 + i * 6, gy - 8 + i * 3);
  // Hull: the far gunwale, the inside, the near side planks.
  const far = side(-1),
    near = side(1),
    keel = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8;
      project(gx, gy, f, -15 + 30 * t, 0, 0.5 + 2 * t * t, 0);
      return { x: SX[0], y: SY[0] };
    });
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints([...far, ...near.slice().reverse()].map((p) => ({ x: p.x, y: p.y - 0.6 })), true);
  g.fillStyle(0x3a2e24);
  g.fillPoints([...far, ...near.slice().reverse()], true);
  // Thwarts and oars inside.
  for (const p of [-5, 4]) {
    project(gx, gy, f, p, -5.5, 5, 0);
    project(gx, gy, f, p, 5.5, 5, 1);
    g.lineStyle(1.6, 0x8a7458);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  rod(g, gx, gy, -12 * Math.cos(b.a), -12 * Math.sin(b.a), 5, 14 * Math.cos(b.a), 14 * Math.sin(b.a) + 2, 7, 1, 0xa89a7a);
  g.fillStyle(b.paint);
  g.fillPoints([...near, ...keel.slice().reverse()], true);
  g.lineStyle(1.2, 0xe8e0d0, 0.9);
  g.strokePoints(near, false);
  g.lineStyle(0.6, shade(b.paint, -0.35), 0.8);
  g.strokePoints(near.map((p, i) => ({ x: (p.x + keel[i].x) / 2, y: (p.y + keel[i].y) / 2 })), false);
}
export function boatShadow(g: Ink, gx: number, gy: number, b: Boat) {
  boxShadow(g, gx + 1, gy + 2, b.a, 15, 7, 8, 0.32);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The lighthouse's lamp height (at full size). */
export const LIGHT = { lamp: 70 } as const;
/**
 * A stone lighthouse on a rock: a tapering tower banded white and red, a gallery with railings, a glazed lantern room
 * under a domed cap; its beam turns in the ambient.
 */
export function drawLighthouse(g: Ink) {
  stone(g, 0, 4, 30, 10, 11);
  stone(g, 18, 12, 10, 7, 12);
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      r = 11 - 4 * t0;
    drum(g, 0, 0, r, 8 + 50 * t0, 8 + 50 * t1 + 0.4, i % 2 ? 0xb83a32 : 0xe8e4dc, i % 2 ? 0xc84a3e : 0xf4f0e8, 16);
  }
  drum(g, 0, 0, 9.5, 58, 60, 0x2a2e34, 0x3a3e44, 16);
  for (let i = 0; i <= 10; i++) {
    const t = (i / 10) * Math.PI;
    rod(g, 0, 0, Math.cos(t) * 9, Math.sin(t) * 9, 60, Math.cos(t) * 9, Math.sin(t) * 9, 63, 0.5, 0x6a6e74);
  }
  drum(g, 0, 0, 5.4, 60, 69, 0x2a3a4a, 0x3a4a5a, 12);
  for (let i = 0; i < 4; i++) {
    const t = Math.PI * (0.15 + i * 0.23);
    g.lineStyle(0.6, 0x1a1e22);
    g.lineBetween(X(0, Math.cos(t) * 5.4), Y(0, Math.sin(t) * 5.4, 60), X(0, Math.cos(t) * 5.4), Y(0, Math.sin(t) * 5.4, 69));
  }
  for (let i = 0; i < 3; i++) drum(g, 0, 0, 6 - i * 2, 69 + i * 1.4, 70.4 + i * 1.4, 0x2a2e34, 0x3a3e44, 12);
  rod(g, 0, 0, 0, 0, 73, 0, 0, 77, 0.6, 0x6a6e74);
  // The keeper's door and a window.
  project(0, 0, frame(0, 0, 0), 0, 11, 8, 0);
  g.fillStyle(0x2a2420);
  g.fillRect(SX[0] - 2, SY[0] - 7, 4, 7);
}
export function lighthouseShadow(g: Ink) {
  oval(g, 10, 8, 34, 18, SHADE, 0.22);
  g.lineStyle(10, SHADE, 0.18);
  g.lineBetween(0, 0, 60 * SUN.x, 60 * SUN.y);
}
/** Where the hut's window glows (ground u, v, height at full size). */
export const HUT = { window: { u: 4, v: 12.1, h: 26 } } as const;
/**
 * A fisher's hut on stilts: a weathered plank cabin with a pitched tin roof standing on piles over the flat, a ladder
 * and a little jetty, nets hung to dry along the rail, a lit window.
 */
export function drawHut(g: Ink) {
  const pile = (u: number, v: number) => drum(g, X(0, u), Y(0, v, 0), 1.8, 0, 16, 0x4a4438, 0x6a6458, 8);
  for (const [u, v] of [[-18, -12], [18, -12], [-18, 12], [18, 12]]) pile(u, v);
  // Jetty running out to the front right on its own piles.
  for (const u of [24, 34]) pile(u, 14);
  box(g, 0, 0, frame(0, 0, 14, 22, 12), -2, 16, -4, 4, 0, 1.5, 0x8a7a5e);
  const f = frame(0, 0, 16);
  box(g, 0, 0, f, -22, 22, -15, 15, 0, 2, 0x7a6a50);
  box(g, 0, 0, f, -16, 16, -11, 11, 2, 20, 0x6a6458);
  g.lineStyle(0.6, 0x4a4438, 0.8);
  for (let p = -14; p < 16; p += 4) {
    project(0, 0, f, p, 11.05, 2, 0);
    project(0, 0, f, p, 11.05, 20, 1);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  // Window and door on the front.
  project(0, 0, f, HUT.window.u - 3, 11.06, 7, 0);
  project(0, 0, f, HUT.window.u + 3, 11.06, 7, 1);
  project(0, 0, f, HUT.window.u + 3, 11.06, 13, 2);
  project(0, 0, f, HUT.window.u - 3, 11.06, 13, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x3a3020);
  project(0, 0, f, -12, 11.06, 2, 0);
  project(0, 0, f, -6, 11.06, 2, 1);
  project(0, 0, f, -6, 11.06, 15, 2);
  project(0, 0, f, -12, 11.06, 15, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x2a2420);
  // Pitched tin roof with the ridge running along the cabin: the back plane, then the front plane with its
  // corrugations and a dark drip edge, the gable ends filled under it.
  const ridge = 32,
    eave = 17,
    pt = (p: number, q: number, z: number, i: number) => project(0, 0, f, p, q, z, i);
  for (const end of [-18, 18]) {
    pt(end * 0.9, -12, eave, 0);
    pt(end * 0.9, 12, eave, 1);
    pt(end * 0.9, 0, ridge, 2);
    g.fillStyle(0x5a5448);
    g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
  }
  pt(-20, -15, eave - 1, 0);
  pt(20, -15, eave - 1, 1);
  pt(20, 0, ridge, 2);
  pt(-20, 0, ridge, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x4a565e);
  pt(-20, 0, ridge, 0);
  pt(20, 0, ridge, 1);
  pt(20, 15, eave - 1, 2);
  pt(-20, 15, eave - 1, 3);
  quad(g, SX[0] - 0.6, SY[0] - 0.6, SX[1] + 0.6, SY[1] - 0.6, SX[2] + 0.6, SY[2] + 0.8, SX[3] - 0.6, SY[3] + 0.8, OUTLINE, 0.9);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x8a96a0);
  g.lineStyle(0.6, 0x6a7680, 0.9);
  for (let p = -18; p <= 18; p += 3) {
    pt(p, 0.5, ridge - 0.3, 0);
    pt(p, 14.5, eave - 0.5, 1);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  // Rust streaks and the ridge cap.
  for (const p of [-9, 6, 12]) {
    pt(p, 6, ridge - 6, 0);
    pt(p + 0.6, 14, eave, 1);
    g.lineStyle(1.2, 0x8a4a22, 0.6);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  pt(-20, 0, ridge + 0.6, 0);
  pt(20, 0, ridge + 0.6, 1);
  g.lineStyle(1.6, 0xb8c4cc);
  g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  // Nets hung on the front rail.
  for (let i = 0; i < 3; i++) {
    project(0, 0, f, 8 + i * 4.5, 14, 2, 0);
    g.fillStyle(0x3a4a5a, 0.7);
    g.fillTriangle(SX[0] - 2, SY[0] - 6, SX[0] + 2, SY[0] - 6, SX[0], SY[0] + 3);
  }
  // Ladder down from the deck.
  rod(g, 0, 0, -20, 15, 0, -20, 15, 16, 0.8, 0x8a7a5e);
  rod(g, 0, 0, -16, 15, 0, -16, 15, 16, 0.8, 0x8a7a5e);
  for (let h = 3; h < 16; h += 3) rod(g, 0, 0, -20, 15, h, -16, 15, h, 0.6, 0x8a7a5e);
}
export function hutShadow(g: Ink) {
  boxShadow(g, 4, 4, 0, 22, 15, 20, 0.26);
}
