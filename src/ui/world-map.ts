/**
 * The Sector Atlas's world map, pure geometry: a planet's whole surface as one plane (`WORLD_W` × `WORLD_H` units,
 * equirectangular: x is longitude, y latitude; `globe.ts` wraps it onto the sphere), split into territories with
 * shared jagged borders: one per sector, gathered on the face the globe turns to the viewer, with the sector's
 * missions as stations on a route across it, and unclaimed wilds over the rest of the planet. No DOM here;
 * `sector-atlas.ts` draws it. Everything is a pure function of the centres, so the map never moves between visits.
 */
import type { MapTheme } from "../core/types";
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
/** A sector's territory, or its deck when the sector is a station in orbit. */
export interface Region extends Territory {
  /** Where the sector's label stands: in the north of its territory, above a deck. */
  label: Point;
  station?: boolean;
}
/** A stable pseudo-random number in [0, 1) for a pair of integers (render-side jitter, no `Math.random`). */
export function jitter(a: number, b: number) {
  let h = Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 7, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 2 ** 32;
}
const round = (n: number) => Math.round(n * 100) / 100;
/** The planet's whole surface: the plane wraps around in x (longitude) and ends at the poles in y. */
export const GLOBE_BOX: Box = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };
/** Plane units painted past the surface's west edge and blended into its east edge, so the picture wraps without a seam. */
export const WRAP = 20;
/** Where a world's sectors gather: the face of the globe, within about ±60° longitude and ±45° latitude. */
export const FRONT: Box = { x: 66, y: 26, w: 68, h: 48 };
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
export const BORDER_WOBBLE = 3.2;
/**
 * The border warp's displacement at (x, y), in units of `BORDER_WOBBLE`: smooth, and a function of the position
 * only, so both neighbours of an edge move it alike and their borders stay one line. A broad meander, a mid bend and
 * a fine jag (`fine` false leaves the jag out, for the surface's biome lookup).
 */
export function borderShift(x: number, y: number, fine = true): Point {
  const d = (seed: number) =>
    (valueNoise(x * 0.11, y * 0.11, seed) - 0.5) * 1.2 + (valueNoise(x * 0.45, y * 0.45, seed + 1) - 0.5) * 0.55 + (fine ? (valueNoise(x * 1.7, y * 1.7, seed + 2) - 0.5) * 0.25 : 0);
  return { x: d(11) * BORDER_WOBBLE, y: d(21) * BORDER_WOBBLE };
}
function warp(p: Point): Point {
  const x = round(p.x),
    y = round(p.y),
    d = borderShift(x, y);
  return { x: round(x + d.x), y: round(y + d.y) };
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
/** Rows of a serpentine: one row for up to four sectors, else enough rows for cells about 3:2. */
export const worldRows = (count: number) => (count <= 4 ? 1 : Math.ceil(Math.sqrt(count / 2)));
/** Sector centres in a serpentine across the globe's face, for a world without enough hand-placed centres. */
export function serpentine(count: number): Point[] {
  const rows = worldRows(count),
    cols = Math.ceil(count / rows),
    cw = FRONT.w / cols,
    ch = FRONT.h / rows;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols),
      col = row % 2 === 1 ? cols - 1 - (i % cols) : i % cols;
    return {
      x: round(FRONT.x + cw * (col + 0.5) + (jitter(i, 1) - 0.5) * cw * 0.2),
      y: round(FRONT.y + ch * (row + 0.5) + (jitter(i, 2) - 0.5) * ch * 0.26),
    };
  });
}
/** The deck of a station in orbit around `c`: a long hull with chamfered ends and a notched spine. */
export function deckOutline(c: Point): Point[] {
  const w = 26,
    h = 9;
  return [
    [-w, -2],
    [-w + 6, -h],
    [-6, -h],
    [-3, -h - 3],
    [3, -h - 3],
    [6, -h],
    [w - 6, -h],
    [w, -2],
    [w, 2],
    [w - 6, h],
    [6, h],
    [3, h + 3],
    [-3, h + 3],
    [-6, h],
    [-w + 6, h],
    [-w, 2],
  ].map(([x, y]) => ({ x: round(c.x + x), y: round(c.y + y) }));
}
/** How far up from `p` the polygon's inside reaches, in whole units. */
function reachUp(p: Point, poly: readonly Point[]) {
  let d = 0;
  while (d < 100 && inside({ x: p.x, y: p.y - d - 1 }, poly)) d++;
  return d;
}
/**
 * The wild seeds around a world's sectors: a ring just beyond the outermost ones, so every territory closes about
 * half a neighbour's distance past its centre, and a loose lattice over the rest of the planet.
 */
function wildSeedsOf(ground: readonly Point[]): Point[] {
  const cx = ground.reduce((a, p) => a + p.x, 0) / (ground.length || 1),
    cy = ground.reduce((a, p) => a + p.y, 0) / (ground.length || 1),
    reach = Math.max(8, ...ground.map((p) => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2))) + 26,
    seeds: Point[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * Math.PI + (jitter(i, 36) - 0.5) * 0.3,
      r = reach + (jitter(i, 37) - 0.5) * 5;
    seeds.push({ x: round(cx + Math.cos(a) * r), y: round(cy + Math.sin(a) * r * 0.85) });
  }
  for (let x = 12; x < WORLD_W; x += 30)
    for (const y of [10, 50, 90]) {
      const p = { x: round(x + (jitter(x, y) - 0.5) * 8), y: round(y + (jitter(y, x) - 0.5) * 8) };
      if (Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2) > reach + 14) seeds.push(p);
    }
  return seeds.filter((p) => p.x > 0 && p.x < WORLD_W && p.y > 0 && p.y < WORLD_H);
}
/**
 * A world's territories: one per centre in play order, grown into cells that tile the planet together with the wild
 * seeds around them (`wildSeedsOf`); the `station` centre becomes a deck in orbit instead and splits no land.
 */
export function planetLayout(centres: readonly Point[], station?: number): Planet {
  const ground = centres.filter((_, i) => i !== station),
    wildSeeds = wildSeedsOf(ground);
  const seeds = [...ground, ...wildSeeds],
    border = (i: number) => jaggedBorder(voronoiCell(seeds, i, GLOBE_BOX));
  let g = 0;
  const regions = centres.map((c): Region => {
    if (station !== undefined && c === centres[station]) {
      const deck = deckOutline(c),
        box = boxOf(deck);
      return { x: c.x, y: c.y, box, outline: pathOf(deck), border: deck, label: { x: c.x, y: round(box.y - 4) }, station: true };
    }
    const points = border(g++);
    return { x: c.x, y: c.y, box: boxOf(points), outline: pathOf(points), border: points, label: { x: c.x, y: round(c.y - reachUp(c, points) * 0.62) } };
  });
  const wilds = wildSeeds.map((s, i) => {
    const points = border(ground.length + i);
    return { x: s.x, y: s.y, box: boxOf(points), outline: pathOf(points), border: points };
  });
  return { regions, wilds };
}
/** Sector territories in a serpentine (a world without hand-placed centres). */
export const worldLayout = (count: number): Region[] => planetLayout(serpentine(count)).regions;
/**
 * The shapes a sector's route of missions can take, as points in the territory's own frame: `x` runs from the
 * entry (-1) towards the exit (+1), `y` across it, both scaled to the room the territory has (`frameOf`). Each has
 * five points; other mission counts are sampled along it.
 */
export const ROUTE_SHAPES = {
  chain: [
    [-1, 0.15],
    [-0.5, -0.3],
    [0, 0.25],
    [0.5, -0.25],
    [1, 0.1],
  ],
  // Two branches that meet again: the second and third missions side by side.
  fork: [
    [-1, 0],
    [-0.35, -0.55],
    [-0.25, 0.5],
    [0.4, -0.05],
    [1, 0.05],
  ],
  climb: [
    [-1, 0.65],
    [-0.5, 0.2],
    [0.02, 0.45],
    [0.45, -0.15],
    [0.95, -0.6],
  ],
  // Inwards to the finale at the centre.
  spiral: [
    [-1, 0],
    [-0.07, -0.8],
    [0.59, -0.1],
    [0.1, 0.39],
    [0, 0],
  ],
  hop: [
    [-1, 0.4],
    [-0.45, -0.5],
    [0.05, 0.5],
    [0.5, -0.45],
    [1, 0.3],
  ],
  ridge: [
    [-1, -0.45],
    [-0.5, -0.3],
    [0, 0.08],
    [0.5, 0.2],
    [1, 0.5],
  ],
  arc: [
    [-1, 0.5],
    [-0.6, -0.15],
    [0, -0.45],
    [0.6, -0.15],
    [1, 0.5],
  ],
  // Down into a cave mouth.
  descent: [
    [-1, -0.55],
    [-0.45, -0.6],
    [0, -0.15],
    [0.35, 0.3],
    [0.6, 0.7],
  ],
  meander: [
    [-1, -0.2],
    [-0.55, 0.45],
    [0, -0.45],
    [0.5, 0.4],
    [1, -0.1],
  ],
  // A cross on a deck: in, two wings, the hub, out.
  deck: [
    [-0.95, 0],
    [-0.35, -0.6],
    [-0.35, 0.6],
    [0.35, 0],
    [0.95, 0],
  ],
  // Around a ring, the finale in its middle.
  ring: [
    [-0.9, 0.25],
    [-0.35, -0.7],
    [0.5, -0.65],
    [0.9, 0.2],
    [0, 0.1],
  ],
} satisfies Record<string, readonly (readonly [number, number])[]>;
export type RouteShape = keyof typeof ROUTE_SHAPES;
/** The route shape of a sector, from the terrain theme of its first map; ring missions circle. */
export const THEME_ROUTES: Record<MapTheme, RouteShape> = {
  outpost: "fork",
  lock: "chain",
  shard: "chain",
  ember: "ridge",
  core: "deck",
  frost: "climb",
  toxic: "hop",
  orbit: "deck",
  ruin: "fork",
  rift: "spiral",
  dune: "meander",
  abyss: "hop",
  storm: "spiral",
  jungle: "arc",
  volcano: "ridge",
  geode: "descent",
  gear: "ring",
  tide: "hop",
};
export const routeShape = (theme: MapTheme, circle: boolean): RouteShape => (circle && theme !== "tide" ? "ring" : THEME_ROUTES[theme]);
/**
 * The room a route has in a territory: half the clear distance from its centre to the border along each axis
 * (the smaller side), so every station keeps a margin to the border for its label.
 */
export function frameOf(region: Region): { rx: number; ry: number } {
  const reach = (dx: number, dy: number) => {
    let d = 0;
    while (d < 200 && inside({ x: region.x + dx * (d + 1), y: region.y + dy * (d + 1) }, region.border)) d++;
    return d;
  };
  return { rx: round(Math.min(reach(1, 0), reach(-1, 0)) * 0.68), ry: round(Math.min(reach(0, 1), reach(0, -1)) * 0.6) };
}
/** `count` points along a polyline, evenly by length; the polyline itself when the counts match. */
function sample(points: readonly (readonly [number, number])[], count: number): [number, number][] {
  if (count === points.length) return points.map(([x, y]) => [x, y]);
  if (count === 1) return [[0, 0]];
  const lengths = points.slice(1).map(([x, y], i) => Math.sqrt((x - points[i][0]) ** 2 + (y - points[i][1]) ** 2)),
    total = lengths.reduce((a, b) => a + b, 0);
  return Array.from({ length: count }, (_, i) => {
    let at = (total * i) / (count - 1),
      k = 0;
    while (k < lengths.length - 1 && at > lengths[k]) at -= lengths[k++];
    const t = Math.min(1, at / (lengths[k] || 1)),
      [ax, ay] = points[k],
      [bx, by] = points[k + 1];
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  });
}
export interface RouteOptions {
  shape: RouteShape;
  /** The direction of travel through the territory, radians: from where the route comes in to where it leaves. */
  heading: number;
  /** Mirror the route across its direction, so neighbours with one shape differ. */
  mirror?: boolean;
  /** The mission that steps aside from the route (the special operation with restricted towers). */
  aside?: number;
}
/** Where a sector's missions sit in its territory: its route shape, turned to the direction of travel. */
export function routePoints(region: Region, count: number, { shape, heading, mirror, aside }: RouteOptions): Point[] {
  const { rx, ry } = frameOf(region),
    cos = Math.cos(heading),
    sin = Math.sin(heading);
  return sample(ROUTE_SHAPES[shape], count).map(([u, v], i) => {
    let w = mirror ? -v : v;
    if (i === aside) w = Math.max(-1, Math.min(1, w + (w < 0 ? -0.45 : 0.45)));
    // Turned in the unit frame, then stretched to the territory's room.
    return { x: round(region.x + (u * cos - w * sin) * rx), y: round(region.y + (u * sin + w * cos) * ry) };
  });
}
/** The heading of sector `i` of a chain of centres: from the one before it towards the one after it. */
export function headingOf(centres: readonly Point[], i: number): number {
  const a = centres[Math.max(0, i - 1)],
    b = centres[Math.min(centres.length - 1, i + 1)];
  return a === b ? 0 : Math.atan2(b.y - a.y, b.x - a.x);
}
/** A straight SVG path from `a` to `b`. */
export const link = (a: Point, b: Point) => `M${a.x} ${a.y}L${b.x} ${b.y}`;
/** Stars behind the globe: position as fractions of the view and a radius in px, the same on every visit. */
export function stars(count: number): (Point & { r: number })[] {
  return Array.from({ length: count }, (_, i) => ({ x: round(jitter(i, 40) * 100) / 100, y: round(jitter(i, 41) * 100) / 100, r: round(0.4 + jitter(i, 42) ** 3 * 1.1) }));
}
/** What a sector zoom shows: its stations with room around them for the labels (`mx`, `my` world units). */
export function stationBox(points: readonly Point[], mx: number, my: number): Box {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    x = Math.min(...xs) - mx,
    y = Math.min(...ys) - my;
  return { x, y, w: Math.max(...xs) + mx - x, h: Math.max(...ys) + my * 1.3 - y };
}
