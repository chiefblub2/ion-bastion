import type { MapDefinition, Point } from "../core/types";
import { CELL, disc, hash01, type Ink, type Pen, px, shade } from "./shapes";
import { drawBoardLight, drawGround, GROUND_FAMILY, type GroundFamily, groundRandom } from "./ground";
import { landmarkAt, type LandmarkSpot, landmarkSpots } from "./landmarks";
import { type ObstaclePiece, obstaclePieces } from "./obstacle-pieces";
import { contactShadow, drawLandmark, landmarkFrame, landmarkLight } from "./landmark-art";
import { drawPathMaterial } from "./path-material";
import { drawGateBases, drawGateLife } from "./gates";
import { landOf, seaCells } from "./coast";
import { fnv } from "../core/hash";
import type Phaser from "phaser";
import { along, cellRandom, type Theme } from "./terrain-themes/kit";
import { THEMES } from "./terrain-themes";
export { THEMES };
const themeOf = (map: MapDefinition) => THEMES[map.theme ?? "outpost"];
/** Reactor colour of the map's theme. */
export const themeAccent = (map: MapDefinition) => themeOf(map).accent;
/** Strength of additive light on a map: full on dark ground, dimmed on light stone and sand so glow never washes out. */
export function themeGlow(map: MapDefinition) {
  const c = themeOf(map).ground[0],
    luma = (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
  return Math.min(1, Math.max(0.55, 1.2 - 2.4 * luma));
}
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Path in pixels; a ring repeats its first cell at the end so lines and markers close the loop. */
const pixelPath = (map: MapDefinition) =>
  (map.loop ? [...map.path, map.path[0]] : map.path).map((p) => ({ x: px(p.x), y: px(p.y) }));
/** A polyline moved sideways by `d` pixels (positive to the right of travel), with mitred corners. */
function offsetPath(path: readonly Point[], d: number) {
  const normal = (a: Point, b: Point) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  };
  return path.map((p, i) => {
    const n0 = i > 0 ? normal(path[i - 1], p) : normal(p, path[i + 1]),
      n1 = i < path.length - 1 ? normal(p, path[i + 1]) : n0,
      n = { x: n0.x + n1.x, y: n0.y + n1.y },
      k = d / Math.max(0.5, n.x * n0.x + n.y * n0.y);
    return { x: p.x + n.x * k, y: p.y + n.y * k };
  });
}
const shifted = (path: readonly Point[], dx: number, dy: number) => path.map((p) => ({ x: p.x + dx, y: p.y + dy }));
/**
 * Static terrain, drawn once per mission: ground (`ground.ts`), decor, obstacles and landmarks, the path, entry and
 * reactor, the board light and the labels. Returns the objects it added; the battlefield bakes them into one texture.
 */
export function drawTerrain(scene: Phaser.Scene, map: MapDefinition, isBlocked: (x: number, y: number) => boolean): Phaser.GameObjects.GameObject[] {
  const first = scene.children.length,
    theme = themeOf(map),
    onPath = new Set(map.path.map((p) => `${p.x},${p.y}`)),
    family = GROUND_FAMILY[map.theme ?? "outpost"],
    spots = landmarks(map);
  // A coastal theme paints its sea over the ground: the sea counts as open ground there, so the beach gets no contact shadow.
  const sea = theme.sea ? seaCells(map) : undefined,
    ground = sea?.size ? (x: number, y: number) => isBlocked(x, y) && !sea.has(`${x},${y}`) : isBlocked;
  drawGround(scene.add.graphics(), map, theme, ground, (x, y) => onPath.has(`${x},${y}`));
  // Decor is background: drawn quieter than the ground pads, before obstacles so their shadows sit on top of it.
  const decor = scene.add.graphics().setAlpha(0.7);
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.columns; x++) {
      if (onPath.has(`${x},${y}`) || isBlocked(x, y)) continue;
      const rand = cellRandom(map, x, y);
      if (rand() < 0.25) theme.decor(decor, x * CELL, y * CELL, rand);
    }
  const g = scene.add.graphics();
  // One light for every theme: a soft shadow to the lower right under each obstacle, then the theme's own drawing.
  // Obstacles as pieces: single cells, and in groups some 2×2 blocks drawn as the theme's own obstacle at twice the size.
  // Tilted themes stand their pieces up after the path instead (`drawStanding`).
  const parts = pieces(map);
  if (!theme.tilted) {
    for (const p of parts) contactShadow(g, (p.x + p.size / 2) * CELL, (p.y + p.size / 2) * CELL, CELL * 0.46 * p.size, CELL * 0.38 * p.size);
    for (const p of parts) enlarged(g, p, () => theme.obstacle(g, p.x * CELL, p.y * CELL, cellRandom(map, p.x, p.y)));
    for (const spot of spots) drawLandmark(g, spot, family, theme, groundRandom(map, "landmark", spot.x, spot.y));
  }
  if (theme.sea && sea) theme.sea(g, map, sea);
  const path = pixelPath(map);
  if (theme.drawPath) theme.drawPath(g, map);
  else drawRoad(g, map, theme, path, family);
  drawStanding(g, map, theme, parts, spots, family);
  const start = path[0],
    end = path[path.length - 1],
    accent = theme.accent;
  // Entry breach and reactor core in the towers' 3/4 tilt (`gates.ts`); a ring has no reactor.
  drawGateBases(g, path, !!map.loop, accent);
  drawBoardLight(scene.add.graphics(), map, theme, themeGlow(map));
  const label = (x: number, y: number, text: string, color: string) =>
    scene.add.text(x, y, text, {
      fontFamily: "monospace",
      fontSize: "13px",
      fontStyle: "bold",
      color,
      backgroundColor: hex(theme.backdrop),
      padding: { x: 7, y: 5 },
    });
  const width = CELL * map.columns,
    height = CELL * map.rows;
  // Centred on `x`, kept inside the board.
  const place = (text: Phaser.GameObjects.Text, x: number, y: number) =>
    text.setPosition(
      Math.min(Math.max(x - text.width / 2, 4), width - text.width - 4),
      Math.min(Math.max(y, 4), height - text.height - 4),
    );
  // Below the gates, clear of their pylons and the core's hologram ring; above them (higher still) on the bottom row.
  place(
    label(0, 0, map.loop ? "PORTAL" : "ENTRY", map.loop ? hex(accent) : "#efd297"),
    start.x,
    start.y + 34 + 30 < height ? start.y + 34 : start.y - 84,
  );
  if (!map.loop) place(label(0, 0, "REACTOR", hex(accent)), end.x, end.y + 36 + 30 < height ? end.y + 36 : end.y - 98);
  // Map name in the top-left corner, or in the first corner the path keeps clear.
  const name = label(0, 0, map.name.toUpperCase(), hex(shade(theme.grid, 0.35))),
    clear = (row: number, fromRight: boolean) =>
      !map.path.some((p) => p.y === row && (fromRight ? p.x >= map.columns - 4 : p.x < 4));
  if (clear(0, false)) name.setPosition(20, 22);
  else if (clear(map.rows - 1, false)) name.setPosition(20, height - name.height - 22);
  else name.setPosition(width - name.width - 20, clear(0, true) ? 22 : height - name.height - 22);
  return scene.children.list.slice(first);
}
/** The default path: a road sunk into the ground with kerbs, a bed in the family's material, worn lanes, grit and arrows. */
function drawRoad(g: Ink, map: MapDefinition, theme: Theme, path: readonly Point[], family: GroundFamily) {
  const bed = theme.path.bed;
  // The road sits in the ground: a cast shadow, a lit and a shaded lip, a sunken bed with its inner shadow.
  g.lineStyle(54, theme.path.line, 0.06);
  g.strokePoints(path, false);
  g.lineStyle(46, 0x000000, 0.35);
  g.strokePoints(shifted(path, 3, 4), false);
  g.lineStyle(42, shade(theme.path.edge, -0.4));
  g.strokePoints(shifted(path, 1.5, 1.5), false);
  g.lineStyle(42, shade(theme.path.edge, 0.2));
  g.strokePoints(shifted(path, -1, -1), false);
  g.lineStyle(42, theme.path.edge);
  g.strokePoints(path, false);
  g.lineStyle(38, shade(bed, -0.3));
  g.strokePoints(path, false);
  g.lineStyle(35, bed);
  g.strokePoints(shifted(path, 1.2, 1.5), false);
  g.lineStyle(20, shade(bed, 0.06));
  g.strokePoints(path, false);
  drawPathMaterial(g, map, path, bed, family);
  // Worn lanes either side of the centre.
  for (const side of [-9, 9]) {
    g.lineStyle(3, shade(bed, -0.12), 0.55);
    g.strokePoints(offsetPath(path, side), false);
  }
  // Grit along the bed: pebbles and specks, seeded per map so they never move.
  const grit = fnv(`${map.id}:grit`);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i],
      b = path[i + 1],
      l = Math.hypot(b.x - a.x, b.y - a.y),
      nx = -(b.y - a.y) / l,
      ny = (b.x - a.x) / l;
    for (let d = 0; d < l; d += 6) {
      const h = hash01(grit, i, d),
        side = (hash01(grit, d, i) - 0.5) * 30,
        x = a.x + ((b.x - a.x) * d) / l + nx * side,
        y = a.y + ((b.y - a.y) * d) / l + ny * side;
      if (h < 0.5) disc(g, x, y, 0.8 + h * 1.6, shade(bed, h < 0.25 ? -0.18 : 0.1), 0.55);
    }
  }
  g.lineStyle(2, theme.path.line, 0.4);
  g.strokePoints(path, false);
  for (let i = 2; i < path.length - 1; i += 3) {
    const p = path[i],
      n = path[i + 1],
      a = Math.atan2(n.y - p.y, n.x - p.x);
    g.lineStyle(2, theme.path.arrow, 0.45);
    for (const sign of [-1, 1])
      g.lineBetween(p.x, p.y, p.x - Math.cos(a + sign * 0.65) * 7, p.y - Math.sin(a + sign * 0.65) * 7);
  }
}
/**
 * The pieces and landmarks of a tilted theme, over the path: every shadow first, then the bodies row by row from the
 * north (by their bottom row, then west to east), so a tall piece overlaps the row above it and is overlapped by the
 * one below. Flat themes draw nothing here.
 */
function drawStanding(g: Ink, map: MapDefinition, theme: Theme, parts: readonly ObstaclePiece[], spots: readonly LandmarkSpot[], family: GroundFamily) {
  const tilted = theme.tilted;
  if (!tilted) return;
  for (const p of parts) enlarged(g, p, () => tilted.shadow(g, p.x * CELL, p.y * CELL, cellRandom(map, p.x, p.y)));
  const items = [
    ...parts.map((p) => ({ x: p.x, row: p.y + p.size, draw: () => enlarged(g, p, () => theme.obstacle(g, p.x * CELL, p.y * CELL, cellRandom(map, p.x, p.y))) })),
    ...spots.map((spot) => {
      const rand = groundRandom(map, "landmark", spot.x, spot.y),
        { x, y, s } = landmarkFrame(spot);
      return { x: spot.x, row: spot.y + spot.size, draw: () => (tilted.landmark ? tilted.landmark(g, x, y, s, spot.variant, rand) : drawLandmark(g, spot, family, theme, rand)) };
    }),
  ];
  // Extras stand on a ground point; a cell's piece stands about 0.36 cells above its bottom edge (`groundOf` in the themes).
  for (const extra of tilted.extras?.(map) ?? []) {
    extra.shadow(g);
    items.push({ x: extra.x / CELL, row: extra.y / CELL + 0.36, draw: () => extra.draw(g) });
  }
  items.sort((a, b) => a.row - b.row || a.x - b.x);
  for (const item of items) item.draw();
}
/** Landmark spots per map, computed once (ambient asks every frame). */
const LANDMARKS = new Map<string, ReturnType<typeof landmarkSpots>>();
function landmarks(map: MapDefinition) {
  let spots = LANDMARKS.get(map.id);
  if (!spots) LANDMARKS.set(map.id, (spots = landmarkSpots(themeOf(map).sea ? landOf(map) : map)));
  return spots;
}
/** Obstacle pieces per map, computed once (ambient asks every frame). */
const PIECES = new Map<string, ObstaclePiece[]>();
function pieces(map: MapDefinition) {
  let list = PIECES.get(map.id);
  if (!list) PIECES.set(map.id, (list = obstaclePieces(themeOf(map).sea ? landOf(map) : map, landmarks(map))));
  return list;
}
/** Runs `draw` (which draws the piece's top-left cell at its normal place) scaled up about that cell's corner to the piece's size. */
function enlarged(g: Ink, p: ObstaclePiece, draw: () => void) {
  if (p.size === 1) return draw();
  const x = p.x * CELL,
    y = p.y * CELL;
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(p.size, p.size);
  g.translateCanvas(-x, -y);
  draw();
  g.restore();
}
/** Per-map inputs of the ambient layer, computed once instead of every frame. */
interface AmbientFrame {
  path: readonly Point[];
  blocked: readonly Point[];
  hash: (x: number, y: number) => number;
}
const AMBIENT = new Map<string, AmbientFrame>();
function ambientFrame(map: MapDefinition): AmbientFrame {
  let frame = AMBIENT.get(map.id);
  if (frame) return frame;
  const spots = landmarks(map),
    big = pieces(map).filter((p) => p.size > 1),
    inBig = (x: number, y: number) => big.some((p) => x >= p.x && x < p.x + p.size && y >= p.y && y < p.y + p.size),
    cells = new Float64Array(map.columns * map.rows).fill(-1);
  frame = {
    path: pixelPath(map),
    blocked: (themeOf(map).sea ? landOf(map) : map).blocked.filter((b) => !landmarkAt(spots, b.x, b.y) && !inBig(b.x, b.y)),
    // Cells on the board are cached; other arguments (particle and slot indices) are computed each call.
    hash: (x, y) => {
      if (x < 0 || y < 0 || x >= map.columns || y >= map.rows || x !== Math.floor(x) || y !== Math.floor(y)) return cellRandom(map, x, y)();
      const i = y * map.columns + x;
      return cells[i] >= 0 ? cells[i] : (cells[i] = cellRandom(map, x, y)());
    },
  };
  AMBIENT.set(map.id, frame);
  return frame;
}
/** Animated terrain details, redrawn every frame: motion on `g`, light on `glow` (additive); `still` (reduced motion) freezes them. */
export function drawAmbient(g: Ink, glow: Ink, map: MapDefinition, clock: number, still = false) {
  const family = GROUND_FAMILY[map.theme ?? "outpost"],
    time = still ? 0 : clock,
    lit = themeGlow(map);
  const own = themeOf(map).tilted;
  for (const spot of landmarks(map)) {
    if (own?.landmark && own.landmarkLight) {
      const { x, y, s } = landmarkFrame(spot);
      own.landmarkLight(g, glow, x, y, s, spot.variant, time, lit);
    } else if (!own?.landmark) landmarkLight(g, glow, spot, family, themeOf(map).accent, time, lit);
  }
  const frame = ambientFrame(map);
  themeOf(map).ambient({ g, glow, lit, map, clock: time, still, ...frame });
  // Big pieces: the theme's ambient once more per piece, for its top-left cell only, scaled like the piece. No path
  // and a board of size 0, so the board-wide parts (flows, rain, snow, stars, flashes) stay out of it.
  const empty = { ...map, columns: 0, rows: 0 };
  for (const p of pieces(map))
    if (p.size > 1)
      enlarged(g, p, () => enlarged(glow, p, () => themeOf(map).ambient({ g, glow, lit, map: empty, clock: time, still, hash: frame.hash, path: [], blocked: [{ x: p.x, y: p.y }] })));
}
/**
 * The live part of the entry breach and the reactor core, drawn every frame over the baked terrain (`gates.ts`
 * `drawGateLife`): the vortex and lightning of the breach, the core's pulse and hologram ring. `alarm` (0 to 1) turns
 * the reactor red and quickens it; a ring map has no reactor, so its breach takes the alarm. `still` (reduced motion)
 * keeps everything in place.
 */
export function drawGates(pen: Pen, map: MapDefinition, clock: number, still: boolean, alarm: number) {
  drawGateLife(pen, pixelPath(map), !!map.loop, themeOf(map).accent, clock, still, alarm, themeGlow(map));
}
