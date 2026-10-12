import type { MapDefinition, MapTheme } from "../core/types";
import { fnv } from "../core/hash";
import { CELL, disc, hash01, oval, shade, type Ink } from "./shapes";
/**
 * The battlefield ground below decor, obstacles and the path: smooth tonal variation instead of a hard checkerboard,
 * a few soft patches, a fine material grain per theme family, contact darkening along obstacles and the path, and a
 * bevelled "pad" on every buildable cell, so placeable ground reads as tiles and everything else as background.
 * Everything is seeded per map and cell (salted, so the themes' decor and obstacle rolls stay as they were).
 */
export type GroundFamily = "metal" | "sand" | "rock" | "volcanic" | "ice" | "organic" | "crystal" | "water";
export const GROUND_FAMILY: Record<MapTheme, GroundFamily> = {
  outpost: "metal",
  lock: "metal",
  core: "metal",
  orbit: "metal",
  gear: "metal",
  dune: "sand",
  storm: "rock",
  ruin: "rock",
  ember: "volcanic",
  volcano: "volcanic",
  frost: "ice",
  jungle: "organic",
  toxic: "organic",
  shard: "crystal",
  geode: "crystal",
  rift: "crystal",
  abyss: "water",
  tide: "water",
};
interface GroundTheme {
  backdrop: number;
  ground: readonly [number, number];
  grid: number;
}
type Random = () => number;
/** Linear mix of two colours. */
export function blend(a: number, b: number, t: number) {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
/** Relative luminance in [0, 1]. */
export const luma = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
function random(seed: number): Random {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Salted per-cell random stream; the salt keeps it apart from the themes' own `cellRandom`. */
export const groundRandom = (map: MapDefinition, salt: string, x: number, y: number) => random(fnv(`${map.id}:${salt}:${x}:${y}`));
/** Smooth value noise in [-1, 1] on a lattice of `step` cells (bilinear between hashed corners). */
function noise(seed: number, x: number, y: number, step: number) {
  const gx = x / step,
    gy = y / step,
    x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    fx = gx - x0,
    fy = gy - y0,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    v = (i: number, j: number) => hash01(seed, x0 + i, y0 + j) * 2 - 1,
    top = v(0, 0) * (1 - sx) + v(1, 0) * sx,
    bottom = v(0, 1) * (1 - sx) + v(1, 1) * sx;
  return top * (1 - sy) + bottom * sy;
}
function zigzag(g: Ink, x: number, y: number, rand: Random, length: number, segments: number, width: number, color: number, alpha: number) {
  let a = rand() * Math.PI * 2;
  const points = [{ x, y }];
  for (let i = 0; i < segments; i++) {
    a += (rand() - 0.5) * 1.3;
    const last = points[points.length - 1];
    points.push({ x: last.x + Math.cos(a) * (length / segments), y: last.y + Math.sin(a) * (length / segments) });
  }
  g.lineStyle(width, color, alpha);
  g.strokePoints(points, false);
}
/** Fine material marks inside one cell (top-left `x`, `y`); `n` scales how many, `base` is the cell's ground colour. */
type Grain = (g: Ink, x: number, y: number, rand: Random, base: number, n: number) => void;
const inside = (rand: Random, margin = 6) => margin + rand() * (CELL - 2 * margin);
const GRAIN: Record<GroundFamily, Grain> = {
  // Panel seams with a lit lip, and rivet pairs.
  metal: (g, x, y, rand, base, n) => {
    if (rand() < 0.55) {
      const along = rand() < 0.5,
        o = Math.round(14 + rand() * 28);
      g.fillStyle(shade(base, -0.22), 0.55);
      if (along) g.fillRect(x + 2, y + o, CELL - 4, 1);
      else g.fillRect(x + o, y + 2, 1, CELL - 4);
      g.fillStyle(shade(base, 0.1), 0.45);
      if (along) g.fillRect(x + 2, y + o + 1, CELL - 4, 1);
      else g.fillRect(x + o + 1, y + 2, 1, CELL - 4);
    }
    for (let i = 0; i < n; i++) {
      const rx = x + inside(rand, 7),
        ry = y + inside(rand, 7);
      disc(g, rx, ry, 1.3, shade(base, -0.2), 0.6);
      disc(g, rx - 0.4, ry - 0.4, 0.7, shade(base, 0.16), 0.6);
    }
  },
  // Wind ripples: a lit crest over a soft trough.
  sand: (g, x, y, rand, base, n) => {
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const cy = y + inside(rand, 8),
        cx = x + inside(rand, 10),
        w = 12 + rand() * 18,
        points = Array.from({ length: 6 }, (_, k) => ({ x: cx - w / 2 + (w * k) / 5, y: cy + Math.sin(k * 1.2 + rand()) * 1.6 }));
      g.lineStyle(1.4, shade(base, -0.1), 0.5);
      g.strokePoints(points.map((p) => ({ x: p.x, y: p.y + 1.2 })), false);
      g.lineStyle(1, shade(base, 0.1), 0.55);
      g.strokePoints(points, false);
    }
  },
  // Hairline cracks and pebbles.
  rock: (g, x, y, rand, base, n) => {
    if (rand() < 0.45) zigzag(g, x + inside(rand), y + inside(rand), rand, 14 + rand() * 14, 4, 1, shade(base, -0.28), 0.5);
    for (let i = 0; i < n; i++) {
      const rx = x + inside(rand),
        ry = y + inside(rand),
        r = 1.2 + rand() * 1.8;
      oval(g, rx + 0.6, ry + 0.8, r, r * 0.75, shade(base, -0.25), 0.45);
      oval(g, rx, ry, r, r * 0.75, shade(base, 0.08), 0.5);
    }
  },
  // Dark fissures and ash flecks.
  volcanic: (g, x, y, rand, base, n) => {
    if (rand() < 0.4) zigzag(g, x + inside(rand), y + inside(rand), rand, 12 + rand() * 16, 5, 1.2, shade(base, -0.35), 0.55);
    for (let i = 0; i < n + 2; i++) disc(g, x + inside(rand, 3), y + inside(rand, 3), 0.6 + rand() * 0.8, shade(base, rand() < 0.5 ? 0.14 : -0.2), 0.5);
  },
  // Frost cracks and tiny sparkles.
  ice: (g, x, y, rand, base, n) => {
    if (rand() < 0.5) {
      const cx = x + inside(rand),
        cy = y + inside(rand);
      g.lineStyle(1, shade(base, 0.16), 0.45);
      for (let k = 0; k < 3; k++) {
        const a = rand() * Math.PI * 2,
          l = 6 + rand() * 10;
        g.lineBetween(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const sx = x + inside(rand, 4),
        sy = y + inside(rand, 4);
      g.fillStyle(shade(base, 0.3), 0.5);
      g.fillRect(sx - 1.5, sy - 0.25, 3, 0.5);
      g.fillRect(sx - 0.25, sy - 1.5, 0.5, 3);
    }
  },
  // Moss clumps and leaf flecks.
  organic: (g, x, y, rand, base, n) => {
    for (let i = 0; i < n; i++) {
      const mx = x + inside(rand),
        my = y + inside(rand);
      if (rand() < 0.5) {
        for (let k = 0; k < 3; k++) disc(g, mx + (rand() - 0.5) * 6, my + (rand() - 0.5) * 5, 1.6 + rand() * 1.8, shade(base, 0.07 + rand() * 0.05), 0.5);
      } else oval(g, mx, my, 2.4, 0.9, shade(base, rand() < 0.5 ? 0.12 : -0.15), 0.5, rand() * Math.PI);
    }
  },
  // Facet lines: a faint triangular plane with a lit edge.
  crystal: (g, x, y, rand, base, n) => {
    if (rand() < 0.5) {
      const ax = x + inside(rand),
        ay = y + inside(rand),
        bx = ax + (rand() - 0.5) * 26,
        by = ay + (rand() - 0.5) * 26,
        cx = ax + (rand() - 0.5) * 26,
        cy = ay + (rand() - 0.5) * 26;
      g.fillStyle(shade(base, 0.06), 0.4);
      g.fillTriangle(ax, ay, bx, by, cx, cy);
      g.lineStyle(1, shade(base, 0.18), 0.45);
      g.lineBetween(ax, ay, bx, by);
    }
    for (let i = 0; i < n - 1; i++) disc(g, x + inside(rand, 4), y + inside(rand, 4), 0.7, shade(base, 0.25), 0.5);
  },
  // Caustic squiggles.
  water: (g, x, y, rand, base, n) => {
    for (let i = 0; i < Math.max(1, n - 1); i++) {
      const cx = x + inside(rand, 8),
        cy = y + inside(rand, 8),
        w = 8 + rand() * 12,
        phase = rand() * Math.PI * 2,
        points = Array.from({ length: 6 }, (_, k) => ({ x: cx - w / 2 + (w * k) / 5, y: cy + Math.sin(phase + k * 1.4) * 2.2 }));
      g.lineStyle(1, shade(base, 0.14), 0.4);
      g.strokePoints(points, false);
    }
  },
};
/** The colour of one ground cell, before grain: the checkerboard reduced to a hint, shifted by smooth noise. */
function cellColor(theme: GroundTheme, seed: number, x: number, y: number) {
  const mean = blend(theme.ground[0], theme.ground[1], 0.5),
    base = blend(mean, theme.ground[(Math.floor(x) + Math.floor(y)) % 2], 0.35),
    v = noise(seed, x, y, 3) * 0.06 + noise(seed + 7, x, y, 1.1) * 0.015;
  return shade(base, v);
}
/**
 * Draws the whole ground of a map into `g`. `onPath` and `isBlocked` decide which cells are buildable (the pad) and
 * where contact shadows fall.
 */
export function drawGround(g: Ink, map: MapDefinition, theme: GroundTheme, isBlocked: (x: number, y: number) => boolean, onPath: (x: number, y: number) => boolean) {
  const seed = fnv(`${map.id}:ground`),
    family = GROUND_FAMILY[map.theme ?? "outpost"],
    width = map.columns * CELL,
    height = map.rows * CELL,
    mean = blend(theme.ground[0], theme.ground[1], 0.5),
    light = luma(mean) > 0.3,
    free = (x: number, y: number) => x >= 0 && y >= 0 && x < map.columns && y < map.rows && !isBlocked(x, y) && !onPath(x, y);
  g.fillStyle(theme.backdrop);
  g.fillRect(0, 0, width, height);
  // Tone: 4×4 tiles per cell, each sampled at its own centre, so the noise flows across cell borders.
  const tile = CELL / 4;
  for (let y = 0; y < map.rows * 4; y++)
    for (let x = 0; x < map.columns * 4; x++) {
      g.fillStyle(cellColor(theme, seed, (x + 0.5) / 4, (y + 0.5) / 4));
      g.fillRect(x * tile, y * tile, tile, tile);
    }
  // Soft patches over several cells: worn ground, dust, moss or silt, depending on the family's colours.
  const patches = random(seed ^ 0x5f3759df);
  for (let i = 0, n = 3 + Math.floor(patches() * 3); i < n; i++) {
    const cx = patches() * width,
      cy = patches() * height,
      rx = CELL * (1.4 + patches() * 2.2),
      ry = rx * (0.45 + patches() * 0.4),
      rot = patches() * Math.PI,
      color = shade(mean, patches() < 0.55 ? -0.18 : 0.1);
    for (let k = 0; k < 4; k++) oval(g, cx, cy, rx * (1 - k * 0.2), ry * (1 - k * 0.2), color, 0.05, rot);
  }
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) {
      if (onPath(x, y) || isBlocked(x, y)) continue;
      const x0 = x * CELL,
        y0 = y * CELL,
        base = cellColor(theme, seed, x + 0.25, y + 0.25),
        rand = groundRandom(map, "grain", x, y);
      // Buildable cells stay calmer than the decorated ground around them.
      GRAIN[family](g, x0, y0, rand, base, 2 + Math.floor(rand() * 2));
      // Contact darkening where the cell meets an obstacle or the path.
      const dark = shade(mean, -0.6),
        edge = (k: number) => 0.13 * (1 - k / 3) * (light ? 0.7 : 1);
      for (let k = 0; k < 3; k++) {
        const o = k * 2;
        g.fillStyle(dark, edge(k));
        if (!free(x, y - 1)) g.fillRect(x0, y0 + o, CELL, 2);
        if (!free(x, y + 1)) g.fillRect(x0, y0 + CELL - o - 2, CELL, 2);
        if (!free(x - 1, y)) g.fillRect(x0 + o, y0, 2, CELL);
        if (!free(x + 1, y)) g.fillRect(x0 + CELL - o - 2, y0, 2, CELL);
      }
      // The pad: lit top and left edges, shaded bottom and right, light from the upper left.
      g.fillStyle(shade(base, light ? 0.18 : 0.13), 0.55);
      g.fillRect(x0 + 2, y0 + 2, CELL - 4, 1);
      g.fillRect(x0 + 2, y0 + 3, 1, CELL - 5);
      g.fillStyle(shade(base, -0.35), 0.5);
      g.fillRect(x0 + 2, y0 + CELL - 3, CELL - 4, 1);
      g.fillRect(x0 + CELL - 3, y0 + 2, 1, CELL - 5);
    }
  // A soft grid between cells and a dot at every corner.
  g.fillStyle(theme.grid, 0.18);
  for (let x = 1; x < map.columns; x++) g.fillRect(x * CELL - 0.5, 0, 1, height);
  for (let y = 1; y < map.rows; y++) g.fillRect(0, y * CELL - 0.5, width, 1);
  for (let y = 1; y < map.rows; y++) for (let x = 1; x < map.columns; x++) disc(g, x * CELL, y * CELL, 1.2, theme.grid, 0.5);
}
/**
 * Board light over the finished terrain: a soft pool from the upper left and a vignette towards the edges, both
 * weaker on light ground (`strength` from `themeGlow`).
 */
export function drawBoardLight(g: Ink, map: MapDefinition, theme: GroundTheme, strength: number) {
  const width = map.columns * CELL,
    height = map.rows * CELL,
    mean = blend(theme.ground[0], theme.ground[1], 0.5),
    pool = shade(mean, 0.55);
  for (let k = 0; k < 6; k++) oval(g, width * 0.22, height * 0.18, width * (0.75 - k * 0.1), height * (0.8 - k * 0.11), pool, 0.012 * strength);
  const steps = 14,
    depth = CELL * 2;
  for (let k = 0; k < steps; k++) {
    const t = k / steps,
      w = depth / steps,
      alpha = 0.055 * (1 - t) * (1 - t) * (0.5 + strength / 2);
    g.fillStyle(0x000000, alpha);
    g.fillRect(0, k * w, width, w);
    g.fillRect(0, height - (k + 1) * w, width, w);
    g.fillRect(k * w, 0, w, height);
    g.fillRect(width - (k + 1) * w, 0, w, height);
  }
}
