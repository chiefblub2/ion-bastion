import { describe, expect, it } from "vitest";
import { FRONT, headingOf, inside, jaggedBorder, planetLayout, ROUTE_SHAPES, type RouteShape, routePoints, voronoiCell, WORLD_H, WORLD_W } from "./world-map";
import { WORLDS } from "./planets";
describe("world map", () => {
  it("tiles every world with its territories and wilds, a station's deck apart in orbit", () => {
    for (const w of WORLDS) {
      const { regions, wilds } = planetLayout(w.centres, w.station),
        ground = regions.filter((r) => !r.station),
        all = [...ground, ...wilds];
      let single = 0,
        total = 0;
      for (let x = 2; x < WORLD_W; x += 6)
        for (let y = 2; y < WORLD_H; y += 6) {
          total++;
          if (all.filter((t) => inside({ x, y }, t.border)).length === 1) single++;
        }
      // Only points right on a border may fall into none or two.
      expect(single / total).toBeGreaterThan(0.98);
      for (const r of regions) {
        expect(inside(r, r.border)).toBe(true);
        expect(r.label.y).toBeLessThan(r.y);
      }
      // The sectors gather on the face the globe turns to the viewer.
      for (const r of ground) {
        expect(r.x).toBeGreaterThanOrEqual(FRONT.x);
        expect(r.x).toBeLessThanOrEqual(FRONT.x + FRONT.w);
        expect(r.y).toBeGreaterThanOrEqual(FRONT.y);
        expect(r.y).toBeLessThanOrEqual(FRONT.y + FRONT.h);
      }
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
  it("lays every route shape into each territory of every world, from its entry towards its exit", () => {
    for (const w of WORLDS) {
      const { regions } = planetLayout(w.centres, w.station);
      for (const shape of Object.keys(ROUTE_SHAPES) as RouteShape[])
        regions.forEach((r, i) => {
          for (const count of [3, 5]) for (const p of routePoints(r, count, { shape, heading: headingOf(regions, i), aside: 1 })) expect(inside(p, r.border)).toBe(true);
        });
    }
    const { regions } = planetLayout(WORLDS[0].centres, WORLDS[0].station);
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
});
