import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { isCircleSector, missionNumber } from "../content/missions";
import { atlasPick, atlasSectors } from "./sector-atlas";
const { missions, sectors = [] } = DEFAULT_CONTENT;
describe("sector atlas", () => {
  const campaign = atlasSectors(DEFAULT_CONTENT, false),
    rings = atlasSectors(DEFAULT_CONTENT, true);
  it("shows every sector and mission once, Circuit apart from the campaign", () => {
    expect([...campaign, ...rings].map((s) => s.index).sort((a, b) => a - b)).toEqual(sectors.map((_, i) => i));
    expect(campaign.some((s) => isCircleSector(sectors[s.index]))).toBe(false);
    expect(rings.every((s) => isCircleSector(sectors[s.index]))).toBe(true);
    expect([...campaign, ...rings].reduce((n, s) => n + s.count, 0)).toBe(missions.length);
  });
  it("numbers each card's missions as the campaign does", () => {
    for (const s of [...campaign, ...rings]) {
      const members = sectors[s.index].missions;
      expect([s.first, s.last]).toEqual([missionNumber(members[0], missions), missionNumber(members[members.length - 1], missions)]);
    }
  });
  it("marks the sector of the loaded mission", () => {
    const id = sectors[1].missions[2].id;
    expect(atlasSectors(DEFAULT_CONTENT, false, id).filter((s) => s.current).map((s) => s.index)).toEqual([1]);
  });
  it("features the picked mission, else the loaded one, else the first", () => {
    const list = sectors[0].missions;
    expect(atlasPick(list, list[3].id, list[1].id)).toBe(list[3]);
    expect(atlasPick(list, "elsewhere", list[1].id)).toBe(list[1]);
    expect(atlasPick(list, undefined, "elsewhere")).toBe(list[0]);
  });
});
