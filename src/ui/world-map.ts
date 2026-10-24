/**
 * The Sector Atlas's world map, pure geometry: the mode is one planet's surface (`WORLD_W` × `WORLD_H` units, the
 * SVG's viewBox, with land beyond it up to `SURFACE`), split into territories with shared jagged borders: one per
 * sector, laid out in a serpentine so the campaign reads as one journey from the first sector to the last, with the
 * sector's missions as stations on a route across it, and unclaimed wilds around them. No DOM here;
 * `sector-atlas.ts` draws it. Everything is a pure function of the sector count and index, so the map never moves
 * between visits.
 */
export const WORLD_W = 200;
export const WORLD_H = 100;
export interface Point {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A territory: one cell of the planet's surface, with a jagged border shared exactly with its neighbours. */
export interface Territory {
  /** The seed the cell grows around. */
  x: number;
  y: number;
  /** The border, a closed SVG path. */
  outline: string;
  /** Bounding box of the border. */
  box: Box;
  /** The border's points. */
  border: Point[];
}
/** A sector's territory, with the radii its stations and label use. */
export interface Region extends Territory {
  rx: number;
  ry: number;
  /** The stations run right to left on the serpentine's way back. */
  reverse: boolean;
}
/** A stable pseudo-random number in [0, 1) for a pair of integers (render-side jitter, no `Math.random`). */
export function jitter(a: number, b: number) {
  let h = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 2 ** 32;
}
const round = (n: number) => Math.round(n * 100) / 100;
/** Rows of the serpentine: one row for up to four sectors, else enough rows for cells about 3:2. */
export const worldRows = (count: number) => (count <= 4 ? 1 : Math.ceil(Math.sqrt(count / 2)));
/** The planet's surface: land beyond the world on every side, so the tilted view and the zoom never show its edge. */
export const SURFACE: Box = { x: -60, y: -40, w: WORLD_W + 120, h: WORLD_H + 90 };
/** The convex cell of `seeds[i]` (all points closer to it than to any other seed) inside `bounds`. */
export function voronoiCell(seeds: readonly Point[], i: number, bounds: Box): Point[] {
  const s = seeds[i];
  let poly: Point[] = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y },
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    { x: bounds.x, y: bounds.y + bounds.h },
  ];
  for (let j = 0; j < seeds.length && poly.length; j++) {
    if (j === i) continue;
    // Keep the half-plane on s's side of the perpendicular bisector (Sutherland–Hodgman).
    const o = seeds[j],
      nx = o.x - s.x,
      ny = o.y - s.y,
      c = (nx * (o.x + s.x) + ny * (o.y + s.y)) / 2,
      side = (p: Point) => nx * p.x + ny * p.y - c,
      next: Point[] = [];
    poly.forEach((a, k) => {
      const b = poly[(k + 1) % poly.length],
        da = side(a),
        db = side(b);
      if (da <= 0) next.push(a);
      if (da < 0 !== db < 0 && da !== 0 && db !== 0) {
        const t = da / (da - db);
        next.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    });
    poly = next;
  }
  return poly;
}
/** Smooth value noise in [0, 1) over the plane, one lattice value per integer point (from `jitter`). */
export function valueNoise(x: number, y: number, seed = 0) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy),
    corner = (cx: number, cy: number) => jitter(cx * 7919 + seed, cy * 104729 - seed);
  const top = corner(ix, iy) + (corner(ix + 1, iy) - corner(ix, iy)) * u,
    bottom = corner(ix, iy + 1) + (corner(ix + 1, iy + 1) - corner(ix, iy + 1)) * u;
  return top + (bottom - top) * v;
}
/** How far a border point moves at most from the straight cell edge, in world units. */
export const BORDER_WOBBLE = 4.5;
/**
 * The border warp: a smooth displacement that depends on the position only, so both neighbours of an edge move it
 * alike and their borders stay one line. A broad meander, a mid bend and a fine jag.
 */
function warp(p: Point): Point {
  const x = round(p.x),
    y = round(p.y),
    d = (seed: number) =>
      (valueNoise(x * 0.11, y * 0.11, seed) - 0.5) * 1.2 + (valueNoise(x * 0.45, y * 0.45, seed + 1) - 0.5) * 0.55 + (valueNoise(x * 1.7, y * 1.7, seed + 2) - 0.5) * 0.25;
  return { x: round(x + d(11) * BORDER_WOBBLE), y: round(y + d(21) * BORDER_WOBBLE) };
}
/**
 * The jagged border of a convex cell: every edge split into short steps, each edge walked from its smaller end so
 * the shared edge of two cells gets the same points, and every point warped.
 */
export function jaggedBorder(poly: readonly Point[]): Point[] {
  const out: Point[] = [],
    key = (p: Point) => Math.round(p.x * 100) * 1e6 + Math.round(p.y * 100);
  poly.forEach((a, k) => {
    const b = poly[(k + 1) % poly.length],
      flip = key(a) > key(b),
      [p, q] = flip ? [b, a] : [a, b],
      dx = q.x - p.x,
      dy = q.y - p.y,
      steps = Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) / 0.9)),
      inner = Array.from({ length: steps - 1 }, (_, i) => warp({ x: p.x + (dx * (i + 1)) / steps, y: p.y + (dy * (i + 1)) / steps }));
    out.push(warp(a), ...(flip ? inner.reverse() : inner));
  });
  return out;
}
const pathOf = (points: readonly Point[]) => `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`;
function boxOf(points: readonly Point[]): Box {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    x = Math.min(...xs),
    y = Math.min(...ys);
  return { x: round(x), y: round(y), w: round(Math.max(...xs) - x), h: round(Math.max(...ys) - y) };
}
/** Is `p` inside the closed polygon (even-odd)? */
export function inside(p: Point, poly: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
/** The planet: a territory per sector (`regions`, in play order) and the unclaimed wilds around the world. */
export interface Planet {
  regions: Region[];
  wilds: Territory[];
}
/**
 * The serpentine of sector centres plus a ring of wild seeds just outside the world, which bounds the outer
 * sectors, all grown into territories that tile the surface.
 */
export function planetLayout(count: number): Planet {
  const rows = worldRows(count),
    cols = Math.ceil(count / rows),
    cw = WORLD_W / cols,
    ch = WORLD_H / rows;
  const centres = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols),
      reverse = row % 2 === 1,
      col = reverse ? cols - 1 - (i % cols) : i % cols;
    return {
      x: round(cw * (col + 0.5) + (jitter(i, 1) - 0.5) * cw * 0.2),
      y: round(ch * (row + 0.5) + (jitter(i, 2) - 0.5) * ch * 0.26),
      reverse,
    };
  });
  // About one sector cell apart along each side; the corners of the surface get their own wilds.
  const wildSeeds: Point[] = [],
    across = Math.max(2, Math.round(WORLD_W / Math.max(cw, 40))),
    down = Math.max(1, Math.round(WORLD_H / Math.max(ch, 40))),
    reachX = Math.min(cw, 60) * 0.5 + 8,
    reachY = Math.min(ch, 50) * 0.5 + 6;
  for (let i = 0; i <= across; i++) {
    const x = round((WORLD_W * i) / across + (jitter(i, 30) - 0.5) * 10);
    wildSeeds.push({ x, y: round(-reachY - jitter(i, 31) * 5) }, { x: round(x + WORLD_W / across / 2), y: round(WORLD_H + reachY + jitter(i, 32) * 5) });
  }
  for (let i = 0; i < down; i++) {
    const y = round((WORLD_H * (i + 0.5)) / down + (jitter(i, 33) - 0.5) * 8);
    wildSeeds.push({ x: round(-reachX - jitter(i, 34) * 5), y }, { x: round(WORLD_W + reachX + jitter(i, 35) * 5), y });
  }
  for (const [fx, fy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ])
    wildSeeds.push({ x: SURFACE.x + 6 + fx * (SURFACE.w - 12), y: SURFACE.y + 6 + fy * (SURFACE.h - 12) });
  const seeds: Point[] = [...centres, ...wildSeeds],
    border = (i: number) => jaggedBorder(voronoiCell(seeds, i, SURFACE));
  const regions = centres.map((c, i) => {
    const points = border(i),
      rx = round(cw * 0.36);
    return { x: c.x, y: c.y, rx, ry: round(Math.min(ch * 0.34, rx * 0.8)), box: boxOf(points), outline: pathOf(points), border: points, reverse: c.reverse };
  });
  const wilds = wildSeeds.map((s, i) => {
    const points = border(count + i);
    return { x: s.x, y: s.y, box: boxOf(points), outline: pathOf(points), border: points };
  });
  return { regions, wilds };
}
/** The territory of every sector, in play order along the serpentine. */
export const worldLayout = (count: number): Region[] => planetLayout(count).regions;
/**
 * Where a sector's missions sit in its territory: evenly across it in travel direction, zigzagging up and down, with
 * a small per-sector offset so neighbouring sectors differ.
 */
export function stationPoints(region: Region, count: number, seed: number): Point[] {
  const span = region.rx * 1.3,
    rise = region.ry * 0.34;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1),
      along = (region.reverse ? 1 - t : t) - 0.5,
      side = count === 1 ? 0 : i % 2 === seed % 2 ? -1 : 1;
    return { x: round(region.x + along * span), y: round(region.y + side * rise + (jitter(seed, i + 10) - 0.5) * rise * 0.4) };
  });
}
/** A straight SVG path from `a` to `b`. */
export const link = (a: Point, b: Point) => `M${a.x} ${a.y}L${b.x} ${b.y}`;
/** The whole world with a margin for the labels along its edges. */
export const WORLD_BOX: Box = { x: -4, y: -9, w: WORLD_W + 8, h: WORLD_H + 13 };
/** What a sector zoom shows: its stations with room around them for the labels (`mx`, `my` world units). */
export function stationBox(points: readonly Point[], mx: number, my: number): Box {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    x = Math.min(...xs) - mx,
    y = Math.min(...ys) - my;
  return { x, y, w: Math.max(...xs) + mx - x, h: Math.max(...ys) + my * 1.3 - y };
}
/**
 * The plane's transform that fits `box` (world units) centred into a `width` × `height` viewport, where the plane is
 * `width` pixels wide at scale 1.
 */
export function fitBox(box: Box, width: number, height: number) {
  const unit = width / WORLD_W,
    scale = Math.min(width / (box.w * unit), height / (box.h * unit)),
    cx = box.x + box.w / 2,
    cy = box.y + box.h / 2;
  return { scale, x: width / 2 - cx * unit * scale, y: height / 2 - cy * unit * scale };
}
