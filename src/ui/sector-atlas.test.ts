import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { isCircleSector, missionNumber } from "../content/missions";
import { atlasNext, atlasPick, atlasSectors, progressOf } from "./sector-atlas";
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
  it("marks the one sector that holds the next mission", () => {
    const record = Object.fromEntries([...sectors[0].missions, sectors[1].missions[0]].map((m) => [m.id, 2] as const));
    expect(atlasSectors(DEFAULT_CONTENT, false, record).filter((s) => s.next).map((s) => s.index)).toEqual([1]);
    expect(atlasSectors(DEFAULT_CONTENT, false).filter((s) => s.next).map((s) => s.index)).toEqual([0]);
  });
  it("counts won missions and best stars per sector", () => {
    const [a, b] = sectors[0].missions,
      ring = sectors.find(isCircleSector)!.missions[0],
      record = { [a.id]: 3, [b.id]: 1, [ring.id]: 2 } as const,
      cards = atlasSectors(DEFAULT_CONTENT, false, record);
    expect(cards.map((s) => [s.won, s.stars])).toEqual(cards.map((s) => (s.index === 0 ? [2, 4] : [0, 0])));
    expect(atlasSectors(DEFAULT_CONTENT, true, record).reduce((n, s) => n + s.stars, 0)).toBe(2);
    expect(progressOf(missions, record)).toEqual({ won: 3, stars: 6, count: missions.length });
  });
  it("finds the first unwon mission as the next one", () => {
    const list = sectors[0].missions;
    expect(atlasNext(list, {})).toBe(list[0]);
    expect(atlasNext(list, { [list[0].id]: 3, [list[2].id]: 1 })).toBe(list[1]);
    expect(atlasNext(list, Object.fromEntries(list.map((m) => [m.id, 1] as const)))).toBeUndefined();
  });
  it("features the picked mission, else the one being played, else the next, else the first", () => {
    const list = sectors[0].missions,
      record = { [list[0].id]: 3 } as const,
      all = Object.fromEntries(list.map((m) => [m.id, 1] as const));
    expect(atlasPick(list, record, list[3].id, list[2].id)).toBe(list[3]);
    expect(atlasPick(list, record, "elsewhere", list[2].id)).toBe(list[2]);
    expect(atlasPick(list, record, undefined, "elsewhere")).toBe(list[1]);
    expect(atlasPick(list, all)).toBe(list[0]);
  });
});
