import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, quad } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Storm Plateau (`storm.ts`), a basalt plateau under a thunderstorm, drawn in the towers' 3/4 tilt:
// basalt needles, lightning rods, wind turbines, storm shelters, rain-slick boulders and leaning power poles; a tesla
// tower and a weather observatory as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up
// front into a plain record; strikes, turning blades, lamps and sparks live in the theme's ambient.

export const SHADE = 0x02040a;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const BOLT = 0xcfeaff;
const BASALT = 0x2a3448,
  STEEL = 0x6a7a90,
  COPPER = 0xc88a4a,
  CONCRETE = 0x4a5466;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A rain puddle at the foot of a prop, catching a pale streak of sky (drawn in the shadow pass). */
export function puddle(g: Ink, x: number, y: number, r: number) {
  oval(g, x, y, r, r * 0.42, 0x0a1220, 0.9);
  g.lineStyle(0.8, 0x7ab8e0, 0.4);
  g.lineBetween(x - r * 0.45, y - r * 0.08, x + r * 0.15, y - r * 0.12);
}

// ── Basalt needles ──────────────────────────────────────────────────────────────────────────────────────────────────
export function needlesOf(rand: Random): Crystal[] {
  const n = 2 + Math.floor(rand() * 3);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(),
      d = i ? 6 + rand() * 6 : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: rand() * 0.25, len: (i ? 14 : 24) + rand() * 12, r: (i ? 3.6 : 5) + rand() * 1.4, color: shade(BASALT, (rand() - 0.3) * 0.25), core: false };
  }).sort((p, q) => p.v - q.v);
}
/** Jagged basalt needles: dark hexagonal prisms with wet, blue-lit faces, splintered off the plateau. */
export function drawNeedles(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystal(g, gx, gy, c);
}
export function needlesShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  puddle(g, gx + 8, gy + 5, 9);
  for (const c of list) crystalShadow(g, gx, gy, c);
}

// ── Lightning rod ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a lightning rod's tip. */
export const ROD_TIP = 46;
/** A lightning rod: a stepped concrete footing, a guyed steel mast with a copper spike and a corona ring. */
export function drawRod(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0, 0, 0), -8, 8, -8, 8, 0, 3, CONCRETE);
  box(g, gx, gy, frame(0, 0, 0), -5, 5, -5, 5, 3, 6, shade(CONCRETE, 0.08));
  for (const a of [0.7, 2.4, 4.0, 5.6]) rod(g, gx, gy, Math.cos(a) * 11, Math.sin(a) * 11, 0, 0, 0, 30, 0.5, 0x8a96a8);
  drum(g, gx, gy, 1.8, 6, ROD_TIP - 8, STEEL, shade(STEEL, 0.15), 8);
  drum(g, gx, gy, 4.2, ROD_TIP - 10, ROD_TIP - 8.5, 0x3a4458, 0x8a96a8, 12);
  rod(g, gx, gy, 0, 0, ROD_TIP - 8, 0, 0, ROD_TIP, 1.4, COPPER);
  disc(g, gx, Y(gy, 0, ROD_TIP), 1.2, 0xffd8a0);
}
export function rodShadow(g: Ink, gx: number, gy: number) {
  boxShadow(g, gx, gy, 0, 8, 8, 6, 0.3);
  g.lineStyle(1.6, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + ROD_TIP * SUN.x, gy + ROD_TIP * SUN.y);
}

// ── Wind turbine ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The turbine's hub height; its blades turn in the ambient. */
export const HUB = 40;
/** A storm turbine: a tapered white mast on a footing and a nacelle facing the wind; the blades are drawn by `blades`. */
export function drawTurbine(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0, 0, 0), -6, 6, -6, 6, 0, 3, CONCRETE);
  for (let i = 0; i < 6; i++) {
    const h0 = 3 + i * 6,
      r = 2.8 - i * 0.25;
    drum(g, gx, gy, r, h0, Math.min(HUB - 2, h0 + 6.2), 0xc8d0dc, 0xd8e0e8, 10);
  }
  box(g, gx, gy, frame(0, 0, HUB - 3), -6, 3, -2.4, 2.4, 0, 5, 0xc8d0dc);
  disc(g, X(gx, 4), Y(gy, 0, HUB), 2.4, OUTLINE);
  disc(g, X(gx, 4), Y(gy, 0, HUB), 1.8, 0x8a96a8);
}
/** The turbine's three blades turning at angle `t` in the plane facing the viewer, plus its red tip lamp. */
export function blades(g: Ink, gx: number, gy: number, t: number) {
  const hx = X(gx, 4.5),
    hy = Y(gy, 0, HUB);
  for (let i = 0; i < 3; i++) {
    const a = t + (i / 3) * Math.PI * 2,
      ex = hx + Math.cos(a) * 20,
      ey = hy + Math.sin(a) * 20,
      nx = -Math.sin(a) * 1.6,
      ny = Math.cos(a) * 1.6;
    g.fillStyle(OUTLINE, 0.8);
    g.fillTriangle(hx + nx * 1.4, hy + ny * 1.4, hx - nx * 1.4, hy - ny * 1.4, ex, ey);
    g.fillStyle(0xe0e6ee);
    g.fillTriangle(hx + nx, hy + ny, hx - nx * 0.6, hy - ny * 0.6, ex, ey);
  }
  disc(g, hx, hy, 1.6, 0x8a96a8);
}
export function turbineShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(2.4, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + HUB * SUN.x, gy + HUB * SUN.y);
  oval(g, gx + HUB * SUN.x + 4, gy + HUB * SUN.y, 14, 5, SHADE, 0.14);
}

// ── Storm shelter ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the shelter's door lamp hangs (screen offset from the ground point). */
export const SHELTER_LAMP = { x: 5, y: Y(0, 12, 10) } as const;
/** A storm shelter: a low concrete half-dome sunk in the rock, a steel door with a lamp over it and a vent on top. */
export function drawShelter(g: Ink, gx: number, gy: number) {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      r = 14 * Math.cos(((t0 + t1) / 2) * Math.PI * 0.5),
      h0 = 13 * Math.sin(t0 * Math.PI * 0.5),
      h1 = 13 * Math.sin(t1 * Math.PI * 0.5) + 0.5;
    drum(g, gx, gy, r, h0, h1, shade(CONCRETE, -0.04 * (i % 2)), shade(CONCRETE, 0.15), 16);
  }
  // The door: a dark recess with a steel frame on the front.
  const f = frame(0, 0, 0);
  box(g, gx, gy, f, -5, 5, 8, 14, 0, 10, shade(CONCRETE, 0.05));
  project(gx, gy, f, -3.4, 14.05, 0, 0);
  project(gx, gy, f, 3.4, 14.05, 0, 1);
  project(gx, gy, f, 3.4, 14.05, 8, 2);
  project(gx, gy, f, -3.4, 14.05, 8, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x3a4458);
  g.lineStyle(0.8, 0xc8a238, 0.8);
  g.lineBetween(SX[0], SY[0], SX[2], SY[2]);
  drum(g, gx - 5, gy - 2, 1.6, 12, 17, 0x5a6478, 0x2a3040, 8);
}
export function shelterShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 15, 12);
}

// ── Wet boulders ────────────────────────────────────────────────────────────────────────────────────────────────────
const BF = new Float64Array(16),
  BI = new Float64Array(16);
export interface Boulders { list: { u: number; v: number; r: number; seed: number }[] }
export function bouldersOf(rand: Random): Boulders {
  const n = rand() < 0.5 ? 2 : 3,
    spots = n === 2 ? [[-6, -3], [8, 4]] : [[-9, -4], [8, -4], [1, 6]];
  return { list: spots.map(([u, v]) => ({ u, v, r: 6 + rand() * 6, seed: Math.floor(rand() * 1e6) })).sort((p, q) => p.v - q.v) };
}
/** Basalt boulders slick with rain: dark blocks with a cold sheen along their lit edges. */
export function drawBoulders(g: Ink, gx: number, gy: number, b: Boulders) {
  for (const s of b.list) {
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2 + hash01(s.seed) * 2,
        k = 0.75 + hash01(s.seed, i) * 0.25;
      BF[2 * i] = Math.cos(t) * s.r * k;
      BF[2 * i + 1] = Math.sin(t) * s.r * k;
      BI[2 * i] = BF[2 * i] * 0.62;
      BI[2 * i + 1] = BF[2 * i + 1] * 0.62;
    }
    block(g, gx + s.u, gy + s.v * SQUASH, BF, BI, 6, 0, s.r * 0.6, s.r * 0.4, 0x1e2636, 0x34405a, 0x9ac8f0);
  }
}
export function bouldersShadow(g: Ink, gx: number, gy: number, b: Boulders) {
  puddle(g, gx + 6, gy + 6, 12);
  for (const s of b.list) roundShadow(g, gx + s.u, gy + s.v * SQUASH, s.r + 1, s.r);
}

// ── Power pole ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pole { lean: number; wire: number }
export const poleOf = (rand: Random): Pole => ({ lean: (rand() - 0.5) * 0.5, wire: rand() < 0.5 ? -1 : 1 });
/** Where the snapped wire's live end hangs (ground u, v, height), for its sparks. */
export const wireEnd = (p: Pole) => ({ u: p.lean * 34 + p.wire * 14, v: 4, h: 6 });
/** A timber power pole leaning in the gale: a crossarm with glass insulators and one snapped wire hanging to the ground. */
export function drawPole(g: Ink, gx: number, gy: number, p: Pole) {
  const tu = p.lean * 34;
  rod(g, gx, gy, 0, 0, 0, tu, 0, 36, 2.6, 0x4a3a2a);
  rod(g, gx, gy, tu - 11, 0, 31, tu + 11, 0, 31, 1.6, 0x4a3a2a);
  for (const d of [-9, 0, 9]) disc(g, X(gx, tu + d), Y(gy, 0, 33), 1.3, 0x7ab8a0);
  const end = wireEnd(p);
  g.lineStyle(0.8, 0x1a1e24, 0.9);
  g.strokePoints([0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: X(gx, tu + p.wire * 9 + (end.u - tu - p.wire * 9) * t), y: Y(gy, end.v * t, 31 - (31 - end.h) * Math.sqrt(t)) })), false);
}
export function poleShadow(g: Ink, gx: number, gy: number, p: Pole) {
  g.lineStyle(2, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + p.lean * 34 + 36 * SUN.x, gy + 36 * SUN.y);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The tesla tower's toroid (height and radius at full size). */
export const TESLA = { h: 64, r: 14 } as const;
/** A tesla tower: a stepped plinth, a tall coil wound in copper on a lattice, and a polished toroid crowning it. */
export function drawTesla(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -24, 24, -20, 20, 0, 4, CONCRETE);
  box(g, 0, 0, frame(0, 0, 0), -17, 17, -14, 14, 4, 9, shade(CONCRETE, 0.08));
  for (const [u, v] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) rod(g, 0, 0, u, v, 9, u * 0.35, v * 0.35, 48, 1.4, STEEL);
  drum(g, 0, 0, 6, 9, 54, 0x8a5a2a, 0xa86a34, 14);
  for (let h = 12; h < 52; h += 2.2) drum(g, 0, 0, 6.3, h, h + 1, COPPER, shade(COPPER, 0.2), 14);
  drum(g, 0, 0, 3, 54, TESLA.h - 4, STEEL, shade(STEEL, 0.2), 10);
  // The toroid: two stacked ovals with a lit top.
  oval(g, 0, Y(0, 0, TESLA.h), TESLA.r + 0.8, (TESLA.r + 0.8) * SQUASH + 3, OUTLINE, 0.9);
  oval(g, 0, Y(0, 0, TESLA.h) + 1, TESLA.r, TESLA.r * SQUASH + 2, 0x6a7a90);
  oval(g, 0, Y(0, 0, TESLA.h) - 1, TESLA.r - 1, (TESLA.r - 1) * SQUASH, 0xb8c8d8);
  oval(g, 0, Y(0, 0, TESLA.h) - 1, TESLA.r * 0.45, TESLA.r * 0.45 * SQUASH, 0x3a4458);
  oval(g, -TESLA.r * 0.5, Y(0, 0, TESLA.h) - 2, 3, 1.2, 0xffffff, 0.8);
}
export function teslaShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 24, 20, 8, 0.28);
  g.lineStyle(9, SHADE, 0.16);
  g.lineBetween(0, 0, TESLA.h * SUN.x, TESLA.h * SUN.y);
}
/** The observatory's windsock and lit window (heights at full size). */
export const OBSERVATORY = { sock: 56, window: 14 } as const;
/** A weather observatory: a squat round blockhouse with a slit window, a radar dome on top and a mast with a windsock. */
export function drawObservatory(g: Ink) {
  drum(g, 0, 0, 26, 0, 4, CONCRETE, shade(CONCRETE, 0.1), 20);
  drum(g, 0, 0, 20, 4, 24, shade(CONCRETE, 0.04), shade(CONCRETE, 0.16), 20);
  // The radar dome: one smooth shell lit from the upper left.
  const eq = Y(0, 0, 24),
    R = 14,
    top = 13,
    arc = (rx: number, ry: number, cx: number, cy: number, a0: number, a1: number) =>
      Array.from({ length: 25 }, (_, i) => {
        const t = a0 + ((a1 - a0) * i) / 24;
        return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
      });
  g.fillStyle(OUTLINE, 0.8);
  g.fillPoints([...arc(R + 0.8, top + 0.8, 0, eq, Math.PI, Math.PI * 2), ...arc(R + 0.8, R * SQUASH, 0, eq, 0, Math.PI)], true);
  g.fillStyle(0xa8b4c0);
  g.fillPoints([...arc(R, top, 0, eq, Math.PI, Math.PI * 2), ...arc(R, R * SQUASH, 0, eq, 0, Math.PI)], true);
  g.fillStyle(0xc8d2dc);
  g.fillPoints(arc(R * 0.82, top * 0.85, -R * 0.12, eq - top * 0.1, 0, Math.PI * 2), true);
  g.fillStyle(0xe8eef4);
  g.fillPoints(arc(R * 0.42, top * 0.42, -R * 0.32, eq - top * 0.45, 0, Math.PI * 2), true);
  // The slit window round the front.
  g.lineStyle(2.4, 0x0a1220);
  g.strokePoints(Array.from({ length: 9 }, (_, i) => {
    const t = Math.PI * (0.15 + i * 0.0875);
    return { x: X(0, Math.cos(t) * 20.1), y: Y(0, Math.sin(t) * 20.1, OBSERVATORY.window) };
  }), false);
  rod(g, 0, 0, -16, -12, 24, -16, -12, OBSERVATORY.sock + 4, 1, 0x8a96a8);
  g.fillStyle(0xe0603a);
  g.fillTriangle(X(0, -16), Y(0, -12, OBSERVATORY.sock + 4), X(0, -16), Y(0, -12, OBSERVATORY.sock), X(0, -4), Y(0, -12, OBSERVATORY.sock + 1.5));
}
export function observatoryShadow(g: Ink) {
  roundShadow(g, 2, 2, 26, 30);
}
