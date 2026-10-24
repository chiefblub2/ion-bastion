import type { MapTheme } from "../core/types";
import { borderShift, type Box, type Point } from "./world-map";
/**
 * The Sector Atlas's planet surface, painted pixel by pixel: no DOM, so a worker can run it (`planet-worker.ts`).
 * Every territory has a biome from its sector's terrain theme (the wilds are orange waste); height comes from warped
 * value noise with ridged mountains, is lit from the upper left like the battlefield, and gets the biome's seas,
 * glowing cracks or hive plating. Everything is a function of world coordinates, so a sharper tile of one sector
 * matches the whole surface under it.
 */
export type BiomeId = MapTheme | "waste" | "tundra" | "verdant" | "regolith";
export interface Biome {
  /** Ground colour from low to high. */
  ramp: readonly [number, number, number];
  /** How mountainous, 0 to 1. */
  relief: number;
  /** Low ground below `level` (0 to 1) is liquid; `glow` makes it shine (lava). */
  sea?: { level: number; deep: number; shallow: number; glow?: boolean };
  /** Glowing cracks along the valleys. */
  cracks?: number;
  /** Hive-city plating: panel size in world units. */
  plates?: number;
}
export const BIOMES: Record<BiomeId, Biome> = {
  waste: { ramp: [0x3a2414, 0x6e4422, 0xa27046], relief: 0.75 },
  tundra: { ramp: [0x2a3036, 0x56606a, 0x9aa6ae], relief: 0.7, sea: { level: 0.22, deep: 0x1c2e40, shallow: 0x3c5a72 } },
  verdant: { ramp: [0x1e2a16, 0x3a4a26, 0x6e7a48], relief: 0.65, sea: { level: 0.24, deep: 0x0e2a30, shallow: 0x1f5a56 } },
  regolith: { ramp: [0x2a2a30, 0x55555e, 0x9a98a2], relief: 0.55 },
  outpost: { ramp: [0x3a3626, 0x686244, 0xa29774], relief: 0.6 },
  lock: { ramp: [0x262c36, 0x485260, 0x7c8796], relief: 0.3, plates: 3.2 },
  shard: { ramp: [0x2c2638, 0x544a6a, 0x9488b4], relief: 0.8, cracks: 0xd8ccff },
  ember: { ramp: [0x2a1610, 0x553226, 0x8a5a40], relief: 0.7, cracks: 0xff7a3a },
  core: { ramp: [0x22262e, 0x404754, 0x707a8c], relief: 0.25, plates: 2.4, cracks: 0x93f5b8 },
  frost: { ramp: [0x4a5a6c, 0x8a9eb0, 0xc6d4e2], relief: 0.85, sea: { level: 0.3, deep: 0x5d86a6, shallow: 0xa8cce2 } },
  toxic: { ramp: [0x2a3120, 0x4b582c, 0x7c884a], relief: 0.45, sea: { level: 0.36, deep: 0x2f5a10, shallow: 0x8fd41f, glow: true } },
  orbit: { ramp: [0x262d3c, 0x465166, 0x7a879f], relief: 0.2, plates: 4 },
  ruin: { ramp: [0x34302c, 0x5c534a, 0x8c8070], relief: 0.4, plates: 2.6 },
  rift: { ramp: [0x1c1430, 0x382a54, 0x6a5a8a], relief: 0.7, cracks: 0xf08aff },
  dune: { ramp: [0x7a4e24, 0xa87840, 0xd2aa6a], relief: 0.3 },
  abyss: { ramp: [0x23403c, 0x3c5c50, 0x6e8a70], relief: 0.5, sea: { level: 0.62, deep: 0x04182c, shallow: 0x135c6c } },
  storm: { ramp: [0x363c46, 0x58626e, 0x8c98a6], relief: 0.75, sea: { level: 0.28, deep: 0x16263a, shallow: 0x2e4a62 } },
  jungle: { ramp: [0x1a361a, 0x2c5822, 0x5a8a38], relief: 0.55, sea: { level: 0.3, deep: 0x123828, shallow: 0x2a6a4c } },
  volcano: { ramp: [0x181212, 0x382824, 0x6a4e3e], relief: 1, sea: { level: 0.26, deep: 0xd8400e, shallow: 0xffb03a, glow: true }, cracks: 0xff6a1a },
  geode: { ramp: [0x28223e, 0x483e68, 0x8a7ab0], relief: 0.8, cracks: 0x5ef2e0 },
  gear: { ramp: [0x3a2c1a, 0x684e2e, 0x9e7a48], relief: 0.3, plates: 3 },
  tide: { ramp: [0x2e4a50, 0x4a706e, 0x88aea6], relief: 0.45, sea: { level: 0.55, deep: 0x06283a, shallow: 0x1a7a8a } },
};
/** The flat colour a territory shows before its surface is painted. */
export const biomeGround = (id: BiomeId) => `#${BIOMES[id].ramp[1].toString(16).padStart(6, "0")}`;
/** A territory's seed and biome. */
export interface SurfaceSeed extends Point {
  biome: BiomeId;
}
/** One 256 × 256 lattice of values in [0, 1); noise reads it at offsets per seed. */
const LATTICE = (() => {
  const values = new Float32Array(256 * 256);
  for (let i = 0; i < values.length; i++) {
    let h = Math.imul(i + 1, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h ^= h >>> 12;
    values[i] = (h >>> 0) / 2 ** 32;
  }
  return values;
})();
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy),
    x0 = ix & 255,
    x1 = (ix + 1) & 255,
    y0 = (iy & 255) << 8,
    y1 = ((iy + 1) & 255) << 8,
    a = LATTICE[y0 + x0],
    b = LATTICE[y0 + x1],
    c = LATTICE[y1 + x0],
    d = LATTICE[y1 + x1];
  return a + (b - a) * u + (c - a + (a - b + d - c) * u) * v;
}
/** Fractal noise in [0, 1): `octaves` layers, each twice as fine and half as strong. */
function fbm(x: number, y: number, octaves: number) {
  let sum = 0,
    amp = 0.5,
    norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y) * amp;
    norm += amp;
    amp *= 0.5;
    x = x * 2 + 17.3;
    y = y * 2 + 9.1;
  }
  return sum / norm;
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const channel = (c: number, shift: number) => (c >> shift) & 255;
/** Light from the upper left, as on the battlefield. */
const LIGHT = (() => {
  const l = Math.sqrt(1 + 1 + 1.6);
  return { x: -1 / l, y: -1 / l, z: Math.sqrt(1.6) / l };
})();
/** Height units per world unit of slope: how strongly relief shades. */
const RELIEF = 7;
/** Width in world units over which neighbouring biomes blend. */
const BLEND = 2;
/**
 * RGBA pixels of the surface in `box` (world units) at `width` × `height`. `seeds` are the territories' seeds:
 * the biome of a point is its territory's, found through the same warp the borders use.
 */
export function paintSurface(seeds: readonly SurfaceSeed[], box: Box, width: number, height: number): Uint8ClampedArray {
  const upp = box.w / width,
    vpp = box.h / height,
    // Detail down to about two pixels, so a sharp tile and the whole surface share their coarse layers.
    octaves = Math.max(3, Math.min(9, Math.ceil(Math.log2(24 / (2 * Math.min(upp, vpp)))))),
    W = width + 2,
    H = height + 2,
    biomes = seeds.map((s) => BIOMES[s.biome]);
  // The inverse border warp on a coarse grid (it is smooth), read bilinearly per pixel: the biome of a point is the
  // territory of its unwarped position, so biomes change where the borders run.
  const step = Math.max(0.4, Math.max(upp, vpp) * 6),
    gx = Math.ceil(box.w / step) + 4,
    gy = Math.ceil(box.h / step) + 4,
    shift = new Float32Array(gx * gy * 2);
  for (let j = 0; j < gy; j++)
    for (let i = 0; i < gx; i++) {
      const qx = box.x + (i - 1) * step,
        qy = box.y + (j - 1) * step;
      // Fixed-point iteration: p + shift(p) = q.
      let px = qx,
        py = qy;
      for (let k = 0; k < 3; k++) {
        const d = borderShift(px, py, false);
        px = qx - d.x;
        py = qy - d.y;
      }
      shift[(j * gx + i) * 2] = px - qx;
      shift[(j * gx + i) * 2 + 1] = py - qy;
    }
  const unwarp = (x: number, y: number) => {
    const fx = Math.min(gx - 1.001, Math.max(0, (x - box.x) / step + 1)),
      fy = Math.min(gy - 1.001, Math.max(0, (y - box.y) / step + 1)),
      i = Math.floor(fx),
      j = Math.floor(fy),
      u = fx - i,
      v = fy - j,
      at = (k: number, c: number) => shift[k * 2 + c],
      k00 = j * gx + i,
      lerp2 = (c: number) => mix(mix(at(k00, c), at(k00 + 1, c), u), mix(at(k00 + gx, c), at(k00 + gx + 1, c), u), v);
    return { x: x + lerp2(0), y: y + lerp2(1) };
  };
  // Height with a one-pixel rim for the normals; liquid lies flat at its level.
  const hgt = new Float32Array(W * H),
    raw = new Float32Array(W * H),
    weight = new Float32Array(W * H),
    first = new Int16Array(W * H),
    second = new Int16Array(W * H);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const x = box.x + (i - 0.5) * upp,
        y = box.y + (j - 0.5) * vpp,
        p = unwarp(x, y);
      // The two nearest seeds and the distance to their bisector: 0 on the border, BLEND or more fully inside.
      let a = 0,
        b = seeds.length > 1 ? 1 : 0,
        da = Infinity,
        db = Infinity;
      for (let n = 0; n < seeds.length; n++) {
        const d = (seeds[n].x - p.x) ** 2 + (seeds[n].y - p.y) ** 2;
        if (d < da) {
          b = a;
          db = da;
          a = n;
          da = d;
        } else if (d < db) {
          b = n;
          db = d;
        }
      }
      const span = Math.sqrt((seeds[a].x - seeds[b].x) ** 2 + (seeds[a].y - seeds[b].y) ** 2) || 1,
        w = a === b ? 1 : 0.5 + 0.5 * Math.min(1, (db - da) / (2 * span) / BLEND),
        relief = mix(biomes[b].relief, biomes[a].relief, w),
        wx = x + (noise(x * 0.06 + 40, y * 0.06) - 0.5) * 8,
        wy = y + (noise(x * 0.06, y * 0.06 + 40) - 0.5) * 8,
        base = fbm(wx / 24, wy / 24, octaves),
        ridge = 1 - Math.abs(2 * fbm(wx / 9 + 50, wy / 9 + 50, Math.max(2, octaves - 2)) - 1),
        mountains = fbm(wx / 40 + 90, wy / 40, 2),
        h = Math.min(1, Math.max(0, base * 1.3 - 0.15 + ridge * ridge * ridge * relief * 0.55 * Math.min(1, mountains * 1.6))),
        level = mix(biomes[b].sea?.level ?? 0, biomes[a].sea?.level ?? 0, w),
        n = j * W + i;
      raw[n] = h;
      hgt[n] = Math.max(h, level);
      weight[n] = w;
      first[n] = a;
      second[n] = b;
    }
  const out = new Uint8ClampedArray(width * height * 4),
    rgb = [0, 0, 0],
    colour = (bi: Biome, h: number, x: number, y: number) => {
      const [lo, md, hi] = bi.ramp,
        t = h < 0.5 ? h * 2 : (h - 0.5) * 2,
        c0 = h < 0.5 ? lo : md,
        c1 = h < 0.5 ? md : hi,
        sea = bi.sea && h < bi.sea.level ? bi.sea : undefined;
      let tone = 1,
        r: number,
        g: number,
        b: number;
      if (sea) {
        const depth = Math.pow(h / sea.level, 2);
        r = mix(channel(sea.deep, 16), channel(sea.shallow, 16), depth);
        g = mix(channel(sea.deep, 8), channel(sea.shallow, 8), depth);
        b = mix(channel(sea.deep, 0), channel(sea.shallow, 0), depth);
      } else {
        r = mix(channel(c0, 16), channel(c1, 16), t);
        g = mix(channel(c0, 8), channel(c1, 8), t);
        b = mix(channel(c0, 0), channel(c1, 0), t);
        if (bi.plates) {
          // Panels with dark seams, a finer subdivision and a hashed shade per panel.
          const p = bi.plates,
            px = x / p,
            py = y / p,
            fx = px - Math.floor(px),
            fy = py - Math.floor(py),
            seam = Math.min(fx, 1 - fx, fy, 1 - fy),
            sx = (px * 3) % 1,
            sy = (py * 3) % 1,
            sub = Math.min(Math.abs(sx), 1 - Math.abs(sx), Math.abs(sy), 1 - Math.abs(sy));
          tone *= (0.82 + 0.34 * noise(Math.floor(px) * 1.37 + 0.5, Math.floor(py) * 1.37 + 0.5)) * (seam < 0.05 ? 0.7 : 1) * (sub < 0.04 ? 0.9 : 1);
        }
      }
      rgb[0] = r * tone;
      rgb[1] = g * tone;
      rgb[2] = b * tone;
      return sea?.glow ? 1 : 0;
    };
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) {
      const n = (j + 1) * W + (i + 1),
        x = box.x + (i + 0.5) * upp,
        y = box.y + (j + 0.5) * vpp,
        h = raw[n],
        w = weight[n],
        A = biomes[first[n]],
        B = biomes[second[n]];
      const glowA = colour(A, h, x, y),
        ra = rgb[0],
        ga = rgb[1],
        ba = rgb[2];
      let r = ra,
        g = ga,
        b = ba,
        glow = glowA;
      if (w < 1) {
        const glowB = colour(B, h, x, y);
        r = mix(rgb[0], ra, w);
        g = mix(rgb[1], ga, w);
        b = mix(rgb[2], ba, w);
        glow = mix(glowB, glowA, w);
      }
      // Lambert shading from the height's slope, normalised so flat ground keeps its colour.
      const sx = ((hgt[n + 1] - hgt[n - 1]) / (2 * upp)) * RELIEF,
        sy = ((hgt[n + W] - hgt[n - W]) / (2 * vpp)) * RELIEF,
        len = Math.sqrt(sx * sx + sy * sy + 1),
        lambert = Math.max(0, (-sx * LIGHT.x - sy * LIGHT.y + LIGHT.z) / len) / LIGHT.z,
        shade = mix(0.3 + 0.75 * lambert, 1.15, glow);
      r *= shade;
      g *= shade;
      b *= shade;
      // Glowing cracks in the low ground.
      const crack = (cr: number | undefined) => {
        if (!cr) return 0;
        const c = 1 - Math.abs(2 * fbm(x / 6 + 200, y / 6, 3) - 1);
        return c > 0.94 ? ((c - 0.94) / 0.06) * Math.max(0, 1 - h * 1.2) : 0;
      };
      const ca = crack(A.cracks),
        cb = w < 1 ? crack(B.cracks) : 0;
      if (ca > 0) {
        const k = ca * w;
        r += channel(A.cracks!, 16) * k;
        g += channel(A.cracks!, 8) * k;
        b += channel(A.cracks!, 0) * k;
      }
      if (cb > 0) {
        const k = cb * (1 - w);
        r += channel(B.cracks!, 16) * k;
        g += channel(B.cracks!, 8) * k;
        b += channel(B.cracks!, 0) * k;
      }
      const o = (j * width + i) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  return out;
}
