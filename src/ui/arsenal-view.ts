// The Arsenal page (`/#arsenal`): research towers with Salvage and forge gear marks for towers with veterancy. A band
// (Salvage, collection, slots, bounty, the way onward), the collection (branch tabs, filters, tiles) and the selected
// tower's detail. The regions are built once and updated in place, so selection, tab, filter, focus and scroll survive
// a purchase. Lazy-loaded by `app/menu-nav.ts`; the pure parts live in `ui/arsenal/model.ts`.
import "./arsenal.css";
import { bountyToday, loadArsenal, updateArsenal } from "../app/arsenal-store";
import { campaignRecord } from "../app/progress";
import { rovingKeys } from "../app/roving-keys";
import { forge, markOf, owns, research } from "../campaign/arsenal";
import { slotsOf } from "../campaign/loadout";
import { SECTORS } from "../content/missions";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { detailParts } from "./arsenal/detail";
import { type ArsenalFilter, arsenalTiles, branchCounts, defaultTile, forgeBlock, matchesFilter, researchBlock } from "./arsenal/model";
import { filtersHtml, tabsHtml, tileHtml } from "./arsenal/tiles";
import { escape, number } from "./format";
import { ROMAN } from "./gear-text";

export interface ArsenalOptions {
  /** The campaign mission to go on with (started through the app's `data-mission` click). */
  next?: MissionDefinition;
  /** The mission whose briefing opened the page: a Back button returns to it instead. */
  briefing?: MissionDefinition;
  /** The name of the mission whose debrief opened the page, likewise. */
  debrief?: string;
  /** A campaign mission is under way: purchases apply from its next start or Restart. */
  underway?: boolean;
}

interface View {
  root: HTMLElement;
  content: ContentPack;
  opts: ArsenalOptions;
  tab: number;
  filter: ArsenalFilter;
  selected: TowerId;
}
let view: View | undefined;
let quiet: number | undefined;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = <T extends HTMLElement>(root: HTMLElement, sel: string) => root.querySelector<T>(sel)!;

const SKELETON = `<div class="ars">
<div class="ars-band"><div class="ars-salvage"><span class="ars-k">Salvage</span><b class="ars-salvage-n"></b></div><dl class="ars-facts"></dl><p class="ars-status" role="status"></p><div class="ars-onward"></div></div>
<section class="ars-panel ars-collection" aria-label="Towers"><div class="ars-bar"><div class="ars-tabs" role="tablist" aria-label="Tower branches"></div><div class="ars-filters" role="group" aria-label="Show"></div></div><ul class="ars-tiles" id="ars-tiles" role="tabpanel"></ul></section>
<section class="ars-panel ars-detail" aria-labelledby="ars-d-name" tabindex="-1"><header class="ars-d-head"></header><div class="ars-d-body"></div><footer class="ars-d-foot"></footer></section>
</div>`;

/** Opens the page: selects the first tower with a purchase ready (else the first owned one) on the "All" filter. */
export function renderArsenal(root: HTMLElement, content: ContentPack, opts: ArsenalOptions = {}) {
  // Picked (and stored) before the Arsenal is read, so the page shows today's bounty.
  const bounty = bountyToday(),
    tiles = arsenalTiles(loadArsenal(), content),
    pick = defaultTile(tiles)!;
  view = { root, content, opts, tab: pick.page, filter: "all", selected: pick.id };
  if (!root.dataset.ready) {
    root.dataset.ready = "1";
    root.innerHTML = SKELETON;
    bind(root);
  }
  const record = campaignRecord(),
    slots = slotsOf(record, content.sectors ?? SECTORS),
    mission = bounty && content.missions.find((m) => m.id === bounty.id),
    owned = tiles.filter((t) => t.owned).length;
  $(root, ".ars-facts").innerHTML = [
    `<div class="ars-fact ars-owned"><dt>Towers</dt><dd><b class="ars-owned-n">${owned}</b><small>/${tiles.length}<span class="ars-fit"> towers</span></small></dd></div>`,
    `<div class="ars-fact"><dt>Loadout</dt><dd><b>${slots}</b> <small>slots</small></dd></div>`,
    mission
      ? `<div class="ars-fact ars-bounty${bounty!.paid ? " is-paid" : ""}"><dt>Today's bounty</dt><dd><span class="ars-fit">Bounty</span> <span class="ars-bounty-name">${escape(mission.name)}</span> <b>${bounty!.paid ? "paid" : "×2"}</b></dd></div>`
      : "",
  ].join("");
  const { next, briefing, debrief } = opts;
  $(root, ".ars-onward").innerHTML = briefing
    ? `<button class="primary ars-go" data-back><span aria-hidden="true">◀</span> <span class="ars-go-k"><span class="ars-long">Back to b</span><span class="ars-fit">B</span>riefing:</span> <span class="ars-go-name">${escape(briefing.name)}</span></button>`
    : debrief
      ? `<button class="primary ars-go" data-back><span aria-hidden="true">◀</span> <span class="ars-go-k"><span class="ars-long">Back to d</span><span class="ars-fit">D</span>ebrief:</span> <span class="ars-go-name">${escape(debrief)}</span></button>`
      : next
        ? `<button class="primary ars-go" data-mission="${escape(next.id)}"><span class="ars-go-k">Next<span class="ars-long"> mission</span>:</span> <span class="ars-go-name">${escape(next.name)}</span> <span aria-hidden="true">▶</span></button>`
        : "";
  say("");
  update();
  $(root, ".ars-tiles").scrollTop = 0;
  $(root, ".ars-d-body").scrollTop = 0;
}

/** One delegated click listener and the keyboard bars, bound once; they read the current `view`. */
function bind(root: HTMLElement) {
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b || !view || !root.contains(b)) return;
    if (b.dataset.arsTab) setTab(Number(b.dataset.arsTab));
    else if (b.dataset.arsFilter) setFilter(b.dataset.arsFilter as ArsenalFilter);
    else if (b.dataset.arsTile) select(b.dataset.arsTile as TowerId);
    else if (b.dataset.arsBuy) buy(b.dataset.arsBuy as "research" | "forge");
    // `data-back` and `data-mission` bubble on to the app's document handler.
  });
  const focusOn = (sel: string) => root.querySelector<HTMLElement>(sel)?.focus({ preventScroll: false });
  rovingKeys($(root, ".ars-tabs"), "[data-ars-tab]", (el) => (setTab(Number(el.dataset.arsTab)), focusOn(`[data-ars-tab="${el.dataset.arsTab}"]`)));
  rovingKeys($(root, ".ars-filters"), "[data-ars-filter]", (el) => (setFilter(el.dataset.arsFilter as ArsenalFilter), focusOn(`[data-ars-filter="${el.dataset.arsFilter}"]`)));
  rovingKeys($(root, ".ars-tiles"), "[data-ars-tile]", (el) => (select(el.dataset.arsTile as TowerId), focusOn(`[data-ars-tile="${el.dataset.arsTile}"]`)), { vertical: true });
}

function setTab(tab: number) {
  const v = view!;
  if (v.tab === tab) return;
  v.tab = tab;
  // The detail follows the tab: its first ready tower, else its first shown one.
  const shown = arsenalTiles(loadArsenal(), v.content).filter((t) => t.page === tab && matchesFilter(t, v.filter));
  const pick = shown.find((t) => t.ready) ?? shown[0];
  if (pick) v.selected = pick.id;
  update({ resetDetail: !!pick });
}
function setFilter(filter: ArsenalFilter) {
  view!.filter = filter;
  update();
}
function select(id: TowerId) {
  if (view!.selected === id) return;
  view!.selected = id;
  update({ resetDetail: true });
}

/** The status line; cleared after a while so it never goes stale. */
function say(text: string) {
  if (!view) return;
  const el = $(view.root, ".ars-status");
  el.textContent = text;
  clearTimeout(quiet);
  if (text) quiet = window.setTimeout(() => (el.textContent = ""), 6000);
}

function buy(kind: "research" | "forge") {
  const v = view!,
    id = v.selected,
    name = v.content.towers[id].name,
    now = loadArsenal(),
    apply = kind === "research" ? research : forge,
    want = apply(now, id);
  if (want === now) {
    // The button is aria-disabled: say why instead.
    const why = kind === "research" ? researchBlock(now, id)?.reason : forgeBlock(now, id, v.content)?.reason;
    return say(why ? `${name}: ${why}.` : "");
  }
  const saved = updateArsenal((a) => apply(a, id)),
    mark = markOf(saved, id),
    ok = kind === "research" ? owns(saved, id) : mark > markOf(now, id);
  if (!ok) return say("Not saved: this browser refused to store the purchase. Nothing was spent.");
  say(kind === "research" ? `${name} researched.` : `${name}: Mk ${ROMAN[mark - 1]} forged.`);
  update({ flare: kind === "research" ? 0 : mark });
}

/** The focused control as a selector, so it can be focused again after its region is rebuilt. */
function focusKey(root: HTMLElement) {
  const f = document.activeElement as HTMLElement | null;
  if (!f || !root.contains(f)) return undefined;
  for (const key of ["arsTab", "arsFilter", "arsTile", "arsBuy"] as const) {
    const v = f.dataset[key];
    if (v !== undefined) return `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${v}"]`;
  }
  return undefined;
}

/**
 * Fills the regions from the stored Arsenal. `flare`: a purchase just happened (0 research, n the mark forged), so the
 * tile and the changed node flare once; `resetDetail`: another tower is shown, its body starts at the top.
 */
function update({ flare, resetDetail = false }: { flare?: number; resetDetail?: boolean } = {}) {
  const v = view!,
    { root, content } = v,
    a = loadArsenal(),
    tiles = arsenalTiles(a, content),
    counts = branchCounts(tiles),
    key = focusKey(root),
    grid = $(root, ".ars-tiles"),
    body = $(root, ".ars-d-body"),
    keep = { grid: grid.scrollTop, body: resetDetail ? 0 : body.scrollTop };
  $(root, ".ars-salvage-n").textContent = number(a.salvage);
  const ownedN = root.querySelector(".ars-owned-n");
  if (ownedN) ownedN.textContent = String(tiles.filter((t) => t.owned).length);
  $(root, ".ars-tabs").innerHTML = tabsHtml(counts, v.tab);
  $(root, ".ars-filters").innerHTML = filtersHtml(v.filter);
  // The selected tower stays in its grid when a purchase moves it out of the filter.
  const shown = tiles.filter((t) => t.page === v.tab && (matchesFilter(t, v.filter) || t.id === v.selected)),
    focusable = shown.some((t) => t.id === v.selected) ? v.selected : shown[0]?.id;
  grid.setAttribute("aria-labelledby", `ars-tab-${v.tab}`);
  grid.innerHTML = shown.length
    ? shown.map((t) => tileHtml(t, content, t.id === v.selected, t.id === focusable)).join("")
    : `<li class="ars-empty">${v.filter === "ready" ? "Nothing to buy here yet. Campaign missions pay Salvage; towers earn XP for their next rank." : "No tower owned here yet: research one under All."}</li>`;
  const d = detailParts(a, v.selected, content, !!v.opts.underway),
    detail = $(root, ".ars-detail");
  detail.style.setProperty("--accent", d.accent);
  $(root, ".ars-d-head").innerHTML = d.head;
  body.innerHTML = d.body;
  $(root, ".ars-d-foot").innerHTML = d.foot;
  grid.scrollTop = keep.grid;
  body.scrollTop = keep.body;
  if (key) {
    const el = root.querySelector<HTMLElement>(key) ?? (key.startsWith("[data-ars-buy") ? root.querySelector<HTMLElement>("[data-ars-buy]") : null);
    // After the last purchase the action row may hold no button: the selected tile takes the focus.
    (el ?? root.querySelector<HTMLElement>(`[data-ars-tile="${v.selected}"]`) ?? detail).focus({ preventScroll: true });
  }
  if (flare !== undefined && !reduced()) {
    const targets = [root.querySelector<HTMLElement>(`[data-ars-tile="${v.selected}"]`), flare ? root.querySelector<HTMLElement>(`[data-ars-node="${flare}"]`) : $(root, ".ars-d-icon"), $(root, ".ars-salvage")];
    for (const el of targets) {
      if (!el) continue;
      el.classList.remove("is-flare");
      void el.offsetWidth;
      el.classList.add("is-flare");
      el.addEventListener("animationend", () => el.classList.remove("is-flare"), { once: true });
    }
    // The changed node in view: a forged mark may sit below the body's fold.
    if (flare) root.querySelector<HTMLElement>(`[data-ars-node="${flare}"]`)?.scrollIntoView({ block: "nearest" });
  }
}
