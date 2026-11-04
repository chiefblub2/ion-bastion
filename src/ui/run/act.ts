// The act transition between two acts.
import { actName, rosterCap, type RunState } from "../../run/run";
import { escape } from "../format";
import { page } from "./state";
import { continueHtml, pendingDecision } from "./decision";
export function actHtml(r: RunState) {
  const next = r.length === "full" && r.act + 1 >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act + 1]}: ${escape(actName({ act: r.act + 1 }, page.host.content))}`,
    head = `<p class="run-cleared"><b>Act ${["I", "II", "III"][r.act]} cleared</b> · reactor fully repaired (${r.reactor}/${r.reactorMax}) · next: ${next} · roster up to ${rosterCap({ ...r, act: r.act + 1 })} towers</p>`;
  return (
    pendingDecision(r, head) ??
    `<section class="run-decision run-done">${head}<header class="run-decision-head"><p class="choice-index">ACT REWARD CLAIMED</p><h2 class="run-step-title">On to ${next}</h2></header>${continueHtml(r, `On to ${next}`)}</section>`
  );
}
