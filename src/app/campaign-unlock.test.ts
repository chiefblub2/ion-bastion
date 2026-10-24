import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { isCircleSector } from "../content/missions";
import type { MissionSector } from "../core/types";
import { campaignLocks, newlyUnlocked, sectorGate, sectorLocked } from "./campaign-unlock";
import type { CampaignRecord } from "./progress";
const sectors = DEFAULT_CONTENT.sectors ?? [],
  campaign = sectors.filter((s) => !isCircleSector(s)),
  [first, second, third] = campaign,
  wins = (...ids: string[]): CampaignRecord => Object.fromEntries(ids.map((id) => [id, 2 as const]));
const ids = (s: MissionSector) => s.missions.map((m) => m.id);
describe("campaign unlocks", () => {
  it("opens only the first mission for a new player, never Circuit missions", () => {
    const locks = campaignLocks(sectors, {});
    expect(ids(first).map((id) => locks.has(id))).toEqual([false, true, true, true, true]);
    expect(sectorLocked(second, locks)).toBe(true);
    expect(sectors.filter(isCircleSector).every((s) => !sectorLocked(s, locks))).toBe(true);
    expect(locks.get(ids(first)[1])).toEqual({ kind: "mission", after: first.missions[0] });
  });
  it("opens the next two missions after a win, so one mission can be skipped", () => {
    const [a, b, c, d] = ids(first),
      locks = campaignLocks(sectors, wins(a));
    expect([b, c, d].map((id) => locks.has(id))).toEqual([false, false, true]);
  });
  it("opens the next sector once all but one of the sector's missions are won", () => {
    const [a, b, c, d] = ids(first);
    expect(sectorGate(first)).toBe(first.missions.length - 1);
    expect(sectorLocked(second, campaignLocks(sectors, wins(a, b, c)))).toBe(true);
    const locks = campaignLocks(sectors, wins(a, b, c, d)),
      lock = campaignLocks(sectors, wins(a, b, c)).get(ids(second)[0]);
    expect(lock).toEqual({ kind: "sector", sector: first, need: 1 });
    expect(locks.has(ids(second)[0])).toBe(false);
    expect(sectorLocked(third, locks)).toBe(true);
  });
  it("keeps won missions and their sectors open for records played out of order", () => {
    const late = third.missions[3].id,
      locks = campaignLocks(sectors, wins(late));
    expect(locks.has(late)).toBe(false);
    expect(locks.has(third.missions[0].id)).toBe(false);
    expect(locks.has(third.missions[4].id)).toBe(false);
    expect(sectorLocked(second, locks)).toBe(true);
  });
  it("names what a win opened", () => {
    const [a, b, c, d] = ids(first),
      before = campaignLocks(sectors, wins(a, b, c)),
      opened = newlyUnlocked(sectors, before, campaignLocks(sectors, wins(a, b, c, d)));
    expect(opened.sectors).toEqual([second]);
    expect(opened.missions).toEqual([]);
    expect(newlyUnlocked(sectors, campaignLocks(sectors, wins(a)), campaignLocks(sectors, wins(a, b))).missions).toEqual([first.missions[3]]);
  });
});
