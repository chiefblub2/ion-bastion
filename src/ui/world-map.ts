/**
 * The Sector Atlas's world map, pure geometry: every sector of a mode is a landmass on one plane (`WORLD_W` ×
 * `WORLD_H` units, the SVG's viewBox), laid out in a serpentine so the campaign reads as one journey from the first
 * sector to the last, with the sector's missions as stations on a route across it. No DOM here; `sector-atlas.ts`
 * draws it. Everything is a pure function of the sector count and index, so the map never moves between visits.
 */
export const WORLD_W = 200;
export const WORLD_H = 100;
export interface Point {
  x: number;
  y: number;
}
export interface Region {
  /** Centre and radii of the landmass. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Bounding box of the outline, for the terrain picture and the zoom. */
  box: { x: number; y: number; w: number; h: number };
  /** The coastline, a closed SVG path. */
  outline: string;
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
/** How far a coastline reaches beyond its radii at most (lobes × wobble, see `coastline`). */
export const COAST_REACH = 1.36;
/**
 * A closed, smooth coastline around (x, y): two broad lobes give each landmass its own silhouette, a per-vertex
 * wobble smoothed with its neighbours gives bays and capes.
 */
export function coastline(x: number, y: number, rx: number, ry: number, seed: number, vertices = 32) {
  const phase = jitter(seed, 90) * Math.PI * 2,
    phase2 = jitter(seed, 91) * Math.PI * 2,
    raw = Array.from({ length: vertices }, (_, i) => {
      const a = (i / vertices) * Math.PI * 2;
      return (0.8 + 0.3 * jitter(seed, i)) * (1 + 0.1 * Math.sin(2 * a + phase) + 0.07 * Math.sin(3 * a + phase2));
    }),
    radius = raw.map((r, i) => (raw[(i + vertices - 1) % vertices] + 2 * r + raw[(i + 1) % vertices]) / 4),
    points = radius.map((r, i) => {
      const a = (i / vertices) * Math.PI * 2;
      return { x: x + Math.cos(a) * rx * r, y: y + Math.sin(a) * ry * r };
    }),
    mid = (a: Point, b: Point) => `${round((a.x + b.x) / 2)} ${round((a.y + b.y) / 2)}`;
  // Quadratic curves through the edge midpoints, with the vertices as control points: a smooth closed outline.
  return `M${mid(points[vertices - 1], points[0])} ${points.map((p, i) => `Q${round(p.x)} ${round(p.y)} ${mid(p, points[(i + 1) % vertices])}`).join(" ")}Z`;
}
/** The landmass of every sector, in play order along the serpentine. */
export function worldLayout(count: number): Region[] {
  const rows = worldRows(count),
    cols = Math.ceil(count / rows),
    cw = WORLD_W / cols,
    ch = WORLD_H / rows;
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols),
      reverse = row % 2 === 1,
      col = reverse ? cols - 1 - (i % cols) : i % cols,
      x = round(cw * (col + 0.5) + (jitter(i, 1) - 0.5) * cw * 0.12),
      y = round(ch * (row + 0.5) + (jitter(i, 2) - 0.5) * ch * 0.14),
      rx = round(cw * 0.36),
      ry = round(Math.min(ch * 0.34, rx * 0.8)),
      box = { x: round(x - rx * COAST_REACH), y: round(y - ry * COAST_REACH), w: round(rx * 2 * COAST_REACH), h: round(ry * 2 * COAST_REACH) };
    return { x, y, rx, ry, box, outline: coastline(x, y, rx, ry, i), reverse };
  });
}
/**
 * Where a sector's missions sit on its landmass: evenly across it in travel direction, zigzagging up and down, with
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
/** A smooth SVG path from `a` to `b`, leaving and arriving horizontally. */
export function curve(a: Point, b: Point) {
  const mid = round((a.x + b.x) / 2);
  return `M${a.x} ${a.y} C${mid} ${a.y} ${mid} ${b.y} ${b.x} ${b.y}`;
}
/** The whole world with a margin for the labels along its edges. */
export const WORLD_BOX = { x: -4, y: -9, w: WORLD_W + 8, h: WORLD_H + 13 };
/** What a sector zoom shows: its stations with room around them for the labels (`mx`, `my` world units). */
export function stationBox(points: readonly Point[], mx: number, my: number) {
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
export function fitBox(box: Region["box"], width: number, height: number) {
  const unit = width / WORLD_W,
    scale = Math.min(width / (box.w * unit), height / (box.h * unit)),
    cx = box.x + box.w / 2,
    cy = box.y + box.h / 2;
  return { scale, x: width / 2 - cx * unit * scale, y: height / 2 - cy * unit * scale };
}
