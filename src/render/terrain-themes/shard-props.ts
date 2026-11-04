import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block } from "../tower-art/tilt";
import { box, frame, lit, rod, seen } from "../tower-art/tilt-frame";
import type { Random } from "./kit";

// The props of Shard Field (`shard.ts`), an alien crystal field, drawn in the towers' 3/4 tilt: hexagonal crystal
// prisms in clusters on rock, cracked geodes, floating shards, sensor tripods and resonance pylons; the crystal
// monolith and the split geode as landmarks; spires and a crystal fringe for the crystal sea. Every prop stands on a
// ground point (gx, gy) in pixels and is rolled up front into a plain record.

/** Shadow colour on the violet ground. */
export const SHADE = 0x05030a;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const CRYSTAL_COLORS = [0x9d8cff, 0xb8a6ff, 0x7fd8ff, 0xf0a6d8, 0xc8bcff] as const;
const ROCK = { wall: 0x2e2840, top: 0x463e5e } as const;

// ── Crystal prism ───────────────────────────────────────────────────────────────────────────────────────────────────
/** One crystal: base offset, the ground direction it leans to and how far (0 upright), length, radius and colour. */
export interface Crystal { u: number; v: number; a: number; lean: number; len: number; r: number; color: number; z?: number }
type Vec = [number, number, number];
const add = (p: Vec, q: Vec, k = 1): Vec => [p[0] + q[0] * k, p[1] + q[1] * k, p[2] + q[2] * k];
/**
 * A hexagonal crystal prism with a pointed tip, standing at (u, v) and leaning towards `a` by `lean` radians: every
 * side and tip face turned to the viewer is filled and lit by its normal, with a bright edge where faces meet in the
 * light and a pale core line up the middle.
 */
export function crystal(g: Ink, gx: number, gy: number, c: Crystal) {
  const p = Math.PI / 2 - c.lean,
    ca = Math.cos(c.a),
    sa = Math.sin(c.a),
    D: Vec = [ca * Math.cos(p), sa * Math.cos(p), Math.sin(p)],
    E: Vec = [-sa, ca, 0],
    N: Vec = [-ca * Math.sin(p), -sa * Math.sin(p), Math.cos(p)],
    base: Vec = [c.u, c.v, c.z ?? 0],
    tip = c.r * 1.6,
    at = (d: number, t: number, r = c.r): Vec => add(add(add(base, D, d), E, Math.cos(t) * r), N, Math.sin(t) * r),
    screen = (q: Vec) => ({ x: X(gx, q[0]), y: Y(gy, q[1], q[2]) }),
    apex = screen(add(base, D, c.len + tip)),
    faces: { pts: { x: number; y: number }[]; tone: number; depth: number }[] = [];
  for (let k = 0; k < 6; k++) {
    const t0 = (k / 6) * Math.PI * 2 + 0.3,
      t1 = t0 + Math.PI / 3,
      tm = (t0 + t1) / 2,
      n: Vec = [E[0] * Math.cos(tm) + N[0] * Math.sin(tm), E[1] * Math.cos(tm) + N[1] * Math.sin(tm), E[2] * Math.cos(tm) + N[2] * Math.sin(tm)];
    if (seen(n[1], n[2]) > 0.01)
      faces.push({ pts: [screen(at(0, t0)), screen(at(0, t1)), screen(at(c.len, t1)), screen(at(c.len, t0))], tone: shade(c.color, -0.35 + 0.45 * lit(n[0], n[1], n[2])), depth: 0 });
    // The tip face over this side: its normal tilts towards the axis.
    const tn: Vec = [n[0] * 0.75 + D[0] * 0.66, n[1] * 0.75 + D[1] * 0.66, n[2] * 0.75 + D[2] * 0.66];
    if (seen(tn[1], tn[2]) > 0.01) faces.push({ pts: [screen(at(c.len, t0)), screen(at(c.len, t1)), apex], tone: shade(c.color, -0.25 + 0.5 * lit(tn[0], tn[1], tn[2])), depth: 1 });
  }
  // Outline round the whole crystal, then the faces, sides before the tip.
  g.fillStyle(OUTLINE, 0.6);
  for (const f of faces) g.fillPoints(f.pts.map((q) => ({ x: q.x + (q.x - apex.x) * 0.02, y: q.y + 0.7 })), true);
  for (const f of faces.sort((a, b) => a.depth - b.depth)) {
    g.fillStyle(f.tone);
    g.fillPoints(f.pts, true);
    g.lineStyle(0.6, shade(f.tone, 0.35), 0.8);
    g.lineBetween(f.pts[0].x, f.pts[0].y, f.pts[f.pts.length - 1].x, f.pts[f.pts.length - 1].y);
  }
  const foot = screen(add(base, D, c.r * 0.5));
  g.lineStyle(Math.max(0.8, c.r * 0.35), 0xffffff, 0.28);
  g.lineBetween(foot.x, foot.y, apex.x, apex.y);
}
/** A crystal's shadow: a long wedge thrown to the lower right from its foot. */
export function crystalShadow(g: Ink, gx: number, gy: number, c: Crystal) {
  const h = (c.len + c.r * 1.6) * Math.cos(c.lean),
    reach = (c.len + c.r * 1.6) * Math.sin(c.lean),
    x0 = X(gx, c.u),
    y0 = Y(gy, c.v, 0),
    x1 = x0 + Math.cos(c.a) * reach + h * SUN.x,
    y1 = y0 + Math.sin(c.a) * reach * SQUASH + h * SUN.y;
  g.fillStyle(SHADE, 0.22);
  g.fillTriangle(x0 - c.r, y0, x0 + c.r, y0 + 1, x1, y1);
}

// ── Crystal cluster ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cluster { crystals: Crystal[]; rock: number[] }
/** A cluster: one tall crystal near the middle, smaller ones round it leaning outwards, all of one or two colours. */
export function clusterOf(rand: Random, size = 1): Cluster {
  const main = CRYSTAL_COLORS[Math.floor(rand() * CRYSTAL_COLORS.length)],
    second = rand() < 0.35 ? CRYSTAL_COLORS[Math.floor(rand() * CRYSTAL_COLORS.length)] : main,
    crystals: Crystal[] = [{ u: (rand() - 0.5) * 4, v: (rand() - 0.5) * 3, a: rand() * Math.PI * 2, lean: rand() * 0.25, len: (22 + rand() * 12) * size, r: (4.6 + rand() * 1.2) * size, color: main }],
    n = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6,
      d = (7 + rand() * 6) * size;
    crystals.push({ u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: 0.35 + rand() * 0.45, len: (7 + rand() * 12) * size, r: (2.4 + rand() * 1.8) * size, color: i % 3 === 2 ? second : main });
  }
  return { crystals: crystals.sort((p, q) => p.v - q.v), rock: Array.from({ length: 6 }, () => 0.8 + rand() * 0.2) };
}
/** Scratch footprints for rock blocks. */
const F = new Float64Array(16),
  I = new Float64Array(16);
function rockBase(g: Ink, gx: number, gy: number, radii: number[], r: number, h: number) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.2;
    F[2 * i] = Math.cos(t) * r * radii[i];
    F[2 * i + 1] = Math.sin(t) * r * radii[i];
    I[2 * i] = F[2 * i] * 0.65;
    I[2 * i + 1] = F[2 * i + 1] * 0.65;
  }
  block(g, gx, gy, F, I, 6, 0, h * 0.5, h * 0.5, ROCK.wall, ROCK.top, shade(ROCK.top, 0.3));
}
export function drawCluster(g: Ink, gx: number, gy: number, c: Cluster) {
  rockBase(g, gx, gy, c.rock, 14, 6);
  for (const k of c.crystals) crystal(g, gx, gy - 3, k);
}
export function clusterShadow(g: Ink, gx: number, gy: number, c: Cluster) {
  oval(g, gx + 4, gy + 3, 16, 8, SHADE, 0.2);
  for (const k of c.crystals) crystalShadow(g, gx, gy, k);
}

// ── Geode rock ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Geode { radii: number[]; color: number; r: number }
export const geodeOf = (rand: Random): Geode => ({ radii: Array.from({ length: 6 }, () => 0.82 + rand() * 0.18), color: CRYSTAL_COLORS[Math.floor(rand() * 3)], r: 14 + rand() * 3 });
/** A boulder cracked open on top: a dark rind, a pale band of agate, and a hollow lined with tiny crystal points. */
export function drawGeode(g: Ink, gx: number, gy: number, q: Geode) {
  rockBase(g, gx, gy, q.radii, q.r, 14);
  const cy = Y(gy, 0, 14.5),
    rx = q.r * 0.62,
    ry = q.r * 0.62 * SQUASH;
  oval(g, gx, cy, rx + 1.6, ry + 1.2, 0xd8d0e8);
  oval(g, gx, cy, rx, ry, shade(q.color, -0.6));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2,
      x = gx + Math.cos(a) * rx * 0.8,
      y = cy + Math.sin(a) * ry * 0.8,
      tx = gx + Math.cos(a) * rx * 0.35,
      ty = cy + Math.sin(a) * ry * 0.35 - 2;
    g.fillStyle(shade(q.color, Math.sin(a) > 0 ? -0.1 : 0.25));
    g.fillTriangle(x - 1.4, y, x + 1.4, y, tx, ty);
  }
  disc(g, gx, cy, 2, shade(q.color, 0.4));
}
export function geodeShadow(g: Ink, gx: number, gy: number, q: Geode) {
  for (const k of [0.5, 1]) oval(g, gx + 8 * k, gy + 5 * k, q.r + 2, (q.r + 2) * SQUASH, SHADE, 0.12);
}

// ── Floating shard ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Height a floating shard hovers at, in px. */
export const HOVER = 20;
/** A double-pointed shard hovering over the ground: a crystal tip above, a faceted point below, its shadow far down. */
export function drawFloater(g: Ink, gx: number, gy: number, color: number, a: number) {
  const ring = Array.from({ length: 6 }, (_, k) => (k / 6) * Math.PI * 2 + a),
    point = (t: number) => ({ x: X(gx, Math.cos(t) * 5), y: Y(gy, Math.sin(t) * 5, HOVER) }),
    bottom = { x: gx, y: Y(gy, 0, HOVER - 10) };
  // The lower point: its faces on the near half, darker than the tip, under the upper crystal.
  for (let k = 0; k < 6; k++) {
    const t0 = ring[k],
      t1 = ring[(k + 1) % 6],
      tm = (t0 + t1) / 2;
    if (Math.sin(tm) <= 0) continue;
    const p0 = point(t0),
      p1 = point(t1);
    g.fillStyle(OUTLINE, 0.6);
    g.fillTriangle(p0.x, p0.y + 0.6, p1.x, p1.y + 0.6, bottom.x, bottom.y + 0.8);
    g.fillStyle(shade(color, -0.45 + 0.3 * lit(Math.cos(tm), Math.sin(tm), -0.6)));
    g.fillTriangle(p0.x, p0.y, p1.x, p1.y, bottom.x, bottom.y);
  }
  crystal(g, gx, gy, { u: 0, v: 0, a, lean: 0, len: 0.5, r: 5, color, z: HOVER });
}
export function floaterShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 3, gy + 2, 7, 3.2, SHADE, 0.25);
}

// ── Sensor tripod ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the sensor's lamp sits (screen offset from its ground point). */
export const SENSOR_LAMP = { x: 0, y: -27 } as const;
/** A survey sensor: three splayed legs, a sensor head with a lens turned to `a` and a whip antenna. */
export function drawSensor(g: Ink, gx: number, gy: number, a: number) {
  for (let i = 0; i < 3; i++) {
    const t = a + (i / 3) * Math.PI * 2 + 0.5;
    rod(g, gx, gy, Math.cos(t) * 10, Math.sin(t) * 10, 0, 0, 0, 18, 1.2, 0x8a90a0);
  }
  box(g, gx, gy, frame(a, 0, 18), -4, 4, -3, 3, 0, 5, 0xc8ccd8);
  const lx = Math.cos(a) * 4.5,
    ly = Math.sin(a) * 4.5;
  disc(g, X(gx, lx), Y(gy, ly, 20.5), 1.8, 0x1a2030);
  disc(g, X(gx, lx) - 0.5, Y(gy, ly, 21), 0.7, 0x7fd8ff);
  rod(g, gx, gy, -1, -1, 23, -1, -1, 27, 0.5, 0xc8ccd8);
}
export function sensorShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(1, SHADE, 0.2);
  for (let i = 0; i < 3; i++) g.lineBetween(gx + Math.cos(i * 2.1) * 10, gy + Math.sin(i * 2.1) * 10 * SQUASH, gx + 9, gy + 6);
  oval(g, gx + 10, gy + 6, 6, 3, SHADE, 0.2);
}

// ── Resonance pylon ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the pylon's crystal centre in px. */
export const PYLON_CORE = 18;
/** A resonance pylon: a steel base and two posts holding a vertical crystal between clamps, cables trailing off. */
export function drawPylon(g: Ink, gx: number, gy: number, a: number, color: number) {
  box(g, gx, gy, frame(a, 0, 0), -9, 9, -6, 6, 0, 4, 0x3a3650);
  const across = (k: number) => ({ u: Math.cos(a) * k, v: Math.sin(a) * k });
  const left = across(-7),
    right = across(7);
  rod(g, gx, gy, left.u, left.v, 4, left.u, left.v, 32, 2, 0x6a6a80);
  crystal(g, gx, gy, { u: 0, v: 0, a, lean: 0, len: 22, r: 4, color, z: 6 });
  rod(g, gx, gy, right.u, right.v, 4, right.u, right.v, 32, 2, 0x6a6a80);
  rod(g, gx, gy, left.u, left.v, 30, right.u, right.v, 30, 1.6, 0x6a6a80);
  g.lineStyle(1.2, 0x1a1a24, 0.9);
  g.strokePoints([{ x: X(gx, left.u), y: Y(gy, left.v, 4) }, { x: gx - 10, y: gy + 8 }, { x: gx - 16, y: gy + 6 }], false);
}
export function pylonShadow(g: Ink, gx: number, gy: number) {
  g.fillStyle(SHADE, 0.2);
  g.fillPoints([{ x: gx - 9, y: gy }, { x: gx + 9, y: gy - 2 }, { x: gx + 26, y: gy + 14 }, { x: gx + 10, y: gy + 16 }], true);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The monolith's core height (screen offset at full size). */
export const MONOLITH_CORE = 46;
/** A giant crystal monolith: a towering hexagonal spire on a terraced rock base, with smaller spires round its foot. */
export function drawMonolith(g: Ink, color: number) {
  const radii = [0.92, 1, 0.88, 0.95, 1, 0.9];
  rockBase(g, 0, 8, radii, 34, 10);
  rockBase(g, 0, 2, radii.slice().reverse(), 24, 8);
  for (const k of [
    { u: -20, v: -6, a: Math.PI * 1.1, lean: 0.4, len: 20, r: 5 },
    { u: 18, v: -8, a: -0.2, lean: 0.45, len: 24, r: 5.5 },
  ])
    crystal(g, 0, 0, { ...k, color: shade(color, -0.1), z: 6 });
  crystal(g, 0, 0, { u: 0, v: 0, a: 0.4, lean: 0.06, len: 70, r: 11, color, z: 8 });
  for (const k of [
    { u: -16, v: 12, a: Math.PI * 0.8, lean: 0.55, len: 16, r: 4.5 },
    { u: 20, v: 10, a: 0.5, lean: 0.5, len: 18, r: 4.5 },
    { u: 2, v: 18, a: Math.PI / 2, lean: 0.6, len: 12, r: 3.5 },
  ])
    crystal(g, 0, 0, { ...k, color, z: 6 });
}
export function monolithShadow(g: Ink) {
  g.fillStyle(SHADE, 0.2);
  g.fillPoints([{ x: -14, y: 6 }, { x: 14, y: 0 }, { x: 52, y: 32 }, { x: 34, y: 40 }], true);
  oval(g, 6, 10, 38, 18, SHADE, 0.14);
}
/** A giant geode cracked open: a great boulder whose top is a hollow lined with crystal, a cluster bursting out of it. */
export function drawSplitGeode(g: Ink, color: number) {
  rockBase(g, 0, 6, [0.94, 1, 0.9, 0.96, 1, 0.88], 34, 26);
  const cy = Y(6, 0, 26.5);
  oval(g, 0, cy, 24, 24 * SQUASH, 0xd8d0e8);
  oval(g, 0, cy + 0.6, 21, 21 * SQUASH, shade(color, -0.65));
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2,
      x = Math.cos(a) * 18,
      y = cy + Math.sin(a) * 18 * SQUASH;
    g.fillStyle(shade(color, Math.sin(a) > 0 ? -0.2 : 0.2));
    g.fillTriangle(x - 2, y, x + 2, y, x * 0.6, y - 4);
  }
  for (const k of [
    { u: -8, v: -4, a: Math.PI * 1.1, lean: 0.45, len: 20, r: 4.5 },
    { u: 8, v: -5, a: -0.3, lean: 0.4, len: 24, r: 5 },
    { u: 0, v: -1, a: 0.3, lean: 0.1, len: 34, r: 6.5 },
    { u: -9, v: 5, a: Math.PI * 0.8, lean: 0.55, len: 14, r: 3.8 },
    { u: 9, v: 5, a: 0.6, lean: 0.55, len: 16, r: 4 },
  ])
    crystal(g, 0, cy - 6 + 3, { ...k, color, z: 0 });
}
export function splitGeodeShadow(g: Ink) {
  for (const k of [0.5, 1]) oval(g, 12 * k, 8 * k, 40, 20, SHADE, 0.12);
}
