// Builds sample run states for the UI check.
import { writeFileSync } from "node:fs";
import { DEFAULT_CONTENT as C } from "../../src/content";
import { chooseNode, chooseStarter, continueRun, finishMission, mapChoices, newRun, pickRelic, pickTower, type RunState } from "../../src/run/run";
const out: Record<string, RunState> = {};
let run = chooseStarter(newRun(4242, { length: "full" }, C), 0);
out.map = run;
run = chooseNode(run, mapChoices(run, C)[0].lane, C);
out.mission = run;
const win = (r: RunState) => finishMission(r, { won: true, lives: r.reactor - 4, kills: { [r.roster[0]]: 80, [r.roster[1]]: 30 }, built: r.roster, stars: 2 }, C);
run = win(run);
out.reward1 = run;
run = continueRun(pickTower(run, null), C);
// a camp
const camps = mapChoices(run, C);
for (const n of camps) out[`camp-${n.kind}`] = chooseNode(run, n.lane, C);
run = continueRun(out[`camp-${camps[0].kind}`], C);
run = chooseNode(run, mapChoices(run, C)[0].lane, C);
run = win(run);
out.reward2 = run; // relic + doctrine
let r3 = { ...run };
r3 = pickRelic(r3, "relics", r3.offers.relics![0]);
out.boss = { ...r3, phase: "reward", node: { act: 0, column: 4, lane: 1, kind: "boss", mission: run.node!.mission }, offers: {} } as RunState;
out.act = continueRun(out.boss, C);
out.won = { ...run, phase: "won", offers: {} };
out.lost = { ...run, phase: "lost", offers: {}, log: [...run.log, { mission: run.node!.mission!, kind: "standard", act: 0, won: false, start: 20, end: 0, kills: 40, scrap: 0, wave: 9 }] };
writeFileSync(process.argv[2], JSON.stringify(out));
console.log(Object.keys(out).join(" "));
