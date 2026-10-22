import type { MapDefinition } from "../core/types";
import { fnv } from "../core/hash";
import { landmarkAt, type LandmarkSpot } from "./landmarks";
/** One obstacle drawing: a single cell, or the theme's obstacle at twice the size over a 2×2 block (top-left `x`, `y`). */
export interface ObstaclePiece {
  x: number;
  y: number;
  size: 1 | 2;
}
/** Share of the free 2×2 obstacle blocks drawn as one big piece; the rest stay single, so groups mix sizes. */
export const BIG_SHARE = 0.6;
/**
 * The obstacle cells outside the landmarks as pieces, every cell in exactly one: scanning top to bottom, left to right,
 * a cell starts a big piece when its 2×2 block is all free obstacle cells and a salted hash of the map and cell says so.
 * Pure and deterministic, so the baked terrain and the ambient find the same pieces.
 */
export function obstaclePieces(map: MapDefinition, spots: readonly LandmarkSpot[]): ObstaclePiece[] {
  const free = new Set(map.blocked.filter((p) => !landmarkAt(spots, p.x, p.y)).map((p) => `${p.x},${p.y}`)),
    taken = new Set<string>(),
    open = (x: number, y: number) => free.has(`${x},${y}`) && !taken.has(`${x},${y}`),
    pieces: ObstaclePiece[] = [];
  for (const p of [...map.blocked].sort((a, b) => a.y - b.y || a.x - b.x)) {
    if (!open(p.x, p.y)) continue;
    const big = open(p.x + 1, p.y) && open(p.x, p.y + 1) && open(p.x + 1, p.y + 1) && fnv(`${map.id}:piece:${p.x}:${p.y}`) / 4294967296 < BIG_SHARE,
      size = big ? 2 : 1;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) taken.add(`${p.x + i},${p.y + j}`);
    pieces.push({ x: p.x, y: p.y, size });
  }
  return pieces;
}
