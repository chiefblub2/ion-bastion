import { disc, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, drum, endFace, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Gearworks (`gear.ts`), a clockwork foundry in brass and copper, drawn in the towers' 3/4 tilt:
// great cogs standing in iron frames, stacks of lying gears on spindles, twin-cylinder piston engines with a flywheel,
// riveted copper boilers with a chimney and gauge, and banks of steam pipes; a clock tower and a great escapement
// wheel with its pendulum as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front
// into a plain record; steam, firebox glow and turning glints live in the theme's ambient.

export const SHADE = 0x0a0603;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const BRASS = 0xc8963a;
export const COPPER = 0xb8642e;
const IRON = 0x3a3430,
  DARK_BRASS = 0x8a6424;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};

// ── Cog geometry ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The outline of a cog as (cos, sin) multiples: `teeth` trapezoid teeth of depth `depth` round radius 1. */
export function cogRing(teeth: number, rot: number, depth = 0.26) {
  const out: [number, number][] = [],
    step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    for (const [da, rr] of [[-0.5, 1 - depth], [-0.22, 1 - depth], [-0.14, 1], [0.14, 1], [0.22, 1 - depth]] as const) out.push([Math.cos(a + da * step) * rr, Math.sin(a + da * step) * rr]);
  }
  return out;
}
/** A cog standing upright facing the viewer: centre at ground (u, v) and height h, radius r, `thick` deep. */
export function cogUpright(g: Ink, gx: number, gy: number, u: number, v: number, h: number, r: number, teeth: number, rot: number, color: number, thick = 3) {
  const ring = cogRing(teeth, rot),
    at = (dv: number, k: number) => ring.map(([c, s]) => ({ x: X(gx, u + c * r * k), y: Y(gy, v + dv, h + s * r * k) }));
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints(at(-thick, 1.04), true);
  g.fillStyle(shade(color, -0.4));
  g.fillPoints(at(-thick, 1), true);
  g.fillStyle(OUTLINE, 0.6);
  g.fillPoints(at(0, 1.03), true);
  g.fillStyle(color);
  g.fillPoints(at(0, 1), true);
  // Web, spokes and hub on the front face.
  const cx = X(gx, u),
    cy = Y(gy, v, h);
  oval(g, cx, cy, r * 0.74, r * 0.74, shade(color, -0.22));
  for (let i = 0; i < 4; i++) {
    const a = rot + (i / 4) * Math.PI * 2 + 0.3;
    g.lineStyle(Math.max(1.4, r * 0.16), color);
    g.lineBetween(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2, cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
  }
  disc(g, cx, cy, r * 0.24, shade(color, 0.15));
  disc(g, cx, cy, r * 0.11, IRON);
  // A lit rim on the upper left.
  g.lineStyle(1, shade(color, 0.4), 0.8);
  g.strokePoints(ring.slice(Math.floor(ring.length * 0.45), Math.floor(ring.length * 0.75)).map(([c, s]) => ({ x: X(gx, u + c * r * 0.98), y: Y(gy, v, h + s * r * 0.98) })), false);
}
/** A cog lying flat at heights h0…h1: its side band in layers, then the lit top face with web and hub. */
export function cogFlat(g: Ink, x: number, y0: number, r: number, teeth: number, rot: number, h0: number, h1: number, color: number) {
  const ring = cogRing(teeth, rot),
    at = (h: number, k: number) => ring.map(([c, s]) => ({ x: x + c * r * k, y: Y(y0, s * r * k, h) }));
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints(at(h0 - 0.6, 1.04), true);
  for (let h = h0; h < h1; h += 0.8) {
    g.fillStyle(shade(color, -0.35));
    g.fillPoints(at(h, 1), true);
  }
  g.fillStyle(color);
  g.fillPoints(at(h1, 1), true);
  oval(g, x, Y(y0, 0, h1), r * 0.7, r * 0.7 * SQUASH, shade(color, -0.18));
  for (let i = 0; i < 3; i++) {
    const a = rot + (i / 3) * Math.PI * 2;
    g.lineStyle(Math.max(1.2, r * 0.14), color);
    g.lineBetween(x + Math.cos(a) * r * 0.2, Y(y0, Math.sin(a) * r * 0.2, h1), x + Math.cos(a) * r * 0.68, Y(y0, Math.sin(a) * r * 0.68, h1));
  }
  oval(g, x, Y(y0, 0, h1), r * 0.24, r * 0.24 * SQUASH, shade(color, 0.2));
}

// ── Standing cog ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Standing { r: number; teeth: number; rot: number; small: boolean }
export const standingOf = (rand: Random): Standing => ({ r: 13 + rand() * 3, teeth: 9 + Math.floor(rand() * 3), rot: rand(), small: rand() < 0.6 });
/** Where a standing cog's hub sits (ground u, v, height) and its radius. */
export const standingHub = (s: Standing) => ({ u: -2, v: -1, h: s.r + 4, r: s.r });
/** A great brass cog standing in an iron A-frame on a plinth, a small copper pinion meshing beside it. */
export function drawStanding(g: Ink, gx: number, gy: number, s: Standing) {
  const hub = standingHub(s);
  box(g, gx, gy, frame(0, 0, 0), -16, 14, -6, 6, 0, 3, IRON);
  for (const u of [-10, 6]) rod(g, gx, gy, u, -4, 3, hub.u, -4, hub.h, 2, 0x4a4440);
  cogUpright(g, gx, gy, hub.u, hub.v, hub.h, s.r, s.teeth, s.rot, BRASS);
  if (s.small) cogUpright(g, gx, gy, hub.u + s.r + 3.5, hub.v + 2, hub.h - s.r * 0.55, 5.5, 8, s.rot + 0.2, COPPER, 2.4);
  for (const u of [-10, 6]) rod(g, gx, gy, u, 4, 3, hub.u, 4, hub.h, 2, 0x5a5450);
  disc(g, X(gx, hub.u), Y(gy, 4, hub.h), 1.8, 0x5a5450);
}
export function standingShadow(g: Ink, gx: number, gy: number, s: Standing) {
  boxShadow(g, gx, gy, 0, 16, 4, s.r * 2 + 4, 0.3);
}

// ── Gear stack ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Stack { gears: { u: number; v: number; r: number; z: number; teeth: number; rot: number; color: number }[] }
export function stackOf(rand: Random): Stack {
  const roll = rand(),
    c = () => (rand() < 0.65 ? BRASS : COPPER);
  const gears =
    roll < 0.5
      ? [{ u: 0, v: 0, r: 15, z: 0, teeth: 14, rot: rand(), color: c() }, { u: 1, v: -1, r: 10, z: 4, teeth: 10, rot: rand(), color: c() }, { u: 1.5, v: -1.5, r: 6, z: 8, teeth: 8, rot: rand(), color: c() }]
      : [{ u: -7, v: -4, r: 11, z: 0, teeth: 11, rot: rand(), color: c() }, { u: 9, v: 5, r: 8, z: 0, teeth: 9, rot: rand(), color: c() }, { u: -6, v: -5, r: 6, z: 4, teeth: 8, rot: rand(), color: c() }];
  return { gears };
}
/** Spare gears lying stacked on a spindle or side by side on the floor, oil-dark at their teeth. */
export function drawStack(g: Ink, gx: number, gy: number, s: Stack) {
  for (const k of [...s.gears].sort((p, q) => p.z - q.z || p.v - q.v)) cogFlat(g, gx + k.u, gy + k.v * SQUASH, k.r, k.teeth, k.rot, k.z, k.z + 3.2, k.color);
  const top = s.gears[s.gears.length - 1];
  if (top.z) drum(g, gx + top.u, gy + top.v * SQUASH, 1.6, top.z + 3, top.z + 9, IRON, 0x5a5450, 8);
}
export function stackShadow(g: Ink, gx: number, gy: number, s: Stack) {
  for (const k of s.gears) if (!k.z) roundShadow(g, gx + k.u, gy + k.v * SQUASH, k.r + 1, 8);
}

// ── Piston engine ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Engine { flip: boolean }
export const engineOf = (rand: Random): Engine => ({ flip: rand() < 0.5 });
/** The engine's flywheel (ground u, v, height, radius), by its facing. */
export const flywheelOf = (e: Engine) => ({ u: e.flip ? -12 : 12, v: 2, h: 13, r: 10 });
/** A twin-cylinder piston engine on an iron bed: copper cylinders, brass piston rods to a crank, a spoked flywheel. */
export function drawEngine(g: Ink, gx: number, gy: number, e: Engine) {
  const s = e.flip ? -1 : 1,
    w = flywheelOf(e);
  box(g, gx, gy, frame(0, 0, 0), -17, 17, -8, 8, 0, 4, IRON);
  for (const u of [-9 * s, -1 * s]) {
    drum(g, gx + u, gy - 3 * SQUASH, 3.6, 4, 17, COPPER, shade(COPPER, 0.15), 12);
    for (const h of [6, 15]) drum(g, gx + u, gy - 3 * SQUASH, 4, h, h + 1, BRASS, shade(BRASS, 0.2), 12);
    rod(g, gx, gy, u, -3, 17, u, -3, 22, 1.2, 0xd8d0b0);
    rod(g, gx, gy, u, -3, 22, w.u - 2 * s, w.v, w.h + 3, 1.2, BRASS);
  }
  cogUpright(g, gx, gy, w.u, w.v, w.h, w.r, 16, 0.2, DARK_BRASS, 2.4);
  // The flywheel's rim is smooth: a plain ring over the teeth.
  oval(g, X(gx, w.u), Y(gy, w.v, w.h), w.r * 0.95, w.r * 0.95, OUTLINE, 0.25);
}
export function engineShadow(g: Ink, gx: number, gy: number, e: Engine) {
  boxShadow(g, gx, gy, 0, 17, 8, 20, 0.3);
}

// ── Boiler ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Boiler { a: number }
export const boilerOf = (rand: Random): Boiler => ({ a: (rand() - 0.5) * 0.6 });
/** Where the boiler's chimney mouth and firebox door sit (screen offsets from its ground point). */
export function boilerParts(b: Boiler) {
  const c = { u: -Math.cos(b.a) * 9, v: -Math.sin(b.a) * 9 },
    near = Math.sin(b.a) >= 0 ? 15 : -15;
  return { chimney: { x: X(0, c.u), y: Y(0, c.v, 32) }, door: { x: X(0, Math.cos(b.a) * near), y: Y(0, Math.sin(b.a) * near, 7) } };
}
/** A riveted copper boiler on iron saddles: brass bands, a firebox door at the near end, a chimney, a gauge and a valve. */
export function drawBoiler(g: Ink, gx: number, gy: number, b: Boiler) {
  const a = b.a,
    near = Math.sin(a) >= 0 ? 15 : -15;
  for (const d of [-8, 8]) box(g, gx, gy, frame(a, 0, 0, Math.cos(a) * d, Math.sin(a) * d), -2, 2, -7, 7, 0, 5, IRON);
  tube(g, gx, gy, a, 11, -15, 15, 8, COPPER);
  for (const d of [-10, -2, 6, 13]) tube(g, gx, gy, a, 11, d - 0.6, d + 0.6, 8.3, BRASS, 1, false);
  endFace(g, gx, gy, a, 11, near, 8, shade(COPPER, 0.1));
  endFace(g, gx, gy, a, 11, near * 1.01, 4, IRON);
  endFace(g, gx, gy, a, 11, near * 1.02, 3, 0x3a1408);
  // Rivets along the top seam.
  for (let d = -13; d <= 13; d += 3.2) disc(g, X(gx, Math.cos(a) * d), Y(gy, Math.sin(a) * d, 19), 0.6, shade(BRASS, 0.3));
  const c = { u: -Math.cos(a) * 9, v: -Math.sin(a) * 9 };
  drum(g, gx + c.u, gy + c.v * SQUASH, 2.6, 17, 30, 0x2a2420, 0x3a3430, 10);
  drum(g, gx + c.u, gy + c.v * SQUASH, 3.4, 30, 32, 0x2a2420, 0x120e0b, 10);
  // A pressure gauge on a stalk and a red valve wheel.
  const gu = Math.cos(a) * 4,
    gv = Math.sin(a) * 4;
  rod(g, gx, gy, gu, gv, 18, gu, gv, 23, 0.8, BRASS);
  disc(g, X(gx, gu), Y(gy, gv, 25), 2.8, BRASS);
  disc(g, X(gx, gu), Y(gy, gv, 25), 2.1, 0xe8e0c8);
  g.lineStyle(0.6, 0xc83a2e);
  g.lineBetween(X(gx, gu), Y(gy, gv, 25), X(gx, gu) + 1.4, Y(gy, gv, 25) - 1);
}
export function boilerShadow(g: Ink, gx: number, gy: number, b: Boiler) {
  boxShadow(g, gx, gy, b.a, 16, 8, 20, 0.3);
  roundShadow(g, gx - Math.cos(b.a) * 9, gy - Math.sin(b.a) * 9 * SQUASH, 3, 32);
}

// ── Steam pipes ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pipes { list: { u: number; v: number; h: number; r: number }[] }
export function pipesOf(rand: Random): Pipes {
  const n = 4 + Math.floor(rand() * 3);
  return { list: Array.from({ length: n }, (_, i) => ({ u: -12 + (i * 24) / (n - 1) + (rand() - 0.5) * 2, v: (i % 2) * 5 - 3 + (rand() - 0.5) * 2, h: 14 + rand() * 20, r: 2.2 + rand() * 1.2 })).sort((p, q) => p.v - q.v) };
}
/** The tops of the steam pipes (screen offsets), where the steam puffs. */
export const pipeTops = (p: Pipes) => p.list.map((q) => ({ x: X(0, q.u), y: Y(0, q.v, q.h + 2), r: q.r }));
/** A bank of copper steam pipes rising from a manifold, each with a flared brass mouth, joined by a cross pipe. */
export function drawPipes(g: Ink, gx: number, gy: number, p: Pipes) {
  box(g, gx, gy, frame(0, 0, 0), -15, 15, -6, 6, 0, 4, IRON);
  for (const q of p.list) {
    const x = gx + q.u,
      y = gy + q.v * SQUASH;
    drum(g, x, y, q.r, 4, q.h, COPPER, shade(COPPER, 0.1), 10);
    drum(g, x, y, q.r + 0.8, q.h * 0.55, q.h * 0.55 + 1, BRASS, BRASS, 10);
    drum(g, x, y, q.r + 1.2, q.h, q.h + 2, BRASS, 0x1a1008, 10);
  }
  rod(g, gx, gy, -13, 4, 10, 13, 4, 10, 1.6, shade(COPPER, -0.1));
}
export function pipesShadow(g: Ink, gx: number, gy: number, p: Pipes) {
  for (const q of p.list) roundShadow(g, gx + q.u, gy + q.v * SQUASH, q.r + 1, q.h, 0.24);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The clock face of the tower (centre height, radius, at full size), on its front. */
export const CLOCK = { h: 56, r: 11, v: 13 } as const;
/**
 * A clock tower: a stone base, a brick shaft with brass corner trims, a great clock face on its front with brass
 * numerals, a gallery under a copper roof gone green, and a spire with a weather vane.
 */
export function drawClockTower(g: Ink) {
  const f = frame(0, 0, 0);
  box(g, 0, 0, f, -18, 18, -16, 16, 0, 6, 0x6a6258);
  box(g, 0, 0, f, -13, 13, -12, 12, 6, 70, 0x7a4a32);
  for (let h = 10; h < 70; h += 6) {
    project(0, 0, f, -13, 12.05, h, 0);
    project(0, 0, f, 13, 12.05, h, 1);
    g.lineStyle(0.5, 0x4a2a1c, 0.7);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  for (const u of [-13, 13]) rod(g, 0, 0, u, 12.5, 6, u, 12.5, 70, 1.6, BRASS);
  // The clock face.
  const cx = 0,
    cy = Y(0, CLOCK.v, CLOCK.h);
  disc(g, cx, cy, CLOCK.r + 1.6, OUTLINE);
  disc(g, cx, cy, CLOCK.r + 1, BRASS);
  disc(g, cx, cy, CLOCK.r, 0xf0e4c0);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    disc(g, cx + Math.cos(t) * CLOCK.r * 0.82, cy + Math.sin(t) * CLOCK.r * 0.82, i % 3 ? 0.6 : 1.1, 0x3a2a14);
  }
  g.lineStyle(1.4, 0x2a1d0c);
  g.lineBetween(cx, cy, cx + CLOCK.r * 0.45, cy - CLOCK.r * 0.3);
  g.lineStyle(1, 0x2a1d0c);
  g.lineBetween(cx, cy, cx - CLOCK.r * 0.1, cy - CLOCK.r * 0.75);
  disc(g, cx, cy, 1.2, BRASS);
  // Gallery, roof and spire.
  box(g, 0, 0, f, -16, 16, -15, 15, 70, 73, 0x4a4038);
  for (let u = -15; u <= 15; u += 3) rod(g, 0, 0, u, 15, 73, u, 15, 77, 0.6, BRASS);
  const roof = [{ x: X(0, -15), y: Y(0, 15, 74) }, { x: X(0, 15), y: Y(0, 15, 74) }, { x: X(0, 0), y: Y(0, 0, 98) }];
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints([{ x: X(0, -16), y: Y(0, 16, 73) }, { x: X(0, 16), y: Y(0, 16, 73) }, { x: X(0, 16), y: Y(0, -16, 73) }, { x: 0, y: Y(0, 0, 99) }, { x: X(0, -16), y: Y(0, -16, 73) }], true);
  g.fillStyle(0x3a8a74);
  g.fillPoints([{ x: X(0, 15), y: Y(0, 15, 74) }, { x: X(0, 15), y: Y(0, -15, 74) }, { x: 0, y: Y(0, 0, 98) }], true);
  g.fillStyle(0x5aaa8e);
  g.fillPoints(roof, true);
  g.fillStyle(0x6ac0a0);
  g.fillPoints([{ x: X(0, -15), y: Y(0, 15, 74) }, { x: X(0, -15), y: Y(0, -15, 74) }, { x: 0, y: Y(0, 0, 98) }], true);
  rod(g, 0, 0, 0, 0, 98, 0, 0, 108, 0.9, BRASS);
  g.fillStyle(BRASS);
  g.fillTriangle(0, Y(0, 0, 106), 7, Y(0, 0, 105), 0, Y(0, 0, 103));
}
export function clockTowerShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 18, 16, 70, 0.3);
}
/** The escapement's wheel (centre height, radius) and its pendulum pivot (at full size). */
export const ESCAPE = { h: 34, r: 26, pivot: 64 } as const;
/**
 * A great escapement: a huge brass escape wheel with hooked teeth standing between two iron pillars on a stepped
 * plinth, an anchor across its top and a long pendulum hanging in front; the pendulum swings in the ambient.
 */
export function drawEscapement(g: Ink) {
  const f = frame(0, 0, 0);
  box(g, 0, 0, f, -34, 34, -16, 16, 0, 4, 0x5a5248);
  box(g, 0, 0, f, -28, 28, -12, 12, 4, 8, 0x6a6258);
  for (const u of [-30, 30]) {
    box(g, 0, 0, frame(0, 0, 0, u, -4), -3, 3, -3, 3, 8, ESCAPE.pivot + 4, IRON);
    drum(g, X(0, u), Y(0, -4, 0), 3.4, ESCAPE.pivot + 4, ESCAPE.pivot + 7, BRASS, shade(BRASS, 0.2), 10);
  }
  box(g, 0, 0, frame(0, 0, ESCAPE.pivot), -32, 32, -6, -2, 0, 4, IRON);
  cogUpright(g, 0, 0, 0, -4, ESCAPE.h, ESCAPE.r, 18, 0.13, BRASS, 4);
  // The anchor over the wheel's top: two arms with pallets.
  rod(g, 0, 0, 0, -1, ESCAPE.pivot - 1, -14, -1, ESCAPE.h + ESCAPE.r - 2, 2.4, DARK_BRASS);
  rod(g, 0, 0, 0, -1, ESCAPE.pivot - 1, 14, -1, ESCAPE.h + ESCAPE.r - 2, 2.4, DARK_BRASS);
  disc(g, 0, Y(0, -1, ESCAPE.pivot - 1), 3, BRASS);
}
export function escapementShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 34, 16, 30, 0.3);
}
/** The pendulum at angle `swing` (radians) from its pivot, hanging in front of the wheel. */
export function pendulum(g: Ink, x: number, y0: number, k: number, swing: number) {
  const px = x,
    py = Y(y0, 6 * k, (ESCAPE.pivot - 1) * k),
    len = 50 * k,
    bx = px + Math.sin(swing) * len,
    by = py + Math.cos(swing) * len * 0.85;
  g.lineStyle(1.6 * k, OUTLINE);
  g.lineBetween(px, py, bx, by);
  g.lineStyle(1 * k, BRASS);
  g.lineBetween(px, py, bx, by);
  disc(g, bx, by, 6 * k, OUTLINE);
  disc(g, bx, by, 5.2 * k, BRASS);
  disc(g, bx - 1.6 * k, by - 1.6 * k, 2 * k, 0xf0d488);
  disc(g, px, py, 2 * k, BRASS);
}
