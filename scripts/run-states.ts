/**
 * Run states for the browser checks (`menu-fit-check.ts`): a run standing at each reward, camp and act screen, built
 * through the run's own pure transitions, so every state is one a player can reach. Stored under `ion-bastion:run`.
 */
import { DEFAULT_CONTENT } from "../src/content";
import type { TowerId } from "../src/core/types";
import { rewardSteps } from "../src/run/rewards";
import { chooseNode, chooseStarter, continueRun, finishMission, gainRelic, mapChoices, newRun, pickRelic, pickTower, rosterCap, type RunState } from "../src/run/run";
import { RANK_XP } from "../src/run/tuning";
const content = DEFAULT_CONTENT;
const win = (run: RunState): RunState =>
  finishMission(run, { won: true, lives: Math.max(1, run.reactor - 2), kills: Object.fromEntries(run.roster.map((id) => [id, 40])), built: run.roster, stars: 2 }, content);
/** Walks the map, taking the first lane of the wanted kind where there is one, and clears every reward with the first offer. */
function walkTo(seed: number, stop: (run: RunState) => boolean, prefer: string[] = []): RunState {
  let run = chooseStarter(newRun(seed, { length: "full" }, content), 0);
  for (let guard = 0; guard < 200 && !stop(run); guard++) {
    if (run.phase === "map") {
      const choices = mapChoices(run, content),
        node = choices.find((n) => prefer.includes(n.kind)) ?? choices.find((n) => n.kind !== "event") ?? choices[0];
      run = chooseNode(run, node.lane, content);
    } else if (run.phase === "mission") run = win(run);
    else if (run.phase === "reward" || run.phase === "act" || run.phase === "camp") {
      if (run.offers.towers) run = pickTower(run, run.offers.towers[0], run.roster.length >= rosterCap(run) ? run.roster[run.roster.length - 1] : undefined);
      else if (run.offers.relics) run = pickRelic(run, "relics", run.offers.relics[0]);
      else if (run.offers.prize) run = pickRelic(run, "prize", null);
      else if (run.offers.legendary) run = pickRelic(run, "legendary", run.offers.legendary[0]);
      else run = continueRun(run, content);
    } else break;
  }
  return run;
}
const rich = (run: RunState): RunState => ({
  ...run,
  scrap: 140,
  ranks: Object.fromEntries(run.roster.map((id, i) => [id, RANK_XP[Math.min(3, i)] + 20])) as Partial<Record<TowerId, number>>,
  doctrines: run.roster[0] ? [...run.doctrines.filter((d) => !d.startsWith(`${run.roster[0]}:`))] : run.doctrines,
});
/** A run on the act map with the act boss as its next node (the inspector previews the boss's technology). */
export function bossMapState(): RunState {
  return rich(walkTo(4, (r) => r.phase === "map" && r.column === 3));
}
/** A run on the act map with the second mission column next (its card sits beside the middle of the map). */
export function midMapState(): RunState {
  return rich(walkTo(4, (r) => r.phase === "map" && r.column === 1));
}
export function runStates(): Record<string, RunState> {
  const out: Record<string, RunState> = {};
  const draft = walkTo(3, (r) => r.phase === "reward" && !!r.offers.towers);
  out.draft = rich(draft);
  // The second regular reward carries a relic.
  out.relic = rich(pickTower(walkTo(3, (r) => r.phase === "reward" && !!r.offers.relics), null));
  const full = walkTo(5, (r) => r.phase === "reward" && !!r.offers.towers && r.roster.length >= rosterCap(r));
  out.replace = { ...rich(full), mods: [{ tower: full.roster[0], kind: "drill" }], doctrines: [] };
  out.elite = rich(walkTo(7, (r) => r.phase === "reward" && !!r.offers.prize, ["elite"]));
  for (let seed = 1; seed < 40 && !(out.shop && out.forge && out.repair && out.event); seed++)
    for (const kind of ["shop", "forge", "repair", "event"] as const)
      if (!out[kind]) {
        const camp = walkTo(seed, (r) => r.phase === "camp" && r.node?.kind === kind, [kind]);
        if (camp.phase === "camp" && camp.node?.kind === kind) out[kind] = rich(camp);
      }
  out.act = rich(walkTo(4, (r) => r.phase === "act"));
  const master = walkTo(4, (r) => r.phase === "reward" && r.node?.kind === "boss");
  out.master = continueRun(gainRelic(master, "master"), content);
  const doctrine = walkTo(11, (r) => r.phase === "reward" && !!r.offers.doctrine);
  out.doctrine = rich(pickRelic(pickTower(doctrine, null), "relics", null));
  for (const [k, r] of Object.entries(out)) if (!rewardSteps(r).length && r.phase !== "camp") throw new Error(`run state ${k} has no pending decision (${r.phase})`);
  return out;
}
