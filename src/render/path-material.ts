import type { MapDefinition, Point } from "../core/types";
import { fnv } from "../core/hash";
import type { GroundFamily } from "./ground";
import { arcBand, disc, hash01, oval, polygon, shade, type Ink } from "./shapes";
/**
 * The road's surface, baked with the terrain on top of the bed: a material per ground family (seams on metal, ripples
 * on sand, cracks on ice, mud on organic ground, a wet sheen on water, scoria on volcanic rock, facets on crystal,
 * flagstones and gravel on rock), then extra wear on the outer side of every corner and near the entry and the
 * reactor. Jitter comes from `hash01` over a salted map seed, so the themes' own rolls stay unchanged.
 */
/** Half the width of the bed in pixels: details stay inside it. */
const HALF = 15;
interface Segment {
  /** Start of the segment, its unit direction, normal (to the right of travel) and length. */
  a: Point;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  length: number;
  index: number;
}
function segments(path: readonly Point[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      length = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      tx = (b.x - a.x) / length,
      ty = (b.y - a.y) / length;
    out.push({ a, tx, ty, nx: -ty, ny: tx, length, index: i });
  }
  return out;
}
/** The point `d` pixels along a segment and `side` pixels to the right of it. */
const at = (s: Segment, d: number, side: number) => ({ x: s.a.x + s.tx * d + s.nx * side, y: s.a.y + s.ty * d + s.ny * side });
type Material = (g: Ink, s: Segment, seed: number, bed: number) => void;
const MATERIALS: Record<GroundFamily, Material> = {
  // Deck plates: a seam across the bed every half cell, lit on its far side, with a rivet at each end.
  metal: (g, s, seed, bed) => {
    for (let d = 14; d < s.length; d += 28) {
      const p0 = at(s, d, -HALF + 1),
        p1 = at(s, d, HALF - 1);
      g.lineStyle(1.5, shade(bed, -0.4), 0.7);
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      g.lineStyle(1, shade(bed, 0.2), 0.35);
      g.lineBetween(p0.x + s.tx * 1.5, p0.y + s.ty * 1.5, p1.x + s.tx * 1.5, p1.y + s.ty * 1.5);
      for (const side of [-11, 11]) {
        const r = at(s, d + 5, side);
        disc(g, r.x, r.y, 1.3, shade(bed, 0.25), 0.6);
      }
      if (hash01(seed, s.index, d) < 0.3) {
        const scuff = at(s, d + 14, (hash01(seed, d, s.index) - 0.5) * 16);
        oval(g, scuff.x, scuff.y, 6, 1.5, shade(bed, 0.12), 0.3, Math.atan2(s.ty, s.tx));
      }
    }
  },
  // Wind ripples across the bed, bowed a little, dark in the trough and lit on the crest.
  sand: (g, s, seed, bed) => {
    for (let d = 3; d < s.length; d += 7) {
      const bow = (hash01(seed, s.index, d) - 0.5) * 6,
        line = (offset: number) => [at(s, d + offset, -HALF + 2), at(s, d + offset + bow, 0), at(s, d + offset, HALF - 2)];
      g.lineStyle(1.4, shade(bed, -0.14), 0.4);
      g.strokePoints(line(0), false);
      g.lineStyle(1, shade(bed, 0.14), 0.3);
      g.strokePoints(line(1.5), false);
    }
  },
  // Pale cracks in the ice and a few frost specks.
  ice: (g, s, seed, bed) => {
    for (let d = 6; d < s.length; d += 18) {
      if (hash01(seed, s.index, d) > 0.6) continue;
      let a = hash01(seed, d, s.index) * Math.PI * 2,
        p = at(s, d, (hash01(d, seed, s.index) - 0.5) * 20);
      const points = [p];
      for (let k = 0; k < 3; k++) {
        a += (hash01(seed, s.index * 7 + k, d) - 0.5) * 1.4;
        p = { x: p.x + Math.cos(a) * 5, y: p.y + Math.sin(a) * 5 };
        points.push(p);
      }
      g.lineStyle(1, shade(bed, 0.4), 0.5);
      g.strokePoints(points, false);
    }
    for (let d = 2; d < s.length; d += 5) {
      const h = hash01(seed, d, s.index * 3);
      if (h < 0.5) continue;
      const p = at(s, d, (hash01(s.index, d, seed) - 0.5) * 26);
      disc(g, p.x, p.y, 0.7, 0xeaf7ff, 0.4 * h);
    }
  },
  // Mud puddles with a wet highlight, and roots reaching in from the edges.
  organic: (g, s, seed, bed) => {
    const heading = Math.atan2(s.ty, s.tx);
    for (let d = 10; d < s.length; d += 26) {
      const h = hash01(seed, s.index, d);
      if (h < 0.45) continue;
      const p = at(s, d, (hash01(seed, d, s.index) - 0.5) * 14),
        rx = 5 + h * 5;
      oval(g, p.x, p.y, rx, rx * 0.5, shade(bed, -0.3), 0.55, heading);
      oval(g, p.x - 1.5, p.y - 1.2, rx * 0.5, rx * 0.15, shade(bed, 0.35), 0.35, heading);
    }
    for (let d = 8; d < s.length; d += 20) {
      if (hash01(seed, d, s.index * 5) < 0.55) continue;
      const side = hash01(s.index, seed, d) < 0.5 ? -1 : 1,
        p0 = at(s, d, side * (HALF + 2)),
        p1 = at(s, d + 4, side * (HALF - 5)),
        p2 = at(s, d + 3, side * (HALF - 9));
      g.lineStyle(1.8, shade(bed, -0.35), 0.6);
      g.strokePoints([p0, p1, p2], false);
    }
  },
  // A wet sheen: long thin light streaks along the bed and a few shallow pools.
  water: (g, s, seed, bed) => {
    for (let d = 0; d < s.length; d += 9) {
      const h = hash01(seed, s.index, d);
      if (h < 0.45) continue;
      const side = (hash01(seed, d, s.index) - 0.5) * 24,
        p0 = at(s, d, side),
        p1 = at(s, d + 8 + h * 12, side);
      g.lineStyle(1, shade(bed, 0.4), 0.16);
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
    }
    for (let d = 20; d < s.length; d += 40) {
      if (hash01(seed, d, s.index * 3) < 0.5) continue;
      const p = at(s, d, (hash01(s.index, d, seed) - 0.5) * 12);
      oval(g, p.x, p.y, 8, 3.5, shade(bed, -0.2), 0.4, Math.atan2(s.ty, s.tx));
      oval(g, p.x - 2, p.y - 1, 4, 1, shade(bed, 0.45), 0.3, Math.atan2(s.ty, s.tx));
    }
  },
  // Scoria: dark pores everywhere and now and then a crack with a dim ember line.
  volcanic: (g, s, seed, bed) => {
    for (let d = 1; d < s.length; d += 3) {
      const h = hash01(seed, s.index, d);
      if (h < 0.55) continue;
      const p = at(s, d, (hash01(seed, d, s.index) - 0.5) * 28);
      disc(g, p.x, p.y, 0.6 + h, shade(bed, -0.45), 0.6);
    }
    for (let d = 12; d < s.length; d += 30) {
      if (hash01(seed, d, s.index * 7) < 0.6) continue;
      let p = at(s, d, (hash01(s.index, seed, d) - 0.5) * 16),
        a = Math.atan2(s.ty, s.tx) + (hash01(d, s.index, seed) - 0.5) * 2;
      const points = [p];
      for (let k = 0; k < 4; k++) {
        a += (hash01(seed, k, d + s.index) - 0.5) * 1.2;
        p = { x: p.x + Math.cos(a) * 4, y: p.y + Math.sin(a) * 4 };
        points.push(p);
      }
      g.lineStyle(2, shade(bed, -0.5), 0.6);
      g.strokePoints(points, false);
      g.lineStyle(0.8, 0xff6a2a, 0.4);
      g.strokePoints(points, false);
    }
  },
  // Facets: small lit triangles set into the bed, with a sparkle here and there.
  crystal: (g, s, seed, bed) => {
    for (let d = 4; d < s.length; d += 8) {
      const h = hash01(seed, s.index, d);
      if (h < 0.45) continue;
      const p = at(s, d, (hash01(seed, d, s.index) - 0.5) * 24);
      polygon(g, p.x, p.y, 2 + h * 2.5, 3, shade(bed, h > 0.75 ? 0.3 : -0.25), h * 9, 0.35);
      if (h > 0.92) disc(g, p.x, p.y, 0.9, 0xffffff, 0.5);
    }
  },
  // Flagstones: broken joints across the bed at irregular steps, gravel with a lit top.
  rock: (g, s, seed, bed) => {
    for (let d = 10 + hash01(seed, s.index) * 10; d < s.length; d += 16 + hash01(seed, d, s.index) * 14) {
      const tilt = (hash01(s.index, d, seed) - 0.5) * 4,
        p0 = at(s, d - tilt, -HALF + 1),
        p1 = at(s, d, 0),
        p2 = at(s, d + tilt, HALF - 1);
      g.lineStyle(1.3, shade(bed, -0.35), 0.55);
      g.strokePoints([p0, p1, p2], false);
    }
    for (let d = 2; d < s.length; d += 4) {
      const h = hash01(seed, d, s.index * 11);
      if (h < 0.6) continue;
      const p = at(s, d, (hash01(s.index, d, seed) - 0.5) * 28),
        r = 0.8 + h * 1.2;
      disc(g, p.x + 0.6, p.y + 0.8, r, shade(bed, -0.35), 0.5);
      disc(g, p.x, p.y, r, shade(bed, 0.18), 0.6);
    }
  },
};
/** Scuffs worn into the bed around (`x`, `y`), stretched along `angle`. */
function scuff(g: Ink, x: number, y: number, angle: number, size: number, bed: number) {
  for (let k = 0; k < 3; k++) oval(g, x, y, size * (1 - k * 0.25), size * 0.55 * (1 - k * 0.25), shade(bed, -0.25), 0.1, angle);
}
export function drawPathMaterial(g: Ink, map: MapDefinition, path: readonly Point[], bed: number, family: GroundFamily) {
  const seed = fnv(`${map.id}:path-material`),
    all = segments(path);
  for (const s of all) MATERIALS[family](g, s, seed, bed);
  // Corners: the outer side of every turn is worn darker, with skid marks swinging round it.
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1],
      b = all[i];
    if (a.tx === b.tx && a.ty === b.ty) continue;
    const p = path[i],
      ox = a.tx - b.tx,
      oy = a.ty - b.ty,
      ol = Math.hypot(ox, oy) || 1,
      angle = Math.atan2(oy, ox);
    scuff(g, p.x + (ox / ol) * 8, p.y + (oy / ol) * 8, angle + Math.PI / 2, 13, bed);
    for (const r of [9, 13]) arcBand(g, p.x, p.y, r, 1.2, angle - 0.7, angle + 0.7, shade(bed, -0.3), 0.3);
  }
  // Entry and reactor: heavy traffic wears the first and last stretch.
  const ends = map.loop ? [0] : [0, path.length - 1];
  for (const i of ends) {
    const s = all[Math.min(i, all.length - 1)],
      dir = i === 0 ? 1 : -1,
      from = path[i],
      angle = Math.atan2(s.ty, s.tx);
    for (let k = 0; k < 3; k++) scuff(g, from.x + s.tx * dir * (18 + k * 16), from.y + s.ty * dir * (18 + k * 16), angle, 15 - k * 3, bed);
    g.lineStyle(1, shade(bed, -0.3), 0.35);
    for (let k = 0; k < 5; k++) {
      const side = (hash01(seed, i, k) - 0.5) * 22,
        d0 = 14 + hash01(seed, k, i) * 20,
        x0 = from.x + s.tx * dir * d0 + s.nx * side,
        y0 = from.y + s.ty * dir * d0 + s.ny * side;
      g.lineBetween(x0, y0, x0 + s.tx * dir * 14, y0 + s.ty * dir * 14);
    }
  }
}
