import { describe, expect, it } from "vitest";
import type { Tower, TowerId } from "../core/types";
import { initialState } from "../core/game";
import { MISSIONS } from "../content/missions";
import { cardChoices, cardTower, towerCardHtml } from "./tower-card";

const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
const tower = (type: TowerId, upgrades: string[] = []): Tower => ({ id: 1, type, x: 0, y: 0, upgrades, cooldown: 0, spent: 80, angle: 0, kills: 0, owner: 0 });
const options = (over = {}) => ({ credits: 10000, slim: false, ...over });

describe("tower card content", () => {
  it("offers the next level with its price, disabled while unaffordable", () => {
    expect(cardChoices(tower("pulse"), [], 0)).toEqual([expect.objectContaining({ id: "level-2", price: 72, disabled: true })]);
    expect(cardChoices(tower("pulse"), [], 500)[0].disabled).toBe(false);
  });
  it("offers three specialization choices after level 5", () => {
    const choices = cardChoices(tower("pulse", LEVELS), [], 500);
    expect(choices.map((c) => c.id)).toEqual(["sharpshooter-1", "overclock-1", "ricochet-1"]);
    for (const c of choices) expect(c.detail).not.toBe("");
  });
  it("offers the three Aura paths before the first purchase", () => {
    expect(cardChoices(tower("aura"), [], 500)).toHaveLength(3);
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
