// The Run page's first screens: the intro (length, threat, seed, daily, history) and the starter pack.
import { MAX_THREAT, THREAT_TEXT } from "../../run/ascension";
import { DAILY_THREAT, dailyDate } from "../../run/daily";
import { missionsOf } from "../../run/map";
import { seedText } from "../../run/rng";
import type { RunState } from "../../run/run";
import { dailyPlayed, runRecord, unlocks } from "../../run/storage";
import { escape } from "../format";
import { page } from "./state";
import { towerChip, towerName } from "./pieces";
export function introHtml() {
  const record = runRecord(),
    u = unlocks(record),
    date = dailyDate(new Date()),
    played = dailyPlayed(record, date),
    levels = Array.from({ length: Math.min(MAX_THREAT, u.threat) + 1 }, (_, i) => `<option value="${i}"${i === page.threat ? " selected" : ""}>${i} · ${escape(THREAT_TEXT[i])}</option>`).join("");
  const history = record.history.length
    ? `<h2 class="run-step-title">Recent runs</h2><ol class="run-history">${record.history
        .map(
          (h) =>
            `<li data-won="${h.won}"><span>${h.daily ? escape(h.daily) : seedText(h.seed)}</span>${h.length === "short" ? "Short" : "Full"}${h.threat ? ` · Threat ${h.threat}` : ""}<b>${h.won ? "Won" : `${h.depth}/${missionsOf(h.length)}`}</b>${
              h.daily ? "" : `<button class="quiet run-mini" data-run="seed:${h.seed}">Play seed</button>`
            }</li>`,
        )
        .join("")}</ol>`
    : "";
  return `<div class="run-intro"><p>Ten missions in three acts and a Final Stand, on campaign maps with waves generated from each map's enemies. You start with three towers. Every win drafts another, earns Scrap and rank XP, and every second one a relic; Doctrines unlock a tower's specialization path. The reactor's damage carries from mission to mission, and <b>one lost mission ends the run</b>.</p>
<div class="run-options"><fieldset class="run-length"><legend>Length</legend><label><input type="radio" name="run-length" value="full"${page.length === "full" && u.full ? " checked" : ""}${u.full ? "" : " disabled"}> Full run <small>10 missions${u.full ? "" : " · win a short run first"}</small></label><label><input type="radio" name="run-length" value="short"${page.length === "short" || !u.full ? " checked" : ""}> Short run <small>act I, 3 missions</small></label></fieldset>
<label class="run-threat">Threat <select name="run-threat"${u.threat ? "" : " disabled"}>${levels}</select></label></div>
<div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button><form id="run-seed-form" class="run-seed"><label for="run-seed">Seed</label><input id="run-seed" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="4F2K9Q"><button class="quiet">Play seed</button></form>${
    u.daily
      ? `<button class="quiet run-daily" data-run="daily"${played ? " disabled" : ""}>Daily run <small>${played ? `played · ${record.daily[date]}/3` : `${date} · threat ${DAILY_THREAT}`}</small></button>`
      : ""
  }</div>
${record.runs ? `<p class="run-record">Runs <b>${record.runs}</b> · Best full run <b>${record.best}/${missionsOf("full")}</b> · Won <b>${record.wins}</b> full, <b>${record.shortWins}</b> short${u.threat ? ` · Threat unlocked <b>${u.threat}</b>` : ""}</p>` : ""}${history}</div>`;
}
export function starterHtml(r: RunState) {
  return `<h2 class="run-step-title">Choose your starter pack</h2><div class="run-cards">${(r.offers.starters ?? [])
    .map(
      (pack, i) =>
        `<button class="choice-card run-card" data-run="starter:${i}"><span class="choice-index">PACK ${String(i + 1).padStart(2, "0")}</span><strong>${pack.map(towerName).join(" · ")}</strong><ul class="run-chips">${pack.map((id) => towerChip(r, id)).join("")}</ul></button>`,
    )
    .join("")}</div>`;
}
