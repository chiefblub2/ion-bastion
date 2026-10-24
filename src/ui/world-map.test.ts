import { describe, expect, it } from "vitest";
import { fitBox, headingOf, inside, jaggedBorder, planetLayout, project, ROUTE_SHAPES, type RouteShape, routePoints, tiltFor, voronoiCell, WORLD_H, WORLD_W, worldLayout, worldRows } from "./world-map";
describe("world map", () => {
  it("lays the campaign out as a serpentine of territories", () => {
    const regions = worldLayout(12);
    expect(worldRows(12)).toBe(3);
    expect(worldRows(3)).toBe(1);
    for (const r of regions) {
      expect(r.x).toBeGreaterThan(0);
      expect(r.x).toBeLessThan(WORLD_W);
      expect(r.y).toBeGreaterThan(0);
      expect(r.y).toBeLessThan(WORLD_H);
      expect(inside(r, r.border)).toBe(true);
    }
    // Neighbours in play order are neighbours on the map: the second row runs back from right to left.
    for (let i = 1; i < regions.length; i++) expect(Math.hypot(regions[i].x - regions[i - 1].x, regions[i].y - regions[i - 1].y)).toBeLessThan(60);
    expect(regions[4].reverse).toBe(true);
    expect(worldLayout(12)).toEqual(regions);
  });
  it("tiles the world with territories, wilds around the sectors", () => {
    for (const count of [3, 5, 12]) {
      const { regions, wilds } = planetLayout(count),
        all = [...regions, ...wilds];
      let single = 0,
        total = 0;
      for (let x = 1; x < WORLD_W; x += 3)
        for (let y = 1; y < WORLD_H; y += 3) {
          total++;
          if (all.filter((t) => inside({ x, y }, t.border)).length === 1) single++;
        }
      // Only points right on a border may fall into none or two.
      expect(single / total).toBeGreaterThan(0.98);
    }
  });
  it("splits two seeds at their bisector and gives a shared edge the same jagged points", () => {
    const seeds = [
        { x: 20, y: 50 },
        { x: 80, y: 50 },
      ],
      bounds = { x: 0, y: 0, w: 100, h: 100 },
      left = voronoiCell(seeds, 0, bounds),
      right = voronoiCell(seeds, 1, bounds);
    expect(Math.max(...left.map((p) => p.x))).toBeCloseTo(50);
    expect(Math.min(...right.map((p) => p.x))).toBeCloseTo(50);
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`,
      shared = (poly: { x: number; y: number }[]) => new Set(poly.filter((p) => Math.abs(p.x - 50) < 8 && p.y > 2 && p.y < 98).map(key));
    const a = shared(jaggedBorder(left)),
      b = shared(jaggedBorder(right));
    expect(a.size).toBeGreaterThan(20);
    expect([...a].filter((p) => b.has(p)).length).toBeGreaterThan(a.size * 0.9);
  });
  it("lays every route shape into each territory, from its entry towards its exit", () => {
    const regions = worldLayout(12);
    for (const shape of Object.keys(ROUTE_SHAPES) as RouteShape[])
      regions.forEach((r, i) => {
        for (const count of [3, 5]) for (const p of routePoints(r, count, { shape, heading: headingOf(regions, i), aside: 1 })) expect(inside(p, r.border)).toBe(true);
      });
    const east = routePoints(regions[0], 5, { shape: "chain", heading: 0 }),
      west = routePoints(regions[0], 5, { shape: "chain", heading: Math.PI });
    expect(east[0].x).toBeLessThan(east[4].x);
    expect(west[0].x).toBeGreaterThan(west[4].x);
    // The mission stepping aside moves away from the route.
    const plain = routePoints(regions[0], 5, { shape: "chain", heading: 0 }),
      aside = routePoints(regions[0], 5, { shape: "chain", heading: 0, aside: 2 });
    expect(Math.abs(aside[2].y - regions[0].y)).toBeGreaterThan(Math.abs(plain[2].y - regions[0].y));
    expect(aside[1]).toEqual(plain[1]);
  });
  it("fits a box centred into the view", () => {
    const box = { x: 50, y: 20, w: 40, h: 20 },
      fit = fitBox(box, 1000, 400),
      unit = 1000 / WORLD_W;
    expect(fit.x + (box.x + box.w / 2) * unit * fit.scale).toBeCloseTo(500);
    expect(fit.y + (box.y + box.h / 2) * unit * fit.scale).toBeCloseTo(200);
    expect(fit.scale).toBeCloseTo(Math.min(1000 / (40 * unit), 400 / (20 * unit)));
  });
  it("projects world points through the fit and the tilt", () => {
    const fit = { x: 100, y: 50, scale: 2 },
      flat = { ...tiltFor(1000), deg: 0 },
      tilt = tiltFor(1000);
    // Untilted, a point lands where the plane's transform puts it.
    expect(project({ x: 20, y: 10 }, fit, 1000, 400, flat)).toEqual({ x: 100 + 20 * 5 * 2, y: 50 + 10 * 5 * 2 });
    // Tilted, the pivot stays, the far side shrinks towards it and the near side grows.
    const pivot = { x: (500 - fit.x) / 10, y: (300 - fit.y) / 10 },
      at = (dy: number) => project({ x: pivot.x + 10, y: pivot.y + dy }, fit, 1000, 400, tilt);
    expect(project(pivot, fit, 1000, 400, tilt).x).toBeCloseTo(500);
    expect(project(pivot, fit, 1000, 400, tilt).y).toBeCloseTo(300);
    expect(at(-10).x - 500).toBeLessThan(100);
    expect(at(10).x - 500).toBeGreaterThan(100);
    expect(300 - at(-10).y).toBeLessThan(100);
  });
});
