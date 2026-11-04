import type { MapDefinition, Point } from "../core/types";
import { CELL, hash01 } from "./shapes";
import { fnv } from "../core/hash";
/**
 * Pure geometry of a coastal theme (`Theme.sea`, `Theme.path`; Palm Atoll): which obstacle cells are open sea, how far
 * a point lies from dry land, the sea's depth field and its shore lines for the surf, and the path as a smoothed channel. Cached per map id,
 * so the baked terrain and the ambient layer, which asks every frame, read the same shapes.
 */

/** A sea region needs this many obstacle cells; smaller groups at the edge stay ordinary obstacles. */
export const MIN_SEA = 4;
const key = (x: number, y: number) => `${x},${y}`;
const SEA = new Map<string, ReadonlySet<string>>();
/**
 * The sea: every group of 4-connected obstacle cells that touches the board edge and holds at least `MIN_SEA` cells
 * (keys `"x,y"`). Path cells are never obstacles, so the sea never covers the path.
 */
export function seaCells(map: MapDefinition): ReadonlySet<string> {
  const cached = SEA.get(map.id);
  if (cached) return cached;
  const blocked = new Set(map.blocked.map((p) => key(p.x, p.y))),
    seen = new Set<string>(),
    sea = new Set<string>();
  for (const start of map.blocked) {
    const edge = start.x === 0 || start.y === 0 || start.x === map.columns - 1 || start.y === map.rows - 1;
    if (!edge || seen.has(key(start.x, start.y))) continue;
    const region: Point[] = [start];
    seen.add(key(start.x, start.y));
    for (let i = 0; i < region.length; i++)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = region[i].x + dx,
          y = region[i].y + dy;
        if (blocked.has(key(x, y)) && !seen.has(key(x, y))) {
          seen.add(key(x, y));
          region.push({ x, y });
        }
      }
    if (region.length >= MIN_SEA) for (const p of region) sea.add(key(p.x, p.y));
  }
  SEA.set(map.id, sea);
  return sea;
}
/** The map without its sea cells among the obstacles: what obstacle pieces and landmarks are laid out on. */
export function landOf(map: MapDefinition): MapDefinition {
  const sea = seaCells(map);
  return sea.size ? { ...map, blocked: map.blocked.filter((p) => !sea.has(key(p.x, p.y))) } : map;
}
/** Smooth value noise in [-1, 1] over pixel positions (lattice of `step` px), for wobbling shores and banks. */
export function wobble(seed: number, x: number, y: number, step = 40) {
  const gx = x / step,
    gy = y / step,
    x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    fx = gx - x0,
    fy = gy - y0,
    sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy),
    v = (i: number, j: number) => hash01(seed, x0 + i, y0 + j) * 2 - 1;
  return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
}
/**
 * Pixel distance from (x, y) to the nearest dry board cell (any cell outside the sea), searched up to `reach` cells
 * away; `Infinity` beyond. Off the board counts as open sea.
 */
export function landDistance(map: MapDefinition, sea: ReadonlySet<string>, x: number, y: number, reach = 3) {
  const cx = Math.floor(x / CELL),
    cy = Math.floor(y / CELL);
  let best = Infinity;
  for (let j = cy - reach; j <= cy + reach; j++)
    for (let i = cx - reach; i <= cx + reach; i++) {
      if (i < 0 || j < 0 || i >= map.columns || j >= map.rows || sea.has(key(i, j))) continue;
      const dx = Math.max(i * CELL - x, 0, x - (i + 1) * CELL),
        dy = Math.max(j * CELL - y, 0, y - (j + 1) * CELL);
      best = Math.min(best, Math.sqrt(dx * dx + dy * dy));
    }
  return best;
}
/** One stretch of the shoreline: a sea cell's side facing dry land, with the normal pointing out to sea. */
export interface ShoreEdge { x0: number; y0: number; x1: number; y1: number; nx: number; ny: number }
const EDGES = new Map<string, ShoreEdge[]>();
/** The sides of the sea cells that face dry land, straight along the grid (for fences and walls along a border). */
export function shoreEdges(map: MapDefinition): readonly ShoreEdge[] {
  const cached = EDGES.get(map.id);
  if (cached) return cached;
  const sea = seaCells(map),
    edges: ShoreEdge[] = [],
    land = (x: number, y: number) => x >= 0 && y >= 0 && x < map.columns && y < map.rows && !sea.has(key(x, y));
  for (const k of sea) {
    const [x, y] = k.split(",").map(Number),
      l = x * CELL,
      t = y * CELL,
      r = l + CELL,
      b = t + CELL;
    if (land(x, y - 1)) edges.push({ x0: l, y0: t, x1: r, y1: t, nx: 0, ny: 1 });
    if (land(x, y + 1)) edges.push({ x0: l, y0: b, x1: r, y1: b, nx: 0, ny: -1 });
    if (land(x - 1, y)) edges.push({ x0: l, y0: t, x1: l, y1: b, nx: 1, ny: 0 });
    if (land(x + 1, y)) edges.push({ x0: r, y0: t, x1: r, y1: b, nx: -1, ny: 0 });
  }
  EDGES.set(map.id, edges);
  return edges;
}
/** Offsets the sea depth is averaged over: a ring of radius `RING` px, which rounds every corner of the cell grid. */
const RING = 13;
const RING_POINTS = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4) * RING, Math.sin((i * Math.PI) / 4) * RING])];
/** Depths are capped here: open water, the deepest colour. */
export const OPEN_SEA = 200;
/**
 * Depth of the sea at a pixel, in px of distance from dry land: `landDistance` averaged over a small ring (so the
 * coast curves instead of following the cell steps) plus a slow wobble of up to `wobbly` px (0: straight quays with
 * rounded corners).
 */
export function seaDepth(map: MapDefinition, sea: ReadonlySet<string>, x: number, y: number, wobbly = 7) {
  const near = landDistance(map, sea, x, y);
  if (near > 60) return Math.min(OPEN_SEA, near);
  let sum = 0;
  for (const [dx, dy] of RING_POINTS) sum += Math.min(OPEN_SEA, landDistance(map, sea, x + dx, y + dy));
  return sum / RING_POINTS.length + (wobbly ? wobble(fnv(`${map.id}:sea`), x, y, 34) * wobbly : 0);
}
/** Tile size of the sea field in px: fine enough for a smooth foam line. */
export const SEA_TILE = 2;
const FIELD = new Map<string, Map<string, Float32Array>>();
/** `seaDepth` at every tile centre of every sea cell (`CELL / SEA_TILE` squared per cell, row by row), computed once. */
export function seaField(map: MapDefinition, wobbly = 7): ReadonlyMap<string, Float32Array> {
  const id = `${map.id}:${wobbly}`,
    cached = FIELD.get(id);
  if (cached) return cached;
  const sea = seaCells(map),
    n = CELL / SEA_TILE,
    field = new Map<string, Float32Array>();
  for (const k of sea) {
    const [cx, cy] = k.split(",").map(Number),
      depths = new Float32Array(n * n);
    for (let ty = 0; ty < n; ty++)
      for (let tx = 0; tx < n; tx++) depths[ty * n + tx] = seaDepth(map, sea, cx * CELL + (tx + 0.5) * SEA_TILE, cy * CELL + (ty + 0.5) * SEA_TILE, wobbly);
    field.set(k, depths);
  }
  FIELD.set(id, field);
  return field;
}
/** A point on a line of equal sea depth, with the unit normal pointing to deeper water. */
export interface ShorePoint { x: number; y: number; nx: number; ny: number }
const SHORE = new Map<string, ShorePoint[]>();
/**
 * Points about `spacing` px apart along the line where the sea is `depth` deep (the foam line, a swell line further
 * out), for the surf animation; read from `seaField`, so they lie on the baked shore.
 */
export function shoreLine(map: MapDefinition, depth: number, spacing = 7): readonly ShorePoint[] {
  const id = `${map.id}:${depth}:${spacing}`,
    cached = SHORE.get(id);
  if (cached) return cached;
  const sea = seaCells(map),
    n = CELL / SEA_TILE,
    taken = new Set<string>(),
    points: ShorePoint[] = [];
  for (const [k, depths] of seaField(map)) {
    const [cx, cy] = k.split(",").map(Number);
    for (let t = 0; t < depths.length; t++) {
      if (Math.abs(depths[t] - depth) > 0.9) continue;
      const x = cx * CELL + ((t % n) + 0.5) * SEA_TILE,
        y = cy * CELL + (Math.floor(t / n) + 0.5) * SEA_TILE,
        slot = `${Math.floor(x / spacing)},${Math.floor(y / spacing)}`;
      if (taken.has(slot)) continue;
      taken.add(slot);
      const gx = seaDepth(map, sea, x + 2, y) - seaDepth(map, sea, x - 2, y),
        gy = seaDepth(map, sea, x, y + 2) - seaDepth(map, sea, x, y - 2),
        l = Math.sqrt(gx * gx + gy * gy) || 1;
      points.push({ x, y, nx: gx / l, ny: gy / l });
    }
  }
  SHORE.set(id, points);
  return points;
}

/** A point on the smoothed channel: position, unit normal (to the right of travel) and distance along it in px. */
export interface ChannelSample { x: number; y: number; nx: number; ny: number; s: number }
/** Spacing of channel samples in px. */
export const CHANNEL_STEP = 3;
/** How far before and after a turn the channel starts to curve, in px: rounder than the road's mitred corners. */
const ROUND = CELL * 0.48;
const CHANNEL = new Map<string, ChannelSample[]>();
/**
 * The path as a channel: every turn rounded by a quadratic curve through the corner, resampled every
 * `CHANNEL_STEP` px from the entry to the reactor (or once round a ring).
 */
export function channelOf(map: MapDefinition): readonly ChannelSample[] {
  const cached = CHANNEL.get(map.id);
  if (cached) return cached;
  const cells = map.loop ? [...map.path, map.path[0]] : map.path,
    pts = cells.map((p) => ({ x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL })),
    line: { x: number; y: number }[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1],
      c = pts[i],
      b = pts[i + 1],
      straight = (c.x - a.x) * (b.y - c.y) === (c.y - a.y) * (b.x - c.x);
    if (straight) {
      line.push(c);
      continue;
    }
    const inX = Math.sign(c.x - a.x),
      inY = Math.sign(c.y - a.y),
      outX = Math.sign(b.x - c.x),
      outY = Math.sign(b.y - c.y);
    for (let k = 0; k <= 8; k++) {
      const t = k / 8,
        p0 = { x: c.x - inX * ROUND, y: c.y - inY * ROUND },
        p2 = { x: c.x + outX * ROUND, y: c.y + outY * ROUND };
      line.push({
        x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * c.x + t * t * p2.x,
        y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * c.y + t * t * p2.y,
      });
    }
  }
  line.push(pts[pts.length - 1]);
  const samples: ChannelSample[] = [];
  let s = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      l = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    if (l < 1e-6) continue;
    const nx = -(b.y - a.y) / l,
      ny = (b.x - a.x) / l;
    for (let d = (CHANNEL_STEP - (s % CHANNEL_STEP)) % CHANNEL_STEP; d < l; d += CHANNEL_STEP)
      samples.push({ x: a.x + ((b.x - a.x) * d) / l, y: a.y + ((b.y - a.y) * d) / l, nx, ny, s: s + d });
    s += l;
  }
  const end = line[line.length - 1],
    last = samples[samples.length - 1];
  samples.push({ x: end.x, y: end.y, nx: last.nx, ny: last.ny, s });
  CHANNEL.set(map.id, samples);
  return samples;
}
/**
 * Half width of the channel at distance `s`, for one of its layers (0 the outer bank, higher inner): a steady base
 * with slow noise, so the banks meander a little and never run parallel like a road's kerbs.
 */
export function bankWidth(seed: number, s: number, base: number, layer: number) {
  return base * (1 + 0.14 * wobble(seed + layer * 101, s, layer * 37, 70) + 0.05 * wobble(seed + layer * 7, s, 3, 19));
}
