import { describe, expect, it } from "vitest";
import { BIOMES, biomeGround, paintSurface, paintWrapped, type SurfaceSeed } from "./planet-surface";
const seeds: SurfaceSeed[] = [
  { x: 20, y: 20, biome: "frost" },
  { x: 60, y: 20, biome: "volcano" },
  { x: 40, y: 60, biome: "orbit" },
];
const box = { x: 0, y: 0, w: 80, h: 80 };
describe("planet surface", () => {
  it("paints opaque pixels, the same every time", () => {
    const a = paintSurface(seeds, box, 40, 40);
    expect(a.length).toBe(40 * 40 * 4);
    expect([...a].filter((_, i) => i % 4 === 3).every((v) => v === 255)).toBe(true);
    expect(paintSurface(seeds, box, 40, 40)).toEqual(a);
  });
  it("gives each territory its biome's colours", () => {
    const px = paintSurface(seeds, box, 40, 40),
      at = (x: number, y: number) => [...px.slice((y * 40 + x) * 4, (y * 40 + x) * 4 + 3)],
      luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Around the frost seed the ground is far brighter than around the volcano seed.
    let frost = 0,
      volcano = 0;
    for (let d = -2; d <= 2; d++) {
      frost += luma(at(10 + d, 10));
      volcano += luma(at(30 + d, 10));
    }
    expect(frost).toBeGreaterThan(volcano * 1.5);
  });
  it("paints a sharper tile that matches the whole surface under it", () => {
    const whole = paintSurface(seeds, box, 80, 80),
      tile = paintSurface(seeds, { x: 20, y: 20, w: 20, h: 20 }, 80, 80);
    // The tile's pixel (40, 40) covers world (30.1, 30.1), the whole surface's pixel (30, 30) world (30.5, 30.5).
    let diff = 0;
    for (let c = 0; c < 3; c++) diff += Math.abs(tile[(40 * 80 + 40) * 4 + c] - whole[(30 * 80 + 30) * 4 + c]);
    expect(diff / 3).toBeLessThan(40);
  });
  it("has a flat ground colour for every biome", () => {
    for (const id of Object.keys(BIOMES) as (keyof typeof BIOMES)[]) expect(biomeGround(id)).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("paints a picture that wraps around without a seam", () => {
    const box = { x: 0, y: 0, w: 60, h: 20 },
      seeds = [{ x: 30, y: 10, biome: "frost" as const }],
      px = paintWrapped(seeds, box, 120, 40, 10),
      at = (i: number, j: number) => [0, 1, 2].map((c) => px[(j * 120 + i) * 4 + c]),
      step = (a: number, b: number) => Math.max(...at(a, 20).map((v, c) => Math.abs(v - at(b, 20)[c])));
    // The last column runs on into the first about as smoothly as two inner neighbours.
    expect(step(119, 0)).toBeLessThanOrEqual(Math.max(12, 2 * step(60, 61)));
  });
});
