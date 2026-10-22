import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { validateMission } from "../core/validation";
import { isSupport } from "../systems/attacks";
import { rosterCovers, runMission } from "./generate";
import { applyRelics } from "./relics";
import { parseSeed, seedText, streamOf } from "./rng";
import { chooseRoute, chooseStarter, finishMission, newRun, pickRelic, pickTower, RUN_LENGTH, type RunState } from "./run";
import { runMissionId } from "./run-id";
import { settleRun } from "./session";
import { loadRun, parseRun, runRecord, saveRun } from "./storage";
const content = DEFAULT_CONTENT;
/** Plays a run to its end on paper: every mission won, first offers taken. */
function walk(seed: number, visit: (run: RunState) => void) {
  let run = chooseStarter(newRun(seed), seed % 3, content);
  while (run.phase === "route") {
    run = chooseRoute(run, seed % 2);
    visit(run);
    run = finishMission(run, true, content);
    if (run.phase === "reward") {
      run = pickTower(run, run.offers.towers![0], content);
      if (run.offers.relics) run = pickRelic(run, run.offers.relics[0], content);
    }
  }
  return run;
}
describe("run", () => {
  it("draws the same offers from the same seed", () => {
    expect(newRun(42)).toEqual(newRun(42));
    expect(streamOf(1, "a")()).not.toBe(streamOf(1, "b")());
    expect(parseSeed(seedText(123456))).toBe(123456);
  });
  it("generates valid missions the roster can fight on every step", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const end = walk(seed, (run) => {
        const { mission, content: pack } = runMission(run, run.node!, content),
          covers = rosterCovers(run.roster, pack);
        expect(() => validateMission(mission, pack)).not.toThrow();
        expect(mission.availableTowers).toEqual(run.roster);
        for (const group of mission.waves.flatMap((w) => w.groups)) {
          const e = pack.enemies[group.type];
          if (e.layer === "air") expect(covers.air).toBe(true);
          if (e.traits?.some((t) => t.kind === "stealth" || t.kind === "cloakField")) expect(covers.detect).toBe(true);
        }
      });
      expect(end.phase).toBe("won");
      expect(end.history).toHaveLength(RUN_LENGTH);
      expect(new Set(end.history.map((h) => h.mission)).size).toBe(RUN_LENGTH);
    }
  });
  it("starts with a pack that hits flyers and ends on a loss", () => {
    let run = chooseStarter(newRun(7), 0, content);
    expect(run.roster.some((id) => !isSupport(content.towers[id].attack) && content.towers[id].targets.includes("air"))).toBe(true);
    run = finishMission(chooseRoute(run, 0), false, content);
    expect(run.phase).toBe("lost");
  });
  it("applies relics to a fresh pack and the mission", () => {
    const m = content.missions[0],
      { content: pack, mission } = applyRelics(content, m, ["salvage", "capacitor", "plating"]);
    expect(pack).not.toBe(content);
    expect(pack.towers.pulse.cost).toBe(Math.round(content.towers.pulse.cost * 0.85));
    const level = (c: typeof content) => c.towers.pulse.upgrades.find((u) => u.effects.stats?.damage)!.effects.stats!.damage!;
    expect(level(pack)).toBe(Math.round(level(content) * 1.12));
    expect(content.towers.pulse.cost).toBe(80);
    expect(mission.reactorEnergy).toBe(m.reactorEnergy + 5);
  });
  it("loads a run mission with its own pack in solo only", () => {
    const run = chooseRoute(chooseStarter(newRun(3), 0, content), 0),
      { mission, content: pack } = runMission(run, run.node!, content),
      game = new Game();
    expect(game.command({ type: "run", mission, content: pack }).ok).toBe(true);
    expect(game.content).toBe(pack);
    expect(game.command({ type: "mission", id: content.missions[0].id }).ok).toBe(true);
    expect(game.content).toBe(content);
    game.setPlayers(2);
    expect(game.command({ type: "run", mission, content: pack }).code).toBe("run-solo");
  });
  it("reads back a stored run and rejects corrupt ones", () => {
    const run = chooseStarter(newRun(9), 1, content);
    expect(parseRun(JSON.stringify(run), content)).toEqual(run);
    expect(parseRun(JSON.stringify({ ...run, roster: ["nope"] }), content)).toBeUndefined();
    expect(parseRun("{", content)).toBeUndefined();
  });
  it("settles the stored run when its mission ends", () => {
    const store = new Map<string, string>();
    globalThis.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } as unknown as Storage;
    try {
      const run = chooseRoute(chooseStarter(newRun(11), 0, content), 0);
      saveRun(run);
      settleRun("run:other:0", true, content);
      expect(loadRun(content)?.phase).toBe("mission");
      expect(settleRun(runMissionId(run), true, content)?.phase).toBe("reward");
      saveRun(run);
      settleRun(runMissionId(run), false, content);
      expect(loadRun(content)?.phase).toBe("lost");
      expect(runRecord()).toEqual({ best: 0, wins: 0, runs: 1 });
    } finally {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });
});
