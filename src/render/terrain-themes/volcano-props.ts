import { disc, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, quad } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Volcano Chain (`volcano.ts`), a pale ash plain on the flank of an active volcano worked by a
// mining outpost, drawn in the towers' 3/4 tilt: sulphur vents, ash-dusted obsidian, ash-capped boulders, drill rigs
// over glowing boreholes, ore carts of glowing magma ore and sensor huts; a geothermal wellhead and a basalt crag with
// a lava fall as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain
// record; steam, glow and beacons live in the theme's ambient.

export const SHADE = 0x1a1614;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const ASH = 0xc8c2b8;
export const SULPHUR = 0xf2d23c;
export const LAVA = 0xff6a1a;
const BASALT = { wall: 0x2e2a2a, top: 0x4a4440 } as const,
  STEEL = 0x5a5e62,
  HAZARD = 0xe0b030;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A lumpy basalt rock of six corners whose top is dusted with pale ash. */
export function rock(g: Ink, gx: number, gy: number, radii: readonly number[], r: number, h: number) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.3;
    F[2 * i] = Math.cos(t) * r * radii[i];
    F[2 * i + 1] = Math.sin(t) * r * radii[i];
    I[2 * i] = F[2 * i] * 0.6;
    I[2 * i + 1] = F[2 * i + 1] * 0.6;
  }
  block(g, gx, gy, F, I, 6, 0, h * 0.55, h * 0.45, BASALT.wall, ASH, 0xf0ece4);
}

// ── Sulphur vent ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a vent's mouth. */
export const VENT_MOUTH = 11;
/** A sulphur vent: a low mound of grey ash crusted bright yellow round its mouth, crystals of sulphur on its slopes. */
export function drawVent(g: Ink, gx: number, gy: number, s: number) {
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4,
      t1 = (i + 1) / 4;
    drum(g, gx, gy, (17 - 9 * t0) * s, VENT_MOUTH * s * t0, VENT_MOUTH * s * t1 + 0.4, i < 2 ? shade(ASH, -0.15 - 0.05 * i) : shade(SULPHUR, -0.25), i < 2 ? ASH : SULPHUR, 14);
  }
  oval(g, gx, Y(gy, 0, VENT_MOUTH * s), 5 * s, 5 * s * SQUASH, 0x4a3a10);
  oval(g, gx, Y(gy, 0, VENT_MOUTH * s) + 0.5, 2.6 * s, 2.6 * s * SQUASH, 0xff8a2a);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1,
      r = (12 + (i % 2) * 3) * s;
    disc(g, X(gx, Math.cos(a) * r), Y(gy, Math.sin(a) * r, 3 * s), 1.3, i % 2 ? 0xfff08a : SULPHUR);
  }
}
export function ventShadow(g: Ink, gx: number, gy: number, s: number) {
  oval(g, gx + 5 * s, gy + 3 * s, 18 * s, 9 * s, SHADE, 0.2);
}

// ── Obsidian ────────────────────────────────────────────────────────────────────────────────────────────────────────
export function obsidianOf(rand: Random, size = 1): Crystal[] {
  const n = 3 + Math.floor(rand() * 3);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.8,
      d = i ? (5 + rand() * 6) * size : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: i ? 0.35 + rand() * 0.4 : rand() * 0.15, len: (i ? 8 + rand() * 10 : 20 + rand() * 8) * size, r: (i ? 2.6 + rand() * 1.4 : 4.4) * size, color: 0x24222a, core: false };
  }).sort((p, q) => p.v - q.v);
}
/** Black glass shards in a drift of ash, their upward faces dusted pale. */
export function drawObsidian(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  oval(g, gx + 1, gy + 1, 15, 7, shade(ASH, -0.2), 0.9);
  oval(g, gx, gy, 13, 6, ASH, 0.9);
  for (const c of list) {
    crystal(g, gx, gy, c);
    // Ash lying on the tip's upper face.
    const h = (c.len + c.r * 1.6) * Math.cos(c.lean),
      reach = (c.len + c.r * 1.6) * Math.sin(c.lean);
    disc(g, X(gx, c.u + Math.cos(c.a) * reach * 0.82), Y(gy, c.v + Math.sin(c.a) * reach * 0.82, h * 0.85), c.r * 0.45, ASH, 0.8);
  }
}
export function obsidianShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystalShadow(g, gx, gy, c);
}

// ── Boulders ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Boulder { radii: number[]; r: number; du: number; dv: number }
export function bouldersOf(rand: Random): Boulder[] {
  const one = (du: number, dv: number, r: number): Boulder => ({ radii: Array.from({ length: 6 }, () => 0.75 + rand() * 0.25), r, du, dv });
  return rand() < 0.5 ? [one(0, 0, 14 + rand() * 4)] : [one(-6, -4, 12 + rand() * 3), one(10, 6, 6 + rand() * 2)];
}
export function drawBoulders(g: Ink, gx: number, gy: number, list: readonly Boulder[]) {
  for (const b of list) rock(g, gx + b.du, gy + b.dv * SQUASH, b.radii, b.r, b.r);
}
export function bouldersShadow(g: Ink, gx: number, gy: number, list: readonly Boulder[]) {
  for (const b of list) roundShadow(g, gx + b.du, gy + b.dv * SQUASH, b.r + 2, b.r);
}

// ── Drill rig ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Heights of the rig's crown block and its warning lamp. */
export const RIG = { crown: 40, lamp: 42 } as const;
/** A drill rig: a three-legged derrick over a glowing borehole, the drill string hanging from its crown, a winch box. */
export function drawRig(g: Ink, gx: number, gy: number, a: number) {
  oval(g, gx, gy, 7, 3.6, 0x2a1a10);
  oval(g, gx, gy, 4.4, 2.2, LAVA);
  oval(g, gx, gy - 0.3, 2, 1, 0xffd08a);
  box(g, gx, gy, frame(a, 0, 0, Math.cos(a) * 12, Math.sin(a) * 12), -4, 4, -4, 4, 0, 7, HAZARD);
  const legs = [0.5, 2.6, 4.7].map((t) => ({ u: Math.cos(t + a) * 12, v: Math.sin(t + a) * 12 }));
  const back = legs.filter((l) => l.v < 0),
    front = legs.filter((l) => l.v >= 0);
  for (const l of back) rod(g, gx, gy, l.u, l.v, 0, 0, 0, RIG.crown, 1.8, STEEL);
  rod(g, gx, gy, 0, 0, RIG.crown, 0, 0, 4, 1.2, 0x8a8e92);
  drum(g, gx, gy, 2, 12, 16, 0x3a3e42, 0x5a5e62, 8);
  for (const l of front) rod(g, gx, gy, l.u, l.v, 0, 0, 0, RIG.crown, 1.8, STEEL);
  for (const h of [14, 26]) {
    const k = 1 - h / RIG.crown;
    g.lineStyle(0.8, 0x7a7e82, 0.9);
    g.strokePoints([...legs, legs[0]].map((l) => ({ x: X(gx, l.u * k), y: Y(gy, l.v * k, h) })), false);
  }
  drum(g, gx, gy, 3, RIG.crown, RIG.crown + 2, HAZARD, shade(HAZARD, 0.15), 8);
  rod(g, gx, gy, Math.cos(a) * 12, Math.sin(a) * 12, 7, 0, 0, RIG.crown, 0.6, 0x2a2a2a);
}
export function rigShadow(g: Ink, gx: number, gy: number) {
  g.fillStyle(SHADE, 0.18);
  g.fillTriangle(gx - 10, gy, gx + 10, gy + 2, gx + RIG.crown * SUN.x, gy + RIG.crown * SUN.y);
}

// ── Ore cart ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the cart's ore glows (ground u, v, height). */
export const CART_ORE = { h: 12 } as const;
/** An ore cart on a short length of track, heaped with dark ore glowing through its cracks, a buffer at the rail end. */
export function drawCart(g: Ink, gx: number, gy: number, a: number) {
  const f = frame(a, 0, 0);
  for (const q of [-4, 4]) box(g, gx, gy, f, -18, 18, q - 0.7, q + 0.7, 0, 1.2, 0x6a6e72);
  for (let p = -16; p <= 16; p += 6) box(g, gx, gy, f, p - 1.4, p + 1.4, -6, 6, 0, 0.8, 0x4a3a2a);
  box(g, gx, gy, f, 15, 18, -5, 5, 0, 5, HAZARD);
  for (const [p, q] of [[-6, -4.6], [6, -4.6], [-6, 4.6], [6, 4.6]]) box(g, gx, gy, f, p - 2.2, p + 2.2, q - 0.8, q + 0.8, 0.8, 5, 0x1e1c1c);
  box(g, gx, gy, f, -10, 10, -5.5, 5.5, 4, 11, 0x6a4a30);
  box(g, gx, gy, f, -9, 9, -4.6, 4.6, 10.6, 11.2, 0x1e1a18);
  for (let i = 0; i < 6; i++) {
    project(gx, gy, f, -7 + i * 2.8, (i % 2 ? 1 : -1) * 2, 12 + (i % 3) * 0.8, 0);
    disc(g, SX[0], SY[0], 2.6, BASALT.wall);
    disc(g, SX[0] + 0.4, SY[0] + 0.4, 0.9, i % 2 ? LAVA : 0xffb04a);
  }
}
export function cartShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 10, 6, 12, 0.3);
}

// ── Sensor hut ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the hut's beacon. */
export const HUT_BEACON = 30;
/** A seismic sensor hut: a squat heat-shielded cabin, a solar panel on its roof, a mast with a beacon, a cable reel. */
export function drawHut(g: Ink, gx: number, gy: number, a: number) {
  const f = frame(a, 0, 0);
  box(g, gx, gy, f, -10, 10, -7, 7, 0, 2, 0x4a4440);
  box(g, gx, gy, f, -8, 8, -6, 6, 2, 13, 0xd8d0c0);
  for (const p of [-6, -2, 2, 6]) {
    project(gx, gy, f, p, 6.05, 3, 0);
    project(gx, gy, f, p, 6.05, 12, 1);
    g.lineStyle(0.6, 0x9a9488, 0.8);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  project(gx, gy, f, 2, 6.06, 4, 0);
  project(gx, gy, f, 6, 6.06, 4, 1);
  project(gx, gy, f, 6, 6.06, 10, 2);
  project(gx, gy, f, 2, 6.06, 10, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x3a3e42);
  box(g, gx, gy, frame(a, -0.4, 13), -6, 6, -5, 5, 0, 0.8, 0x1e3a6a);
  rod(g, gx, gy, -Math.cos(a) * 7, -Math.sin(a) * 7, 13, -Math.cos(a) * 7, -Math.sin(a) * 7, HUT_BEACON, 0.8, 0x8a8e92);
  drum(g, X(gx, Math.cos(a) * 12), Y(gy, Math.sin(a) * 12 + 5, 0), 3, 0, 5, HAZARD, 0x3a3a3a, 10);
}
export const hutBeacon = (a: number) => ({ x: X(0, -Math.cos(a) * 7), y: Y(0, -Math.sin(a) * 7, HUT_BEACON + 1) });
export function hutShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 10, 7, 14, 0.3);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The wellhead's steam outlet (height at full size). */
export const WELL = { steam: 58, u: -14 } as const;
/**
 * A geothermal wellhead: a concrete pad, a valve tree on the well, insulated pipes running in bends to a separator
 * tank, a silencer stack venting steam, and a control shed.
 */
export function drawWellhead(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -30, 34, -20, 22, 0, 2, 0x5a5650);
  // Separator tank at the back right, on its skirt.
  drum(g, X(0, 20), Y(0, -8, 0), 9, 2, 30, 0xd8d0c0, 0xe8e0d0, 16);
  for (const h of [10, 20]) drum(g, X(0, 20), Y(0, -8, 0), 9.3, h, h + 1.4, 0x9a948a, 0xa8a298, 16);
  drum(g, X(0, 20), Y(0, -8, 0), 3, 30, 33, 0x6a6460, 0x7a746c, 8);
  // Silencer stack venting steam, back left.
  drum(g, X(0, WELL.u), Y(0, -10, 0), 8, 3, 46, 0x9a948a, 0xb8b2a8, 14);
  for (const h of [14, 28, 42]) drum(g, X(0, WELL.u), Y(0, -10, 0), 8.4, h, h + 1.6, 0x6a6460, 0x7a746c, 14);
  drum(g, X(0, WELL.u), Y(0, -10, 0), 5, 46, WELL.steam - 4, 0x6a6460, 0x3a3634, 12);
  // Insulated pipes from the well to the stack and the tank.
  rod(g, 0, 0, 0, 6, 10, WELL.u, -2, 10, 3.6, 0xd8d0c0);
  rod(g, 0, 0, 0, 6, 10, 14, -4, 14, 3.6, 0xd8d0c0);
  // The valve tree on the well.
  drum(g, 0, Y(0, 6, 0), 5, 3, 7, 0x4a4440, 0x5a5450, 10);
  drum(g, 0, Y(0, 6, 0), 2.4, 7, 22, 0xc83a2e, 0xd84a3e, 10);
  for (const h of [12, 18]) {
    rod(g, 0, 0, -5, 6, h, 5, 6, h, 1.6, 0xc83a2e);
    disc(g, X(0, 5.5), Y(0, 6, h), 1.8, 0xe8e0c8);
  }
  // Control shed at the front right.
  box(g, 0, 0, frame(0.1, 0, 0, 22, 12), -7, 7, -6, 6, 2, 14, 0xe0b030);
  box(g, 0, 0, frame(0.1, 0, 0, 22, 12), -8, 8, -7, 7, 14, 16, 0x4a4440);
}
export function wellheadShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 32, 21, 2, 0.2);
  roundShadow(g, 20, -8 * SQUASH, 10, 30);
  roundShadow(g, WELL.u, -10 * SQUASH, 9, 46);
}
/** Where the lava fall leaves the crag and lands (screen offsets at full size). */
export const FALL = { top: { u: -4, h: 50 }, pool: { u: 2, v: 22 } } as const;
/**
 * A basalt crag: stepped columns of black rock dusted with ash, a cleft down its front from which a lava fall pours
 * into a glowing pool at its foot, sulphur crusting the pool's rim.
 */
export function drawCrag(g: Ink) {
  const cols = [[-24, -10, 30], [-14, -14, 44], [-4, -12, 54], [8, -14, 48], [20, -8, 36], [28, 2, 22], [-28, 4, 20]];
  for (const [u, v, h] of cols.sort((p, q) => p[1] - q[1])) rock(g, X(0, u), Y(0, v, 0), [0.9, 1, 0.85, 1, 0.9, 0.95], 9, h);
  // The pool at the foot.
  oval(g, X(0, FALL.pool.u), Y(0, FALL.pool.v, 0), 18, 9, SULPHUR);
  oval(g, X(0, FALL.pool.u), Y(0, FALL.pool.v, 0), 15, 7.4, 0x3a1a0a);
  oval(g, X(0, FALL.pool.u), Y(0, FALL.pool.v, 0) + 0.5, 12.5, 6, LAVA);
  oval(g, X(0, FALL.pool.u) - 3, Y(0, FALL.pool.v, 0), 6, 2.6, 0xffc070);
  // The fall itself: a ribbon from the cleft down the rock to the pool.
  const top = { x: X(0, FALL.top.u), y: Y(0, 0, FALL.top.h) },
    foot = { x: X(0, FALL.pool.u), y: Y(0, FALL.pool.v, 0) - 2 };
  g.fillStyle(OUTLINE, 0.8);
  g.fillPoints([{ x: top.x - 4, y: top.y }, { x: top.x + 4, y: top.y }, { x: foot.x + 6, y: foot.y }, { x: foot.x - 6, y: foot.y }], true);
  g.fillStyle(LAVA);
  g.fillPoints([{ x: top.x - 3, y: top.y }, { x: top.x + 3, y: top.y }, { x: foot.x + 5, y: foot.y }, { x: foot.x - 5, y: foot.y }], true);
  g.fillStyle(0xffc070);
  g.fillPoints([{ x: top.x - 1, y: top.y }, { x: top.x + 1, y: top.y }, { x: foot.x + 1.6, y: foot.y }, { x: foot.x - 1.6, y: foot.y }], true);
}
export function cragShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 22 * k, 13 * k, 40, 22, SHADE, 0.18);
}
