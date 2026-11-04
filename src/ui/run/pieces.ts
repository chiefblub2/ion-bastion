// Pieces every Run screen shows: tower and relic chips, the run's status bar, Abandon.
import type { TowerId } from "../../core/types";
import { missionsOf } from "../../run/map";
import { MASTERY, MAX_RANK, nextRankAt, rankText } from "../../run/ranks";
import { relicOf, type RelicId } from "../../run/relics";
import { seedText } from "../../run/rng";
import { rankOfTower, rosterCap, runDepth, type RunState } from "../../run/run";
import { escape } from "../format";
import { towerIconHtml } from "../tower-codex";
import { page } from "./state";
export const towerName = (id: TowerId) => page.host.content.towers[id].name;
const pips = (id: TowerId, rank: number) =>
  rank ? `<span class="run-rank"${rank >= 4 && MASTERY[id] ? " data-mastery" : ""} title="Rank ${rank}: ${escape(rankText(id, rank))}">${"▮".repeat(rank)}${"▯".repeat(MAX_RANK - rank)}</span>` : "";
export function towerChip(r: RunState, id: TowerId, extra = "") {
  const d = page.host.content.towers[id],
    doctrines = r.doctrines.filter((x) => x.startsWith(`${id}:`)).map((x) => d.visual.paths?.[x.split(":")[1]]?.name ?? x.split(":")[1]);
  return `<li class="run-chip" title="${escape(`${d.role}. ${rankHint(r.ranks[id])}`)}">${towerIconHtml(d)}<span>${escape(d.name)}</span>${pips(id, rankOfTower(r, id))}${
    doctrines.length ? `<em class="run-doctrine-tag">${escape(doctrines.join(" + "))}</em>` : ""
  }${extra}</li>`;
}
function relicChip(id: RelicId) {
  const r = relicOf(id);
  return `<li class="run-chip run-relic" data-rarity="${r.rarity}" title="${escape(r.description)}"><i aria-hidden="true">${r.icon}</i><span>${escape(r.name)}</span></li>`;
}
export function statusHtml(r: RunState) {
  const total = missionsOf(r.length),
    depth = runDepth(r),
    acts = r.length === "short" ? ["I"] : ["I", "II", "III", "Final"],
    actStrip = acts.map((label, i) => `<li data-state="${i < r.act || r.phase === "won" ? "won" : i === r.act ? "current" : "open"}">${label}</li>`).join(""),
    reactor = Math.round((100 * r.reactor) / r.reactorMax);
  return `<section class="run-status" aria-label="This run"><div class="run-meta"><span>${r.daily ? `DAILY <b>${r.daily}</b>` : `SEED <b>${seedText(r.seed)}</b>`}${r.threat ? ` · THREAT <b>${r.threat}</b>` : ""}${r.length === "short" ? " · SHORT RUN" : ""}</span><ol class="run-steps run-acts" aria-label="Acts">${actStrip}</ol><span>MISSION <b>${Math.min(depth + (r.phase === "won" ? 0 : 1), total)}/${total}</b></span></div>
<div class="run-gauges"><div class="run-gauge" title="Reactor energy carries from mission to mission"><span>REACTOR</span><b>${r.reactor}/${r.reactorMax}</b><i style="--fill:${reactor}%" data-low="${reactor < 35}"></i></div><div class="run-gauge"><span>SCRAP</span><b>◈ ${r.scrap}</b></div><div class="run-gauge"><span>ROSTER</span><b>${r.roster.length}/${rosterCap(r)}</b></div>${
    r.funds ? `<div class="run-gauge"><span>NEXT MISSION</span><b>+◇ ${r.funds}</b></div>` : ""
  }${r.loan ? `<div class="run-gauge"><span>ON LOAN</span><b>${escape(towerName(r.loan))}</b></div>` : ""}</div>${
    r.roster.length ? `<div class="run-carry"><h2>Roster</h2><ul class="run-chips">${r.roster.map((id) => towerChip(r, id)).join("")}</ul></div>` : ""
  }${r.relics.length ? `<div class="run-carry"><h2>Relics</h2><ul class="run-chips">${r.relics.map(relicChip).join("")}</ul></div>` : ""}</section>`;
}
export const abandonHtml = () => `<button class="quiet run-abandon" data-run="abandon">${page.armed === "abandon" ? "Press again to abandon the run" : "Abandon run"}</button>`;
/** How far a tower type is from its next rank. */
export const rankHint = (xp?: number) => {
  const next = nextRankAt(xp);
  return next === undefined ? "Top rank." : `${next - (xp ?? 0)} XP to the next rank.`;
};
