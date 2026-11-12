import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { DEFAULT_CONTENT } from "../content/index";
import { CORE_KIT } from "../content/arsenal";
import { MISSIONS } from "../content/missions";
import type { ContentPack, TowerDefinition, TowerId } from "../core/types";
import { EMPTY_ARSENAL, researchPrice } from "./arsenal";
import { campaignLocks } from "./campaign-unlock";
import { afterDebrief } from "./debrief";
import { MissionTally } from "./tally";
import { lossTip } from "./tip";

const sectors = DEFAULT_CONTENT.sectors!,
  campaign = MISSIONS.filter((m) => !m.circle);

describe("mission tally", () => {
  it("counts leaks per enemy type and resets on a new state", () => {
    const game = new Game(MISSIONS[0]),
      tally = new MissionTally();
    game.command({ type: "start" });
    for (let i = 0; i < 20000 && !tally.lastLeakWave && game.state.status === "wave"; i++) {
      game.tick();
      tally.observe(game.state, game.drainEvents());
    }
    const total = Object.values(tally.leaks).reduce((n, v) => n + v!, 0);
    expect(total).toBeGreaterThan(0);
    expect(tally.lastLeakWave).toBe(1);
    game.command({ type: "restart" });
    tally.observe(game.state, []);
    expect(tally.leaks).toEqual({});
  });
});

describe("loss tip", () => {
  const mission = MISSIONS[0],
    flyer = "glider" as const;
  it("names an owned anti-air tower left at home when flyers leaked", () => {
    const tip = lossTip({ [flyer]: 5, drone: 1 }, mission, ["blast"], EMPTY_ARSENAL, DEFAULT_CONTENT, 0);
    expect(tip).toMatchObject({ kind: "counter", enemy: flyer });
    expect(CORE_KIT).toContain(tip.tower);
    expect(DEFAULT_CONTENT.towers[tip.tower!].targets).toContain("air");
  });
  it("suggests the cheapest research when nothing owned answers", () => {
    const grounded = Object.fromEntries(
      Object.entries(DEFAULT_CONTENT.towers).map(([id, t]) => [id, CORE_KIT.includes(id as TowerId) ? { ...t, targets: ["ground"] } : t]),
    ) as unknown as Record<TowerId, TowerDefinition>;
    const content: ContentPack = { ...DEFAULT_CONTENT, towers: grounded },
      tip = lossTip({ [flyer]: 5 }, mission, ["blast"], EMPTY_ARSENAL, content, 0);
    expect(tip).toMatchObject({ kind: "research", enemy: flyer });
    expect(tip.price).toBe(researchPrice(tip.tower!));
    expect(content.towers[tip.tower!].targets).toContain("air");
  });
  it("falls back to unspent credits without leaks", () => {
    expect(lossTip({}, mission, ["blast"], EMPTY_ARSENAL, DEFAULT_CONTENT, 120)).toMatchObject({ kind: "credits" });
  });
});

describe("after the debrief", () => {
  const at = (id: string) => ({ id, name: id, number: 1 }),
    sector = { number: 1, name: "" },
    none = { missions: [], sectors: [] };
  it("a loss offers no Next", () => {
    expect(afterDebrief({ won: false, best: 0, mission: at(campaign[0].id), sector, unlocked: none }, sectors, {}, new Map()).kind).toBe("none");
  });
  it("a plain win leads to the next mission's briefing", () => {
    const record = { [campaign[0].id]: 3 as const };
    expect(afterDebrief({ won: true, best: 0, mission: at(campaign[0].id), sector, unlocked: none }, sectors, record, campaignLocks(sectors, record)))
      .toEqual({ kind: "briefing", id: campaign[1].id });
  });
  it("a win that opened a sector flies the atlas there", () => {
    expect(afterDebrief({ won: true, best: 0, mission: at(campaign[4].id), sector, unlocked: { missions: [], sectors: [{ number: 2, name: "" }] } }, sectors, {}, new Map()))
      .toEqual({ kind: "atlas", sector: 2 });
  });
  it("the last mission's first win leads to the victory page, a later one does not", () => {
    const last = campaign.at(-1)!;
    expect(afterDebrief({ won: true, best: 0, mission: at(last.id), sector, unlocked: none }, sectors, {}, new Map()).kind).toBe("victory");
    expect(afterDebrief({ won: true, best: 2, mission: at(last.id), sector, unlocked: none }, sectors, {}, new Map()).kind).not.toBe("victory");
  });
});
