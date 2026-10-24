import { describe, expect, it } from "vitest";
import { fitBox, stationPoints, WORLD_H, WORLD_W, worldLayout, worldRows } from "./world-map";
describe("world map", () => {
  it("lays the campaign out as a serpentine of landmasses inside the world", () => {
    const regions = worldLayout(12);
    expect(worldRows(12)).toBe(3);
    expect(worldRows(3)).toBe(1);
    for (const r of regions) {
      expect(r.box.x).toBeGreaterThanOrEqual(-2);
      expect(r.box.y).toBeGreaterThanOrEqual(-2);
      expect(r.box.x + r.box.w).toBeLessThanOrEqual(WORLD_W + 2);
      expect(r.box.y + r.box.h).toBeLessThanOrEqual(WORLD_H + 2);
    }
    // Neighbours in play order are neighbours on the map: the second row runs back from right to left.
    for (let i = 1; i < regions.length; i++) expect(Math.hypot(regions[i].x - regions[i - 1].x, regions[i].y - regions[i - 1].y)).toBeLessThan(60);
    expect(regions[4].reverse).toBe(true);
    expect(worldLayout(12)).toEqual(regions);
  });
  it("places a sector's stations across its landmass in travel direction, zigzagging", () => {
    const [ahead, , , , back] = worldLayout(12),
      forward = stationPoints(ahead, 5, 0),
      reverse = stationPoints(back, 5, 4);
    expect(forward.map((p) => p.x)).toEqual([...forward.map((p) => p.x)].sort((a, b) => a - b));
    expect(reverse.map((p) => p.x)).toEqual([...reverse.map((p) => p.x)].sort((a, b) => b - a));
    expect(forward.every((p, i) => i === 0 || p.y > ahead.y !== forward[i - 1].y > ahead.y)).toBe(true);
  });
  it("fits a box centred into the view", () => {
    const box = { x: 50, y: 20, w: 40, h: 20 },
      fit = fitBox(box, 1000, 400),
      unit = 1000 / WORLD_W;
    expect(fit.x + (box.x + box.w / 2) * unit * fit.scale).toBeCloseTo(500);
    expect(fit.y + (box.y + box.h / 2) * unit * fit.scale).toBeCloseTo(200);
    expect(fit.scale).toBeCloseTo(Math.min(1000 / (40 * unit), 400 / (20 * unit)));
  });
});
