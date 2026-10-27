import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { missionsLeft, relicFit, transitionsLeft, usable } from "./relic-fit";
import { relicOf, RELIC_IDS } from "./relics";
import { rewardProgress, rewardSteps } from "./rewards";
import { chooseStarter, continueRun, gainRelic, newRun, pickDoctrine, pickRelic, relicOffers, type MissionLog, type RunState } from "./run";
const content = DEFAULT_CONTENT;
const won = (kind: MissionLog["kind"]): MissionLog => ({ mission: "x", kind, act: 0, won: true, start: 30, end: 28, kills: 0, scrap: 0 });
const base = (roster: RunState["roster"], log: MissionLog[] = [], length: "full" | "short" = "full"): RunState => ({ ...chooseStarter(newRun(5, { length }, content), 0), roster, log });
describe("relic eligibility", () => {
  it("counts the missions and act transitions still ahead", () => {
    const run = base(["pulse"], [won("standard"), won("standard"), won("boss")]);
    expect(missionsLeft(run)).toBe(7);
    expect(transitionsLeft({ ...run, phase: "reward" })).toBe(3);
    expect(transitionsLeft({ ...run, phase: "act" })).toBe(2);
    expect(transitionsLeft(base(["pulse"], [], "short"))).toBe(0);
  });
  it("drops relics that can no longer pay off", () => {
    expect(usable(base(["pulse"], [], "short"), "master", content)).toBe(false);
    const late = base(["pulse"], [...Array(9)].map(() => won("standard")));
    expect(usable(late, "sergeant", content)).toBe(false);
    expect(usable(late, "capacitor", content)).toBe(true);
    // One mission left and no trap: Sapper Crew could never act.
    expect(usable(late, "sappers", content)).toBe(false);
    expect(usable(gainRelic(base(["pulse"]), "capacitor"), "capacitor", content)).toBe(false);
  });
  it("tells which roster towers a relic works through", () => {
    expect(relicFit(base(["pulse", "frost"]), "cryo", content)).toMatchObject({ fits: true, towers: ["frost"], synergy: true });
    expect(relicFit(base(["pulse"]), "amplifier", content).fits).toBe(false);
    expect(relicFit(base(["pulse"]), "salvage", content).fits).toBe(true);
    expect(relicFit({ ...base(["pulse"]), doctrines: ["pulse:x"] }, "zealot", content).fits).toBe(true);
  });
  it("offers only fresh, usable relics, one of them fitting the roster", () => {
    let fitted = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const run = { ...base(["pulse", "frost", "blast"], [won("standard"), won("standard")]), seed, relics: ["capacitor" as const] },
        offers = relicOffers(run, 3, content);
      expect(new Set(offers).size).toBe(offers.length);
      expect(offers).not.toContain("capacitor");
      for (const id of offers) expect(["common", "rare"]).toContain(relicOf(id).rarity);
      if (offers.some((id) => relicFit(run, id, content).synergy)) fitted++;
    }
    expect(fitted).toBe(40);
  });
  it("keeps every relic described", () => {
    for (const id of RELIC_IDS) {
      const r = relicOf(id);
      expect(r.description.length, id).toBeGreaterThan(10);
      if (r.rarity === "cursed") expect(r.downside, id).toBeTruthy();
      if (r.wants && r.wants !== undefined && r.category === "synergy") expect(r.wantsText, id).toBeTruthy();
    }
  });
});
describe("reward steps", () => {
  const act = (relics: RunState["relics"] = []): RunState => ({ ...base(["pulse", "frost"]), relics, phase: "act", offers: { legendary: ["core", "pockets", "sabotage"], doctrine: true, steps: 1 } });
  it("show the act's relic and Doctrine as one decision, two with Master License", () => {
    expect(rewardSteps(act())).toEqual(["act"]);
    expect(rewardSteps(act(["master"]))).toEqual(["legendary", "doctrine"]);
  });
  it("never let the act reward pay out twice", () => {
    const relic = pickRelic(act(), "legendary", "core");
    expect(rewardSteps(relic)).toEqual([]);
    expect(pickDoctrine(relic, "pulse", "x", content)).toBe(relic);
    const doctrine = pickDoctrine(act(), "pulse", Object.keys(content.towers.pulse.visual.paths ?? {})[0], content);
    expect(rewardSteps(doctrine)).toEqual([]);
    expect(pickRelic(doctrine, "legendary", "core")).toBe(doctrine);
  });
  it("count the decisions of a reward", () => {
    const run: RunState = { ...base(["pulse"]), phase: "reward", offers: { towers: ["frost"], relics: ["salvage"], steps: 2 } };
    expect(rewardProgress(run)).toEqual({ index: 1, total: 2 });
    expect(rewardProgress({ ...run, offers: { relics: ["salvage"], steps: 2 } })).toEqual({ index: 2, total: 2 });
    // An older save without the count still reads.
    expect(rewardProgress({ ...run, offers: { relics: ["salvage"] } })).toEqual({ index: 1, total: 1 });
  });
  it("store the count with fresh offers", () => {
    const boss = { ...base(["pulse", "frost"], [won("standard"), won("standard"), won("boss")]), phase: "reward" as const, node: { act: 0, column: 4, lane: 1, kind: "boss" as const, mission: "x" }, offers: {} };
    const next = continueRun(boss, content);
    expect(next.phase).toBe("act");
    expect(next.offers.steps).toBeUndefined();
    expect(rewardSteps(next)).toEqual(["act"]);
  });
});
