// The campaign-complete page (`/#victory`): a short congratulation, the campaign's totals and what to do next. Rendered
// from `campaignTotals` alone (`campaign/finale.ts`), so a reload shows it again.
import "./victory.css";
import type { CampaignTotals } from "../campaign/finale";
import { starText } from "../campaign/rating";
import { escape, number } from "./format";

/** The first campaign mission still under three stars: the three-star hunt's target. */
export interface Hunt {
  id: string;
  name: string;
  stars: number;
}
export function renderVictory(root: HTMLElement, t: CampaignTotals, hunt: Hunt | undefined) {
  const tile = (label: string, value: number, of: number) =>
    `<li class="vc-tile"><span class="vc-k">${label}</span><b>${number(value)}<small> / ${number(of)}</small></b></li>`;
  root.innerHTML = `<div class="vc">
<section class="vc-hero"><p class="vc-lead">All ${t.missions} missions held. The reactor still burns.</p><p class="vc-sub">The campaign is complete: every sector secured. The rest is yours to sharpen.</p></section>
<ul class="vc-totals" aria-label="Campaign totals">${[
    tile("Missions won", t.won, t.missions),
    tile("Stars", t.stars, t.maxStars),
    tile("Towers owned", t.owned, t.towers),
    tile("Ranks", t.ranks, t.maxRanks),
    tile("Gear marks", t.marks, t.maxMarks),
  ].join("")}</ul>
<div class="vc-actions">${hunt ? `<button class="primary vc-primary" data-mission="${escape(hunt.id)}"><span class="vc-label"><b>Three-star hunt</b><small>${escape(hunt.name)} <span aria-hidden="true">${starText(hunt.stars)}</span></small></span></button>` : ""}<button class="${hunt ? "quiet" : "primary vc-primary"}" data-victory="circuit">Circuit <span aria-hidden="true">⟳</span></button><button class="quiet" data-victory="run">Run <span aria-hidden="true">✧</span></button><button class="quiet" data-victory="atlas">Back to the atlas</button></div>
<footer class="vc-credits"><p>ION BASTION</p><p>Thank you for playing.</p></footer>
</div>`;
}
/** Puts the focus on the first action. */
export const focusVictory = (root: HTMLElement) => root.querySelector<HTMLElement>(".vc-primary")?.focus({ preventScroll: true });
