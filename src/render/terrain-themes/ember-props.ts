import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { SQUASH, X, Y, block, drum } from "../tower-art/tilt";
import { box, frame, rod } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import type { Random } from "./kit";

// The props of Ember Pass (`ember.ts`), a cooling lava field at night, drawn in the towers' 3/4 tilt: basalt column
// clusters, boulders split by glowing cracks, fumarole cones, charred trees, obsidian spikes and stone braziers; the
// cinder cone and the obsidian shrine as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is
// rolled up front into a plain record; its glow and smoke live in the theme's ambient.

export const SHADE = 0x050302;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const MAGMA = 0xff7a2a;
const BASALT = 0x3a3436;
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A lumpy rock block of six corners, `radii` its unevenness. */
function rock(g: Ink, gx: number, gy: number, radii: readonly number[], r: number, h: number, wall = 0x2e2826, top = 0x463e3a) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.2;
    F[2 * i] = Math.cos(t) * r * radii[i];
    F[2 * i + 1] = Math.sin(t) * r * radii[i];
    I[2 * i] = F[2 * i] * 0.62;
    I[2 * i + 1] = F[2 * i + 1] * 0.62;
  }
  block(g, gx, gy, F, I, 6, 0, h * 0.55, h * 0.45, wall, top, shade(top, 0.25));
}
const radiiOf = (rand: Random) => Array.from({ length: 6 }, () => 0.8 + rand() * 0.2);

// ── Basalt columns ──────────────────────────────────────────────────────────────────────────────────────────────────
/** A cluster of hexagonal basalt columns packed together, stepped in height like a causeway. */
export function columnsOf(rand: Random): Crystal[] {
  const spots = [[0, 0], [9.5, 0], [-9.5, 0], [4.8, 8.2], [-4.8, 8.2], [4.8, -8.2], [-4.8, -8.2]],
    n = 4 + Math.floor(rand() * 4);
  return spots
    .slice(0, n)
    .map(([u, v]) => ({ u, v: v * 0.9, a: 0, lean: rand() * 0.06, len: 6 + rand() * 22, r: 5.2, color: shade(BASALT, (rand() - 0.5) * 0.12), flat: true }))
    .sort((p, q) => p.v - q.v);
}
export function drawColumns(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystal(g, gx, gy, c);
}
export function columnsShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystalShadow(g, gx, gy, { ...c, r: c.r * 1.4 });
}

// ── Cracked boulder ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface Boulder { radii: number[]; r: number; cracks: number }
export const boulderOf = (rand: Random): Boulder => ({ radii: radiiOf(rand), r: 12 + rand() * 5, cracks: Math.floor(rand() * 1e6) });
/** Where a boulder's glowing cracks run on its top face (screen offsets from its ground point). */
export function boulderCracks(b: Boulder) {
  const top = -b.r * 0.55 - b.r * 0.45,
    list: { x: number; y: number }[][] = [];
  for (let k = 0; k < 2; k++) {
    let x = (hash01(b.cracks, k) - 0.5) * b.r * 0.8,
      y = top + (hash01(b.cracks, k, 1) - 0.5) * b.r * 0.4;
    const line = [{ x, y }];
    for (let i = 0; i < 4; i++) {
      x += (hash01(b.cracks, k, i + 2) - 0.5) * b.r * 0.5;
      y += 1.6 + hash01(b.cracks, k, i + 9) * 2.4;
      line.push({ x, y });
    }
    list.push(line);
  }
  return list;
}
/** A basalt boulder with cracks glowing faintly orange down its face. */
export function drawBoulder(g: Ink, gx: number, gy: number, b: Boulder) {
  rock(g, gx, gy, b.radii, b.r, b.r);
  for (const line of boulderCracks(b)) {
    g.lineStyle(2.2, 0x2a1008, 0.9);
    g.strokePoints(line.map((p) => ({ x: gx + p.x, y: gy + p.y })), false);
    g.lineStyle(1, MAGMA, 0.85);
    g.strokePoints(line.map((p) => ({ x: gx + p.x, y: gy + p.y })), false);
  }
}
export function boulderShadow(g: Ink, gx: number, gy: number, b: Boulder) {
  for (const k of [0.5, 1]) oval(g, gx + b.r * 0.5 * k, gy + b.r * 0.3 * k, b.r + 2, (b.r + 2) * SQUASH, SHADE, 0.16);
}

// ── Fumarole ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a fumarole's mouth in px, by its size. */
export const fumaroleMouth = (s: number) => 14 * s;
/** A small spatter cone: stacked rings narrowing up to a crusted mouth with a glowing throat. */
export function drawFumarole(g: Ink, gx: number, gy: number, s: number) {
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      r = (16 - 10 * t0) * s;
    drum(g, gx, gy, r, fumaroleMouth(s) * t0, fumaroleMouth(s) * t1 + 0.5, shade(0x3e3230, -0.1 * i), shade(0x4e403a, 0.05 * i), 12);
  }
  oval(g, gx, Y(gy, 0, fumaroleMouth(s)), 5 * s, 5 * s * SQUASH, 0x2a1008);
  oval(g, gx, Y(gy, 0, fumaroleMouth(s)) + 0.5, 3.4 * s, 3.4 * s * SQUASH, MAGMA);
  oval(g, gx, Y(gy, 0, fumaroleMouth(s)) + 0.6, 1.8 * s, 1.8 * s * SQUASH, 0xffd08a);
  // Sulphur-free crust: spatter blobs on the slopes.
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3,
      r = 10 * s;
    disc(g, X(gx, Math.cos(a) * r), Y(gy, Math.sin(a) * r, 4 * s), 1.4 * s, 0x5a4a44);
  }
}
export function fumaroleShadow(g: Ink, gx: number, gy: number, s: number) {
  oval(g, gx + 6 * s, gy + 4 * s, 18 * s, 9 * s, SHADE, 0.2);
}

// ── Charred tree ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Tree { a: number; branches: number[]; h: number }
export const treeOf = (rand: Random): Tree => ({ a: rand() * Math.PI * 2, branches: Array.from({ length: 4 }, () => rand()), h: 30 + rand() * 12 });
/** Where a charred tree still smoulders: ember spots along its trunk and branches (ground u, v, height). */
export function treeEmbers(t: Tree) {
  return t.branches.map((b, i) => ({ u: Math.cos(t.a + i * 1.7) * 6 * b, v: Math.sin(t.a + i * 1.7) * 6 * b, h: t.h * (0.45 + 0.35 * b) }));
}
/** A dead tree burnt black: a twisted trunk forking into bare branches, a cracked stump flare at the foot. */
export function drawTree(g: Ink, gx: number, gy: number, t: Tree) {
  rod(g, gx, gy, 0, 0, 0, 1.5, 0.5, t.h * 0.55, 3.6, 0x1a1414);
  t.branches.forEach((b, i) => {
    const a = t.a + i * 1.7,
      h0 = t.h * (0.4 + 0.15 * i),
      u = Math.cos(a) * (8 + 6 * b),
      v = Math.sin(a) * (8 + 6 * b);
    rod(g, gx, gy, 1, 0.3, h0, u, v, h0 + 8 + 8 * b, 1.6 + (3 - i) * 0.3, 0x1e1818);
    rod(g, gx, gy, u, v, h0 + 8 + 8 * b, u * 1.3, v * 1.3, h0 + 12 + 10 * b, 0.9, 0x1e1818);
  });
  for (const r of [-1, 1]) rod(g, gx, gy, 0, 0, 2, r * 6, 2, 0, 1.8, 0x1a1414);
}
export function treeShadow(g: Ink, gx: number, gy: number, t: Tree) {
  g.lineStyle(3, SHADE, 0.2);
  g.lineBetween(gx, gy, gx + t.h * SUN.x, gy + t.h * SUN.y);
}

// ── Obsidian spikes ─────────────────────────────────────────────────────────────────────────────────────────────────
const OBSIDIAN = 0x2e2638;
/** Shards of black volcanic glass breaking out of the ground at angles, with a violet sheen on their faces. */
export function obsidianOf(rand: Random, size = 1): Crystal[] {
  const n = 3 + Math.floor(rand() * 3);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.8,
      d = i ? (5 + rand() * 6) * size : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: i ? 0.4 + rand() * 0.4 : rand() * 0.2, len: (i ? 8 + rand() * 10 : 18 + rand() * 8) * size, r: (i ? 2.4 + rand() * 1.4 : 4) * size, color: OBSIDIAN, core: false };
  }).sort((p, q) => p.v - q.v);
}
export function drawObsidian(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystal(g, gx, gy, c);
}
export function obsidianShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystalShadow(g, gx, gy, c);
}

// ── Brazier ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a brazier's fire in px. */
export const BRAZIER_FIRE = 17;
/** A stone brazier: a squat carved pedestal and a wide iron bowl full of coals. */
export function drawBrazier(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0, 0, 0), -6, 6, -6, 6, 0, 3, 0x4a3e38);
  drum(g, gx, gy, 3.4, 3, 11, 0x3e3430, 0x52463e, 10);
  drum(g, gx, gy, 7.5, 11, 15, 0x2a2420, 0x3a302a, 14);
  oval(g, gx, Y(gy, 0, 15), 6.4, 6.4 * SQUASH, 0x3a1408);
  for (let i = 0; i < 6; i++) disc(g, gx + Math.cos(i) * 3, Y(gy, Math.sin(i) * 3, 15.2), 1.3, i % 2 ? 0xff9a3a : 0xc8401a);
}
export function brazierShadow(g: Ink, gx: number, gy: number) {
  oval(g, gx + 6, gy + 4, 10, 5, SHADE, 0.22);
}
/** A flickering fire at (x, y): three tongues of flame swaying with the clock, a white-hot base. */
export function flame(g: Ink, x: number, y: number, s: number, clock: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(clock * 9 + seed + i * 2.1) * 1.6 * s,
      h = (7 + 3 * Math.sin(clock * 13 + seed * 3 + i)) * s,
      w = (3 - i * 0.6) * s,
      cx = x + (i - 1) * 1.8 * s;
    g.fillStyle([0xff5a1a, 0xff9a3a, 0xffd88a][i], 0.9);
    g.fillTriangle(cx - w, y, cx + w, y, cx + sway, y - h + i * 1.5 * s);
  }
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the cinder cone's crater (at full size). */
export const CONE_CRATER = 38;
/** A cinder cone: a broad scoria cone rising in rough terraces to a crater rim, a lava tongue spilling down its front. */
export function drawCone(g: Ink) {
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      r = 46 - 30 * t0;
    drum(g, 0, 0, r, CONE_CRATER * t0, CONE_CRATER * t1 + 0.6, shade(0x3a2e2a, -0.08 * (i % 2)), shade(0x4a3c36, 0.04 * i), 18);
  }
  // The lava tongue spilling over the front rim: it widens and wanders as it runs down the slope.
  const n = 8,
    spine = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        r = 14 + (46 - 14) * t;
      return { x: 6 + Math.sin(t * 5) * 4 * t, y: Y(0, r * 0.95, CONE_CRATER * (1 - t)), w: 3 + 6 * t };
    }),
    edge = (k: number, grow: number) => spine.map((p) => ({ x: p.x + k * (p.w + grow), y: p.y }));
  g.fillStyle(0x2a1008);
  g.fillPoints([...edge(-1, 2.5), ...edge(1, 2.5).reverse()], true);
  g.fillStyle(MAGMA);
  g.fillPoints([...edge(-1, 0), ...edge(1, 0).reverse()], true);
  g.fillStyle(0xffc070, 0.8);
  g.fillPoints([...edge(-0.35, 0), ...edge(0.25, 0).reverse()], true);
  oval(g, 0, Y(0, 0, CONE_CRATER), 14, 14 * SQUASH, 0x1a0c06);
  oval(g, 0, Y(0, 0, CONE_CRATER) + 1, 10, 10 * SQUASH, 0xff6a1a);
  oval(g, 0, Y(0, 0, CONE_CRATER) + 1.6, 5, 5 * SQUASH, 0xffd08a);
}
export function coneShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 14 * k, 9 * k, 50, 26, SHADE, 0.14);
}
/** The shrine's brazier fire (screen offset at full size). */
export const SHRINE_FIRE = { x: 0, h: 44 } as const;
/** An obsidian shrine: a stepped basalt plinth, two obsidian pillars under a lintel, and a great brazier between them. */
export function drawShrine(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -30, 30, -22, 22, 0, 4, 0x3a3230);
  box(g, 0, 0, frame(0, 0, 0), -24, 24, -17, 17, 4, 8, 0x463c38);
  for (const u of [-16, 16]) crystal(g, 0, 0, { u, v: -6, a: 0, lean: 0, len: 40, r: 5, color: OBSIDIAN, z: 8, flat: true });
  box(g, 0, 0, frame(0, 0, 48), -22, 22, -10, -2, 0, 5, 0x2a2430);
  box(g, 0, 0, frame(0, 0, 53), -18, 18, -9, -3, 0, 2.5, 0x3a3240);
  drum(g, 0, Y(0, 4, 0), 6, 8, 28, 0x3a302c, 0x4e423c, 12);
  drum(g, 0, Y(0, 4, 0), 13, 28, 34, 0x2a2420, 0x3a302a, 16);
  oval(g, 0, Y(4, 0, 34), 11, 11 * SQUASH, 0x3a1408);
  for (let i = 0; i < 9; i++) disc(g, Math.cos(i) * 6, Y(4, Math.sin(i) * 6, 34.3), 1.8, i % 2 ? 0xff9a3a : 0xc8401a);
}
export function shrineShadow(g: Ink) {
  g.fillStyle(SHADE, 0.2);
  g.fillPoints([{ x: -30, y: 14 }, { x: 30, y: 14 }, { x: 56, y: 30 }, { x: -4, y: 30 }], true);
}

