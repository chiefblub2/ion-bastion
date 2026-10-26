import type { Point } from "../core/types";
// The player's zoom on the battlefield (pinch and pan on touch screens). Pure: a view is a zoom factor over the
// fitted board and the world point at the board's centre; the scene turns it into the Phaser camera.
export interface BoardView {
  /** 1 shows the whole board, up to `MAX_ZOOM`. */
  zoom: number;
  /** World point at the centre of the board. */
  x: number;
  y: number;
}
/** The board on screen and in the world: CSS size of the fitted board and the world size it shows at zoom 1. */
export interface BoardSize {
  width: number;
  height: number;
  worldWidth: number;
  worldHeight: number;
}
export const MAX_ZOOM = 3;
/** Below this the view counts as the fitted board: the reset button hides and the card places itself as usual. */
export const ZOOMED = 1.02;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const fittedView = (size: BoardSize): BoardView => ({ zoom: 1, x: size.worldWidth / 2, y: size.worldHeight / 2 });
/** Keeps the zoom in range and the view inside the board. */
export function clampView(view: BoardView, size: BoardSize): BoardView {
  const zoom = clamp(view.zoom, 1, MAX_ZOOM),
    halfW = size.worldWidth / (2 * zoom),
    halfH = size.worldHeight / (2 * zoom);
  return { zoom, x: clamp(view.x, halfW, size.worldWidth - halfW), y: clamp(view.y, halfH, size.worldHeight - halfH) };
}
/** CSS px per world px at this zoom. */
const scaleOf = (view: BoardView, size: BoardSize) => (size.width / size.worldWidth) * view.zoom;
/** World point under a board-local CSS point. */
export function toWorld(view: BoardView, p: Point, size: BoardSize): Point {
  const s = scaleOf(view, size);
  return { x: view.x + (p.x - size.width / 2) / s, y: view.y + (p.y - size.height / 2) / s };
}
/** Board-local CSS point of a world point. */
export function toScreen(view: BoardView, w: Point, size: BoardSize): Point {
  const s = scaleOf(view, size);
  return { x: (w.x - view.x) * s + size.width / 2, y: (w.y - view.y) * s + size.height / 2 };
}
/** The view at `zoom` that keeps world point `anchor` under the board-local point `at` (a pinch's midpoint). */
export function anchorView(anchor: Point, at: Point, zoom: number, size: BoardSize): BoardView {
  const z = clamp(zoom, 1, MAX_ZOOM),
    s = (size.width / size.worldWidth) * z;
  return clampView({ zoom: z, x: anchor.x - (at.x - size.width / 2) / s, y: anchor.y - (at.y - size.height / 2) / s }, size);
}
/** Moves the view with a finger that dragged by (dx, dy) CSS px. */
export function panView(view: BoardView, dx: number, dy: number, size: BoardSize): BoardView {
  const s = scaleOf(view, size);
  return clampView({ ...view, x: view.x - dx / s, y: view.y - dy / s }, size);
}
/**
 * The cell a tap builds on: the tapped cell when it can take the armed tower, else the nearest neighbour that can
 * whose edge lies within `reach` world px of the tap (a finger covers about a cell on a phone), else the tapped cell.
 */
export function snapCell(at: Point, cell: number, columns: number, rows: number, canBuild: (x: number, y: number) => boolean, reach: number): Point {
  const exact = { x: Math.floor(at.x / cell), y: Math.floor(at.y / cell) };
  if (canBuild(exact.x, exact.y)) return exact;
  let best: Point | undefined,
    bestDistance = reach;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const x = exact.x + dx,
        y = exact.y + dy;
      if ((!dx && !dy) || x < 0 || y < 0 || x >= columns || y >= rows || !canBuild(x, y)) continue;
      // Distance from the tap to the cell's rectangle.
      const ex = Math.max(x * cell - at.x, 0, at.x - (x + 1) * cell),
        ey = Math.max(y * cell - at.y, 0, at.y - (y + 1) * cell),
        d = Math.sqrt(ex * ex + ey * ey);
      if (d <= bestDistance) {
        best = { x, y };
        bestDistance = d;
      }
    }
  return best ?? exact;
}
