// The Arsenal's collection: branch tabs, filters and tower tiles as HTML strings (`ui/arsenal-view.ts` places them).
import type { ContentPack } from "../../core/types";
import { hex } from "../atlas/model";
import { escape, number } from "../format";
import { markPips, rankChevrons } from "../gear-badge";
import { ROMAN } from "../gear-text";
import { towerIconHtml } from "../tower-codex";
import { type ArsenalFilter, type ArsenalTile, type BranchCount, FILTERS } from "./model";

export function tabsHtml(counts: readonly BranchCount[], tab: number) {
  return counts
    .filter((c) => c.total)
    .map((c) => {
      const on = c.page === tab;
      return `<button class="ars-tab" role="tab" id="ars-tab-${c.page}" data-ars-tab="${c.page}" aria-controls="ars-tiles" aria-selected="${on}" tabindex="${on ? 0 : -1}" aria-label="${c.name}: ${c.owned} of ${c.total} owned${c.ready ? `, ${c.ready} ready` : ""}"><span class="ars-tab-name">${c.name}</span><span class="ars-tab-meta" aria-hidden="true"><span class="ars-tab-count">${c.owned}<small>/${c.total}</small></span>${c.ready ? `<b class="ars-tab-ready">${c.ready}</b>` : ""}</span></button>`;
    })
    .join("");
}

export function filtersHtml(filter: ArsenalFilter) {
  return FILTERS.map((f) => {
    const on = f.id === filter;
    return `<button class="ars-filter" data-ars-filter="${f.id}" aria-pressed="${on}" tabindex="${on ? 0 : -1}">${f.name}</button>`;
  }).join("");
}

/** The tile's one status line and its words for a screen reader. */
function statusOf(t: ArsenalTile): { html: string; cls: string; label: string } {
  const s = t.status;
  switch (s.kind) {
    case "research":
      return {
        html: `<b>${number(s.price)}</b> Salvage`,
        cls: s.affordable ? "is-afford" : "is-locked",
        label: `locked, research for ${s.price} Salvage${s.affordable ? ", affordable" : ""}`,
      };
    case "forge":
      return { html: `Forge Mk ${ROMAN[s.mark - 1]}`, cls: "is-forge", label: `Mk ${ROMAN[s.mark - 1]} ready to forge` };
    case "maxed":
      return { html: "Maxed", cls: "is-maxed", label: "all five marks forged" };
    default:
      return { html: t.core ? "Core" : "Owned", cls: "is-owned", label: t.core ? "core kit" : "owned" };
  }
}

export function tileHtml(t: ArsenalTile, content: ContentPack, selected: boolean, focusable: boolean) {
  const st = statusOf(t),
    standing = `${rankChevrons(t.rank)}${markPips(t.mark, t.status.kind === "forge")}`,
    words = [t.rank ? `rank ${t.rank}` : "", t.mark ? `Mk ${ROMAN[t.mark - 1]}` : ""].filter(Boolean).join(", ");
  return `<li><button class="ars-tile ${t.owned ? "is-owned" : "is-locked"}${t.ready ? " is-ready" : ""}" style="--accent:${hex(t.color)}" data-ars-tile="${t.id}" aria-pressed="${selected}" tabindex="${focusable ? 0 : -1}" aria-label="${escape(t.name)}: ${st.label}${words ? `, ${words}` : ""}"><span class="ars-tile-icon" aria-hidden="true">${towerIconHtml(content.towers[t.id])}</span><span class="ars-tile-name">${escape(t.name)}</span><span class="ars-tile-standing" aria-hidden="true">${standing}</span><span class="ars-tile-status ${st.cls}" aria-hidden="true">${st.html}</span></button></li>`;
}
