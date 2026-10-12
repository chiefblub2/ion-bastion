import type { MapDefinition } from "../core/types";
/**
 * A cell block that hosts one large set-piece instead of its small obstacles: `size` 2 is a 2×2 block of obstacles
 * (top-left cell `x`, `y`), `size` 1 a single obstacle cell drawn as a smaller "hero" variant.
 */
export interface LandmarkSpot {
  x: number;
  y: number;
  size: 1 | 2;
}
/** At most this many landmarks per map, so they stay landmarks. */
export const MAX_LANDMARKS = 2;
/**
 * The landmarks of a map, always on obstacle cells, so they never cover buildable ground: 2×2 obstacle blocks first;
 * a map without one gets single obstacle cells instead, those with the most obstacle neighbours first. Spots never
 * overlap and keep three cells apart; among equals the one farthest from the entry wins (then top to bottom, left to
 * right). Pure and deterministic, so the terrain and its ambient find the same spots.
 */
export function landmarkSpots(map: MapDefinition): LandmarkSpot[] {
  const blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
    at = (x: number, y: number) => blocked.has(`${x},${y}`),
    entry = map.path[0],
    far = (x: number, y: number) => Math.hypot(x - entry.x, y - entry.y),
    pick = (candidates: { x: number; y: number; score: number }[], size: 1 | 2) => {
      candidates.sort((a, b) => b.score - a.score || a.y - b.y || a.x - b.x);
      const spots: LandmarkSpot[] = [];
      for (const c of candidates) {
        if (spots.length >= MAX_LANDMARKS) break;
        if (spots.every((s) => Math.max(Math.abs(s.x - c.x), Math.abs(s.y - c.y)) >= 3)) spots.push({ x: c.x, y: c.y, size });
      }
      return spots;
    };
  const blocks: { x: number; y: number; score: number }[] = [];
  for (let y = 0; y < map.rows - 1; y++)
    for (let x = 0; x < map.columns - 1; x++)
      if (at(x, y) && at(x + 1, y) && at(x, y + 1) && at(x + 1, y + 1)) blocks.push({ x, y, score: far(x + 1, y + 1) });
  if (blocks.length) return pick(blocks, 2);
  const neighbours = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => at(x + dx, y + dy)).length;
  // Neighbours weigh more than distance: a cluster's heart reads as a landmark, a lone crate at the far end does not.
  return pick(map.blocked.map((p) => ({ x: p.x, y: p.y, score: neighbours(p.x, p.y) * 100 + far(p.x, p.y) })), 1);
}
/** The spot whose cells include (`x`, `y`), if any. */
export const landmarkAt = (spots: readonly LandmarkSpot[], x: number, y: number) =>
  spots.find((s) => x >= s.x && x < s.x + s.size && y >= s.y && y < s.y + s.size);
