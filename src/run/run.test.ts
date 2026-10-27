import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { validateMission } from "../core/validation";
import { isSpecialization } from "../core/upgrades";
import { STRATEGIES } from "../core/strategies";
import { creditsAt, runMission, waveCount } from "./generate";
import { mark, newJournal, record } from "./journal";
import { actMap, isMissionKind, missionsOf, nextNodes } from "./map";
import { EVENTS } from "./events";
import { parseSeed, seedText, streamOf } from "./rng";
import {
  abandon,
  chooseNode,
  chooseStarter,
  continueRun,
  doctrineCandidates,
  doctrinePaths,
  eventChoice,
  finishMission,
  mapChoices,
  newRun,
  pickDoctrine,
  pickRelic,
  pickTower,
  repairChoice,
  rosterCap,
  runDepth,
  type RunState,
} from "./run";
import { runMissionId } from "./run-id";
import { buy } from "./shop";
import { mergeRunRecord, parseRun, parseRunRecord, unlocks } from "./storage";
import { rosterCovers } from "./threats";
import { lockSpecializations } from "./transform";
const content = DEFAULT_CONTENT;
/** Plays a run on paper: every mission won with 2 reactor lost, first offers taken, lanes picked by the seed. */
function walk(seed: number, visit: (run: RunState) => void = () => {}, length: "full" | "short" = "full", threat = 0) {
  let run = chooseStarter(newRun(seed, { length, threat }, content), seed % 3);
  for (let guard = 0; guard < 200 && run.phase !== "won" && run.phase !== "lost"; guard++) {
    if (run.phase === "map") {
      const choices = mapChoices(run, content);
      run = chooseNode(run, choices[(seed + guard) % choices.length].lane, content);
    } else if (run.phase === "mission") {
      visit(run);
      run = finishMission(run, { won: true, lives: Math.max(1, run.reactor - 2), kills: { [run.roster[0]]: 40 }, built: run.roster, stars: 2 }, content);
    } else if (run.phase === "reward" || run.phase === "act" || run.phase === "camp") {
      if (run.offers.towers) run = pickTower(run, run.offers.towers[0], run.roster[run.roster.length - 1]);
      if (run.offers.relics) run = pickRelic(run, "relics", run.offers.relics[0]);
      if (run.offers.prize) run = pickRelic(run, "prize", run.offers.prize[0]);
      if (run.offers.legendary) run = pickRelic(run, "legendary", run.offers.legendary[0]);
      if (run.offers.doctrine) {
        const tower = doctrineCandidates(run, content)[0];
        run = pickDoctrine(run, tower ?? null, tower && doctrinePaths(run, tower, content)[0], content);
      }
      if (run.offers.repair) run = repairChoice(run, "heal");
      if (run.offers.event) run = eventChoice(run, 0, content);
      if (run.offers.shop) {
        const i = run.offers.shop.findIndex((s) => !s.sold && s.price <= run.scrap && (s.kind === "funds" || s.kind === "patch"));
        if (i >= 0) run = buy(run, i, content);
      }
      if (run.offers.towers) run = pickTower(run, null);
      run = continueRun(run, content);
    }
  }
  return run;
}
describe("run", () => {
  it("draws the same run from the same seed and choices", () => {
    const missions = (seed: number) => {
      const out: unknown[] = [];
      walk(seed, (run) => out.push(runMission(run, run.node!, content).mission));
      return out;
    };
    expect(missions(7)).toEqual(missions(7));
    expect(streamOf(1, "a")()).not.toBe(streamOf(1, "b")());
    expect(parseSeed(seedText(123456))).toBe(123456);
  });
  it("plays ten valid missions the roster can fight in a full run, three in a short one", () => {
    for (let seed = 1; seed <= 12; seed++) {
      let played = 0;
      const end = walk(seed, (run) => {
        played++;
        const { mission, content: pack } = runMission(run, run.node!, content),
          covers = rosterCovers(mission.availableTowers!, pack);
        expect(() => validateMission(mission, pack)).not.toThrow();
        expect(mission.reactorEnergy).toBe(run.reactor);
        expect(mission.waves.length).toBe(waveCount(run.node!));
        for (const w of mission.waves)
          for (const g of w.groups) {
            const e = pack.enemies[g.type];
            if (e.layer === "air") expect(covers.air).toBe(true);
            if (e.traits?.some((t) => t.kind === "stealth")) expect(covers.detect && run.node!.act > 0).toBe(true);
          }
      });
      expect(end.phase).toBe("won");
      expect(played).toBe(missionsOf("full"));
      expect(runDepth(end)).toBe(10);
    }
    expect(runDepth(walk(3, undefined, "short"))).toBe(3);
  });
  it("starts with short missions that grow with the run, whatever the roster", () => {
    const firsts: number[] = [];
    let last = 0;
    walk(4, (run) => {
      const node = run.node!;
      last = runMission(run, node, content).mission.waves.length;
      expect(runMission({ ...run, roster: run.roster.slice(0, 3) }, node, content).mission.waves.length).toBe(last);
      if (node.column === 0) firsts.push(last - (node.kind === "elite" ? 1 : 0));
    });
    // Every act opens longer than the one before and ends on the Final Stand's 20.
    expect(firsts[0]).toBe(5);
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).toBeGreaterThan(firsts[i - 1]);
    expect(last).toBe(20);
  });
  it("builds act maps whose lanes are all reachable and offer a Shop or Repair before the boss", () => {
    for (let seed = 1; seed <= 200; seed++)
      for (let act = 0; act < 3; act++) {
        const map = actMap(seed, act, content);
        expect(map.map((c) => c.length)).toEqual([3, 3, 3, 3, 1]);
        for (const node of map[2]) expect(nextNodes(map, 2, node.lane).some((n) => n.kind === "shop" || n.kind === "repair")).toBe(true);
        const sources = map.flat().filter((n) => isMissionKind(n.kind)).map((n) => n.mission);
        expect(new Set(sources).size).toBe(sources.length);
      }
    expect(actMap(5, 3, content)).toHaveLength(1);
  });
  it("enters a hot drop with about the credits strategy A had at that wave", () => {
    for (const id of ["outpost-07", "kernfestung", "frostwall", "korallengraben"].filter((id) => content.missions.some((m) => m.id === id)).slice(0, 3)) {
      const source = content.missions.find((m) => m.id === id)!,
        strategy = STRATEGIES[id]?.A,
        wave = Math.round(source.waves.length * 0.15);
      if (!strategy) continue;
      const g = new Game(source, content);
      for (const b of strategy.builds) g.command({ type: "build", ...b });
      while (g.state.wave < wave && g.state.status !== "lost") {
        g.command({ type: "start" });
        while (g.state.status === "wave") g.tick();
      }
      const earned = g.state.wallets[0] + g.state.towers.reduce((n, t) => n + (t.spent ?? 0), 0);
      expect(Math.abs(creditsAt(source, wave, content) - earned) / earned).toBeLessThan(0.25);
    }
  });
  it("locks levels 6–8 behind Doctrines", () => {
    const pack = lockSpecializations(["frost:" + doctrinePaths({ ...newRun(1), roster: ["frost"] }, "frost", content)[0]])(content);
    const paths = (id: string) => new Set(pack.towers[id as "frost"].upgrades.filter(isSpecialization).map((u) => u.path));
    expect(paths("frost").size).toBe(1);
    expect(paths("pulse").size).toBe(0);
    expect(content.towers.pulse.upgrades.some(isSpecialization)).toBe(true);
  });
  it("needs a replacement at the roster cap and keeps reward, camp and event transitions valid", () => {
    let run: RunState = { ...chooseStarter(newRun(9), 0), phase: "reward", roster: ["pulse", "blast", "frost", "flak", "tesla", "lance"], offers: { towers: ["mortar"] } };
    expect(run.roster.length).toBe(rosterCap(run));
    expect(pickTower(run, "mortar")).toBe(run);
    run = pickTower(run, "mortar", "lance");
    expect(run.roster).toContain("mortar");
    expect(run.roster).not.toContain("lance");
    const camp: RunState = { ...run, phase: "camp", scrap: 200 };
    for (const event of EVENTS)
      for (let i = 0; i < event.choices(camp, content).length; i++) {
        const next = eventChoice({ ...camp, offers: { event: event.id } }, i, content);
        expect(next.scrap).toBeGreaterThanOrEqual(0);
        expect(next.reactor).toBeGreaterThanOrEqual(1);
        expect(next.roster.length).toBeLessThanOrEqual(rosterCap(next));
      }
  });
  it("ends the run on a loss and records it", () => {
    let run = chooseStarter(newRun(4), 0);
    run = chooseNode(run, mapChoices(run, content)[0].lane, content);
    const lost = finishMission(run, { won: false, lives: 0, kills: {}, built: [] }, content);
    expect(lost.phase).toBe("lost");
    const record = mergeRunRecord(parseRunRecord(null), lost);
    expect(record.runs).toBe(1);
    expect(unlocks(record).full).toBe(false);
    expect(abandon(run).phase).toBe("lost");
  });
  it("stores runs, and continues a version 1 run as a short run", () => {
    const run = walk(2, undefined, "short");
    expect(parseRun(JSON.stringify(run), content)).toEqual(run);
    expect(parseRun("{broken", content)).toBeUndefined();
    const v1 = { v: 1, seed: 5, step: 1, phase: "route", roster: ["pulse", "blast", "frost"], relics: ["salvage"], offers: {}, history: [{ mission: "x", kind: "normal", won: true }] };
    const migrated = parseRun(JSON.stringify(v1), content)!;
    expect(migrated.length).toBe("short");
    expect(migrated.roster).toEqual(["pulse", "blast", "frost"]);
    expect(mapChoices(migrated, content).length).toBeGreaterThan(0);
  });
  it("replays a journaled mission to the same state", () => {
    let run = chooseStarter(newRun(11), 0);
    run = chooseNode(run, mapChoices(run, content)[0].lane, content);
    const { mission, content: pack } = runMission(run, run.node!, content),
      live = new Game(content.missions[0], content);
    live.command({ type: "run", mission, content: pack });
    let journal = newJournal(mission.id);
    const apply = (c: Parameters<Game["command"]>[0]) => {
      if (live.command(c).ok) journal = record(journal, live.ticks, c);
    };
    const free = [...mission.map.path.flatMap((p) => [{ x: p.x, y: p.y - 1 }, { x: p.x + 1, y: p.y }])].find((c) => live.canBuild(c.x, c.y, mission.availableTowers![0]))!;
    apply({ type: "build", tower: mission.availableTowers![0], x: free.x, y: free.y });
    apply({ type: "start" });
    for (let i = 0; i < 400; i++) live.tick();
    apply({ type: "pause" });
    apply({ type: "pause" });
    for (let i = 0; i < 200; i++) live.tick();
    journal = mark(journal, live.ticks, stateHash(live.state), live.state.wave);
    const again = new Game(content.missions[0], content);
    again.command({ type: "run", mission, content: pack, replay: journal });
    expect(stateHash(again.state)).toBe(journal.hash);
    expect(runMissionId(run)).toBe(mission.id);
  });
});
