import { describe, expect, it } from "vitest";
import { towerAt } from "../core/test-helpers";
import type { Tower, TowerId } from "../core/types";
import { initialState } from "../core/game";
import { MISSIONS } from "../content/missions";
import { TOWERS } from "../content/towers";
import { cardChoices, cardSub, cardTower, choiceRule, towerCardHtml } from "./tower-card";
import { pathLadder, towerDetails } from "./tower-details";

const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
const tower = (type: TowerId, upgrades: string[] = []): Tower => ({ ...towerAt(1, type, 0, 0, upgrades), spent: 80 });
const options = (over = {}) => ({ credits: 10000, slim: false, ...over });
const offered = (html: string) => [...html.matchAll(/data-upgrade="([^"]+)"/g)].map((m) => m[1]);
const cost = (type: TowerId, id: string) => TOWERS[type].upgrades.find((u) => u.id === id)!.cost;

describe("tower card content", () => {
  it("offers the next level with its price, disabled while unaffordable", () => {
    expect(cardChoices(tower("pulse"), [], 0)).toEqual([expect.objectContaining({ id: "level-2", price: cost("pulse", "level-2"), disabled: true })]);
    expect(cardChoices(tower("pulse"), [], 500)[0].disabled).toBe(false);
  });
  it("shows what a plain level changes", () => {
    const [plain] = cardChoices(tower("pulse"), [], 500);
    expect(plain.changes.length).toBeGreaterThan(0);
    expect(plain.description).toBe("");
    expect(towerCardHtml(tower("pulse"), [], options())).toContain("card-changes");
    expect(towerCardHtml(tower("pulse"), [], options({ slim: true }))).toContain("card-changes-line");
  });
  it("offers each path at level 5 with its name, role, three tiers and their total", () => {
    const choices = cardChoices(tower("pulse", LEVELS), [], 500);
    expect(choices.map((c) => c.id)).toEqual(["sharpshooter-1", "overclock-1", "ricochet-1"]);
    for (const c of choices) {
      expect(c.label).toBe(TOWERS.pulse.visual.paths![c.id.replace(/-1$/, "")].name);
      expect(c.detail).not.toBe("");
      expect(c.description).not.toBe("");
      expect(c.changes.length).toBeGreaterThan(0);
      expect(c.branch!.tiers).toHaveLength(3);
      expect(c.branch!.total).toBe(c.branch!.tiers.reduce((sum, t) => sum + t.price, 0));
    }
  });
  it("states the exclusive rule only when there is more than one branch to choose", () => {
    const choices = cardChoices(tower("pulse", LEVELS), [], 500);
    expect(choiceRule(choices)).toMatch(/^Choose one path\. The other two lock/);
    expect(choiceRule(choices.slice(0, 1))).toBe("");
    expect(choiceRule(cardChoices(tower("pulse"), [], 500))).toBe("");
    expect(choiceRule(cardChoices(tower("aura"), [], 500))).toMatch(/^Choose one track/);
  });
  it("names the level, the choice and the path in the header", () => {
    expect(cardSub(tower("pulse", ["level-2", "level-3"])).text).toBe("Lv 3/8");
    expect(cardSub(tower("pulse", LEVELS)).text).toBe("Lv 5/8 · Choose path");
    const on = cardSub(tower("pulse", [...LEVELS, "ricochet-1"]));
    expect(on.text).toBe(`Lv 6/8 · ${TOWERS.pulse.visual.paths!.ricochet.name} I/III`);
    expect(on.color).toBe(TOWERS.pulse.visual.paths!.ricochet.color);
  });
  it("names the Aura's track and then its path choice", () => {
    expect(cardSub(tower("aura")).text).toContain("Choose track");
    expect(cardSub(tower("aura", ["damage", "damage-2"])).text).toBe("Lv 3/7 · Damage II/III");
    expect(cardSub(tower("aura", ["damage", "damage-2", "damage-3"])).text).toBe("Lv 4/7 · Damage III/III · Choose path");
  });
  it("slim card: an accordion without titles, only the open option can be bought", () => {
    const t = tower("pulse", LEVELS),
      closed = towerCardHtml(t, [], options({ slim: true })),
      open = towerCardHtml(t, [], options({ slim: true, open: "overclock-1" }));
    expect(closed).not.toContain("title=");
    expect(open).not.toContain("title=");
    expect(offered(closed)).toEqual([]);
    expect(offered(open)).toEqual(["overclock-1"]);
    expect(open).toContain(`Choose ${TOWERS.pulse.visual.paths!.overclock.name}`);
    expect(offered(towerCardHtml(t, [], options()))).toEqual(["sharpshooter-1", "overclock-1", "ricochet-1"]);
  });
  it("strikes the list price through under a Workshop discount", () => {
    const t = tower("pulse", LEVELS),
      workshop = { ...towerAt(2, "workshop", 1, 0, ["level-2", "level-3"]), spent: 100 },
      [first] = cardChoices(t, [t, workshop], 500);
    expect(first.price).toBeLessThan(first.listPrice);
    expect(towerCardHtml(t, [t, workshop], options())).toContain(`<s>◇ ${first.listPrice}</s> ◇ ${first.price}`);
  });
  it("shows Max level, and no targeting for support towers", () => {
    expect(towerCardHtml(tower("pulse", [...LEVELS, "ricochet-1", "ricochet-2", "ricochet-3"]), [], options())).toContain("Max level");
    expect(towerCardHtml(tower("refinery"), [], options())).not.toContain("data-priority");
  });
  it("offers no targeting on a trap", () => {
    expect(towerCardHtml(tower("spikes"), [], options())).not.toContain("data-priority");
  });
  it("slim mode cycles the target with one button", () => {
    const html = towerCardHtml(tower("pulse"), [], options({ slim: true }));
    expect(html).toContain("data-priority-cycle");
    expect(html).not.toContain('data-priority="');
  });
  it("disables a co-op partner's tower", () => {
    const html = towerCardHtml(tower("pulse"), [], options({ owner: "Player 2" }));
    expect(html).toContain("Owned by Player 2");
    for (const button of html.match(/<button[^>]*data-(upgrade|sell)[^>]*>/g)!) expect(button).toContain("disabled");
  });
});
describe("read-only sidebar", () => {
  it("has no upgrade, priority or sell control", () => {
    for (const t of [tower("pulse"), tower("pulse", LEVELS), tower("aura"), tower("spikes")]) {
      const html = towerDetails(t.type, t, []);
      expect(html).not.toMatch(/data-upgrade|data-priority|data-sell|sell-btn/);
    }
    expect(towerDetails("pulse", tower("pulse"), [])).toContain("Target: <b>First</b>");
    expect(towerDetails("pulse", tower("pulse", LEVELS), [])).toContain("LEVEL 5 / 8");
  });
  it("lists the paths before the choice and the chosen path's tiers after it", () => {
    const names = Object.values(TOWERS.pulse.visual.paths!).map((p) => p.name!);
    const before = pathLadder(tower("pulse", LEVELS));
    for (const name of names) expect(before).toContain(name);
    const on = pathLadder(tower("pulse", [...LEVELS, "ricochet-1"]));
    expect(on).toContain(TOWERS.pulse.visual.paths!.ricochet.name);
    expect(on).not.toContain(TOWERS.pulse.visual.paths!.overclock.name);
    expect(on.match(/class="owned"/g)).toHaveLength(1);
    expect(towerDetails("pulse", tower("pulse", [...LEVELS, "ricochet-1"]), [])).toContain("LEVEL 6 / 8 · RICOCHET");
  });
});
describe("card subject", () => {
  it("cardTower hides for a missing tower and a finished mission", () => {
    const state = { ...initialState(MISSIONS[0]), towers: [{ ...tower("pulse"), id: 3 }] };
    expect(cardTower(state, 3)?.id).toBe(3);
    expect(cardTower(state, 99)).toBeUndefined();
    expect(cardTower({ ...state, status: "won" }, 3)).toBeUndefined();
    expect(cardTower(state, null)).toBeUndefined();
  });
  it("hides once a versus match has a result, even while the field still runs", () => {
    const state = { ...initialState(MISSIONS[0]), towers: [{ ...tower("pulse"), id: 3 }] };
    expect(cardTower(state, 3, true)).toBeUndefined();
  });
});
