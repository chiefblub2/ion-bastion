// The mission briefing (`/#briefing`): the mission at a glance, its enemies, needs and rewards, and the loadout
// editor. The flow (`app/campaign-flow.ts`) owns the draft and hands this view everything it shows.
import "./briefing.css";
import { rovingKeys } from "../app/roving-keys";
import { type Arsenal, owns, standingOf } from "../campaign/arsenal";
import { fitsAll, type Kit, needChips, nextSlot } from "../campaign/loadout";
import { payPreview } from "../campaign/pay";
import { starText, starThresholds } from "../campaign/rating";
import type { CampaignRecord } from "../campaign/record";
import { missionNumber, sectorOf } from "../content/missions";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { themeAccent } from "../render/terrain";
import { fillImage } from "./atlas/card";
import { hex, type MapImage, pad, plural, roman } from "./atlas/model";
import { escape } from "./format";
import { gearBadge } from "./gear-badge";
import { mapPreviewSvg, missionEnemies } from "./mission-brief";
import { missionTags } from "./mission-tags";
import { towerIconHtml } from "./tower-codex";
import { pageOf, TOWER_PAGES } from "./tower-pages";
import { enemyIcon } from "./wave-forecast";

export interface BriefingData {
  mission: MissionDefinition;
  /** The base pack: towers, enemies, missions and sectors. */
  content: ContentPack;
  arsenal: Arsenal;
  record: CampaignRecord;
  kit: Kit;
  /** The towers picked now (the whole pool when it fits the slots), without the issued ones. */
  picks: readonly TowerId[];
  /** The fielded towers: picks plus issued, as the `mission` command gets them. */
  fielded: readonly TowerId[];
  /** The loadout tab shown (a `TOWER_PAGES` index). */
  tab: number;
  /** Today's unpaid bounty. */
  bounty: boolean;
  /** Starting resets a game under way. */
  reset: boolean;
  /** A short status line under the tiles (a refused pick, Auto-fill's result). */
  message?: string;
  image: MapImage;
}
export interface BriefingActions {
  toggle(id: TowerId): void;
  tab(page: number): void;
  auto(): void;
  start(): void;
}

/** "★★★ reactor at 90% or more": a star level's threshold in the player's words. */
export function starRule(mission: Pick<MissionDefinition, "circle">, stars: 1 | 2 | 3, short = false) {
  const t = starThresholds(mission),
    pct = (v: number) => `${Math.round(v * 100)}%`;
  if (stars === 1) return short ? "win" : "any win";
  const share = stars === 3 ? t.three : t.two;
  if (short) return t.kind === "energy" ? `≥${pct(share)}` : `≤${pct(share)}`;
  return t.kind === "energy" ? `reactor at ${pct(share)} or more` : `ring never over ${pct(share)} full`;
}

/** The pages the loadout shows: those holding a pool or issued tower. */
const pagesOf = (kit: Kit, content: ContentPack) => TOWER_PAGES.map((_, i) => i).filter((i) => [...kit.pool, ...kit.issued].some((id) => pageOf(content.towers[id]) === i));

/** The loadout column's title, tabs, tiles, status and actions. */
function loadoutHtml(d: BriefingData) {
  const { kit, content, picks, arsenal } = d,
    all = fitsAll(kit),
    pages = pagesOf(kit, content),
    tab = pages.includes(d.tab) ? d.tab : (pages[0] ?? 0),
    count = (page: number) => picks.filter((id) => pageOf(content.towers[id]) === page).length;
  const tabs = pages
    .map((i) => {
      const active = i === tab,
        n = count(i) + kit.issued.filter((id) => pageOf(content.towers[id]) === i).length;
      return `<button class="codex-tab bf-tab" role="tab" id="bf-tab-${i}" data-bf-tab="${i}" aria-controls="bf-tiles" aria-selected="${active}" tabindex="${active ? 0 : -1}">${TOWER_PAGES[i].name}${n ? ` <small>${n}</small>` : ""}</button>`;
    })
    .join("");
  const tile = (id: TowerId) => {
    const t = content.towers[id],
      issued = kit.issued.includes(id),
      on = issued || picks.includes(id),
      lent = kit.special && !owns(arsenal, id),
      tag = issued ? "Issued" : lent ? "Lent" : "",
      inner = `<span class="bf-tile-icon" aria-hidden="true">${towerIconHtml(t)}</span><span class="bf-tile-name">${escape(t.name)}</span><span class="bf-tile-badge">${gearBadge(standingOf(arsenal, id))}</span>${tag ? `<em class="bf-tile-tag">${tag}</em>` : ""}`,
      style = ` style="--accent:${hex(t.color)}"`;
    // Issued towers and a pool that fits the slots are fielded as they are: the tile only informs.
    if (issued || all) return `<li class="bf-tile is-fixed${on ? " is-on" : ""}"${style} data-bf-fixed="${id}" tabindex="-1" aria-label="${escape(t.name)}: ${issued ? "issued for this mission, no slot" : "fielded"}">${inner}</li>`;
    return `<li><button class="bf-tile${on ? " is-on" : ""}"${style} data-bf-tower="${id}" aria-pressed="${on}" aria-label="${escape(t.name)}${lent ? " (lent)" : ""}">${inner}</button></li>`;
  };
  const shown = [...kit.pool, ...kit.issued].filter((id) => pageOf(content.towers[id]) === tab);
  const order = (Object.keys(content.towers) as TowerId[]).filter((id) => shown.includes(id));
  const note = kit.special
    ? `<p class="bf-note bf-special">Special operation: field kit issued${kit.pool.some((id) => !owns(arsenal, id)) ? " · lent towers marked" : ""}</p>`
    : all
      ? `<p class="bf-note">Every tower you own fits: all fielded.</p>`
      : "";
  const empty = !all && !picks.length && kit.pool.length > 0;
  return {
    title: `Loadout <b>${picks.length}</b>/${kit.slots}${kit.issued.length ? ` <small>+ ${kit.issued.map((id) => escape(content.towers[id].name)).join(", ")} issued</small>` : ""}`,
    note,
    tabs,
    tiles: order.map(tile).join(""),
    tab,
    status: d.message ?? (empty ? "Pick at least one tower." : ""),
    empty,
    all,
  };
}

/** The need chips: green with the answering tower, a warning when nothing fielded answers. */
function needsHtml(d: BriefingData) {
  const chips = needChips(d.mission, d.fielded, d.content);
  if (!chips.length) return `<p class="bf-none">No special threats.</p>`;
  return `<ul class="bf-needs">${chips
    .map((c) =>
      c.by.length
        ? `<li class="bf-need is-covered"><b>${c.label}</b><span>${c.by
            .slice(0, 2)
            .map((id) => escape(d.content.towers[id].name))
            .join(", ")}${c.by.length > 2 ? ` +${c.by.length - 2}` : ""}</span></li>`
        : `<li class="bf-need is-open"><b>${c.label}</b><span>Nothing fielded answers it</span></li>`,
    )
    .join("")}</ul>`;
}

/** What a win pays now, each unpaid star, a finale's cache and slot, and the bounty. */
function rewardsHtml(d: BriefingData) {
  const { mission, content, record } = d,
    sectors = content.sectors ?? [],
    p = payPreview(mission, sectors, record, d.bounty),
    best = record[mission.id] ?? 0,
    slot = nextSlot(record, sectors)?.mission.id === mission.id,
    row = (label: string, value: string, cls = "") => `<li${cls ? ` class="${cls}"` : ""}><span>${label}</span><b>${value}</b></li>`;
  const stars = ([3, 2, 1] as const).map((s) =>
      row(
        `<i class="bf-stars" aria-label="${s} ${plural(s, "star")}">${starText(s)}</i> ${starRule(mission, s)}`,
        s > best ? `+${p.perStar}` : "paid",
        `bf-star-row${s > best ? "" : " is-paid"}`,
      ),
    ),
    // The fitted layout's one line for the stars: the thresholds and the pay per new star.
    starSum = row(
      `<i class="bf-stars" aria-hidden="true">★★★</i> ${starRule(mission, 3, true)} <i class="bf-stars" aria-hidden="true">★★</i> ${starRule(mission, 2, true)}`,
      p.starsUnpaid ? `+${p.perStar}/★` : "paid",
      `bf-star-sum${p.starsUnpaid ? "" : " is-paid"}`,
    );
  return `<ul class="bf-rewards">${[
    row(p.first ? "First win" : "Replay win", `+${p.win}`),
    ...stars,
    starSum,
    ...(p.cache ? [row("Sector cache", `+${p.cache}`, "is-extra")] : []),
    ...(slot ? [row("Loadout slot", "+1", "is-extra")] : []),
  ].join("")}</ul>`;
}

/** Fills the page's stable regions once, then the parts a pick changes. */
export function renderBriefing(root: HTMLElement, d: BriefingData, actions: BriefingActions) {
  const { mission: m, content } = d,
    sectors = content.sectors ?? [],
    sector = sectorOf(m, sectors);
  if (!root.dataset.ready) {
    root.dataset.ready = "1";
    root.innerHTML = `<div class="bf">
<section class="bf-col bf-mission" aria-label="Mission"><figure class="bf-map preview-stage"></figure><p class="bf-focus"></p><dl class="brief-stats bf-stats"></dl><ul class="brief-rules bf-rules" aria-label="Special rules"></ul></section>
<section class="bf-col bf-info" aria-label="Intel and rewards"><h2 class="bf-h">Intel <small class="bf-intel-count"></small></h2><ul class="brief-enemies bf-enemies"></ul><h2 class="bf-h">Needs</h2><div class="bf-needs-wrap"></div><h2 class="bf-h">Rewards <small>Salvage</small> <b class="bf-bounty" hidden>×2 Bounty</b></h2><div class="bf-rewards-wrap"></div></section>
<section class="bf-col bf-loadout" aria-labelledby="bf-loadout-title"><header class="bf-loadout-head"><h2 class="bf-h" id="bf-loadout-title"></h2><button class="quiet bf-auto" data-bf-auto>Auto-fill</button></header><div class="bf-note-wrap"></div><div class="codex-tabs bf-tabs" role="tablist" aria-label="Loadout categories"></div><ul class="bf-tiles" id="bf-tiles" role="tabpanel"></ul><p class="bf-status" role="status"></p><div class="bf-actions"><p class="mission-warning bf-warning" hidden>Starting this mission resets your current defense and progress.</p><div class="bf-go"><button class="quiet bf-arsenal" data-arsenal>⚒ Arsenal <span aria-hidden="true">›</span></button><button class="primary bf-start" data-bf-start>Start <span aria-hidden="true">▶</span></button></div></div></section>
</div>`;
    rovingKeys(root.querySelector(".bf-tabs")!, "[data-bf-tab]", (tab) => actions.tab(Number(tab.dataset.bfTab)));
    rovingKeys(root.querySelector(".bf-tiles")!, "[data-bf-tower], [data-bf-fixed]", (tile) => tile.focus(), { vertical: true });
  }
  // The handlers read the latest actions (a re-render may hand new ones).
  root.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.bfTower) actions.toggle(b.dataset.bfTower as TowerId);
    else if (b.dataset.bfTab) actions.tab(Number(b.dataset.bfTab));
    else if (b.dataset.bfAuto !== undefined) actions.auto();
    else if (b.dataset.bfStart !== undefined) actions.start();
  };
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  // Header: eyebrow and title belong to the page head.
  const eyebrow = document.getElementById("briefing-title-eyebrow"),
    title = document.getElementById("briefing-title");
  if (eyebrow) eyebrow.textContent = `BRIEFING · MISSION ${pad(missionNumber(m, content.missions))}${sector ? ` · SECTOR ${roman(sectors.indexOf(sector))}` : ""}`;
  if (title) title.textContent = m.name;
  // The mission column and intel change only with the mission.
  if (root.dataset.mission !== m.id) {
    root.dataset.mission = m.id;
    const map = $(".bf-map");
    map.style.setProperty("--accent", hex(themeAccent(m.map)));
    map.innerHTML = `<div class="preview-layer is-in is-loading"><img class="preview-fill" alt="" aria-hidden="true">${mapPreviewSvg(m.map)}<img class="preview-map" alt="Battlefield ${escape(m.map.name)}"></div>`;
    const layer = map.firstElementChild!,
      img = map.querySelector<HTMLImageElement>(".preview-map")!,
      fill = map.querySelector<HTMLImageElement>(".preview-fill")!;
    fillImage(img, m.map, d.image, () => {
      layer.classList.remove("is-loading");
      if (!img.src) return;
      fill.onload = () => fill.classList.add("is-ready");
      fill.src = img.src;
    });
    $(".bf-focus").textContent = m.focus;
    const best = d.record[m.id] ?? 0,
      stat = (label: string, value: string, unit = "") => `<div><dt>${label}</dt><dd>${unit ? `<span class="stat-unit" aria-hidden="true">${unit}</span>` : ""}${value}</dd></div>`;
    $(".bf-stats").innerHTML = [
      stat("Waves", String(m.waves.length)),
      stat("Credits", String(m.startingCredits), "◇"),
      stat("Reactor", String(m.reactorEnergy), "♡"),
      best ? `<div class="brief-best"><dt>Best</dt><dd aria-label="${best} of 3 stars">${starText(best)}</dd></div>` : stat("Best", "—"),
    ].join("");
    const rules = missionTags(m, content).filter((t) => t !== "Restricted towers");
    $(".bf-rules").innerHTML = rules.map((r) => `<li>${r}</li>`).join("");
    $(".bf-rules").hidden = !rules.length;
    const foes = missionEnemies(m, content),
      fresh = foes.filter((f) => f.isNew).length;
    $(".bf-intel-count").textContent = `${foes.length} ${plural(foes.length, "type")}${fresh ? ` · ${fresh} new` : ""}`;
    $(".bf-enemies").innerHTML = foes
      .map(({ id, isNew }) => {
        const e = content.enemies[id];
        return `<li>${enemyIcon(e.visual, e.color, id)}<span>${escape(e.name)}</span>${isNew ? '<b class="new-tag">NEW</b>' : ""}</li>`;
      })
      .join("");
  }
  $(".bf-bounty").hidden = !d.bounty;
  $(".bf-rewards-wrap").innerHTML = rewardsHtml(d);
  $(".bf-needs-wrap").innerHTML = needsHtml(d);
  // The loadout column: keep the focus on the same tab or tile across the update.
  const focused = document.activeElement as HTMLElement | null,
    key = focused && root.contains(focused) ? (focused.dataset.bfTower ? `[data-bf-tower="${focused.dataset.bfTower}"]` : focused.dataset.bfTab ? `[data-bf-tab="${focused.dataset.bfTab}"]` : undefined) : undefined,
    l = loadoutHtml(d);
  $("#bf-loadout-title").innerHTML = l.title;
  $(".bf-note-wrap").innerHTML = l.note;
  $(".bf-tabs").innerHTML = l.tabs;
  $(".bf-tiles").innerHTML = l.tiles;
  $(".bf-tiles").setAttribute("aria-labelledby", `bf-tab-${l.tab}`);
  $(".bf-tiles").classList.toggle("is-fixed", l.all);
  $(".bf-status").textContent = l.status;
  $<HTMLButtonElement>(".bf-auto").hidden = l.all;
  $(".bf-warning").hidden = !d.reset;
  const start = $<HTMLButtonElement>(".bf-start");
  start.disabled = l.empty;
  if (key) root.querySelector<HTMLElement>(key)?.focus({ preventScroll: true });
}
/** Puts the focus on Start (the page's first stop). */
export const focusStart = (root: HTMLElement) => root.querySelector<HTMLElement>(".bf-start")?.focus({ preventScroll: true });
