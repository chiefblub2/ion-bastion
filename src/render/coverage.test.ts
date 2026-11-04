import { describe, expect, it } from "vitest";
import { towerAt } from "../core/test-helpers";
import { DEFAULT_CONTENT } from "../content";
import type { MapDefinition } from "../core/types";
import { pathCoverage, towerReach } from "./coverage";
// A straight path along row 0, cells 0–11.
const map = { id: "line", name: "Line", columns: 12, rows: 4, path: Array.from({ length: 12 }, (_, x) => ({ x, y: 0 })), blocked: [] } as unknown as MapDefinition;
describe("path coverage", () => {
  it("counts a tower on the path cells within its range and none beyond", () => {
    // Pulse, range 2.65, one row below the path at x = 5.
    const counts = pathCoverage(map, towerReach([towerAt(1, "pulse", 5, 1)], DEFAULT_CONTENT));
    expect(counts.map((n, x) => (n ? x : -1)).filter((x) => x >= 0)).toEqual([3, 4, 5, 6, 7]);
  });
  it("leaves out the Mortar's dead zone", () => {
    const counts = pathCoverage(map, towerReach([towerAt(1, "mortar", 5, 1)], DEFAULT_CONTENT));
    expect(counts[5]).toBe(0);
    expect(counts[7]).toBe(1);
  });
  it("counts air-only towers for air but not for ground", () => {
    const reach = towerReach([towerAt(1, "flak", 5, 1)], DEFAULT_CONTENT);
    expect(pathCoverage(map, reach, "ground")[5]).toBe(0);
    expect(pathCoverage(map, reach, "air")[5]).toBe(1);
  });
  it("gives support towers and traps no reach", () => {
    expect(towerReach([towerAt(1, "detector", 5, 1), towerAt(2, "mine", 5, 0)], DEFAULT_CONTENT)).toEqual([]);
  });
});
