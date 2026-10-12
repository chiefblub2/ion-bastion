import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { landmarkAt, landmarkSpots, MAX_LANDMARKS } from "./landmarks";
const maps = [...new Map(MISSIONS.map((m) => [m.map.id, m.map])).values()];
describe("landmark spots", () => {
  it("lie only on obstacles, never overlap, and stay within the limit", () => {
    for (const map of maps) {
      const blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
        spots = landmarkSpots(map),
        cells = spots.flatMap((s) => Array.from({ length: s.size * s.size }, (_, i) => `${s.x + (i % s.size)},${s.y + Math.floor(i / s.size)}`));
      expect(spots.length).toBeLessThanOrEqual(MAX_LANDMARKS);
      expect(cells.every((c) => blocked.has(c))).toBe(true);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });
  it("are the same on every call and found by their cells", () => {
    const map = maps.find((m) => landmarkSpots(m).some((s) => s.size === 2))!,
      [spot] = landmarkSpots(map);
    expect(landmarkSpots(map)).toEqual(landmarkSpots(map));
    expect(landmarkAt([spot], spot.x + 1, spot.y + 1)).toBe(spot);
    expect(landmarkAt([spot], spot.x + 2, spot.y)).toBeUndefined();
  });
});
