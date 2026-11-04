// The end of a run: its log and the record.
import { missionsOf } from "../../run/map";
import { runDepth, type RunState } from "../../run/run";
import { runRecord } from "../../run/storage";
import { escape } from "../format";
import { KIND, page, STARS } from "./state";
export function endHtml(r: RunState) {
  const won = r.phase === "won",
    depth = runDepth(r),
    total = missionsOf(r.length),
    record = runRecord(),
    lines = r.log
      .map((h, i) => {
        const name = page.host.content.missions.find((m) => m.id === h.mission)?.map.name ?? h.mission;
        return `<li data-won="${h.won}"><span>${i + 1}</span>${escape(name)} <small>${KIND[h.kind].label}</small><small>⚡ ${h.start} → ${h.end}</small>${h.stars ? `<small>${STARS(h.stars)}</small>` : ""}<b>${h.won ? "Cleared" : `Lost${h.wave ? ` at wave ${h.wave}` : ""}`}</b></li>`;
      })
      .join(""),
    kills = r.log.reduce((n, h) => n + h.kills, 0),
    scrap = r.log.reduce((n, h) => n + h.scrap, 0);
  return `<div class="run-end" data-won="${won}"><p class="eyebrow">${won ? "RUN COMPLETE" : "RUN OVER"}</p><h2>${won ? "Every line held." : `${depth} of ${total} missions cleared.`}</h2><p class="run-facts">${kills} enemies destroyed · ◈ ${scrap} Scrap earned · ${r.relics.length} relics · ${r.doctrines.length} Doctrines</p><ol class="run-history">${lines}</ol><p class="run-record">Best full run <b>${record.best}/${missionsOf("full")}</b> · Won <b>${record.wins}</b> full, <b>${record.shortWins}</b> short · Runs <b>${record.runs}</b></p><div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button>${
    r.daily ? "" : `<button class="quiet" data-run="seed:${r.seed}">Replay this seed</button>`
  }<button class="quiet" data-run="clear">Close</button></div></div>`;
}
