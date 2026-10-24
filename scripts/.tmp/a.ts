import { DEFAULT_CONTENT as C } from "../../src/content";
import { airCap, runMission } from "../../src/run/generate";
import { chooseStarter, newRun } from "../../src/run/run";
import { threatsOf } from "../../src/run/threats";
const z = C.missions.find((m) => m.map.name === "Zero-G")!;
const run = { ...chooseStarter(newRun(1), 0), roster: ["lance", "mortar", "acid"] as never[] };
console.log("cap", airCap(run.roster, C));
const g = runMission(run, { act: 0, column: 2, lane: 0, kind: "standard", mission: z.id }, C);
console.log(threatsOf(g.mission, g.content, run.roster).map((t) => `${t.id}:${t.share.toFixed(2)}`).join(" "));
