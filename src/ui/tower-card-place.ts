import type { Point } from "../core/types";
// Where the selected tower's action card goes on the board: beside the tower where it covers the least path,
// else above or below it, else docked along the board edge farther from the tower. Pure, in board-local CSS px.
export interface CardPlaceInput {
  /** Board size in CSS px. */
  board: { width: number; height: number };
  columns: number;
  rows: number;
  /** The selected tower's cell. */
  cell: Point;
  /** Measured card size. */
  card: { width: number; height: number };
  path: readonly Point[];
}
export type CardPlacement =
  | { mode: "float"; side: "left" | "right" | "above" | "below"; x: number; y: number }
  | { mode: "dock"; edge: "top" | "bottom" };
/** Px between the cell and the card. */
export const CARD_GAP = 8;
type Side = "left" | "right" | "above" | "below";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function placeTowerCard({ board, columns, rows, cell, card, path }: CardPlaceInput): CardPlacement {
  const size = board.width / columns,
    cx = cell.x * size,
    cy = cell.y * size;
  const spot = (side: Side) => {
    const horizontal = side === "left" || side === "right",
      x = horizontal ? (side === "right" ? cx + size + CARD_GAP : cx - CARD_GAP - card.width) : clamp(cx + size / 2 - card.width / 2, 0, board.width - card.width),
      y = horizontal ? clamp(cy + size / 2 - card.height / 2, 0, board.height - card.height) : side === "below" ? cy + size + CARD_GAP : cy - CARD_GAP - card.height,
      fits = x >= 0 && y >= 0 && x + card.width <= board.width && y + card.height <= board.height,
      room = { right: board.width - cx - size, left: cx, below: board.height - cy - size, above: cy }[side];
    // A path cell counts when any part of it lies under the card.
    const covered = path.filter((p) => p.x * size < x + card.width && (p.x + 1) * size > x && p.y * size < y + card.height && (p.y + 1) * size > y).length;
    return { side, x, y, fits, room, covered };
  };
  for (const pair of [["right", "left"], ["above", "below"]] as const) {
    const best = pair
      .map(spot)
      .filter((s) => s.fits)
      .sort((a, b) => a.covered - b.covered || b.room - a.room)[0];
    if (best) return { mode: "float", side: best.side, x: best.x, y: best.y };
  }
  return { mode: "dock", edge: cell.y < rows / 2 ? "bottom" : "top" };
}
