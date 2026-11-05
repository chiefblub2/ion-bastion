import { disc, type Ink, oval, shade } from "../shapes";
import { SQUASH, X, Y, drum, endFace, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { quad } from "../tower-art/tilt";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Toxic Marsh (`toxic.ts`), a poisoned swamp by a chemical works at dusk, drawn in the towers' 3/4
// tilt: leaking waste barrels, dead swamp trees hung with moss, glowing fungus, rusted chemical tanks and cattails;
// a digester tower and a pump house as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled
// up front into a plain record; its glow, drips and fumes live in the theme's ambient.

export const SHADE = 0x040602;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const GOO = 0xb6f04a;
const RUST = 0x6a4a2a,
  HAZARD = 0xe0c040;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A glowing puddle of spilled waste on the ground (drawn in the shadow pass, so bodies stand in it). */
export function puddle(g: Ink, x: number, y: number, r: number) {
  oval(g, x, y, r + 2, (r + 2) * 0.5, 0x2c3b14, 0.9);
  oval(g, x, y, r, r * 0.5, 0x6f8f2a, 0.85);
  oval(g, x - r * 0.25, y - r * 0.1, r * 0.45, r * 0.18, 0xd8ff8a, 0.5);
}

// ── Waste barrels ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Barrel { du: number; dv: number; color: number; lying: number | null }
const BARRELS = [0x8a7a2a, 0x3a5a6a, 0x6a3a2a, 0x4a4a3a] as const;
export function barrelsOf(rand: Random): Barrel[] {
  const one = (du: number, dv: number, lying = false): Barrel => ({ du, dv, color: BARRELS[Math.floor(rand() * BARRELS.length)], lying: lying ? (rand() - 0.5) * 1.2 : null });
  const roll = rand();
  if (roll < 0.35) return [one(-5, -4), one(6, -2), one(1, 6, true)];
  if (roll < 0.7) return [one(-7, -3), one(4, -5), one(0, 5)];
  return [one(0, -2), one(6, 8, true)];
}
/** Where a barrel leaks (ground offsets), for the drips in the ambient. */
export const leakOf = (list: readonly Barrel[]) => {
  const b = list.find((q) => q.lying !== null) ?? list[0];
  return { u: b.du + (b.lying !== null ? Math.cos(b.lying) * 11 : 4), v: b.dv + (b.lying !== null ? Math.sin(b.lying) * 11 : 4) };
};
/** Rusted waste barrels with hoops and a hazard mark, one lying on its side with its open end spilling. */
export function drawBarrels(g: Ink, gx: number, gy: number, list: readonly Barrel[]) {
  for (const b of [...list].sort((p, q) => p.dv - q.dv)) {
    const x = gx + b.du,
      y = gy + b.dv * SQUASH;
    if (b.lying !== null) {
      tube(g, x, y, b.lying, 5, -8, 8, 5, b.color);
      const end = Math.sin(b.lying) >= 0 ? 8 : -8;
      for (const d of [-4, 4]) tube(g, x, y, b.lying, 5, d - 0.6, d + 0.6, 5.3, shade(b.color, -0.25), 1, false);
      endFace(g, x, y, b.lying, 5, end, 5, shade(b.color, 0.1));
      endFace(g, x, y, b.lying, 5, end, 3.6, 0x1a2010);
      continue;
    }
    drum(g, x, y, 5, 0, 15, b.color, shade(b.color, 0.12), 12);
    for (const h of [4.5, 10.5]) drum(g, x, y, 5.3, h, h + 1, shade(b.color, -0.25), shade(b.color, -0.2), 12);
    oval(g, x + 1.4, Y(y, 0, 15), 1.2, 0.8, 0x1a1a10);
    // Rust bloom and the hazard triangle on the front.
    oval(g, x - 2, Y(y, 5, 3), 2.4, 1.8, RUST, 0.8);
    const tx = x + 1,
      ty = Y(y, 5, 8);
    g.fillStyle(HAZARD);
    g.fillTriangle(tx, ty - 2.4, tx - 2.2, ty + 1.4, tx + 2.2, ty + 1.4);
    disc(g, tx, ty + 0.3, 0.6, 0x1a1a10);
  }
}
export function barrelsShadow(g: Ink, gx: number, gy: number, list: readonly Barrel[]) {
  const l = leakOf(list);
  puddle(g, gx + l.u, gy + l.v * SQUASH + 2, 9);
  for (const b of list) roundShadow(g, gx + b.du, gy + b.dv * SQUASH, 6, b.lying !== null ? 8 : 15);
}

// ── Dead swamp tree ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface Tree { a: number; branches: number[]; h: number }
export const treeOf = (rand: Random): Tree => ({ a: rand() * Math.PI * 2, branches: Array.from({ length: 4 }, () => rand()), h: 30 + rand() * 12 });
/** The tips the moss hangs from (ground u, v, height). */
export function mossOf(t: Tree) {
  return t.branches.map((b, i) => {
    const a = t.a + i * 1.6,
      d = 9 + 7 * b;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d, h: t.h * (0.45 + 0.13 * i) + 6 + 8 * b };
  });
}
/** A drowned tree: a flared, knotted trunk standing in its own pool, crooked bare branches and grey-green moss hanging. */
export function drawTree(g: Ink, gx: number, gy: number, t: Tree) {
  for (const r of [-1, 1]) rod(g, gx, gy, 0, 0, 3, r * 7, r * 2, 0, 2.2, 0x2e2a1e);
  rod(g, gx, gy, 0, 0, 0, 1.5, -0.5, t.h * 0.5, 4.2, 0x3a3424);
  rod(g, gx, gy, 1.5, -0.5, t.h * 0.5, -1, 0, t.h * 0.8, 3, 0x3a3424);
  mossOf(t).forEach((m, i) => {
    const a = t.a + i * 1.6,
      h0 = t.h * (0.45 + 0.13 * i);
    rod(g, gx, gy, 0.5, 0, h0, m.u * 0.6, m.v * 0.6, h0 + 4, 1.8, 0x3a3424);
    rod(g, gx, gy, m.u * 0.6, m.v * 0.6, h0 + 4, m.u, m.v, m.h, 1.1, 0x3a3424);
    // Moss strands hanging from the branch.
    for (let k = 0; k < 3; k++) {
      const f = 0.55 + k * 0.2,
        x = X(gx, m.u * f),
        y = Y(gy, m.v * f, h0 + 4 + (m.h - h0 - 4) * f);
      g.lineStyle(1.2, 0x6a7a4a, 0.85);
      g.lineBetween(x, y, x + Math.sin(a + k) * 0.8, y + 6 + k * 2);
    }
  });
}
export function treeShadow(g: Ink, gx: number, gy: number, t: Tree) {
  puddle(g, gx + 2, gy + 3, 11);
  g.lineStyle(3, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + t.h * SUN.x, gy + t.h * SUN.y);
}

// ── Glowing fungus ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cap { u: number; v: number; h: number; r: number; color: number }
const CAPS = [0x9af04a, 0xc8ff6a, 0x6ad8a0, 0xd88aff] as const;
export function fungusOf(rand: Random): Cap[] {
  const n = 3 + Math.floor(rand() * 4),
    tint = CAPS[Math.floor(rand() * CAPS.length)];
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(),
      d = i ? 5 + rand() * 9 : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, h: i ? 4 + rand() * 7 : 12 + rand() * 4, r: i ? 2.5 + rand() * 2.5 : 6 + rand() * 1.5, color: shade(tint, (rand() - 0.5) * 0.2) };
  }).sort((p, q) => p.v - q.v);
}
/** A cluster of glowing toadstools on a rotten log: pale stems, domed caps with bright spots. */
export function drawFungus(g: Ink, gx: number, gy: number, list: readonly Cap[]) {
  tube(g, gx - 2, gy + 3, 0.3, 2.5, -12, 12, 3, 0x3a3020);
  endFace(g, gx - 2, gy + 3, 0.3, 2.5, 12, 3, 0x5a4a32);
  for (const c of list) {
    const x = gx + c.u,
      y = gy + c.v * SQUASH;
    drum(g, x, y, c.r * 0.28, 0, c.h, 0xd8d0b0, 0xe8e0c8, 8);
    for (let i = 0; i < 3; i++) drum(g, x, y, c.r * (1 - i * 0.3), c.h + i * c.r * 0.22, c.h + (i + 1) * c.r * 0.22, shade(c.color, -0.25 + i * 0.12), shade(c.color, 0.1 + i * 0.1), 12);
    if (c.r > 4) for (let i = 0; i < 3; i++) disc(g, X(x, Math.cos(i * 2.1) * c.r * 0.5), Y(y, Math.sin(i * 2.1) * c.r * 0.5, c.h + c.r * 0.5), 0.7, 0xf8ffe0);
  }
}
export function fungusShadow(g: Ink, gx: number, gy: number, list: readonly Cap[]) {
  oval(g, gx + 4, gy + 5, 15, 6, SHADE, 0.22);
  for (const c of list) roundShadow(g, gx + c.u, gy + c.v * SQUASH, c.r, c.h, 0.2);
}

// ── Chemical tank ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Tank { a: number }
export const tankOf = (rand: Random): Tank => ({ a: (rand() - 0.5) * 0.7 });
/** Where the tank's valve drips (ground offset at the near end). */
export const tankDrip = (t: Tank) => ({ u: Math.cos(t.a) * 16, v: Math.sin(t.a) * 16 + 4 });
/** A horizontal chemical tank on concrete saddles, streaked with rust, a hazard band, a manhole on top and a valve. */
export function drawTank(g: Ink, gx: number, gy: number, t: Tank) {
  const a = t.a,
    near = Math.sin(a) >= 0 ? 15 : -15;
  for (const d of [-9, 9]) box(g, gx, gy, frame(a, 0, 0, Math.cos(a) * d, Math.sin(a) * d), -2.5, 2.5, -7, 7, 0, 5, 0x6a6a5a);
  tube(g, gx, gy, a, 10, -15, 15, 8, 0x7a8a7a);
  tube(g, gx, gy, a, 10, -2, 2, 8.3, HAZARD, 1, false);
  endFace(g, gx, gy, a, 10, near, 8, 0x8a9a8a);
  endFace(g, gx, gy, a, 10, near, 5, 0x6a7a6a);
  // Rust streaks running down its flank.
  for (const d of [-10, -5, 6, 11]) {
    const [x0, y0] = [X(gx, Math.cos(a) * d), Y(gy, Math.sin(a) * d, 16)];
    g.lineStyle(1.2, RUST, 0.7);
    g.lineBetween(x0, y0, x0 + 0.5, y0 + 7);
  }
  drum(g, X(gx, Math.cos(a) * 4), Y(gy, Math.sin(a) * 4, 0), 2.6, 17.5, 19.5, 0x5a6a5a, 0x6a7a6a, 10);
  rod(g, gx, gy, Math.cos(a) * near, Math.sin(a) * near, 4, Math.cos(a) * (near + Math.sign(near) * 2), Math.sin(a) * (near + Math.sign(near) * 2) + 3, 2, 1.4, 0x5a5a4a);
}
export function tankShadow(g: Ink, gx: number, gy: number, t: Tank) {
  const d = tankDrip(t);
  puddle(g, gx + d.u, gy + d.v * SQUASH + 2, 7);
  boxShadow(g, gx, gy, t.a, 16, 8, 18);
}

// ── Cattails ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Reed { u: number; v: number; h: number; lean: number; head: boolean }
export function reedsOf(rand: Random): Reed[] {
  return Array.from({ length: 9 + Math.floor(rand() * 6) }, () => {
    const a = rand() * Math.PI * 2,
      d = rand() * 12;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, h: 14 + rand() * 12, lean: (rand() - 0.5) * 6, head: rand() < 0.55 };
  }).sort((p, q) => p.v - q.v);
}
/** A clump of cattails and sedge in a sludge puddle: stalks, some with brown seed heads, and blades bent over. */
export function drawReeds(g: Ink, gx: number, gy: number, list: readonly Reed[]) {
  for (const r of list) {
    const x = gx + r.u,
      y = gy + r.v * SQUASH;
    g.lineStyle(1.2, 0x4a5a24);
    g.lineBetween(x, y, x + r.lean, y - r.h);
    if (r.head) {
      g.lineStyle(3, 0x5a3a20);
      g.lineBetween(x + r.lean * 0.8, y - r.h * 0.8, x + r.lean * 0.92, y - r.h * 0.92);
    } else {
      g.lineStyle(1, 0x6a7a34);
      g.lineBetween(x, y, x + r.lean * 2 + 4, y - r.h * 0.6);
    }
  }
}
export function reedsShadow(g: Ink, gx: number, gy: number) {
  puddle(g, gx, gy + 1, 13);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The digester's flare tip and the egg's top (heights at full size; the flare stands at u = FLARE.u). */
export const FLARE = { u: 26, h: 78 } as const;
const EGG = 0x8a9a7a;
/** A digester tower: a great egg-shaped tank on a ring footing, a catwalk round its waist, a stair and a flare stack. */
export function drawDigester(g: Ink) {
  drum(g, 0, 0, 30, 0, 5, 0x5a5a4a, 0x6a6a5a, 20);
  const steps = 14,
    top = 66,
    rOf = (t: number) => 24 * Math.sin(Math.PI * (0.12 + 0.88 * t)) ** 0.8 + 2;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      h0 = 5 + (top - 5) * t0,
      h1 = 5 + (top - 5) * t1 + 0.6;
    drum(g, 0, 0, rOf((t0 + t1) / 2), h0, h1, shade(EGG, -0.03 * (i % 2)), shade(EGG, 0.15), 20);
    if (i === 6) drum(g, 0, 0, rOf((t0 + t1) / 2) + 0.4, h0, h0 + 2.4, HAZARD, shade(HAZARD, 0.15), 20);
  }
  // Rust streaks down the egg's front.
  for (const u of [-14, -4, 9, 17]) {
    g.lineStyle(1.6, RUST, 0.55);
    g.lineBetween(X(0, u), Y(0, 18, 50), X(0, u + 1), Y(0, 20, 22));
  }
  drum(g, 0, 0, 5, top, top + 4, 0x5a6a5a, 0x7a8a7a, 12);
  // Catwalk round the waist and a stair up the front.
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.PI;
    rod(g, 0, 0, Math.cos(t) * 29, Math.sin(t) * 29, 30, Math.cos(t) * 29, Math.sin(t) * 29, 35, 0.6, 0xc8b060);
  }
  g.lineStyle(0.9, 0xc8b060);
  g.strokePoints(Array.from({ length: 13 }, (_, i) => ({ x: X(0, Math.cos((i / 12) * Math.PI) * 29), y: Y(0, Math.sin((i / 12) * Math.PI) * 29, 35) })), false);
  rod(g, 0, 0, -18, 26, 5, -6, 28, 30, 2, 0x8a8a6a);
  // The flare stack beside it with a pipe from the dome.
  rod(g, 0, 0, 3, -2, top + 3, FLARE.u, -6, top + 3, 1.6, 0x6a6a5a);
  drum(g, X(0, FLARE.u), Y(0, -6, 0), 2.6, 0, FLARE.h, 0x6a6a5a, 0x7a7a6a, 10);
  for (let h = 12; h < FLARE.h; h += 14) drum(g, X(0, FLARE.u), Y(0, -6, 0), 3, h, h + 1.4, 0xc83a2e, 0xd84a3e, 10);
}
export function digesterShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 24 * k, 14 * k, 36, 22, SHADE, 0.16);
  g.lineStyle(4, SHADE, 0.18);
  g.lineBetween(FLARE.u, -6 * SQUASH, FLARE.u + FLARE.h * SUN.x, -6 * SQUASH + FLARE.h * SUN.y);
}
/** The pump house's two stacks (u, v, height at full size). */
export const STACKS = [{ u: -14, v: -8, h: 58 }, { u: -3, v: -8, h: 50 }] as const;
/** A pump house: a brick shed with a corrugated roof, two smokestacks, an outflow pipe and a lit window. */
export function drawPumpHouse(g: Ink) {
  const f = frame(0, 0, 0);
  box(g, 0, 0, f, -30, 30, -18, 18, 0, 3, 0x5a5a4a);
  box(g, 0, 0, f, -26, 20, -14, 14, 3, 28, 0x6a3a2a);
  for (let h = 7; h < 28; h += 4) {
    project(0, 0, f, -26, 14.05, h, 0);
    project(0, 0, f, 20, 14.05, h, 1);
    g.lineStyle(0.6, 0x4a2418, 0.7);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  // Lit window and door on the front.
  project(0, 0, f, 4, 14.06, 12, 0);
  project(0, 0, f, 12, 14.06, 12, 1);
  project(0, 0, f, 12, 14.06, 20, 2);
  project(0, 0, f, 4, 14.06, 20, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0xd8e070);
  project(0, 0, f, -16, 14.06, 3, 0);
  project(0, 0, f, -8, 14.06, 3, 1);
  project(0, 0, f, -8, 14.06, 18, 2);
  project(0, 0, f, -16, 14.06, 18, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0x2a2a20);
  box(g, 0, 0, f, -28, 22, -16, 16, 28, 30.5, 0x4a5a4a);
  for (const s of STACKS) {
    drum(g, X(0, s.u), Y(0, s.v, 0), 3.6, 30, s.h, 0x6a4a3a, 0x7a5a4a, 10);
    drum(g, X(0, s.u), Y(0, s.v, 0), 4.2, s.h - 2, s.h, 0x3a3a30, 0x1a1a14, 10);
  }
  // The outflow pipe running out to the right and down.
  tube(g, 0, 0, 0, 10, 20, 32, 3.4, 0x6a7a6a);
  endFace(g, 0, 0, 0, 10, 32, 3.4, 0x7a8a7a);
  endFace(g, 0, 0, 0, 10, 32, 2.2, 0x2a3a14);
}
export function pumpHouseShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 28, 16, 30, 0.3);
  puddle(g, 36, 16, 12);
}
