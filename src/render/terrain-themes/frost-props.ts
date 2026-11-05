import { disc, type Ink, oval, shade } from "../shapes";
import { SQUASH, X, Y, block, drum, OUTLINE } from "../tower-art/tilt";
import { box, frame, plane, rod } from "../tower-art/tilt-frame";
import { crystal, crystalShadow, type Crystal } from "./shard-props";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of the Frost Belt (`frost.ts`), a polar night on the ice, drawn in the towers' 3/4 tilt: snow-laden pines,
// ice shards, snow-capped rocks, weather stations and supply caches; a research dome and an ice serac as landmarks.
// Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record; its lights and the
// anemometers' spin live in the theme's ambient.

export const SHADE = 0x02060c;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const SNOW = 0xdcebf4;
export const ICE = [0xbfe6f5, 0x9fd4ec, 0xd8f2ff, 0x8ac4e0] as const;
const PINE = 0x1c3a36;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};

// ── Cone ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * An upright cone from radius r at h0 to its apex at h1: the front half filled and lit from the left, then a snow
 * cover on its upper `snow` share that drips down in scallops.
 */
export function cone(g: Ink, x: number, y0: number, r: number, h0: number, h1: number, color: number, snow = 0) {
  const n = 12,
    pts = (rr: number, hh: number, a0: number, a1: number) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = a0 + ((a1 - a0) * i) / n;
        return { x: X(x, Math.cos(t) * rr), y: Y(y0, Math.sin(t) * rr, hh) };
      }),
    apex = { x, y: Y(y0, 0, h1) };
  g.fillStyle(OUTLINE, 0.8);
  g.fillPoints([apex, ...pts(r + 0.8, h0 - 0.4, 0, Math.PI)], true);
  g.fillStyle(shade(color, -0.15));
  g.fillPoints([apex, ...pts(r, h0, 0, Math.PI)], true);
  g.fillStyle(shade(color, 0.18));
  g.fillPoints([apex, ...pts(r, h0, Math.PI * 0.55, Math.PI)], true);
  if (snow <= 0) return;
  // The snow cap: a smaller cone over the top with a scalloped lower edge.
  const hs = h1 - (h1 - h0) * snow,
    rs = r * snow,
    edge = pts(rs, hs, 0, Math.PI).map((p, i) => ({ x: p.x, y: p.y + (i % 2 ? 1.6 : -0.4) }));
  g.fillStyle(shade(SNOW, -0.18));
  g.fillPoints([apex, ...edge], true);
  g.fillStyle(SNOW);
  g.fillPoints([apex, ...edge.slice(n / 2)], true);
}

// ── Pines ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pine { u: number; v: number; h: number; r: number }
export function pinesOf(rand: Random): Pine[] {
  const n = rand() < 0.35 ? 1 : rand() < 0.7 ? 2 : 3,
    spots = n === 1 ? [[0, 0]] : n === 2 ? [[-8, -5], [8, 4]] : [[-10, -6], [9, -4], [0, 6]];
  return spots.map(([u, v]) => ({ u: u + (rand() - 0.5) * 3, v: v + (rand() - 0.5) * 3, h: (n === 1 ? 40 : 30) + rand() * 10, r: (n === 1 ? 13 : 10) + rand() * 2 })).sort((p, q) => p.v - q.v);
}
/** A snow-laden spruce: a short trunk and three stacked tiers of needles, each capped with snow. */
export function pine(g: Ink, gx: number, gy: number, p: Pine) {
  const x = gx + p.u,
    y = gy + p.v * SQUASH;
  drum(g, x, y, 1.8, 0, p.h * 0.2, 0x3a2a20, 0x4a3a2a, 8);
  for (let i = 0; i < 3; i++) {
    const h0 = p.h * (0.14 + i * 0.25),
      h1 = h0 + p.h * (0.48 - i * 0.06),
      r = p.r * (1 - i * 0.26);
    cone(g, x, y, r, h0, i === 2 ? p.h : h1, PINE, 0.45);
  }
}
export function drawPines(g: Ink, gx: number, gy: number, list: readonly Pine[]) {
  for (const p of list) pine(g, gx, gy, p);
}
export function pinesShadow(g: Ink, gx: number, gy: number, list: readonly Pine[]) {
  for (const p of list) {
    const x = gx + p.u,
      y = gy + p.v * SQUASH;
    g.fillStyle(SHADE, 0.22);
    g.fillTriangle(x - p.r * 0.7, y, x + p.r * 0.7, y + 2, x + p.h * SUN.x, y + p.h * SUN.y);
  }
}

// ── Ice shards ──────────────────────────────────────────────────────────────────────────────────────────────────────
export function shardsOf(rand: Random, size = 1): Crystal[] {
  const n = 3 + Math.floor(rand() * 4);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand(),
      d = i ? (5 + rand() * 7) * size : 0;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, a, lean: i ? 0.3 + rand() * 0.45 : rand() * 0.15, len: (i ? 8 + rand() * 10 : 22 + rand() * 8) * size, r: (i ? 2.6 + rand() * 1.5 : 4.6) * size, color: ICE[Math.floor(rand() * ICE.length)] };
  }).sort((p, q) => p.v - q.v);
}
/** Ice shards pushed up through the snow, a drift banked round their feet. */
export function drawShards(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  oval(g, gx + 1, gy + 1, 15, 7, shade(SNOW, -0.25), 0.9);
  oval(g, gx, gy, 13, 6, SNOW, 0.9);
  for (const c of list) crystal(g, gx, gy, c);
}
export function shardsShadow(g: Ink, gx: number, gy: number, list: readonly Crystal[]) {
  for (const c of list) crystalShadow(g, gx, gy, c);
}

// ── Snow-capped rock ────────────────────────────────────────────────────────────────────────────────────────────────
const F = new Float64Array(16),
  I = new Float64Array(16);
export interface Rock { radii: number[]; r: number; du: number; dv: number }
export function rocksOf(rand: Random): Rock[] {
  const one = (du: number, dv: number, r: number): Rock => ({ radii: Array.from({ length: 6 }, () => 0.78 + rand() * 0.22), r, du, dv });
  return rand() < 0.5 ? [one(0, 0, 14 + rand() * 4)] : [one(-6, -4, 12 + rand() * 3), one(10, 5, 7 + rand() * 2)];
}
/** A rock of six corners whose lit top carries a snow cap. */
function rock(g: Ink, gx: number, gy: number, k: Rock) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.2;
    F[2 * i] = Math.cos(t) * k.r * k.radii[i];
    F[2 * i + 1] = Math.sin(t) * k.r * k.radii[i];
    I[2 * i] = F[2 * i] * 0.6;
    I[2 * i + 1] = F[2 * i + 1] * 0.6;
  }
  block(g, gx + k.du, gy + k.dv * SQUASH, F, I, 6, 0, k.r * 0.55, k.r * 0.45, 0x3a4a58, SNOW, 0xffffff);
}
export function drawRocks(g: Ink, gx: number, gy: number, list: readonly Rock[]) {
  for (const k of list) rock(g, gx, gy, k);
}
export function rocksShadow(g: Ink, gx: number, gy: number, list: readonly Rock[]) {
  for (const k of list) roundShadow(g, gx + k.du, gy + k.dv * SQUASH, k.r + 2, k.r);
}

// ── Weather station ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Heights of the anemometer hub and the warning lamp. */
export const STATION = { hub: 40, lamp: 33 } as const;
/** A weather station: a guyed mast on a tripod, an instrument box with a solar panel, a lamp; its cups spin in the ambient. */
export function drawStation(g: Ink, gx: number, gy: number) {
  oval(g, gx, gy, 12, 6, SNOW, 0.9);
  for (const a of [0.6, 2.6, 4.6]) rod(g, gx, gy, Math.cos(a) * 9, Math.sin(a) * 9, 0, 0, 0, 14, 1, 0x8a96a0);
  box(g, gx, gy, frame(0.2, 0, 8), -4, 4, 2, 7, 0, 7, 0xd8d0c0);
  box(g, gx, gy, frame(0.2, 0, 15), -4.4, 4.4, 1.6, 7.4, 0, 0.8, SNOW);
  rod(g, gx, gy, 0, 0, 0, 0, 0, STATION.hub, 1.4, 0xa0aab2);
  plane(g, gx, gy, frame(-0.6, 0.9, 24, -1, -3), 0, 6, 0x1a2a4a, 1, 4, 4);
  rod(g, gx, gy, -5, 0, 30, 5, 0, 30, 0.8, 0xa0aab2);
  disc(g, X(gx, 5), Y(gy, 0, 30), 1, 0x8a2a20);
  drum(g, gx, gy, 1.6, STATION.hub - 1, STATION.hub + 1, 0x5a6670, 0x8a96a0, 8);
}
/** The anemometer's three cups turning (ambient). */
export function anemometer(g: Ink, gx: number, gy: number, clock: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const a = clock * 6 + seed + (i / 3) * Math.PI * 2,
      u = Math.cos(a) * 6,
      v = Math.sin(a) * 6;
    g.lineStyle(0.7, 0xa0aab2);
    g.lineBetween(gx, Y(gy, 0, STATION.hub + 0.5), X(gx, u), Y(gy, v, STATION.hub + 0.5));
    disc(g, X(gx, u), Y(gy, v, STATION.hub + 0.5), 1.4, 0xe8eef2);
  }
}
export function stationShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(1.6, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + STATION.hub * SUN.x, gy + STATION.hub * SUN.y);
  boxShadow(g, gx, gy + 2, 0.2, 5, 4, 15, 0.25);
}

// ── Supply cache ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cache { a: number; crates: number; drum: boolean }
export const cacheOf = (rand: Random): Cache => ({ a: (rand() - 0.5) * 0.7, crates: rand() < 0.5 ? 2 : 3, drum: rand() < 0.7 });
/** A supply cache: timber crates under a crust of snow, a red fuel drum, a marker pole with an orange flag. */
export function drawCache(g: Ink, gx: number, gy: number, c: Cache) {
  oval(g, gx, gy + 2, 18, 9, SNOW, 0.85);
  const slots = [[-6, -4, 0], [7, -2, 0], [0, -3, 9]].slice(0, c.crates);
  for (const [p, q, z] of slots) {
    const f = frame(c.a, 0, z, Math.cos(c.a) * p - Math.sin(c.a) * q, Math.sin(c.a) * p + Math.cos(c.a) * q);
    box(g, gx, gy, f, -6, 6, -5, 5, 0, 9, 0x7a5a36);
    box(g, gx, gy, f, -6.2, 6.2, -5.2, 5.2, 9, 10.4, SNOW);
  }
  if (c.drum) {
    drum(g, gx - 9, gy + 6 * SQUASH, 4, 0, 11, 0xa83a2a, shade(0xa83a2a, 0.1), 10);
    drum(g, gx - 9, gy + 6 * SQUASH, 4.1, 11, 12, SNOW, SNOW, 10);
  }
  rod(g, gx, gy, 12, 4, 0, 12, 4, 26, 0.8, 0x3a3a3a);
  g.fillStyle(0xff7a2a);
  g.fillTriangle(X(gx, 12), Y(gy, 4, 26), X(gx, 12), Y(gy, 4, 21), X(gx, 19), Y(gy, 4, 24));
}
export function cacheShadow(g: Ink, gx: number, gy: number, c: Cache) {
  boxShadow(g, gx, gy, c.a, 13, 6, c.crates > 2 ? 19 : 10);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The research dome's window band and its beacon (heights at full size). */
export const DOME = { r: 32, band: 14, beacon: 64 } as const;
/** A research station: a white dome ringed by a lit window band on a skirt of snow, a radar dish and an aerial mast. */
export function drawDome(g: Ink) {
  oval(g, 0, 4, 46, 26, SNOW, 0.95);
  drum(g, 0, 0, DOME.r, 0, 10, 0xb8c4cc, 0xc8d4dc, 24);
  drum(g, 0, 0, DOME.r - 0.4, 10, 17, 0x1a2a38, 0x2a3a48, 24);
  // The shell: one smooth hemisphere seen from above the horizon, lit from the upper left, with two panel seams.
  const eq = Y(0, 0, 17),
    R = DOME.r - 0.4,
    top = R * 0.82,
    arc = (rx: number, ry: number, cx: number, cy: number, a0: number, a1: number, n = 24) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = a0 + ((a1 - a0) * i) / n;
        return { x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry };
      });
  g.fillStyle(OUTLINE, 0.8);
  g.fillPoints([...arc(R + 0.8, top + 0.8, 0, eq, Math.PI, Math.PI * 2), ...arc(R + 0.8, R * SQUASH, 0, eq, 0, Math.PI)], true);
  g.fillStyle(0xa8b6c0);
  g.fillPoints([...arc(R, top, 0, eq, Math.PI, Math.PI * 2), ...arc(R, R * SQUASH, 0, eq, 0, Math.PI)], true);
  g.fillStyle(0xc8d4dc);
  g.fillPoints(arc(R * 0.86, top * 0.88, -R * 0.1, eq - top * 0.08, 0, Math.PI * 2), true);
  g.fillStyle(0xe8f0f6);
  g.fillPoints(arc(R * 0.5, top * 0.5, -R * 0.3, eq - top * 0.42, 0, Math.PI * 2), true);
  g.lineStyle(0.8, 0x8a98a2, 0.8);
  for (const k of [-0.45, 0.2]) g.strokePoints(arc(R * Math.abs(k) + 0.1, top, 0, eq, Math.PI * (k < 0 ? 1 : 1.5), Math.PI * (k < 0 ? 1.5 : 2)).map((q) => ({ x: k < 0 ? q.x : q.x, y: q.y })), false);
  g.strokePoints(arc(R * 0.98, top * 0.45, 0, eq, Math.PI, Math.PI * 2), false);
  // Window frames across the band.
  for (let i = 1; i < 12; i++) {
    const t = (i / 12) * Math.PI;
    g.lineStyle(1, 0xb8c4cc);
    g.lineBetween(X(0, Math.cos(t) * DOME.r), Y(0, Math.sin(t) * DOME.r, 10), X(0, Math.cos(t) * DOME.r), Y(0, Math.sin(t) * DOME.r, 17));
  }
  // The radar dish on its stand at the right, the aerial mast at the back left.
  rod(g, 0, 0, 30, 10, 0, 30, 10, 26, 2, 0x8a96a0);
  plane(g, 0, 0, frame(-0.5, 0.6, 30, 28, 10), 2, 11, 0xe8eef2, 1, 11, 18);
  plane(g, 0, 0, frame(-0.5, 0.6, 30, 28, 10), 2.4, 8, 0xc8d0d6, 1, 8, 18);
  rod(g, 0, 0, -8, -4, 38, -8, -4, DOME.beacon, 1.2, 0xa0aab2);
  rod(g, 0, 0, -12, -4, 54, -4, -4, 54, 0.8, 0xa0aab2);
}
export function domeShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 22 * k, 13 * k, 42, 24, SHADE, 0.16);
}
/** An ice serac: a great broken block of glacier ice standing in a drift, shards splintered round it. */
export function drawSerac(g: Ink) {
  oval(g, 0, 4, 44, 24, SNOW, 0.95);
  const list: Crystal[] = [
    { u: -14, v: -8, a: 3.6, lean: 0.25, len: 40, r: 9, color: ICE[1] },
    { u: 4, v: -4, a: 0.5, lean: 0.12, len: 62, r: 13, color: ICE[0] },
    { u: 20, v: 2, a: 0.2, lean: 0.4, len: 30, r: 8, color: ICE[3] },
    { u: -24, v: 8, a: 2.8, lean: 0.6, len: 18, r: 5, color: ICE[2] },
    { u: -4, v: 12, a: 1.6, lean: 0.5, len: 22, r: 6, color: ICE[1] },
    { u: 14, v: 14, a: 0.9, lean: 0.7, len: 14, r: 4, color: ICE[2] },
  ];
  for (const c of list) crystal(g, 0, 0, c);
  // Snow lying on the tallest block's shoulder.
  oval(g, 2, Y(0, -4, 50), 7, 3, SNOW, 0.95);
}
export function seracShadow(g: Ink) {
  g.fillStyle(SHADE, 0.2);
  g.fillTriangle(-20, 6, 26, 10, 60, 40);
}
