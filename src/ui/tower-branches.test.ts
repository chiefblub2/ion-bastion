import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { towerBranches } from "./tower-branches";

describe("towerBranches", () => {
  it("gives an attack tower three paths of three tiers", () => {
    const { paths, tracks } = towerBranches(DEFAULT_CONTENT.towers.pulse);
    expect(paths).toHaveLength(3);
    for (const p of paths) expect(p.tiers).toHaveLength(3);
    expect(tracks).toHaveLength(0);
  });
  it("gives Aura tracks", () => {
    expect(towerBranches(DEFAULT_CONTENT.towers.aura).tracks.length).toBeGreaterThan(0);
  });
});
