import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { landmarkAt, landmarkSpots } from "./landmarks";
import { obstaclePieces } from "./obstacle-pieces";
const maps = [...new Map(MISSIONS.map((m) => [m.map.id, m.map])).values()];
describe("obstacle pieces", () => {
  it("cover every obstacle cell outside the landmarks exactly once, big ones only on full 2×2 obstacle blocks", () => {
    for (const map of maps) {
      const spots = landmarkSpots(map),
        blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
        pieces = obstaclePieces(map, spots),
        cells = pieces.flatMap((p) => Array.from({ length: p.size * p.size }, (_, i) => `${p.x + (i % p.size)},${p.y + Math.floor(i / p.size)}`)),
        expected = map.blocked.filter((p) => !landmarkAt(spots, p.x, p.y)).map((p) => `${p.x},${p.y}`);
      expect(cells.every((c) => blocked.has(c))).toBe(true);
      expect(new Set(cells).size).toBe(cells.length);
      expect([...cells].sort()).toEqual([...expected].sort());
      expect(obstaclePieces(map, spots)).toEqual(pieces);
    }
  });
  it("draw some groups of the campaign as big pieces, but not every block", () => {
    const all = maps.flatMap((m) => obstaclePieces(m, landmarkSpots(m)));
    expect(all.some((p) => p.size === 2)).toBe(true);
    expect(all.some((p) => p.size === 1)).toBe(true);
  });
});
