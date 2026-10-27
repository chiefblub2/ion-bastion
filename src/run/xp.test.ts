import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { MissionDefinition, Tower, TowerId } from "../core/types";
import { applyDamage, hitOf } from "../systems/damage";
import { hasStatus } from "../systems/status";
import { masteryOf, runMission } from "./generate";
import { actMap } from "./map";
import { chooseStarter, finishMission, newRun, type RunState } from "./run";
import { RANK_XP, ASSIST_CAP } from "./tuning";
import { assistsOf } from "./xp";
const content = DEFAULT_CONTENT;
const mission = content.missions[0],
  path = mission.map.path;
let id = 1;
const tower = (type: TowerId, x: number, y: number, kills = 0): Tower => ({ id: id++, type, x, y, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills, owner: 0 });
/** A buildable cell beside the path cell `i`, and one far from every path cell. */
const beside = (i: number) => ({ x: path[i].x, y: path[i].y - 1 });
describe("assist XP", () => {
  it("pays a Control tower a share of the kills of the towers it stands beside, each partner once", () => {
    const at = beside(4),
      towers = [tower("frost", at.x, at.y), tower("pulse", at.x + 1, at.y, 40), tower("blast", at.x - 1, at.y, 20), tower("pulse", at.x + 30, at.y + 30, 100)];
    expect(assistsOf({ towers }, mission, content)).toEqual({ frost: Math.round(60 * 0.35) });
  });
  it("is capped, and nothing for idle or rangeless towers", () => {
    const at = beside(4);
    expect(assistsOf({ towers: [tower("frost", at.x, at.y), tower("pulse", at.x + 1, at.y, 1000)] }, mission, content).frost).toBe(ASSIST_CAP);
    // A Cryo out of reach of the path, beside a scoring tower, earns nothing.
    const far: MissionDefinition = { ...mission, map: { ...mission.map, path: [{ x: 99, y: 99 }] } };
    expect(assistsOf({ towers: [tower("frost", 0, 0), tower("pulse", 1, 0, 50)] }, far, content)).toEqual({});
    expect(assistsOf({ towers: [tower("refinery", at.x, at.y), tower("pulse", at.x + 1, at.y, 50)] }, mission, content)).toEqual({});
    // Attack towers earn their kills, never assists.
    expect(assistsOf({ towers: [tower("pulse", at.x, at.y, 5), tower("blast", at.x + 1, at.y, 50)] }, mission, content)).toEqual({});
  });
  it("adds to the rank XP a won mission pays", () => {
    let run: RunState = chooseStarter(newRun(3, {}, content), 0);
    run = { ...run, roster: ["pulse", "frost"], phase: "mission", node: actMap(run.seed, 0, content)[0][0] };
    const won = finishMission(run, { won: true, lives: 30, kills: { pulse: 30 }, built: ["pulse", "frost"], assists: { frost: 25 }, stars: 3 }, content);
    expect(won.ranks.frost).toBe(25 + 10);
    expect(won.ranks.pulse).toBe(30 + 10);
  });
});
describe("rank 4 mastery", () => {
  it("joins the mission only for mastered types, and their hits apply it", () => {
    const run = { ...chooseStarter(newRun(3, {}, content), 0), roster: ["pulse", "frost", "blast"] as TowerId[], ranks: { pulse: RANK_XP[3], frost: RANK_XP[3], blast: RANK_XP[2] } };
    expect(Object.keys(masteryOf(run) ?? {})).toEqual(["pulse"]);
    const node = actMap(run.seed, 0, content).flat().find((n) => n.mission)!,
      generated = runMission({ ...run, phase: "map" }, node, content);
    expect(generated.mission.protocols?.mastery?.pulse?.kind).toBe("vulnerable");
    // Rank 4 trims a mastered type's damage bonus to +10%.
    expect(generated.content.towers.pulse.damage).toBe(Math.round(content.towers.pulse.damage * 1.1));
    const g = new Game(generated.mission, generated.content),
      e = makeEnemy(1, "drone", 5, 5);
    g.state.enemies.push(e);
    applyDamage(g, { tower: 0, type: "pulse" }, e, 10, false, hitOf("direct", { tower: 0, type: "pulse" }));
    expect(hasStatus(e, "vulnerable", g.state.time)).toBe(true);
  });
});
