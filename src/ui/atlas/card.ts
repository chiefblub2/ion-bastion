// The atlas's mission card: the battlefield preview, the briefing with its Start button, and Intel.
import type { Game } from "../../core/game";
import type { MapDefinition, MissionDefinition } from "../../core/types";
import { isCircleSector, missionNumber, sectorOf } from "../../content/missions";
import { themeAccent } from "../../render/terrain";
import { escape } from "../format";
import { mapPreviewSvg, missionEnemies } from "../mission-brief";
import { missionTags } from "../mission-tags";
import { enemyIcon } from "../wave-forecast";
import { starText } from "../../campaign/rating";
import { FIT_QUERY } from "../../app/compact";
import { type AtlasOptions, hex, LOCK_ICON, lockText, type MapImage, pad, plural, roman } from "./model";
import { $, motion } from "./state";
/**
 * From tablets up the card has room for the enemy list; phones in portrait fold it away. The fitted landscape layout
 * shows it on the inspector's Intel tab instead, so it is always open there (the tab replaces its summary).
 */
const intelQuery = `(min-width: 700px), ${FIT_QUERY}`,
  intelOpen = () => matchMedia(intelQuery).matches;
// Turning a phone into landscape opens the list the portrait layout had folded away.
if (typeof matchMedia === "function")
  matchMedia(FIT_QUERY).addEventListener("change", (e) => {
    if (e.matches) document.querySelector("#brief-intel details")?.setAttribute("open", "");
  });
/** The inspector's tab in the fitted layout: the briefing, or the battlefield and the enemies (Intel). */
export type BriefTab = "overview" | "intel";
export function showBriefTab(tab: BriefTab) {
  const card = $("atlas-card");
  card.dataset.tab = tab;
  for (const b of card.querySelectorAll<HTMLElement>("[data-brief-tab]")) b.setAttribute("aria-pressed", String(b.dataset.briefTab === tab));
}
/** The mission the briefing shows, so the app can return to it after leaving the page. */
let featured: MissionDefinition | undefined;
/** The featured mission and its sector's content index, or undefined before the first render. */
export function atlasSelection(game: Game) {
  const sectors = game.content.sectors ?? [],
    sector = featured && sectorOf(featured, sectors);
  return featured && sector ? { sector: sectors.indexOf(sector), pick: featured.id, circle: isCircleSector(sector) } : undefined;
}
/** Sets an <img> once the terrain picture is ready; it fades in over the SVG placeholder. */
export function fillImage(img: HTMLImageElement, map: MapDefinition, image: MapImage, ready?: () => void) {
  image(map).then(
    (url) => {
      img.onload = () => {
        img.classList.add("is-ready");
        ready?.();
      };
      img.src = url;
    },
    () => ready?.(),
  );
}
/** The battlefield preview, shown whole, and the briefing beside it. */
export function renderFeatured(game: Game, m: MissionDefinition | undefined, { lobby, image, record = {}, locks }: AtlasOptions) {
  const preview = $("atlas-preview"),
    body = $("brief-body"),
    actions = $("brief-actions"),
    intel = $("brief-intel");
  featured = m;
  if (!m) {
    body.innerHTML = actions.innerHTML = intel.innerHTML = "";
    $("brief-intel-count").innerHTML = "";
    return;
  }
  const { content } = game,
    { missions, enemies, towers } = content,
    sectors = content.sectors ?? [],
    sector = sectorOf(m, sectors),
    numeral = sector ? roman(sectors.indexOf(sector)) : "";
  // Preview: a new layer over the old one, crossfaded; the SVG shows at once and the terrain picture fades in.
  preview.style.setProperty("--accent", hex(themeAccent(m.map)));
  $("preview-legend").innerHTML = m.map.loop
    ? '<span class="legend-portal">Portal</span><span>Closed ring</span>'
    : '<span class="legend-entry">Entry</span><span class="legend-reactor">Reactor</span>';
  // Layers stack under the legend chip, which stays put while the picture changes.
  const stage = $("preview-stage"),
    layers = () => [...stage.querySelectorAll<HTMLElement>(":scope > .preview-layer")],
    top = layers().at(-1);
  if (top?.dataset.map !== m.map.id) {
    const layer = document.createElement("div");
    layer.className = "preview-layer is-loading";
    layer.dataset.map = m.map.id;
    // The fill is a blurred copy of the terrain behind the fitted map, so the frame keeps one size for every map.
    layer.innerHTML = `<img class="preview-fill" alt="" aria-hidden="true">${mapPreviewSvg(m.map)}<img class="preview-map" alt="Battlefield ${escape(m.map.name)}">`;
    stage.insertBefore(layer, $("preview-legend"));
    // Older layers fade out under the new one and leave once it is in.
    for (const old of layers().slice(0, -1)) {
      old.classList.add("is-leaving");
      setTimeout(() => old.remove(), motion() ? 320 : 0);
    }
    void layer.offsetWidth;
    layer.classList.add("is-in");
    const img = layer.querySelector<HTMLImageElement>(".preview-map")!,
      fill = layer.querySelector<HTMLImageElement>(".preview-fill")!;
    fillImage(img, m.map, image, () => {
      layer.classList.remove("is-loading");
      if (!img.src) return;
      fill.onload = () => fill.classList.add("is-ready");
      fill.src = img.src;
    });
  }
  // Briefing.
  const s = game.state,
    lock = locks?.get(m.id),
    reset = !lobby && !lock && (s.wave > 0 || s.towers.length > 0),
    stat = (label: string, value: string, unit = "") => `<div><dt>${label}</dt><dd>${unit ? `<span class="stat-unit" aria-hidden="true">${unit}</span>` : ""}${value}</dd></div>`,
    stats = [
      stat("Waves", String(m.waves.length)),
      stat("Credits", String(m.startingCredits), "◇"),
      ...(m.circle ? [stat("Ring limit", String(m.circle.limit)), stat("Wave timer", `${m.circle.interval} s`)] : [stat("Reactor", String(m.reactorEnergy), "♡")]),
      record[m.id]
        ? `<div class="brief-best"><dt>Best</dt><dd aria-label="${record[m.id]} of 3 stars">${starText(record[m.id])}</dd></div>`
        : stat("Best", "—"),
    ],
    rules = [
      ...missionTags(m, content).filter((tag) => tag !== "Restricted towers"),
      ...(m.circle ? [`Early call +${m.circle.earlyBonus} ◇/s`] : []),
      ...(m.availableTowers ? [`${m.availableTowers.length} towers only`] : []),
    ],
    foes = missionEnemies(m, content),
    fresh = foes.filter((f) => f.isNew).length;
  body.innerHTML = `<p class="brief-kicker">MISSION ${pad(missionNumber(m, missions))}${sector ? ` <span aria-hidden="true">·</span> SECTOR ${numeral}` : ""}</p><h2 id="brief-title">${m.name}</h2><p class="brief-focus">${m.focus}</p><dl class="brief-stats">${stats.join("")}</dl>${rules.length ? `<ul class="brief-rules" aria-label="Special rules">${rules.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}`;
  intel.innerHTML = `<details class="brief-intel"${intelOpen() ? " open" : ""}><summary><span>Intel</span><small>${foes.length} enemy ${plural(foes.length, "type")}${fresh ? ` · ${fresh} new` : ""}</small></summary><ul class="brief-enemies">${foes.map(({ id, isNew }) => `<li>${enemyIcon(enemies[id].visual, enemies[id].color, id)}<span>${enemies[id].name}</span>${isNew ? '<b class="new-tag">NEW</b>' : ""}</li>`).join("")}</ul>${m.availableTowers ? `<h3>Restricted to these towers</h3><p class="brief-towers">${m.availableTowers.map((id) => towers[id].name).join(" · ")}</p>` : ""}</details>`;
  // The Intel tab's count: enemy types, and how many are new ("4 +2").
  $("brief-intel-count").innerHTML = `${foes.length}${fresh ? ` <b class="brief-new">+${fresh}</b>` : ""}<span class="sr-only"> enemy ${plural(foes.length, "type")}${fresh ? `, ${fresh} new` : ""}</span>`;
  // Previous and next mission of the sector: the fitted layout's way through small stations (hidden elsewhere).
  const row = sector?.missions ?? [],
    at = row.indexOf(m),
    step = (dir: "prev" | "next", to: MissionDefinition | undefined) =>
      `<button class="quiet brief-step" data-step="${dir}"${to ? ` data-pick="${to.id}" aria-label="${dir === "prev" ? "Previous" : "Next"} mission: ${escape(to.name)}"` : ` aria-label="${dir === "prev" ? "No previous" : "No next"} mission" disabled`}><span aria-hidden="true">${dir === "prev" ? "‹" : "›"}</span></button>`,
    start = lock
      ? `<button class="primary atlas-start" aria-describedby="mission-lock" disabled>Locked <span aria-hidden="true">${LOCK_ICON}</span></button>`
      : `<button class="primary atlas-start" data-mission="${m.id}">${lobby ? "Choose for Room" : "Start Mission"} <span aria-hidden="true">▶</span></button>`;
  actions.innerHTML = `${lock ? `<p class="mission-lock" id="mission-lock">${lockText(lock, missions, sectors)}</p>` : reset ? '<p class="mission-warning">Starting another mission resets your current defense and progress.</p>' : ""}<div class="brief-go">${step("prev", row[at - 1])}${start}${step("next", row[at + 1])}</div>`;
  body.scrollTop = 0;
  // Restarts the briefing's entry animation.
  body.classList.remove("is-entering");
  void body.offsetWidth;
  body.classList.add("is-entering");
}
