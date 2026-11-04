import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, drum, endFace, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import type { Random } from "./kit";

// The props of the Border Zone outpost (`outpost.ts`), drawn in the towers' 3/4 tilt: supply crates, fuel drums,
// sandbag walls, concrete barriers, floodlight masts, shipping containers and generators, plus the watchtower and the
// helipad landmarks and the perimeter fence and tank traps of no-man's-land. Every prop stands on a ground point
// (gx, gy) in pixels and is rolled up front into a plain record, so its body and shadow always agree.

/** Shadow colour on concrete: cool and see-through. */
export const SHADE = 0x05090c;
/** Light falls from the upper left: a point `h` px up casts its shadow this far right and down on the ground. */
export const SUN = { x: 0.5, y: 0.3 } as const;

/** The shadow of a box footprint (ground half sizes, turned by a) of height h, thrown to the lower right in steps. */
function boxShadow(g: Ink, gx: number, gy: number, a: number, hp: number, hq: number, h: number, alpha = 0.32) {
  const c = Math.cos(a),
    s = Math.sin(a),
    corner = (p: number, q: number, k: number) => ({ x: gx + p * c - q * s + h * SUN.x * k, y: gy + (p * s + q * c) * SQUASH + h * SUN.y * k });
  g.fillStyle(SHADE, alpha / 3);
  for (const k of [0, 0.5, 1]) g.fillPoints([corner(-hp, -hq, k), corner(hp, -hq, k), corner(hp, hq, k), corner(-hp, hq, k)], true);
}

// ── Crates ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Crate { du: number; dv: number; a: number; s: number; z: number; color: number; mark: boolean }
const CRATE_PAINT = [0x4a5a3c, 0x3c4e50, 0x5e5236, 0x3a4436] as const;
/** A strapped supply crate: lit top, two steel straps wrapping it, a stencilled chevron on the top. */
function crate(g: Ink, gx: number, gy: number, c: Crate) {
  const f = frame(c.a, 0, c.z, c.du, c.dv),
    h = c.s * 1.1;
  box(g, gx, gy, f, -c.s, c.s, -c.s * 0.8, c.s * 0.8, 0, h, c.color);
  for (const p of [-0.55, 0.55]) box(g, gx, gy, f, c.s * p - 1.2, c.s * p + 1.2, -c.s * 0.8 - 0.4, c.s * 0.8 + 0.4, -0.2, h + 0.4, shade(c.color, -0.3));
  if (c.mark) {
    project(gx, gy, f, -c.s * 0.25, 0, h + 0.5, 0);
    project(gx, gy, f, c.s * 0.25, -c.s * 0.3, h + 0.5, 1);
    project(gx, gy, f, c.s * 0.25, c.s * 0.3, h + 0.5, 2);
    g.fillStyle(0xd8c070, 0.75);
    g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
  }
}
export function crateShadow(g: Ink, gx: number, gy: number, c: Crate) {
  boxShadow(g, gx + c.du, gy + c.dv * SQUASH, c.a, c.s, c.s * 0.8, c.z + c.s * 1.1);
}
/** One to three crates, sometimes a small one stacked on a big one. */
export function cratesOf(rand: Random): Crate[] {
  const paint = () => CRATE_PAINT[Math.floor(rand() * CRATE_PAINT.length)],
    crate = (du: number, dv: number, s: number, z = 0): Crate => ({ du, dv, a: (rand() - 0.5) * 0.9, s, z, color: paint(), mark: rand() < 0.6 }),
    roll = rand();
  if (roll < 0.3) return [crate(0, 0, 12 + rand() * 3)];
  if (roll < 0.65) {
    const big = crate(-2, 0, 12 + rand() * 2);
    return [big, { ...crate(-2 + (rand() - 0.5) * 4, (rand() - 0.5) * 3, 7.5, big.s * 1.1), a: big.a + (rand() - 0.5) * 0.6 }];
  }
  return [crate(-9, -6, 8.5 + rand() * 2), crate(9, -3, 8 + rand() * 2), crate(0, 9, 9 + rand() * 2)];
}
export function drawCrates(g: Ink, gx: number, gy: number, list: readonly Crate[]) {
  for (const c of [...list].sort((p, q) => p.dv + p.z * 0.01 - (q.dv + q.z * 0.01))) crate(g, gx, gy, c);
}

// ── Fuel drums ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Drum { du: number; dv: number; color: number; tipped: boolean }
const DRUM_PAINT = [0xb8402e, 0xc89a2a, 0x3e5a3a, 0x2e5a6a, 0x8a8a84] as const;
/** A 200-litre drum: two rolling hoops, a lit lid with its bung, a hazard band on the yellow ones. */
function fuelDrum(g: Ink, gx: number, gy: number, d: Drum) {
  const x = gx + d.du,
    y = gy + d.dv * SQUASH;
  drum(g, x, y, 5.4, 0, 13, d.color, shade(d.color, 0.18), 12);
  for (const h of [4.2, 8.8]) drum(g, x, y, 5.7, h - 0.5, h + 0.5, shade(d.color, -0.25), shade(d.color, -0.15), 12);
  oval(g, x, Y(y, 0, 13), 3.9, 3.9 * SQUASH, shade(d.color, 0.05));
  disc(g, x + 2, Y(y, 0, 13) - 0.6, 0.9, shade(d.color, -0.45));
}
/** A drum lying on its side, rolled off the cluster: a cylinder along the ground with its hoops and the lid towards the viewer. */
function lyingDrum(g: Ink, gx: number, gy: number, d: Drum) {
  const x = gx + d.du,
    y = gy + d.dv * SQUASH,
    a = 0.35;
  tube(g, x, y, a, 5.4, -6.5, 6.5, 5.4, d.color);
  for (const k of [-2.3, 2.3]) tube(g, x, y, a, 5.4, k - 0.5, k + 0.5, 5.7, shade(d.color, -0.25), 1, false);
  endFace(g, x, y, a, 5.4, 6.5, 5.4, shade(d.color, 0.08));
  endFace(g, x, y, a, 5.4, 6.6, 4, shade(d.color, -0.05));
}
export function drumsOf(rand: Random): Drum[] {
  const paint = () => DRUM_PAINT[Math.floor(rand() * DRUM_PAINT.length)],
    spots = [[-6, -5], [6, -6], [0, 4], [-11, 5], [10, 6]],
    n = 2 + Math.floor(rand() * 3),
    list = spots.slice(0, n).map(([du, dv]) => ({ du: du + (rand() - 0.5) * 2, dv: dv + (rand() - 0.5) * 2, color: paint(), tipped: false }));
  if (rand() < 0.4) list.push({ du: 12, dv: 12, color: paint(), tipped: true });
  return list;
}
export function drawDrums(g: Ink, gx: number, gy: number, list: readonly Drum[]) {
  for (const d of [...list].sort((p, q) => p.dv - q.dv)) (d.tipped ? lyingDrum : fuelDrum)(g, gx, gy, d);
}
export function drumsShadow(g: Ink, gx: number, gy: number, list: readonly Drum[]) {
  for (const d of list) {
    const x = gx + d.du,
      y = gy + d.dv * SQUASH;
    oval(g, x + (d.tipped ? 2 : 4), y + (d.tipped ? 1.5 : 3), d.tipped ? 10 : 7, d.tipped ? 4 : 4.5, SHADE, 0.28);
  }
}

// ── Sandbags ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Sandbags { a: number; arc: number; layers: number; r: number }
const BAG = 0xb09c70;
/** A curved wall of sandbags in two or three courses, staggered like bricks, each bag a soft pillow-shaped block. */
export function drawSandbags(g: Ink, gx: number, gy: number, w: Sandbags) {
  const bags: { u: number; v: number; a: number; z: number; k: number }[] = [];
  for (let layer = 0; layer < w.layers; layer++) {
    const n = 6 - (layer % 2);
    for (let i = 0; i < n; i++) {
      const t = (i + (layer % 2) * 0.5) / 5 - 0.5,
        ang = w.a + t * w.arc;
      bags.push({ u: Math.cos(ang) * w.r, v: Math.sin(ang) * w.r - 4, a: ang + Math.PI / 2, z: layer * 3.6, k: i + layer * 7 });
    }
  }
  bags.sort((p, q) => p.z - q.z || p.v - q.v);
  for (const b of bags) {
    const tone = shade(BAG, 0.1 * (hash01(b.k, w.r) - 0.5)),
      f = frame(b.a, 0, b.z, b.u, b.v);
    box(g, gx, gy, f, -4.6, 4.6, -2.6, 2.6, 0, 3.4, tone);
    // A tied-off end and a soft crease on top.
    project(gx, gy, f, -3.4, 0, 3.5, 0);
    project(gx, gy, f, 3.4, 0, 3.5, 1);
    g.lineStyle(0.6, shade(tone, -0.3), 0.7);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
}
export function sandbagsShadow(g: Ink, gx: number, gy: number, w: Sandbags) {
  for (let i = 0; i < 6; i++) {
    const ang = w.a + (i / 5 - 0.5) * w.arc;
    oval(g, gx + Math.cos(ang) * w.r + 3, gy + (Math.sin(ang) * w.r - 4) * SQUASH + 2.5, 7, 3.6, SHADE, 0.2);
  }
}
export const sandbagsOf = (rand: Random): Sandbags => ({ a: Math.PI / 2 + (rand() - 0.5) * 1.2, arc: 1.6 + rand() * 0.8, layers: 2 + Math.floor(rand() * 2), r: 14 + rand() * 4 });

// ── Concrete barriers ───────────────────────────────────────────────────────────────────────────────────────────────
export interface Barrier { du: number; dv: number; a: number }
const CONCRETE = 0x9a9a90;
/** A jersey barrier: a wide foot, a narrower top and a reflective orange band. */
function barrier(g: Ink, gx: number, gy: number, b: Barrier) {
  const f = frame(b.a, 0, 0, b.du, b.dv);
  box(g, gx, gy, f, -11, 11, -4, 4, 0, 4, shade(CONCRETE, -0.08));
  box(g, gx, gy, f, -11, 11, -2.6, 2.6, 4, 11, CONCRETE);
  // Reflective band on the long side turned to the viewer.
  const q = Math.cos(b.a) > 0 ? 2.65 : -2.65;
  for (const [p0, p1, color] of [[-11, -3.7, 0xd8742e], [-3.7, 3.7, 0xe8e4d8], [3.7, 11, 0xd8742e]] as const) {
    project(gx, gy, f, p0, q, 7.4, 0);
    project(gx, gy, f, p1, q, 7.4, 1);
    project(gx, gy, f, p1, q, 9, 2);
    project(gx, gy, f, p0, q, 9, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color);
  }
}
export function barriersOf(rand: Random): Barrier[] {
  const a = (rand() - 0.5) * 0.6;
  return rand() < 0.5 ? [{ du: -1, dv: -6, a }, { du: 3, dv: 7, a: a + (rand() - 0.5) * 0.5 }] : [{ du: -6, dv: -4, a: a + 0.5 }, { du: 8, dv: 6, a: a - 0.5 }];
}
export function drawBarriers(g: Ink, gx: number, gy: number, list: readonly Barrier[]) {
  for (const b of [...list].sort((p, q) => p.dv - q.dv)) barrier(g, gx, gy, b);
}
export function barriersShadow(g: Ink, gx: number, gy: number, list: readonly Barrier[]) {
  for (const b of list) boxShadow(g, gx + b.du, gy + b.dv * SQUASH, b.a, 11, 4, 11, 0.28);
}

// ── Floodlight mast ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the mast's lamps in px. */
export const MAST_HEIGHT = 50;
/** A mast's two lamps for its facing `a`: ground offset (u, v) at the lamp height, screen offset (x, y), and where
 * each beam lands on the ground (gx, gy, screen offsets from the mast's foot). */
export function mastLamps(a: number) {
  return [-1, 1].map((side) => {
    const u = Math.cos(a) * 3 - Math.sin(a) * side * 5,
      v = Math.sin(a) * 3 + Math.cos(a) * side * 5;
    return { u, v, x: u, y: v * SQUASH - MAST_HEIGHT, gx: Math.cos(a + side * 0.35) * 40, gy: Math.sin(a + side * 0.35) * 40 * SQUASH };
  });
}
/** A lattice mast on a concrete foot, a crossbar with two lamp heads turned to `a`, and a cable box at its base. */
export function drawMast(g: Ink, gx: number, gy: number, a: number) {
  box(g, gx, gy, frame(0, 0, 0), -5, 5, -5, 5, 0, 3, CONCRETE);
  box(g, gx, gy, frame(a, 0, 0, -6 * Math.cos(a), -6 * Math.sin(a)), -2.5, 2.5, -3.5, 3.5, 0, 8, 0x4a5458);
  for (const [u, v] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) rod(g, gx, gy, u, v, 3, u * 0.3, v * 0.3, MAST_HEIGHT - 2, 1.1, 0x6a7478);
  for (let h = 10; h < MAST_HEIGHT - 4; h += 8) {
    const k = 1 - (h / MAST_HEIGHT) * 0.7;
    rod(g, gx, gy, -2 * k, 2 * k, h, 2 * k, 2 * k, h + 6, 0.6, 0x5a6468);
  }
  const lamps = mastLamps(a);
  rod(g, gx, gy, -Math.sin(a) * 7, Math.cos(a) * 7, MAST_HEIGHT, Math.sin(a) * 7, -Math.cos(a) * 7, MAST_HEIGHT, 1.4, 0x6a7478);
  for (const l of lamps) box(g, gx, gy, frame(a, -0.5, MAST_HEIGHT, l.u, l.v), -2, 2.5, -2.4, 2.4, -2, 2, 0x3a4246, 0xf0ead0);
}
export function mastShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(2.5, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + MAST_HEIGHT * SUN.x, gy + MAST_HEIGHT * SUN.y);
  oval(g, gx + MAST_HEIGHT * SUN.x, gy + MAST_HEIGHT * SUN.y, 8, 3, SHADE, 0.2);
}

// ── Shipping container ──────────────────────────────────────────────────────────────────────────────────────────────
export interface Container { a: number; color: number; open: boolean }
const CONTAINER_PAINT = [0xb0522e, 0x2e6a7a, 0x7a8a3a, 0xc88a2a, 0x8a3a3a] as const;
/** A corrugated steel container: ribs down its long side, door bars on the end facing the viewer, a stencil band. */
export function drawContainer(g: Ink, gx: number, gy: number, c: Container) {
  const f = frame(c.a, 0, 0),
    L = 21,
    W = 9,
    H = 17;
  box(g, gx, gy, f, -L, L, -W, W, 0, H, c.color);
  // Ribs on the long side turned to the viewer.
  const q = Math.cos(c.a) > 0 ? W : -W;
  g.lineStyle(0.8, shade(c.color, -0.35), 0.8);
  for (let p = -L + 2.5; p < L; p += 2.6) {
    project(gx, gy, f, p, q, 0.6, 0);
    project(gx, gy, f, p, q, H - 0.6, 1);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  // Door end, when it faces the viewer: two doors and their locking bars.
  const end = Math.sin(c.a) > 0 ? L : -L;
  if (Math.abs(Math.sin(c.a)) > 0.15) {
    g.lineStyle(0.9, shade(c.color, -0.45), 0.9);
    for (const qq of [-W * 0.5, 0, W * 0.5]) {
      project(gx, gy, f, end, qq, 1, 0);
      project(gx, gy, f, end, qq, H - 1, 1);
      g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
    }
  }
  // A pale stencil band near the top of the long side.
  project(gx, gy, f, -L * 0.6, q, H * 0.72, 0);
  project(gx, gy, f, L * 0.2, q, H * 0.72, 1);
  project(gx, gy, f, L * 0.2, q, H * 0.84, 2);
  project(gx, gy, f, -L * 0.6, q, H * 0.84, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0xe8e0c8, 0.55);
}
export function containerShadow(g: Ink, gx: number, gy: number, c: Container) {
  boxShadow(g, gx, gy, c.a, 21, 9, 17);
}
export const containerOf = (rand: Random): Container => ({ a: (rand() - 0.5) * 0.9 + (rand() < 0.5 ? Math.PI : 0), color: CONTAINER_PAINT[Math.floor(rand() * CONTAINER_PAINT.length)], open: rand() < 0.3 });

// ── Generator ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where a generator's exhaust pipe ends (screen offset from its ground point), for its facing `a`. */
export const exhaustTip = (a: number) => ({ x: Math.cos(a) * -9, y: Math.sin(a) * -9 * SQUASH - 20 });
/** A skid generator: housing with a vent grille, a control box, an exhaust stack and a cable snaking off. */
export function drawGenerator(g: Ink, gx: number, gy: number, a: number) {
  const f = frame(a, 0, 0);
  box(g, gx, gy, f, -14, 14, -9, 9, 0, 2, 0x3a3e40);
  box(g, gx, gy, f, -12, 10, -8, 8, 2, 13, 0xc8a238);
  for (let p = -9; p < 4; p += 2.2) {
    project(gx, gy, f, p, -5, 13.2, 0);
    project(gx, gy, f, p, 5, 13.2, 1);
    g.lineStyle(0.8, 0x6a5418, 0.8);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  box(g, gx, gy, f, 10, 14, -5, 3, 2, 10, 0x4a5054);
  const tip = exhaustTip(a);
  rod(g, gx, gy, Math.cos(a) * -9, Math.sin(a) * -9, 13, Math.cos(a) * -9, Math.sin(a) * -9, 20, 2.2, 0x3a3a38);
  disc(g, gx + tip.x, gy + tip.y, 1.3, 0x141414);
  g.lineStyle(1.4, 0x1a1a1a, 0.9);
  g.strokePoints([{ x: X(gx, Math.cos(a) * 14), y: Y(gy, Math.sin(a) * 14, 4) }, { x: gx + 18, y: gy + 8 }, { x: gx + 12, y: gy + 14 }, { x: gx + 20, y: gy + 18 }], false);
}
export function generatorShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 14, 9, 13);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the watchtower's searchlight in px (its frame's ground point at 0, 0). */
export const TOWER_LIGHT = { x: 6, h: 66 } as const;
const STEEL = 0x5a6468,
  CABIN = 0x4e5a4a;
/** A watchtower: four braced legs, a deck with a railing, a cabin with dark slit windows, a roof and a searchlight. */
export function drawWatchtower(g: Ink) {
  const legs = [[-14, -11], [14, -11], [-14, 11], [14, 11]] as const,
    deck = 40;
  for (const [u, v] of legs) box(g, 0, 0, frame(0, 0, 0, u, v), -3, 3, -3, 3, 0, 2, 0x8a8a80);
  for (const [u, v] of legs.slice(0, 2)) rod(g, 0, 0, u, v, 2, u * 0.75, v * 0.75, deck, 2, STEEL);
  for (const v of [-11, 11]) {
    rod(g, 0, 0, -14, v, 4, 14 * 0.85, v * 0.85, deck * 0.55, 0.9, STEEL);
    rod(g, 0, 0, 14, v, 4, -14 * 0.85, v * 0.85, deck * 0.55, 0.9, STEEL);
  }
  for (const [u, v] of legs.slice(2)) rod(g, 0, 0, u, v, 2, u * 0.75, v * 0.75, deck, 2, STEEL);
  // Ladder up the front.
  rod(g, 0, 0, -3, 12, 0, -3, 8.5, deck, 0.9, 0x6a7478);
  rod(g, 0, 0, 3, 12, 0, 3, 8.5, deck, 0.9, 0x6a7478);
  for (let h = 4; h < deck; h += 4) rod(g, 0, 0, -3, 12 - h * 0.09, h, 3, 12 - h * 0.09, h, 0.6, 0x7a8488);
  box(g, 0, 0, frame(0, 0, 0), -16, 16, -13, 13, deck, deck + 2, 0x6a5a40);
  box(g, 0, 0, frame(0, 0, 0), -11, 11, -9, 9, deck + 2, deck + 16, CABIN);
  // Slit windows on the cabin's front, a glint of the light inside.
  for (const u of [-7, 0, 7]) quad(g, X(0, u - 2.6), Y(0, 9, deck + 9), X(0, u + 2.6), Y(0, 9, deck + 9), X(0, u + 2.6), Y(0, 9, deck + 13), X(0, u - 2.6), Y(0, 9, deck + 13), 0x141c1c);
  // Railing round the deck.
  for (const [u0, v0, u1, v1] of [[-16, 13, 16, 13], [-16, -13, -16, 13], [16, -13, 16, 13]] as const) {
    rod(g, 0, 0, u0, v0, deck + 7, u1, v1, deck + 7, 0.8, STEEL);
    for (let k = 0; k <= 4; k++) rod(g, 0, 0, u0 + ((u1 - u0) * k) / 4, v0 + ((v1 - v0) * k) / 4, deck + 2, u0 + ((u1 - u0) * k) / 4, v0 + ((v1 - v0) * k) / 4, deck + 7, 0.6, STEEL);
  }
  box(g, 0, 0, frame(0, 0, 0), -14, 14, -12, 12, deck + 16, deck + 18.5, 0x3a4040);
  // Searchlight on the roof.
  drum(g, X(0, TOWER_LIGHT.x), 0, 3.2, deck + 18.5, TOWER_LIGHT.h - 1, 0x2a3032, 0x4a5256, 10);
  disc(g, X(0, TOWER_LIGHT.x), Y(0, 0, TOWER_LIGHT.h), 3, 0xf6f0d8);
}
export function watchtowerShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 16, 13, 58, 0.3);
  oval(g, 34, 22, 26, 14, SHADE, 0.08);
}
/** Helipad: a raised concrete pad with its H in a circle, landing lights round the rim, a windsock and a fuel bowser. */
export function drawHelipad(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -34, 34, -28, 28, 0, 3, 0x6e706a);
  const ring = 21;
  g.lineStyle(2.5, 0xe8e0c8, 0.85);
  g.beginPath();
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * Math.PI * 2,
      x = Math.cos(t) * ring,
      y = Math.sin(t) * ring * SQUASH - 3;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.strokePath();
  g.fillStyle(0xe8e0c8, 0.9);
  for (const u of [-7, 5]) g.fillRect(u, -3 - 8 * SQUASH, 2.4, 16 * SQUASH);
  g.fillRect(-7, -3 - 1, 14.4, 2);
  // Windsock on a thin mast at the corner.
  rod(g, 0, 0, 30, -24, 3, 30, -24, 28, 0.9, 0xa8a8a0);
  g.save();
  g.scaleCanvas(1.35, 1.35);
  dropship(g);
  g.restore();
}
const HULL = 0x5e6a5c;
/** A parked VTOL dropship on the pad: skids, a boxy hull with a nose and tail boom, stub wings with two ducted fans. */
function dropship(g: Ink) {
  const a = -0.35,
    f = (z: number) => frame(a, 0, z),
    at = (p: number, q: number) => ({ u: Math.cos(a) * p - Math.sin(a) * q, v: Math.sin(a) * p + Math.cos(a) * q });
  for (const q of [-6, 6]) box(g, 0, 0, f(3), -12, 12, q - 0.8, q + 0.8, 0, 1.4, 0x3a3e40);
  for (const [p, q] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
    const o = at(p, q);
    rod(g, 0, 0, o.u, o.v, 4, o.u * 0.85, o.v * 0.85, 8, 0.8, 0x3a3e40);
  }
  box(g, 0, 0, f(8), -24, -12, -1.8, 1.8, 1, 4, HULL);
  box(g, 0, 0, f(8), -27, -23, -0.6, 0.6, 1, 8, shade(HULL, -0.1));
  box(g, 0, 0, f(8), -12, 12, -6, 6, 0, 9, HULL);
  box(g, 0, 0, f(8), 12, 18, -4.5, 4.5, 0.5, 7, shade(HULL, 0.06));
  // Cockpit glass on the nose, a mint stripe down the hull.
  const glass = [[12.5, -4], [17.5, -3], [17.5, 3], [12.5, 4]].map(([p, q]) => at(p, q));
  g.fillStyle(0x203a48);
  g.fillPoints(glass.map((o) => ({ x: X(0, o.u), y: Y(0, o.v, 15.2) })), true);
  g.fillStyle(0x6a9aaa, 0.6);
  g.fillPoints(glass.slice(0, 2).concat([at(15, 0)]).map((o) => ({ x: X(0, o.u), y: Y(0, o.v, 15.3) })), true);
  for (const p of [-10, 6]) {
    const o0 = at(p, -6.05),
      o1 = at(p + 3, -6.05);
    quad(g, X(0, o0.u), Y(0, o0.v, 9), X(0, o1.u), Y(0, o1.v, 9), X(0, o1.u), Y(0, o1.v, 14), X(0, o0.u), Y(0, o0.v, 14), 0x93f5b8, 0.7);
  }
  box(g, 0, 0, f(15), -4, 4, -16, 16, 0, 1.6, shade(HULL, -0.05));
  for (const q of [-17, 17]) {
    const o = at(0, q);
    drum(g, X(0, o.u), Y(0, o.v, 0), 5, 13, 18, 0x4a5450, 0x2a3030, 12);
    disc(g, X(0, o.u), Y(0, o.v, 18), 1.4, 0x6a7470);
  }
}
export function helipadShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 34, 28, 3, 0.3);
  boxShadow(g, 0, -3, -0.35, 24, 19, 22, 0.25);
}
/** The landing lights round the helipad's ring (screen offsets), in order round the circle. */
export const HELIPAD_LIGHTS = Array.from({ length: 12 }, (_, i) => {
  const t = (i / 12) * Math.PI * 2;
  return { x: Math.cos(t) * 30, y: Math.sin(t) * 25 * SQUASH - 3 };
});
/** The windsock: a striped cone off the mast top, flapping with the clock and pointing downwind. */
export function windsock(g: Ink, x: number, y: number, k: number, clock: number) {
  const top = { x: x + X(0, 30) * k, y: y + Y(0, -24, 27) * k },
    flap = Math.sin(clock * 3.1) * 0.12 + Math.sin(clock * 7.3) * 0.05;
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4,
      t1 = (i + 1) / 4,
      p0 = { x: top.x + Math.cos(0.25 + flap * i) * 13 * k * t0, y: top.y + Math.sin(0.25 + flap * i) * 13 * k * t0 + 2 * k * t0 },
      p1 = { x: top.x + Math.cos(0.25 + flap * (i + 1)) * 13 * k * t1, y: top.y + Math.sin(0.25 + flap * (i + 1)) * 13 * k * t1 + 2 * k * t1 },
      r0 = (2.4 - t0 * 1.2) * k,
      r1 = (2.4 - t1 * 1.2) * k;
    quad(g, p0.x, p0.y - r0, p1.x, p1.y - r1, p1.x, p1.y + r1, p0.x, p0.y + r0, i % 2 ? 0xf0ece0 : 0xe8602e);
  }
}

// ── No-man's-land: the fence and tank traps ─────────────────────────────────────────────────────────────────────────
/** A stretch of chain-link fence between two ground points: posts, see-through mesh, razor wire coiled along the top. */
export function drawFence(g: Ink, x0: number, y0: number, x1: number, y1: number) {
  const h = 15,
    len = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2),
    posts = Math.max(1, Math.round(len / 14));
  g.fillStyle(0x8a9498, 0.18);
  g.fillPoints([{ x: x0, y: y0 - 1 }, { x: x1, y: y1 - 1 }, { x: x1, y: y1 - h }, { x: x0, y: y0 - h }], true);
  g.lineStyle(0.5, 0xa8b0b4, 0.45);
  for (let d = 0; d < len; d += 3) {
    const t = d / len,
      x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    g.lineBetween(x, y - 1, Math.min(x + 6, x0 + (x1 - x0) * Math.min(1, (d + 6) / len)), y - h + 1);
  }
  g.lineStyle(0.8, 0x7a8488, 0.9);
  g.lineBetween(x0, y0 - h, x1, y1 - h);
  for (let i = 0; i <= posts; i++) {
    const t = i / posts,
      x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    g.lineStyle(2.4, OUTLINE, 0.8);
    g.lineBetween(x, y, x, y - h - 2);
    g.lineStyle(1.4, 0x8a9498);
    g.lineBetween(x, y, x, y - h - 2);
  }
  // Razor wire: little loops along the top bar.
  g.lineStyle(0.7, 0xc0c8cc, 0.85);
  for (let d = 0; d < len; d += 3.4) {
    const t = d / len,
      x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t - h - 2.2;
    g.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      if (k) g.lineTo(x + Math.cos(a) * 2.2, y + Math.sin(a) * 1.6);
      else g.moveTo(x + 2.2, y);
    }
    g.strokePath();
  }
}
export function fenceShadow(g: Ink, x0: number, y0: number, x1: number, y1: number) {
  g.fillStyle(SHADE, 0.12);
  g.fillPoints([{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x1 + 15 * SUN.x, y: y1 + 15 * SUN.y }, { x: x0 + 15 * SUN.x, y: y0 + 15 * SUN.y }], true);
}
/** A Czech hedgehog: three rusted steel beams crossed at their middles, standing on three of their ends. */
export function drawHedgehog(g: Ink, gx: number, gy: number, a: number) {
  const beams = [0, 2.1, 4.2].map((t) => t + a),
    rust = 0x6a4a32;
  for (const b of beams) rod(g, gx, gy, Math.cos(b) * 11, Math.sin(b) * 11, 0, -Math.cos(b) * 8, -Math.sin(b) * 8, 19, 3, rust);
  disc(g, gx, gy - 9.5, 2.2, shade(rust, -0.3));
}
export function hedgehogShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 7, gy + 4, 13, 5.5, SHADE, 0.22);
}
