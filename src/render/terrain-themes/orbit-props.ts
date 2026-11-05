import { disc, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, drum, endFace, quad, tube } from "../tower-art/tilt";
import { box, frame, plane, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Orbital Deck (`orbit.ts`), the hull of a station in orbit, drawn in the towers' 3/4 tilt: solar
// panels on gimbals, cargo pods in magnetic clamps, pressure spheres, robotic arms, dish antennas and hydroponics
// domes; a docked shuttle and a comms array as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is
// rolled up front into a plain record; its nav lights live in the theme's ambient.

export const SHADE = 0x01020a;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const HULL = 0xc8ccd4;
const DARK = 0x2a3248,
  PANEL = 0x1e3a8a,
  GOLD = 0xc8a040;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A sphere of radius r whose centre is at height h: dark rim, body, a lit cap to the upper left and a glint. */
export function sphere(g: Ink, x: number, y0: number, r: number, h: number, color: number) {
  const cy = Y(y0, 0, h);
  disc(g, x, cy, r + 0.8, OUTLINE, 0.9);
  disc(g, x, cy, r, shade(color, -0.3));
  disc(g, x - r * 0.12, cy - r * 0.12, r * 0.84, shade(color, -0.08));
  disc(g, x - r * 0.3, cy - r * 0.3, r * 0.52, color);
  disc(g, x - r * 0.42, cy - r * 0.42, r * 0.18, shade(color, 0.5));
}

// ── Solar panels ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Solar { a: number; pitch: number; wings: number }
export const solarOf = (rand: Random): Solar => ({ a: (rand() - 0.5) * 0.6, pitch: -(0.45 + rand() * 0.3), wings: rand() < 0.5 ? 1 : 2 });
/** A solar array on a gimbal mast: blue cells in a gold frame, tilted to the sun, one wing or two. */
export function drawSolar(g: Ink, gx: number, gy: number, s: Solar) {
  box(g, gx, gy, frame(s.a, 0, 0), -5, 5, -5, 5, 0, 3, DARK);
  drum(g, gx, gy, 1.6, 3, 16, 0x8a92a4, 0xa8b0c0, 8);
  drum(g, gx, gy, 3, 15, 18, DARK, 0x3a4460, 10);
  for (let w = 0; w < s.wings; w++) {
    const side = s.wings === 1 ? 0 : w ? 1 : -1,
      off = side * 14,
      f = frame(s.a + Math.PI / 2, s.pitch, 18, -Math.sin(s.a) * 0, 0);
    // The panel: a box along the pitched axis, cells drawn across its upper face.
    const pf = { ...f, pu: Math.cos(s.a) * off, pv: Math.sin(s.a) * off };
    box(g, gx, gy, pf, -10, 10, -12, 12, -0.6, 0.6, PANEL, PANEL);
    for (let i = -1; i <= 1; i++) {
      project(gx, gy, pf, i * 6.6 - 2.9, -11.4, 0.65, 0);
      project(gx, gy, pf, i * 6.6 + 2.9, -11.4, 0.65, 1);
      project(gx, gy, pf, i * 6.6 + 2.9, 11.4, 0.65, 2);
      project(gx, gy, pf, i * 6.6 - 2.9, 11.4, 0.65, 3);
      quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x2a4aa8);
    }
    g.lineStyle(0.5, 0x6a8ae8, 0.7);
    for (const q of [-5.7, 0, 5.7]) {
      project(gx, gy, pf, -9.6, q, 0.7, 0);
      project(gx, gy, pf, 9.6, q, 0.7, 1);
      g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
    }
    project(gx, gy, pf, -10, -12, 0.7, 0);
    project(gx, gy, pf, 10, -12, 0.7, 1);
    g.lineStyle(0.8, GOLD, 0.9);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
}
export function solarShadow(g: Ink, gx: number, gy: number, s: Solar) {
  for (let w = 0; w < s.wings; w++) {
    const side = s.wings === 1 ? 0 : w ? 1 : -1;
    boxShadow(g, gx + Math.cos(s.a) * side * 13 + 6, gy + Math.sin(s.a) * side * 13 * SQUASH + 4, s.a, 11, 8, 6, 0.3);
  }
}

// ── Cargo pods ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pod { p: number; q: number; z: number; color: number }
export interface Cargo { a: number; pods: Pod[] }
const PODS = [0xd8dce4, 0xe0a040, 0x4a7ac8, 0xc84a3a, 0x8a96a8] as const;
export function cargoOf(rand: Random): Cargo {
  const c = () => PODS[Math.floor(rand() * PODS.length)],
    roll = rand();
  return {
    a: (rand() - 0.5) * 0.6,
    pods: roll < 0.4 ? [{ p: -6, q: 0, z: 0, color: c() }, { p: 6, q: 0, z: 0, color: c() }, { p: 0, q: 0, z: 9, color: c() }] : roll < 0.75 ? [{ p: -6, q: -3, z: 0, color: c() }, { p: 7, q: 3, z: 0, color: c() }] : [{ p: 0, q: 0, z: 0, color: c() }],
  };
}
/** Cargo pods: rounded cases with a dark band and a stencilled stripe, locked into a magnetic clamp rail on the deck. */
export function drawCargo(g: Ink, gx: number, gy: number, c: Cargo) {
  box(g, gx, gy, frame(c.a, 0, 0), -15, 15, -8, 8, 0, 1.5, DARK);
  for (const p of [...c.pods].sort((u, v) => u.z - v.z || u.q - v.q)) {
    const f = frame(c.a, 0, 1.5 + p.z, Math.cos(c.a) * p.p - Math.sin(c.a) * p.q, Math.sin(c.a) * p.p + Math.cos(c.a) * p.q);
    box(g, gx, gy, f, -5.5, 5.5, -6.5, 6.5, 0, 9, p.color);
    box(g, gx, gy, f, -5.7, 5.7, -6.7, 6.7, 3.5, 5.5, 0x2a3040);
    project(gx, gy, f, -4, 6.75, 6.5, 0);
    project(gx, gy, f, -1, 6.75, 6.5, 1);
    project(gx, gy, f, -1, 6.75, 8, 2);
    project(gx, gy, f, -4, 6.75, 8, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x1a1e28);
  }
}
export function cargoShadow(g: Ink, gx: number, gy: number, c: Cargo) {
  boxShadow(g, gx, gy, c.a, 14, 7, c.pods.some((p) => p.z) ? 20 : 11);
}

// ── Pressure spheres ────────────────────────────────────────────────────────────────────────────────────────────────
export interface Spheres { flip: boolean; color: number }
export const spheresOf = (rand: Random): Spheres => ({ flip: rand() < 0.5, color: rand() < 0.6 ? 0xd8dce4 : 0xe8c060 });
/** Two pressure spheres in cradles of struts, joined by a pipe, a ladder of hazard paint between. */
export function drawSpheres(g: Ink, gx: number, gy: number, s: Spheres) {
  const k = s.flip ? -1 : 1,
    list = [{ u: -8 * k, v: -4, r: 9 }, { u: 9 * k, v: 4, r: 7 }].sort((p, q) => p.v - q.v);
  for (const b of list) {
    const x = gx + b.u,
      y = gy + b.v * SQUASH;
    drum(g, x, y, b.r * 0.7, 0, 3, DARK, 0x3a4460, 10);
    for (const a of [0.8, 2.3, 3.9, 5.4]) rod(g, x, y, Math.cos(a) * b.r * 0.6, Math.sin(a) * b.r * 0.6, 3, Math.cos(a) * b.r * 0.4, Math.sin(a) * b.r * 0.4, b.r * 0.6, 1, 0x8a92a4);
    sphere(g, x, y, b.r, b.r + 3, s.color);
    g.lineStyle(1.2, 0x2a3040, 0.8);
    g.lineBetween(x - b.r, Y(y, 0, b.r + 3), x + b.r, Y(y, 0, b.r + 3));
  }
  rod(g, gx, gy, list[0].u, list[0].v, 8, list[1].u, list[1].v, 6, 1.4, 0x8a92a4);
}
export function spheresShadow(g: Ink, gx: number, gy: number, s: Spheres) {
  const k = s.flip ? -1 : 1;
  roundShadow(g, gx - 8 * k, gy - 4 * SQUASH, 9, 20);
  roundShadow(g, gx + 9 * k, gy + 4 * SQUASH, 7, 16);
}

// ── Robotic arm ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Arm { a: number; lift: number }
export const armOf = (rand: Random): Arm => ({ a: rand() * Math.PI * 2, lift: 0.4 + rand() * 0.5 });
/** Where the arm's wrist lamp sits (ground u, v, height). */
export function wristOf(a: Arm) {
  const elbow = { u: Math.cos(a.a) * 6, v: Math.sin(a.a) * 6, h: 10 + 16 * a.lift };
  return { u: elbow.u + Math.cos(a.a) * 14, v: elbow.v + Math.sin(a.a) * 14, h: elbow.h - 6 + 4 * a.lift, elbow };
}
/** A station's robotic arm: a turret base, two white boom segments with joints, a gripper at the end. */
export function drawArm(g: Ink, gx: number, gy: number, a: Arm) {
  drum(g, gx, gy, 7, 0, 3, DARK, 0x3a4460, 12);
  drum(g, gx, gy, 4.6, 3, 9, HULL, shade(HULL, 0.1), 12);
  const w = wristOf(a),
    e = w.elbow,
    order = Math.sin(a.a) < 0;
  const boom = () => {
    rod(g, gx, gy, 0, 0, 9, e.u, e.v, e.h, 3.4, HULL);
    disc(g, X(gx, e.u), Y(gy, e.v, e.h), 2.8, 0x5a6478);
    rod(g, gx, gy, e.u, e.v, e.h, w.u, w.v, w.h, 2.8, HULL);
    disc(g, X(gx, w.u), Y(gy, w.v, w.h), 2.2, 0x5a6478);
    for (const s of [-1, 1]) rod(g, gx, gy, w.u, w.v, w.h, w.u + Math.cos(a.a + s * 0.5) * 4, w.v + Math.sin(a.a + s * 0.5) * 4, w.h - 3, 1, 0x8a92a4);
  };
  if (order) boom();
  disc(g, X(gx, 0), Y(gy, 0, 9.5), 3, 0x5a6478);
  if (!order) boom();
}
export function armShadow(g: Ink, gx: number, gy: number, a: Arm) {
  const w = wristOf(a);
  roundShadow(g, gx, gy, 7, 6);
  g.lineStyle(3, SHADE, 0.22);
  g.lineBetween(gx + 3, gy + 2, gx + w.u + w.h * SUN.x, gy + w.v * SQUASH + w.h * SUN.y);
}

// ── Dish antenna ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the dish's feed horn tip. */
export const DISH_FEED = 30;
/** A dish antenna on a pedestal: a white dish tipped up and to one side on its yoke, a feed horn on three struts. */
export function drawDish(g: Ink, gx: number, gy: number, a: number) {
  box(g, gx, gy, frame(a, 0, 0), -6, 6, -6, 6, 0, 3, DARK);
  drum(g, gx, gy, 2.6, 3, 14, 0x8a92a4, 0xa8b0c0, 10);
  const f = frame(a, 0.9, 16);
  plane(g, gx, gy, f, -1, 11, OUTLINE, 0.9, 11, 18);
  plane(g, gx, gy, f, 0, 10.4, HULL, 1, 10.4, 18);
  plane(g, gx, gy, f, 0.6, 7.6, shade(HULL, -0.15), 1, 7.6, 18);
  project(gx, gy, f, 13, 0, 0, 0);
  const tip = { x: SX[0], y: SY[0] };
  for (const t of [0, 2.1, 4.2]) {
    project(gx, gy, f, 0.5, Math.cos(t) * 9, Math.sin(t) * 9, 1);
    g.lineStyle(0.8, 0x8a92a4);
    g.lineBetween(SX[1], SY[1], tip.x, tip.y);
  }
  disc(g, tip.x, tip.y, 1.4, 0x5a6478);
}
export const dishTip = (a: number) => {
  project(0, 0, frame(a, 0.9, 16), 13, 0, 0, 0);
  return { x: SX[0], y: SY[0] };
};
export function dishShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx + 4, gy + 2, 11, 18);
}

// ── Hydroponics dome ────────────────────────────────────────────────────────────────────────────────────────────────
/** A hydroponics pod: a glass dome over rows of green plants under grow lights, on a ringed base. */
export function drawHydro(g: Ink, gx: number, gy: number) {
  drum(g, gx, gy, 14, 0, 4, DARK, 0x3a4460, 16);
  oval(g, gx, Y(gy, 0, 4), 12.5, 12.5 * SQUASH, 0x1a2a20);
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) disc(g, X(gx, i * 4.4), Y(gy, j * 5, 5.5), 2.2, j % 2 ? 0x3a9a4a : 0x4ab85a);
  // The glass: a pale, see-through dome with a bright rim highlight.
  g.fillStyle(0xc8e8ff, 0.18);
  g.fillPoints(Array.from({ length: 25 }, (_, i) => {
    const t = Math.PI + (i / 24) * Math.PI;
    return { x: gx + Math.cos(t) * 12.5, y: Y(gy, 0, 4) + Math.sin(t) * 12 };
  }), true);
  g.lineStyle(1, 0xe8f4ff, 0.6);
  g.strokePoints(Array.from({ length: 13 }, (_, i) => {
    const t = Math.PI * 1.05 + (i / 12) * Math.PI * 0.45;
    return { x: gx + Math.cos(t) * 10, y: Y(gy, 0, 4) + Math.sin(t) * 9.6 };
  }), false);
  g.lineStyle(0.6, 0xa8c8e8, 0.5);
  g.lineBetween(gx, Y(gy, 0, 4) - 12, gx, Y(gy, 0, 4) + 12 * SQUASH * 0.2);
}
export function hydroShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 14, 10);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the shuttle's engines glow and its nav lights sit (screen offsets at full size). */
export const SHUTTLE = { engines: [{ u: -40, v: -6, h: 22 }, { u: -40, v: 6, h: 22 }], nav: [{ u: -10, v: -36, h: 18 }, { u: -10, v: 36, h: 18 }] } as const;
/**
 * A shuttle docked on a landing pad: a hexagonal pad with hazard edges and lamps, the craft on its landing struts, a
 * white fuselage with a dark cockpit, swept wings, a tail fin and two engine bells at the back.
 */
export function drawShuttle(g: Ink) {
  drum(g, 0, 0, 46, 0, 3, 0x3a4460, 0x4a5470, 6);
  for (let i = 0; i < 6; i++) {
    const t0 = (i / 6) * Math.PI * 2,
      t1 = t0 + Math.PI / 6;
    g.lineStyle(2.4, i % 2 ? 0xe0b040 : 0x1a1e28, 0.9);
    g.lineBetween(X(0, Math.cos(t0) * 42), Y(0, Math.sin(t0) * 42, 3), X(0, Math.cos(t1) * 42), Y(0, Math.sin(t1) * 42, 3));
  }
  for (const [u, v] of [[-18, -8], [-18, 8], [16, 0]]) rod(g, 0, 0, u, v, 3, u, v, 14, 1.6, 0x5a6478);
  // Wings, then the fuselage, then the fin.
  const wing = (s: number) => {
    project(0, 0, frame(0, 0, 14), -26, s * 4, 0, 0);
    project(0, 0, frame(0, 0, 14), 4, s * 4, 0, 1);
    project(0, 0, frame(0, 0, 14), -18, s * 36, 0, 2);
    project(0, 0, frame(0, 0, 14), -30, s * 36, 0, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], s < 0 ? shade(HULL, -0.05) : shade(HULL, -0.18));
    g.lineStyle(1.2, 0x2a3040, 0.9);
    g.lineBetween(SX[2], SY[2], SX[3], SY[3]);
  };
  wing(-1);
  tube(g, 0, 0, 0, 20, -38, 26, 7.5, HULL);
  endFace(g, 0, 0, 0, 20, -38, 7.5, shade(HULL, -0.3));
  for (const e of SHUTTLE.engines) {
    endFace(g, X(0, 0), Y(0, e.v, 0), Math.PI, e.h, 38, 3.6, 0x2a3040);
    endFace(g, X(0, 0), Y(0, e.v, 0), Math.PI, e.h, 38.5, 2.4, 0x0a0e18);
  }
  // The nose cone and the cockpit's dark glazing.
  tube(g, 0, 0, 0, 20, 26, 34, 5.4, HULL);
  tube(g, 0, 0, 0, 20, 34, 38, 3, shade(HULL, -0.05));
  project(0, 0, frame(0, 0, 20), 22, -5, 5.5, 0);
  project(0, 0, frame(0, 0, 20), 30, -3.5, 4.5, 1);
  project(0, 0, frame(0, 0, 20), 30, 3.5, 4.5, 2);
  project(0, 0, frame(0, 0, 20), 22, 5, 5.5, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x1a2a48);
  g.lineStyle(1.2, 0x3a5aa8);
  g.lineBetween(SX[0], SY[0] + 0.6, SX[1], SY[1] + 0.6);
  g.lineStyle(2, 0x2a5ac8, 0.9);
  g.lineBetween(X(0, -30), Y(0, 7.4, 20), X(0, 20), Y(0, 7.4, 20));
  wing(1);
  box(g, 0, 0, frame(0, 0, 26), -36, -24, -1, 1, 0, 14, shade(HULL, -0.08));
}
export function shuttleShadow(g: Ink) {
  boxShadow(g, 8, 6, 0, 36, 32, 14, 0.25);
}
/** The comms array's beacon height and its dishes (ground u, v, height at full size). */
export const COMMS = { beacon: 76 } as const;
/** A comms array: a lattice tower on a plinth, dishes at three heights turned different ways, an aerial on top. */
export function drawComms(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -24, 24, -18, 18, 0, 4, DARK);
  box(g, 0, 0, frame(0, 0, 0), -10, 10, -8, 8, 4, 12, 0x3a4460);
  const legs = [[-6, -5], [6, -5], [-6, 5], [6, 5]],
    leg = ([u, v]: number[]) => rod(g, 0, 0, u, v, 12, u * 0.35, v * 0.35, 64, 1.6, 0x8a92a4);
  leg(legs[0]);
  leg(legs[1]);
  for (let h = 16; h < 62; h += 8) {
    const k = 1 - ((h - 12) / 52) * 0.65;
    rod(g, 0, 0, -6 * k, 5 * k, h, 6 * k, 5 * k, h + 7, 0.6, 0x8a92a4);
    rod(g, 0, 0, 6 * k, 5 * k, h, -6 * k, 5 * k, h + 7, 0.6, 0x8a92a4);
  }
  leg(legs[2]);
  leg(legs[3]);
  for (const [a, h, r] of [[-0.6, 30, 9], [2.4, 46, 7], [0.4, 58, 6]] as const) {
    const f = frame(a, 0.5, h, Math.cos(a) * 6, Math.sin(a) * 6);
    plane(g, 0, 0, f, -0.6, r + 0.6, OUTLINE, 0.9, r + 0.6, 16);
    plane(g, 0, 0, f, 0, r, HULL, 1, r, 16);
    plane(g, 0, 0, f, 0.4, r * 0.6, shade(HULL, -0.15), 1, r * 0.6, 16);
  }
  drum(g, 0, 0, 3, 64, 66, 0x3a4460, 0x4a5470, 8);
  rod(g, 0, 0, 0, 0, 66, 0, 0, COMMS.beacon, 0.9, 0xa8b0c0);
}
export function commsShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 24, 18, 4, 0.3);
  g.lineStyle(6, SHADE, 0.18);
  g.lineBetween(0, 0, COMMS.beacon * SUN.x, COMMS.beacon * SUN.y);
}
