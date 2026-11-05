import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum, endFace, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import { cone } from "./frost-props";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Crystal Cave (`geode.ts`), a turquoise mine cavern, drawn in the towers' 3/4 tilt: split geodes with
// amethyst hearts, clusters of clear quartz on rock, wet stalagmites, ore carts and miners' lanterns; a giant open geode
// and a timber headframe over a shaft as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled
// up front into a plain record; glints, lamp light and drips live in the theme's ambient.

export const SHADE = 0x010608;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const AMETHYST = [0x8a4ad0, 0xa86cf0, 0xc89aff, 0x7a3cc0] as const;
export const QUARTZ = [0x9ae8e4, 0xc8fff8, 0x7ad0d4] as const;
const STONE = { wall: 0x34474c, top: 0x50666c } as const;
const TIMBER = 0x7a5a36;
export const LAMP = 0xffb85a;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
const F = new Float64Array(16),
  I = new Float64Array(16);
/** A lumpy cave rock of six corners. */
function rock(g: Ink, x: number, y: number, r: number, h: number, seed: number, wall: number = STONE.wall, top: number = STONE.top) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + hash01(seed) * 2,
      k = 0.74 + hash01(seed, i) * 0.26;
    F[2 * i] = Math.cos(t) * r * k;
    F[2 * i + 1] = Math.sin(t) * r * k;
    I[2 * i] = F[2 * i] * 0.6;
    I[2 * i + 1] = F[2 * i + 1] * 0.6;
  }
  block(g, x, y, F, I, 6, 0, h * 0.6, h * 0.4, wall, top, shade(top, 0.3));
}

// ── Split geode ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Geode { r: number; seed: number; tint: number }
export const geodeOf = (rand: Random): Geode => ({ r: 11 + rand() * 4, seed: Math.floor(rand() * 1e6), tint: rand() < 0.75 ? 0 : 1 });
/** Height of a geode's cut face. */
export const geodeFace = (g: Geode) => g.r * 0.95;
/** A geode broken open: a grey rock shell whose cut top is a white agate band round a hollow lined with crystal points. */
export function drawGeode(g: Ink, gx: number, gy: number, geo: Geode) {
  const h = geodeFace(geo),
    colors = geo.tint ? QUARTZ : AMETHYST;
  rock(g, gx, gy, geo.r, h, geo.seed, 0x4a5458, 0x6a767c);
  const fy = Y(gy, 0, h);
  oval(g, gx, fy, geo.r * 0.66, geo.r * 0.66 * SQUASH, 0x8a9498);
  oval(g, gx, fy, geo.r * 0.6, geo.r * 0.6 * SQUASH, 0xe8e4f0);
  oval(g, gx, fy, geo.r * 0.52, geo.r * 0.52 * SQUASH, colors[3 % colors.length]);
  oval(g, gx, fy + 0.6, geo.r * 0.34, geo.r * 0.34 * SQUASH, shade(colors[0], -0.35));
  // Crystal points lining the hollow, pointing inwards, lit ones on the far rim.
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2,
      rr = geo.r * 0.5,
      x0 = gx + Math.cos(t) * rr,
      y0 = fy + Math.sin(t) * rr * SQUASH,
      x1 = gx + Math.cos(t) * rr * 0.45,
      y1 = fy + Math.sin(t) * rr * 0.45 * SQUASH,
      w = geo.r * 0.12,
      c = colors[i % colors.length];
    g.fillStyle(Math.sin(t) < 0 ? shade(c, 0.2) : shade(c, -0.15));
    g.fillTriangle(x0 - Math.sin(t) * w, y0 + Math.cos(t) * w * SQUASH, x0 + Math.sin(t) * w, y0 - Math.cos(t) * w * SQUASH, x1, y1);
  }
  disc(g, gx - geo.r * 0.2, fy - 1, 1, 0xffffff, 0.8);
}
export function geodeShadow(g: Ink, gx: number, gy: number, geo: Geode) {
  roundShadow(g, gx, gy, geo.r + 1, geodeFace(geo) + 4, 0.34);
}

// ── Quartz cluster ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cluster { rock: { r: number; seed: number }; crystals: Crystal[] }
export function clusterOf(rand: Random): Cluster {
  const n = 4 + Math.floor(rand() * 3);
  return {
    rock: { r: 11 + rand() * 3, seed: Math.floor(rand() * 1e6) },
    crystals: Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rand(),
        d = i ? 3 + rand() * 6 : 0;
      return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.7, a, lean: i ? 0.25 + rand() * 0.35 : rand() * 0.12, len: i ? 9 + rand() * 9 : 20 + rand() * 6, r: i ? 2.2 + rand() * 1.2 : 3.8, color: QUARTZ[Math.floor(rand() * QUARTZ.length)], z: 5 };
    }).sort((p, q) => p.v - q.v),
  };
}
/** Clear quartz points growing out of a cave rock, pale teal with a bright core. */
export function drawCluster(g: Ink, gx: number, gy: number, c: Cluster) {
  rock(g, gx, gy, c.rock.r, 9, c.rock.seed);
  for (const k of c.crystals) crystal(g, gx, gy, k);
}
export function clusterShadow(g: Ink, gx: number, gy: number, c: Cluster) {
  roundShadow(g, gx, gy, c.rock.r, 8);
  for (const k of c.crystals) crystalShadow(g, gx, gy, { ...k, z: 0 });
}

// ── Stalagmites ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Mite { u: number; v: number; r: number; h: number }
export function mitesOf(rand: Random): Mite[] {
  const n = 2 + Math.floor(rand() * 3);
  return Array.from({ length: n }, (_, i) => ({ u: i ? (rand() - 0.5) * 24 : 0, v: i ? (rand() - 0.5) * 16 : 0, r: i ? 3.5 + rand() * 3 : 7 + rand() * 2, h: i ? 12 + rand() * 12 : 28 + rand() * 12 })).sort((p, q) => p.v - q.v);
}
/** Where each stalagmite's wet tip catches a drip (ground u, v, height). */
export const miteTips = (list: readonly Mite[]) => list.map((m) => ({ u: m.u, v: m.v, h: m.h }));
/** Stalagmites rising from a flowstone base, banded in pale and rust minerals, their tips wet and shining. */
export function drawMites(g: Ink, gx: number, gy: number, list: readonly Mite[]) {
  oval(g, gx, gy + 1, 16, 7, 0x3a4a4e);
  oval(g, gx - 1, gy, 13, 5.5, 0x4a5c60);
  for (const m of list) {
    const x = gx + m.u,
      y = gy + m.v * SQUASH;
    // Three bands stacked: a wide foot, the shaft, the tip.
    cone(g, x, y, m.r, 0, m.h, 0x6a7a74);
    // A rust band of iron minerals partway up.
    g.lineStyle(1.2, 0x8a6a4a, 0.8);
    g.lineBetween(x - m.r * 0.62, Y(y, m.r * 0.3, m.h * 0.3), x + m.r * 0.62, Y(y, m.r * 0.3, m.h * 0.3));
    disc(g, x - m.r * 0.15, Y(y, 0, m.h * 0.92), 0.9, 0xe8fffc, 0.9);
  }
}
export function mitesShadow(g: Ink, gx: number, gy: number, list: readonly Mite[]) {
  for (const m of list) {
    const x = gx + m.u,
      y = gy + m.v * SQUASH;
    g.fillStyle(SHADE, 0.22);
    g.fillTriangle(x - m.r * 0.8, y, x + m.r * 0.8, y + 1, x + m.h * SUN.x, y + m.h * SUN.y);
  }
}

// ── Ore cart ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cart { a: number; tipped: boolean; tint: number }
export const cartOf = (rand: Random): Cart => ({ a: (rand() - 0.5) * 0.8, tipped: rand() < 0.3, tint: rand() < 0.7 ? 0 : 1 });
/** A mine cart of riveted iron on a short length of rail, heaped with ore and crystal; some tipped over and spilled. */
export function drawCart(g: Ink, gx: number, gy: number, c: Cart) {
  const f = frame(c.a, 0, 0),
    colors = c.tint ? QUARTZ : AMETHYST;
  // A length of track: sleepers and two rails.
  for (const p of [-14, -7, 0, 7, 14]) box(g, gx, gy, f, p - 1.6, p + 1.6, -8, 8, 0, 1.2, 0x5a4026);
  for (const q of [-5, 5]) box(g, gx, gy, f, -17, 17, q - 0.6, q + 0.6, 1.2, 2.4, 0x7a8288);
  if (c.tipped) {
    // On its side beside the rails, the ore spilled out.
    const tf = frame(c.a, 0, 0, -Math.sin(c.a) * 9, Math.cos(c.a) * 9);
    box(g, gx, gy, tf, -9, 9, -1, 9, 0, 10, 0x5a5048);
    for (let i = 0; i < 6; i++) disc(g, X(gx, -Math.sin(c.a) * 16 + (i - 3) * 3), Y(gy, Math.cos(c.a) * 16 + (i % 2) * 2, 1), 1.8, colors[i % colors.length]);
    return;
  }
  for (const p of [-6, 6]) for (const q of [-5, 5]) {
    project(gx, gy, f, p, q, 3.4, 0);
    disc(g, SX[0], SY[0], 2.4, 0x2a2a2a);
  }
  box(g, gx, gy, f, -10, 10, -6.5, 6.5, 3.5, 13, 0x5a5048);
  box(g, gx, gy, f, -10.4, 10.4, -6.9, 6.9, 11.5, 13.2, 0x6a6058);
  // The load: lumps of rock and crystal heaped above the rim.
  for (let i = 0; i < 9; i++) {
    project(gx, gy, f, -7 + (i % 3) * 7, -4 + Math.floor(i / 3) * 4, 13.6 + (i === 4 ? 2.4 : 0.8), 0);
    disc(g, SX[0], SY[0], i % 3 === 1 ? 2.2 : 2.6, i % 4 === 0 ? colors[i % colors.length] : 0x4a5458);
  }
}
export function cartShadow(g: Ink, gx: number, gy: number, c: Cart) {
  boxShadow(g, gx, gy, c.a, 12, 8, c.tipped ? 8 : 14, 0.32);
}

// ── Miner's lantern ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a lantern post's lamp. */
export const LANTERN = 28;
/** A timber post with a hook and a hanging miner's lantern, a pick and shovel leaning at its foot, a crate beside it. */
export function drawLantern(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0.3, 0, 0, 9, 4), -5, 5, -4, 4, 0, 7, TIMBER);
  rod(g, gx, gy, 0, 0, 0, 0, 0, LANTERN + 6, 2.4, 0x5a4026);
  rod(g, gx, gy, 0, 0, LANTERN + 4, 6, 0, LANTERN + 4, 1.2, 0x5a4026);
  const lx = X(gx, 6),
    ly = Y(gy, 0, LANTERN);
  g.lineStyle(0.6, 0x2a2a2a);
  g.lineBetween(lx, Y(gy, 0, LANTERN + 4), lx, ly - 3);
  g.fillStyle(OUTLINE, 0.9);
  g.fillRect(lx - 2.6, ly - 3, 5.2, 6.6);
  g.fillStyle(0xffd890);
  g.fillRect(lx - 2, ly - 2.4, 4, 5.4);
  g.fillStyle(0x3a3a3a);
  g.fillRect(lx - 2.8, ly - 3.6, 5.6, 1.2);
  // A pick leaning on the post.
  rod(g, gx, gy, -4, 3, 0, -1, 1, 14, 1, TIMBER);
  g.lineStyle(1.4, 0x8a9298);
  g.lineBetween(X(gx, -4), Y(gy, 1, 13), X(gx, 2), Y(gy, 1, 15));
}
export const lanternLamp = { u: 6, h: LANTERN } as const;
export function lanternShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(2.4, SHADE, 0.24);
  g.lineBetween(gx, gy, gx + LANTERN * SUN.x, gy + LANTERN * SUN.y);
  boxShadow(g, gx + 9, gy + 4 * SQUASH, 0.3, 5, 4, 7, 0.26);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The giant geode's cut face height and radius (at full size). */
export const GIANT = { h: 30, r: 34 } as const;
/** A giant geode split open: a great rough shell with a ring of agate, its hollow a bed of large amethyst points. */
export function drawGiant(g: Ink) {
  rock(g, -26, 18, 9, 10, 11);
  drawGeode(g, 0, 0, { r: GIANT.r, seed: 5, tint: 0 });
  // A few larger points standing up out of the hollow.
  for (const [u, v, len, r, a] of [[-6, -4, 16, 3.6, 2.6], [5, -2, 20, 4, 0.4], [0, 4, 12, 3, 1.6], [-12, 2, 10, 2.6, 3.4]] as const)
    crystal(g, 0, 0, { u, v, a, lean: 0.25, len, r, color: AMETHYST[1], z: geodeFace({ r: GIANT.r, seed: 5, tint: 0 }) - 4 });
  rock(g, 28, 14, 7, 8, 13);
}
export function giantShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 18 * k, 11 * k, 40, 22, SHADE, 0.16);
}
/** The headframe's lamp and its wheel (heights at full size). */
export const HEADFRAME = { lamp: 50, wheel: 62 } as const;
/**
 * A timber headframe over a mine shaft: a plank collar round the dark shaft, an A-frame of beams with cross braces, a
 * winding wheel on top, its cable down to an ore bucket, and a lamp hung on the frame.
 */
export function drawHeadframe(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -24, 24, -18, 18, 0, 3, 0x5a4026);
  oval(g, 0, Y(0, 0, 3), 15, 15 * SQUASH, 0x050808);
  for (const u of [-24, 24]) box(g, 0, 0, frame(0, 0, 0, u * 0.9, 0), -3, 3, -18, 18, 3, 5, TIMBER);
  const leg = (u: number, v: number) => rod(g, 0, 0, u, v, 3, u * 0.25, v * 0.3, HEADFRAME.wheel - 2, 3, TIMBER);
  leg(-20, -14);
  leg(20, -14);
  for (const h of [20, 38]) {
    const k = 1 - (h - 3) / (HEADFRAME.wheel - 5) * 0.75;
    rod(g, 0, 0, -20 * k, -14 * k, h, 20 * k, -14 * k, h, 1.8, shade(TIMBER, -0.15));
    rod(g, 0, 0, -20 * k, 14 * k, h, 20 * k, 14 * k, h, 1.8, shade(TIMBER, -0.15));
  }
  // The cable and the ore bucket hanging in the shaft.
  g.lineStyle(0.8, 0x2a2a2a);
  g.lineBetween(X(0, 6), Y(0, 0, HEADFRAME.wheel - 2), X(0, 6), Y(0, 0, 18));
  drum(g, X(0, 6), Y(0, 0, 0), 4, 10, 18, 0x5a5048, 0x3a3a3a, 10);
  leg(-20, 14);
  leg(20, 14);
  // The winding wheel, edge on to the light.
  const wy = Y(0, 0, HEADFRAME.wheel);
  tube(g, 0, 0, Math.PI / 2, HEADFRAME.wheel, -2, 2, 9, 0x4a4a4a);
  endFace(g, 0, 0, Math.PI / 2, HEADFRAME.wheel, 2, 9, 0x5a5a5a);
  endFace(g, 0, 0, Math.PI / 2, HEADFRAME.wheel, 2.2, 7, 0x2a2a2a);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    g.lineStyle(1, 0x6a6a6a);
    g.lineBetween(0, wy + 1.2, Math.cos(t) * 7, wy + 1.2 + Math.sin(t) * 7 * 0.95);
  }
  disc(g, 0, wy + 1.2, 1.6, 0x8a8a8a);
}
export function headframeShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 24, 18, 3, 0.3);
  g.lineStyle(8, SHADE, 0.16);
  g.lineBetween(0, 0, HEADFRAME.wheel * SUN.x, HEADFRAME.wheel * SUN.y);
}
