import type { MapDefinition, Point } from "../../core/types";
import { type Ink, shade } from "../shapes";
// Shared pieces of the terrain themes (`terrain-themes/<theme>.ts`): the theme shape, the per-cell random numbers
// and drawing helpers more than one theme uses.

export type Random = () => number;
/** Draws into one cell, given by its top-left pixel corner. */
export type CellDrawing = (g: Ink, x: number, y: number, rand: Random) => void;
export interface AmbientContext {
  g: Ink;
  /** Additive light layer below the units (bloomed with the towers' light): lamps, glows, lava, shafts. */
  glow: Ink;
  /** Light strength for `glow`, from `themeGlow`: weaker on light ground. */
  lit: number;
  map: MapDefinition;
  /** Path cell centres in pixels. */
  path: readonly Point[];
  clock: number;
  /** Stable value in [0, 1) per cell, for phases and offsets; the first draw of `cellRandom`, so it names the obstacle variant. */
  hash: (x: number, y: number) => number;
  /** Obstacle cells without the ones a landmark or a big piece replaced (big pieces get their own call, see `drawAmbient`). */
  blocked: readonly Point[];
  /** Reduced motion: the clock is frozen and full-board flashes are left out. */
  still: boolean;
}
export interface Theme {
  backdrop: number;
  /** Checkerboard pair. */
  ground: [number, number];
  grid: number;
  path: { edge: number; bed: number; line: number; arrow: number };
  accent: number;
  obstacle: CellDrawing;
  /** Optional ground detail on some free cells; never on the path or obstacles. */
  decor: CellDrawing;
  /** Animated layer, redrawn every frame below towers and enemies. */
  ambient: (ctx: AmbientContext) => void;
  /**
   * Replaces the default road (kerbs, sunken bed, worn lanes, grit, centre line and arrows) with the theme's own
   * path, drawn into the static terrain at the same place: Palm Atoll's channel (`coast.ts` `channelOf`).
   */
  drawPath?: (g: Ink, map: MapDefinition) => void;
  /**
   * Coastal theme: obstacle groups at the board edge are open sea (`coast.ts` `seaCells`), left out of the obstacle
   * pieces, landmarks and the ambient's `blocked`, and drawn by this into the static terrain before the path.
   */
  sea?: (g: Ink, map: MapDefinition, sea: ReadonlySet<string>) => void;
  /** Terrain in the towers' 3/4 tilt (see `TiltedTerrain`); absent: flat obstacles under the path. */
  tilted?: TiltedTerrain;
}
/**
 * A theme whose obstacles stand up out of the board in the towers' 3/4 tilt (`tower-art/tilt.ts`). Its obstacles and
 * landmarks are drawn after the path, north to south, so a tall piece may reach into the cell above; the generic
 * contact shadow is left out, the theme casts its own. `shadow` gets the same `cellRandom` stream as `obstacle` and
 * runs for every piece before any body, so no shadow lies on a body.
 */
export interface TiltedTerrain {
  shadow: CellDrawing;
  /** The theme's own landmark on a spot with centre (x, y) and half size `s` (shadow included); replaces the family's. */
  landmark?: (g: Ink, x: number, y: number, s: number, variant: 0 | 1, rand: Random) => void;
  /** Its animated part on the ambient layer (motion on `g`, light on `glow`, scaled by `lit`). */
  landmarkLight?: (g: Ink, glow: Ink, x: number, y: number, s: number, variant: 0 | 1, clock: number, lit: number) => void;
  /** More standing pieces outside the obstacle cells (Palm Atoll's palms on the beach), sorted in with the others. */
  extras?: (map: MapDefinition) => readonly StandingPiece[];
}
/** A standing piece on a ground point in pixels, with its shadow (drawn in the shadow pass) and its body. */
export interface StandingPiece {
  x: number;
  y: number;
  shadow: (g: Ink) => void;
  draw: (g: Ink) => void;
}
/** FNV-1a over the map id and cell, so decoration never moves between redraws. */
export function seed(id: string, x: number, y: number) {
  let h = 2166136261;
  for (const ch of `${id}:${x}:${y}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function mulberry32(a: number): Random {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const cellRandom = (map: MapDefinition, x: number, y: number) => mulberry32(seed(map.id, x, y));
/** Point and direction at fractional cell distance `t` along the path. */
export function along(path: readonly Point[], t: number) {
  const i = Math.min(Math.floor(t), path.length - 2),
    f = t - i,
    a = path[i],
    b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}
/** `count` markers moving along the path at `speed` cells per second. */
export function flow(path: readonly Point[], clock: number, spacing: number, speed: number, draw: (p: ReturnType<typeof along>, k: number) => void) {
  const length = path.length - 1;
  for (let k = 0; k * spacing < length; k++) draw(along(path, (k * spacing + clock * speed) % length), k);
}
export function zigzagPoints(x: number, y: number, rand: Random, length: number, segments: number) {
  let a = rand() * Math.PI * 2;
  const points = [{ x, y }];
  for (let i = 0; i < segments; i++) {
    a += (rand() - 0.5) * 1.4;
    const last = points[points.length - 1];
    points.push({ x: last.x + Math.cos(a) * (length / segments), y: last.y + Math.sin(a) * (length / segments) });
  }
  return points;
}
export function zigzag(g: Ink, x: number, y: number, rand: Random, length: number, segments: number) {
  g.strokePoints(zigzagPoints(x, y, rand, length, segments), false);
}
/** Point on the car wreck in its own frame; the tilt comes from `kind`, so ambient can find the headlights. */
export function wreckPoint(x: number, y: number, kind: number, dx: number, dy: number) {
  const tilt = ((kind - 0.6) * 5 - 0.5) * 0.7,
    c = Math.cos(tilt),
    s = Math.sin(tilt);
  return { x: x + 28 + dx * c - dy * s, y: y + 28 + dx * s + dy * c };
}
/** Rusted car with smashed windows and a faded teal stripe. */
export function wreck(g: Ink, x: number, y: number, kind: number, rand: Random) {
  const p = (dx: number, dy: number) => wreckPoint(x, y, kind, dx, dy),
    rect = (x0: number, y0: number, x1: number, y1: number) => [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)];
  g.fillStyle(0x070605, 0.5);
  g.fillPoints(rect(-21, -11, 21, 11).map((q) => ({ x: q.x + 2, y: q.y + 4 })), true);
  g.fillStyle(0x141210);
  const flat = Math.floor(rand() * 4);
  [[-13, -12], [12, -12], [-13, 12], [12, 12]].forEach(([tx, ty], i) => {
    if (i !== flat) g.fillPoints(rect(tx - 4, ty - 2.5, tx + 4, ty + 2.5), true);
  });
  g.fillStyle(0x5a3a28);
  g.fillPoints(rect(-21, -11, 21, 11), true);
  g.fillStyle(0x3f6a64, 0.75);
  g.fillPoints(rect(-21, -2, 21, 2), true);
  g.fillStyle(0x7a4422);
  for (let i = 0; i < 3; i++) {
    const r = p(-18 + rand() * 36, -9 + rand() * 18);
    g.fillCircle(r.x, r.y, 1.5 + rand() * 2.5);
  }
  g.fillStyle(0x4a3022);
  g.fillPoints(rect(-8, -9, 9, 9), true);
  g.fillStyle(0x101618);
  g.fillPoints([p(9, -8), p(14, -6.5), p(14, 6.5), p(9, 8)], true);
  g.fillPoints(rect(-13, -7, -8, 7), true);
  const c0 = p(10, -4),
    c1 = p(13, 1),
    c2 = p(11, 5);
  g.lineStyle(1, 0x5a6a70, 0.6);
  g.strokePoints([c0, c1, c2], false);
  g.lineStyle(1, shade(0x5a3a28, 0.25));
  const e0 = p(-21, -11),
    e1 = p(21, -11);
  g.lineBetween(e0.x, e0.y, e1.x, e1.y);
  g.fillStyle(0x2a2620);
  for (const hy of [-7, 7]) {
    const h = p(21, hy);
    g.fillCircle(h.x, h.y, 1.8);
  }
}
