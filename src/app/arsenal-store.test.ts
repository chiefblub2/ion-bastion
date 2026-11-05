import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { MISSIONS } from "../content/missions";
import { arsenalTowers, parseArsenal } from "./arsenal-store";
import { EMPTY_ARSENAL } from "../campaign/arsenal";

describe("arsenal store", () => {
  it("parses defensively", () => {
    expect(parseArsenal("{bad")).toEqual(EMPTY_ARSENAL);
    expect(parseArsenal(JSON.stringify({ v: 1, salvage: 12.7, researched: ["lance", "nope", "lance"], xp: { pulse: 5, x: 3 }, gear: {} })))
      .toEqual({ salvage: 12, researched: ["lance"], xp: { pulse: 5 }, gear: {} });
  });

  it("narrows campaign missions only, and restart keeps it", () => {
    const first = MISSIONS[0],
      game = new Game(first),
      towers = arsenalTowers(first.id, EMPTY_ARSENAL)!;
    game.command({ type: "mission", id: first.id, towers });
    expect(game.availableTowers()).toEqual(towers);
    game.command({ type: "restart" });
    expect(game.availableTowers()).toEqual(towers);
    game.command({ type: "mission", id: first.id });
    expect(game.availableTowers().length).toBeGreaterThan(towers.length);
    expect(arsenalTowers(MISSIONS.find((m) => m.circle)!.id, EMPTY_ARSENAL)).toBeUndefined();
  });
});

describe("campaign payout", () => {
  it("a loss pays half its cleared waves; XP counts built towers", async () => {
    const { settleCampaign, playXp } = await import("./arsenal-store");
    const game = new Game(MISSIONS[0]);
    game.state.wave = 4;
    expect(settleCampaign(game, false, false)).toBe("+4 Salvage");
    game.state.towers.push({ type: "pulse", kills: 7 } as never);
    expect(playXp(game).pulse).toBeGreaterThanOrEqual(7);
  });
});
