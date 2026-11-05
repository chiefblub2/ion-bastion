import { disc, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, endFace, quad, tube, turn } from "../tower-art/tilt";
import { box, frame, plane, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Orbital Deck (`orbit.ts`), the hull of a station in orbit, drawn in the towers' 3/4 tilt in one
// sci-fi language: dark gunmetal armour in chamfered blocks, pale trim panels and cyan emitters. Hex energy collectors,
// armoured cargo modules, plasma cells, robotic arms, sensor dishes and hydroponics domes; a dropship on its landing
// pad and a sensor spire as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front
// into a plain record; its lights live in the theme's ambient (the cyan parts here are lit ink, their glow is ambient).

export const SHADE = 0x01020a;
export const SUN = { x: 0.5, y: 0.3 } as const;
/** Gunmetal armour, pale trim and the cyan of every emitter. */
export const ARMOR = { wall: 0x2a3248, top: 0x3e4a66, glint: 0x8a9ac0 } as const;
export const TRIM = 0xc8d0e0;
export const CYAN = 0x5ae0ff;
const CORE = 0xd8fbff;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};

// ── Armour kit ──────────────────────────────────────────────────────────────────────────────────────────────────────
const FOOT = new Float64Array(32),
  INSET = new Float64Array(32);
/** A chamfered armour block over a convex footprint (along, across pairs, clockwise), turned by a about (gx, gy). */
export function armor(g: Ink, gx: number, gy: number, shape: readonly number[], a: number, h0: number, h1: number, bevel = 2, wall: number = ARMOR.wall, top: number = ARMOR.top) {
  const n = turn(shape, a, FOOT);
  let cu = 0,
    cv = 0;
  for (let i = 0; i < n; i++) {
    cu += FOOT[2 * i] / n;
    cv += FOOT[2 * i + 1] / n;
  }
  for (let i = 0; i < n; i++) {
    const du = FOOT[2 * i] - cu,
      dv = FOOT[2 * i + 1] - cv,
      l = Math.sqrt(du * du + dv * dv) || 1,
      k = Math.max(0, l - bevel * 1.3) / l;
    INSET[2 * i] = cu + du * k;
    INSET[2 * i + 1] = cv + dv * k;
  }
  block(g, gx, gy, FOOT, INSET, n, h0, h1, bevel, wall, top, ARMOR.glint);
}
/** A hexagon footprint of radius r (along, across pairs). */
export const hex = (r: number, rot = 0) => Array.from({ length: 12 }, (_, i) => {
  const t = (Math.floor(i / 2) / 6) * Math.PI * 2 + rot;
  return i % 2 ? Math.sin(t) * r : Math.cos(t) * r;
});
/** A chamfered rectangle footprint, half sizes p and q, corners cut by c. */
export const chamfer = (p: number, q: number, c: number) => [p, q - c, p - c, q, -p + c, q, -p, q - c, -p, -q + c, -p + c, -q, p - c, -q, p, -q + c];
/** A lit strip on a frame's +q face from p0 to p1 at height h (an emitter line). */
function strip(g: Ink, gx: number, gy: number, f: ReturnType<typeof frame>, q: number, p0: number, p1: number, h0: number, h1: number, color: number) {
  project(gx, gy, f, p0, q, h0, 0);
  project(gx, gy, f, p1, q, h0, 1);
  project(gx, gy, f, p1, q, h1, 2);
  project(gx, gy, f, p0, q, h1, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color);
}

// ── Hex energy collector ────────────────────────────────────────────────────────────────────────────────────────────
export interface Solar { a: number; pitch: number; wings: number }
export const solarOf = (rand: Random): Solar => ({ a: (rand() - 0.5) * 0.6, pitch: -(0.5 + rand() * 0.3), wings: rand() < 0.55 ? 1 : 2 });
/** Where a collector's core sits (screen offset from the ground point), per wing. */
export function solarCores(s: Solar) {
  return Array.from({ length: s.wings }, (_, w) => {
    const off = s.wings === 1 ? 0 : w ? 13 : -13;
    project(0, 0, { ...frame(s.a + Math.PI / 2, s.pitch, 20), pu: Math.cos(s.a) * off, pv: Math.sin(s.a) * off }, 0, 0, 1, 0);
    return { x: SX[0], y: SY[0] };
  });
}
/** An energy collector: an armoured hex plinth, a mast and one or two hexagonal arrays of dark cells round a cyan core. */
export function drawSolar(g: Ink, gx: number, gy: number, s: Solar) {
  armor(g, gx, gy, hex(7), s.a, 0, 4, 1.5);
  drum(g, gx, gy, 1.8, 4, 17, 0x4a5470, 0x5a6480, 8);
  for (let w = 0; w < s.wings; w++) {
    const off = s.wings === 1 ? 0 : w ? 13 : -13,
      f = { ...frame(s.a + Math.PI / 2, s.pitch, 20), pu: Math.cos(s.a) * off, pv: Math.sin(s.a) * off },
      r = s.wings === 1 ? 14 : 11;
    if (off) rod(g, gx, gy, 0, 0, 17, Math.cos(s.a) * off, Math.sin(s.a) * off, 19, 1.4, 0x4a5470);
    // The array: six triangular cells, each its own tone, framed in pale trim, the core lit in the middle.
    const corner = (k: number, rr: number, i: number) => project(gx, gy, f, Math.cos((k / 6) * Math.PI * 2) * rr, Math.sin((k / 6) * Math.PI * 2) * rr, 0.6, i);
    for (let k = 0; k < 6; k++) {
      corner(k, r + 1.2, 0);
      corner(k + 1, r + 1.2, 1);
      project(gx, gy, f, 0, 0, 0.6, 2);
      g.fillStyle(OUTLINE, 0.9);
      g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
    }
    for (let k = 0; k < 6; k++) {
      corner(k, r, 0);
      corner(k + 1, r, 1);
      project(gx, gy, f, 0, 0, 0.6, 2);
      g.fillStyle([0x1a2a6a, 0x22368a, 0x182660][k % 3]);
      g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
      g.lineStyle(0.7, TRIM, 0.8);
      g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
      g.lineStyle(0.5, 0x5a7ad8, 0.6);
      g.lineBetween(SX[0], SY[0], SX[2], SY[2]);
    }
    project(gx, gy, f, 0, 0, 1, 0);
    disc(g, SX[0], SY[0], 2.8, 0x0a2030);
    disc(g, SX[0], SY[0], 1.9, CYAN);
    disc(g, SX[0], SY[0], 0.9, CORE);
  }
}
export function solarShadow(g: Ink, gx: number, gy: number, s: Solar) {
  for (let w = 0; w < s.wings; w++) {
    const off = s.wings === 1 ? 0 : w ? 13 : -13;
    roundShadow(g, gx + Math.cos(s.a) * off + 6, gy + Math.sin(s.a) * off * SQUASH + 4, s.wings === 1 ? 13 : 10, 10, 0.32);
  }
}

// ── Cargo modules ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pod { p: number; q: number; z: number; color: number }
export interface Cargo { a: number; pods: Pod[] }
const PODS = [TRIM, 0xe0a040, 0x4a7ac8, 0xd85a4a, 0x8a96b8] as const;
export function cargoOf(rand: Random): Cargo {
  const c = () => PODS[Math.floor(rand() * PODS.length)],
    roll = rand();
  return {
    a: (rand() - 0.5) * 0.6,
    pods: roll < 0.4 ? [{ p: -6.5, q: 0, z: 0, color: c() }, { p: 6.5, q: 0, z: 0, color: c() }, { p: 0, q: 0, z: 10, color: c() }] : roll < 0.75 ? [{ p: -6.5, q: -3, z: 0, color: c() }, { p: 7, q: 3, z: 0, color: c() }] : [{ p: 0, q: 0, z: 0, color: c() }],
  };
}
/** Armoured cargo modules: chamfered gunmetal cases with a coloured trim band and a cyan status strip, on a clamp rail. */
export function drawCargo(g: Ink, gx: number, gy: number, c: Cargo) {
  armor(g, gx, gy, chamfer(16, 8, 3), c.a, 0, 2, 1);
  for (const p of [...c.pods].sort((u, v) => u.z - v.z || u.q - v.q)) {
    const du = Math.cos(c.a) * p.p - Math.sin(c.a) * p.q,
      dv = Math.sin(c.a) * p.p + Math.cos(c.a) * p.q,
      x = gx + du,
      y = gy + dv * SQUASH,
      z = 2 + p.z;
    armor(g, x, y - z, chamfer(6, 7, 2), c.a, 0, 9, 1.5);
    // Trim band round the middle and the status strip on the front face.
    const f = frame(c.a, 0, z, du, dv);
    strip(g, gx, gy, f, 7.05, -6, 6, 3.5, 5, p.color);
    strip(g, gx, gy, f, 7.08, -3.5, 3.5, 6.6, 7.4, CYAN);
  }
}
export function cargoShadow(g: Ink, gx: number, gy: number, c: Cargo) {
  boxShadow(g, gx, gy, c.a, 15, 8, c.pods.some((p) => p.z) ? 22 : 12);
}

// ── Plasma cells ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Spheres { flip: boolean; color: number }
export const spheresOf = (rand: Random): Spheres => ({ flip: rand() < 0.5, color: rand() < 0.65 ? CYAN : 0xb88aff });
const cellsOf = (s: Spheres) => {
  const k = s.flip ? -1 : 1;
  return [{ u: -8 * k, v: -4, r: 5.5, h: 22 }, { u: 9 * k, v: 4, r: 4.5, h: 17 }].sort((p, q) => p.v - q.v);
};
/** Where the plasma cells glow (screen offsets from the ground point). */
export const sphereGlows = (s: Spheres) => cellsOf(s).map((c) => ({ x: c.u, y: Y(c.v * SQUASH, 0, c.h * 0.55), r: c.r }));
/** Plasma cells: glass cylinders of glowing plasma held between armoured caps by three ribs, on hex plinths. */
export function drawSpheres(g: Ink, gx: number, gy: number, s: Spheres) {
  const list = cellsOf(s);
  for (const c of list) {
    const x = gx + c.u,
      y = gy + c.v * SQUASH;
    armor(g, x, y, hex(c.r + 3), 0.3, 0, 4, 1.2);
    drum(g, x, y, c.r, 4, c.h - 3, shade(s.color, -0.35), shade(s.color, 0.1), 14);
    // The plasma column inside the glass, brighter down its middle.
    g.fillStyle(shade(s.color, 0.1), 0.9);
    g.fillRect(x - c.r * 0.45, Y(y, 0, c.h - 3), c.r * 0.9, c.h - 7);
    g.fillStyle(CORE, 0.85);
    g.fillRect(x - c.r * 0.12 - 0.4, Y(y, 0, c.h - 3), c.r * 0.24 + 0.4, c.h - 7);
    for (const a of [0.5, 1.6, 2.7]) rod(g, x, y, Math.cos(a) * c.r, Math.sin(a) * c.r, 4, Math.cos(a) * c.r, Math.sin(a) * c.r, c.h - 3, 1.2, 0x4a5470);
    armor(g, x, y - (c.h - 3), hex(c.r + 1.5), 0.3, 0, 3, 1);
    drum(g, x, y, 1.4, c.h, c.h + 3, 0x4a5470, TRIM, 8);
  }
  const [a, b] = list;
  rod(g, gx, gy, a.u, a.v, 2.5, b.u, b.v, 2.5, 1.6, 0x4a5470);
}
export function spheresShadow(g: Ink, gx: number, gy: number, s: Spheres) {
  for (const c of cellsOf(s)) roundShadow(g, gx + c.u, gy + c.v * SQUASH, c.r + 3, c.h);
}

// ── Robotic arm ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Arm { a: number; lift: number }
export const armOf = (rand: Random): Arm => ({ a: rand() * Math.PI * 2, lift: 0.4 + rand() * 0.5 });
/** Where the arm's wrist lamp sits (ground u, v, height). */
export function wristOf(a: Arm) {
  const elbow = { u: Math.cos(a.a) * 6, v: Math.sin(a.a) * 6, h: 11 + 16 * a.lift };
  return { u: elbow.u + Math.cos(a.a) * 14, v: elbow.v + Math.sin(a.a) * 14, h: elbow.h - 6 + 4 * a.lift, elbow };
}
/** A station's robotic arm: an armoured hex turret, two pale boom segments on cyan-ringed joints, a three-claw gripper. */
export function drawArm(g: Ink, gx: number, gy: number, a: Arm) {
  armor(g, gx, gy, hex(8), a.a, 0, 4, 1.5);
  drum(g, gx, gy, 4.8, 4, 10, ARMOR.wall, ARMOR.top, 12);
  const w = wristOf(a),
    e = w.elbow,
    joint = (u: number, v: number, h: number, r: number) => {
      disc(g, X(gx, u), Y(gy, v, h), r + 0.8, OUTLINE, 0.9);
      disc(g, X(gx, u), Y(gy, v, h), r, ARMOR.top);
      disc(g, X(gx, u), Y(gy, v, h), r * 0.45, CYAN);
    },
    boom = () => {
      rod(g, gx, gy, 0, 0, 10, e.u, e.v, e.h, 3.6, TRIM);
      joint(e.u, e.v, e.h, 2.8);
      rod(g, gx, gy, e.u, e.v, e.h, w.u, w.v, w.h, 2.8, TRIM);
      joint(w.u, w.v, w.h, 2.2);
      for (const s of [-1, 0, 1]) rod(g, gx, gy, w.u, w.v, w.h, w.u + Math.cos(a.a + s * 0.6) * 4, w.v + Math.sin(a.a + s * 0.6) * 4, w.h - 3 + Math.abs(s), 0.9, 0x8a96b8);
    };
  if (Math.sin(a.a) < 0) boom();
  joint(0, 0, 10.5, 3.2);
  if (Math.sin(a.a) >= 0) boom();
}
export function armShadow(g: Ink, gx: number, gy: number, a: Arm) {
  const w = wristOf(a);
  roundShadow(g, gx, gy, 8, 6);
  g.lineStyle(3, SHADE, 0.22);
  g.lineBetween(gx + 3, gy + 2, gx + w.u + w.h * SUN.x, gy + w.v * SQUASH + w.h * SUN.y);
}

// ── Sensor dish ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A sensor dish on an armoured plinth: a dark dish ringed in pale trim with radial ribs, a cyan emitter on its prongs. */
export function drawDish(g: Ink, gx: number, gy: number, a: number) {
  armor(g, gx, gy, hex(7.5), a, 0, 4, 1.5);
  drum(g, gx, gy, 2.6, 4, 15, ARMOR.wall, ARMOR.top, 10);
  const f = frame(a, 0.9, 17);
  plane(g, gx, gy, f, -1, 11.6, OUTLINE, 0.9, 11.6, 18);
  plane(g, gx, gy, f, 0, 11, TRIM, 1, 11, 18);
  plane(g, gx, gy, f, 0.3, 9.6, ARMOR.top, 1, 9.6, 18);
  plane(g, gx, gy, f, 0.6, 5, ARMOR.wall, 1, 5, 12);
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * Math.PI * 2;
    project(gx, gy, f, 0.4, Math.cos(t) * 5, Math.sin(t) * 5, 0);
    project(gx, gy, f, 0.4, Math.cos(t) * 9.4, Math.sin(t) * 9.4, 1);
    g.lineStyle(0.6, 0x6a7aa0, 0.8);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  project(gx, gy, f, 11, 0, 0, 0);
  const tip = { x: SX[0], y: SY[0] };
  for (const t of [0, 2.1, 4.2]) {
    project(gx, gy, f, 0.5, Math.cos(t) * 8, Math.sin(t) * 8, 1);
    g.lineStyle(0.9, 0x8a96b8);
    g.lineBetween(SX[1], SY[1], tip.x, tip.y);
  }
  disc(g, tip.x, tip.y, 2.2, OUTLINE);
  disc(g, tip.x, tip.y, 1.6, CYAN);
  disc(g, tip.x - 0.4, tip.y - 0.4, 0.7, CORE);
}
export const dishTip = (a: number) => {
  project(0, 0, frame(a, 0.9, 17), 11, 0, 0, 0);
  return { x: SX[0], y: SY[0] };
};
export function dishShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx + 4, gy + 2, 12, 18);
}

// ── Hydroponics dome ────────────────────────────────────────────────────────────────────────────────────────────────
/** A hydroponics pod: a glass dome over rows of green plants, on an armoured hex ring with a cyan light band. */
export function drawHydro(g: Ink, gx: number, gy: number) {
  armor(g, gx, gy, hex(16, 0.26), 0, 0, 4, 1.5);
  drum(g, gx, gy, 13, 4, 5.2, CYAN, shade(CYAN, 0.1), 18);
  oval(g, gx, Y(gy, 0, 5.2), 12, 12 * SQUASH, 0x10221a);
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) disc(g, X(gx, i * 4.2), Y(gy, j * 4.8, 6.5), 2.1, j % 2 ? 0x3a9a4a : 0x5ac86a);
  g.fillStyle(0xc8e8ff, 0.16);
  g.fillPoints(Array.from({ length: 25 }, (_, i) => {
    const t = Math.PI + (i / 24) * Math.PI;
    return { x: gx + Math.cos(t) * 12, y: Y(gy, 0, 5.2) + Math.sin(t) * 11.5 };
  }), true);
  // Hex framing of the glass and its highlight.
  g.lineStyle(0.6, TRIM, 0.45);
  for (const t of [1.25, 1.55, 1.85]) g.strokePoints(Array.from({ length: 9 }, (_, i) => {
    const s = Math.PI + (i / 8) * Math.PI;
    return { x: gx + Math.cos(s) * 12 * Math.cos(t - 1.55) * 1.0, y: Y(gy, 0, 5.2) + Math.sin(s) * 11.5 * (t - 1.2) * 1.6 };
  }), false);
  g.lineStyle(1, 0xe8f4ff, 0.6);
  g.strokePoints(Array.from({ length: 13 }, (_, i) => {
    const t = Math.PI * 1.05 + (i / 12) * Math.PI * 0.45;
    return { x: gx + Math.cos(t) * 9.6, y: Y(gy, 0, 5.2) + Math.sin(t) * 9.2 };
  }), false);
}
export function hydroShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 15, 10);
}

// ── Dropship ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The dropship's heading on its pad: nose to the upper right. */
const SHIP_A = -0.42;
const at = (p: number, q: number) => ({ u: Math.cos(SHIP_A) * p - Math.sin(SHIP_A) * q, v: Math.sin(SHIP_A) * p + Math.cos(SHIP_A) * q });
const HULL_FOOT = [38, 0, 18, 6.5, -22, 8, -30, 5, -30, -5, -22, -8, 18, -6.5],
  WING_N = [10, -6, -24, -7, -34, -38, -24, -38],
  WING_S = [10, 6, -24, 38, -34, 38, -24, 7];
const engineAt = (q: number) => ({ ...at(-36, q), h: 15 });
/** Where the dropship's engines glow and its nav lights sit (ground u, v, height at full size). */
export const SHUTTLE = {
  engines: [engineAt(-5), engineAt(5)],
  nav: [{ ...at(-31, -38), h: 18 }, { ...at(-31, 38), h: 18 }],
  canopy: { ...at(24, 0), h: 24 },
} as const;
/**
 * A dropship on its landing pad: an armoured hex pad with a landing ring, the craft on three struts: an arrowhead
 * hull of chamfered armour with pale wing panels and cyan running lines, a glowing canopy, two dorsal fins and twin
 * engine pods whose exhausts glow cyan.
 */
export function drawShuttle(g: Ink) {
  armor(g, 0, 0, hex(46, Math.PI / 6), 0, 0, 4, 2.5, 0x2e3650, 0x3a4462);
  // Landing ring and its markings on the pad.
  g.lineStyle(1.4, CYAN, 0.7);
  g.strokePoints(Array.from({ length: 33 }, (_, i) => {
    const t = (i / 32) * Math.PI * 2;
    return { x: Math.cos(t) * 34, y: Y(0, Math.sin(t) * 34, 6.4) };
  }), false);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.lineStyle(2.4, 0xe0b040, 0.85);
    g.lineBetween(X(0, Math.cos(t) * 39), Y(0, Math.sin(t) * 39, 6.4), X(0, Math.cos(t) * 43), Y(0, Math.sin(t) * 43, 6.4));
  }
  for (const [p, q] of [[-16, -9], [-16, 9], [18, 0]]) {
    const s = at(p, q);
    rod(g, 0, 0, s.u, s.v, 6.4, s.u, s.v, 14, 1.8, 0x4a5470);
    oval(g, X(0, s.u), Y(0, s.v, 6.4), 3, 1.6, 0x1a2030);
  }
  // Far wing, engines, hull, near wing: back to front.
  armor(g, 0, -14, WING_N, SHIP_A, 0, 3, 1.2);
  const panel = (shape: number[], h: number, color: number) => {
    const pts = [];
    for (let i = 0; i < shape.length; i += 2) {
      const s = at(shape[i], shape[i + 1]);
      pts.push({ x: X(0, s.u), y: Y(0, s.v, h) });
    }
    g.fillStyle(color);
    g.fillPoints(pts, true);
  };
  panel([-2, -11, -18, -12, -27, -32, -21, -32], 17.6, TRIM);
  for (const q of [-5, 5]) {
    const s = at(-22, q);
    tube(g, X(0, s.u), Y(0, s.v, 0), SHIP_A, 15, -14, 2, 4.6, ARMOR.wall);
    endFace(g, X(0, s.u), Y(0, s.v, 0), SHIP_A, 15, -14, 4.6, 0x1a2030);
    endFace(g, X(0, s.u), Y(0, s.v, 0), SHIP_A, 15, -14.2, 3.4, CYAN);
    endFace(g, X(0, s.u), Y(0, s.v, 0), SHIP_A, 15, -14.4, 1.8, CORE);
  }
  armor(g, 0, -13, HULL_FOOT, SHIP_A, 0, 8, 3);
  // Cyan running lines along both flanks, the canopy, the fins.
  for (const q of [-8.05, 8.05]) {
    const a = at(-20, q),
      b = at(14, q * 0.88);
    g.lineStyle(1.2, CYAN, 0.9);
    g.lineBetween(X(0, a.u), Y(-13, a.v, 4), X(0, b.u), Y(-13, b.v, 4));
  }
  panel([30, 0, 18, 4, 12, 3.5, 12, -3.5, 18, -4], 24.2, 0x0e2a3a);
  panel([28, 0, 18, 3, 14, 2.6, 14, -2.6, 18, -3], 24.4, 0x3ab8e0);
  panel([24, -0.6, 18, 1.6, 16, -1.6], 24.6, CORE);
  for (const q of [-4, 4]) {
    const b = at(-24, q),
      t = at(-28, q * 1.4);
    rod(g, 0, 0, b.u, b.v, 24, t.u, t.v, 33, 2, ARMOR.top);
  }
  armor(g, 0, -14, WING_S, SHIP_A, 0, 3, 1.2);
  panel([-2, 11, -21, 32, -27, 32, -18, 12], 17.6, TRIM);
}
export function shuttleShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 44, 38, 4, 0.3);
  g.fillStyle(SHADE, 0.18);
  const pts = [];
  for (let i = 0; i < HULL_FOOT.length; i += 2) {
    const s = at(HULL_FOOT[i], HULL_FOOT[i + 1]);
    pts.push({ x: s.u + 10, y: s.v * SQUASH + 9 });
  }
  g.fillPoints(pts, true);
}

// ── Sensor spire ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The spire's emitter height (at full size); its rings turn in the ambient. */
export const COMMS = { beacon: 76, rings: [30, 46, 60] } as const;
/** A sensor spire: a stepped hex plinth, a tapering hex column of armour sections split by cyan bands, a crystal emitter. */
export function drawComms(g: Ink) {
  armor(g, 0, 0, hex(28, Math.PI / 6), 0, 0, 4, 2);
  armor(g, 0, -4, hex(18, Math.PI / 6), 0, 0, 5, 1.5);
  const sections = [[13, 9, 22], [11, 22, 38], [9, 38, 52], [7, 52, 64]];
  for (const [r, h0, h1] of sections) {
    armor(g, 0, -h0, hex(r, Math.PI / 6), 0, 0, h1 - h0 - 2, 1.5);
    drum(g, 0, 0, r * 0.82, h1 - 2, h1, CYAN, shade(CYAN, 0.1), 6);
  }
  // Four buttress fins from the plinth.
  for (const t of [Math.PI * 0.25, Math.PI * 0.75]) rod(g, 0, 0, Math.cos(t) * 18, Math.sin(t) * 18, 9, Math.cos(t) * 10, Math.sin(t) * 10, 30, 2.6, ARMOR.top);
  // The emitter: a pale prism on prongs.
  for (const t of [0, 2.1, 4.2]) rod(g, 0, 0, Math.cos(t) * 5, Math.sin(t) * 5, 64, Math.cos(t) * 3, Math.sin(t) * 3, 70, 1.2, TRIM);
  const top = Y(0, 0, COMMS.beacon),
    mid = Y(0, 0, 70);
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints([{ x: 0, y: top - 1 }, { x: 4.6, y: mid }, { x: 0, y: mid + 5 }, { x: -4.6, y: mid }], true);
  g.fillStyle(0x7ae8ff);
  g.fillPoints([{ x: 0, y: top }, { x: 3.8, y: mid }, { x: 0, y: mid + 4 }, { x: -3.8, y: mid }], true);
  g.fillStyle(CORE);
  g.fillPoints([{ x: 0, y: top }, { x: -3.8, y: mid }, { x: 0, y: mid + 1 }], true);
}
export function commsShadow(g: Ink) {
  roundShadow(g, 4, 2, 28, 6);
  g.lineStyle(10, SHADE, 0.16);
  g.lineBetween(0, 0, COMMS.beacon * SUN.x, COMMS.beacon * SUN.y);
}
