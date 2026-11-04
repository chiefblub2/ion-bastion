import { describe, expect, it } from "vitest";
import { parseMap } from "../content/maps";
import { CELL } from "./shapes";
import { CHANNEL_STEP, channelOf, landDistance, landOf, MIN_SEA, seaCells, seaDepth } from "./coast";

const map = parseMap("coast-test", "Coast", [
  "##..#",
  "S===.",
  "#..=.",
  "##.=#",
  "###R#",
], "island");

describe("seaCells", () => {
  it("takes edge-touching obstacle groups of at least MIN_SEA cells and leaves small ones as obstacles", () => {
    const sea = seaCells(map);
    // The lower-left group (6 cells) is sea; the top-left pair (cut off by the entry) and the lone cells are not.
    expect(sea.has("0,4")).toBe(true);
    expect(sea.has("0,0")).toBe(false);
    expect(sea.has("4,0")).toBe(false);
    expect(sea.has("4,3")).toBe(false);
    expect([...sea].length).toBeGreaterThanOrEqual(MIN_SEA);
    expect(landOf(map).blocked).toEqual(map.blocked.filter((p) => !sea.has(`${p.x},${p.y}`)));
  });
  it("measures distance to dry land and keeps the sea depth deeper away from the shore", () => {
    const sea = seaCells(map);
    // Inside a land cell the distance is zero; in the bottom-left sea cell it grows towards the corner.
    expect(landDistance(map, sea, 2.5 * CELL, 2.5 * CELL)).toBe(0);
    const near = landDistance(map, sea, 1.9 * CELL, 3.5 * CELL),
      far = landDistance(map, sea, 0.1 * CELL, 4.9 * CELL);
    expect(far).toBeGreaterThan(near);
    expect(seaDepth(map, sea, 0.1 * CELL, 4.9 * CELL)).toBeGreaterThan(seaDepth(map, sea, 1.9 * CELL, 3.5 * CELL));
  });
});

describe("channelOf", () => {
  it("runs from the entry to the reactor in even steps and rounds the turns inside the corner cells", () => {
    const samples = channelOf(map),
      first = samples[0],
      last = samples[samples.length - 1],
      centre = (x: number, y: number) => ({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL });
    expect(first).toMatchObject(centre(0, 1));
    expect(last).toMatchObject(centre(3, 4));
    for (let i = 1; i < samples.length - 1; i++) expect(samples[i].s - samples[i - 1].s).toBeCloseTo(CHANNEL_STEP, 5);
    // The turn at (3, 1) cuts the corner: no sample reaches the corner cell's centre itself.
    const corner = centre(3, 1);
    expect(Math.min(...samples.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)))).toBeGreaterThan(5);
  });
});
