import type { Game } from "../core/game";
import type { ContentPack, MapDefinition, MissionDefinition, MissionSector } from "../core/types";
import { isCircleSector, missionNumber, sectorOf } from "../content/missions";
import { themeAccent } from "../render/terrain";
import { escape } from "./format";
import { mapPreviewSvg, missionEnemies } from "./mission-brief";
import { missionTags } from "./mission-tags";
import { enemyIcon } from "./wave-forecast";
/**
 * The mission page as a Sector Atlas: a gallery of sector cards, the featured mission (a large battlefield preview
 * beside its briefing) and a rail of the sector's missions. Campaign and Circuit sectors are separate modes and
 * never share a gallery. Each region is updated on its own, so picking a mission never rebuilds the gallery.
 */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
export const roman = (index: number) => ROMAN[index] ?? String(index + 1);
const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** One card of the gallery; `index` is the position in `content.sectors`, which also numbers the sector. */
export interface AtlasSector {
  index: number;
  numeral: string;
  name: string;
  count: number;
  /** Campaign numbers of the first and last mission. */
  first: number;
  last: number;
  /** The cover art: the sector's first map. */
  cover: MapDefinition;
  accent: string;
  /** Holds the mission currently loaded in the game. */
  current: boolean;
}
/** The sectors of one mode (Campaign, or Circuit with `circle`), in content order. */
export function atlasGroup(sectors: readonly MissionSector[], circle: boolean) {
  return sectors.filter((sector) => isCircleSector(sector) === circle);
}
export function atlasSectors(content: ContentPack, circle: boolean, currentId?: string): AtlasSector[] {
  const sectors = content.sectors ?? [];
  return atlasGroup(sectors, circle).map((sector) => {
    const first = missionNumber(sector.missions[0], content.missions);
    return {
      index: sectors.indexOf(sector),
      numeral: roman(sectors.indexOf(sector)),
      name: sector.name,
      count: sector.missions.length,
      first,
      last: first + sector.missions.length - 1,
      cover: sector.missions[0].map,
      accent: hex(themeAccent(sector.missions[0].map)),
      current: sector.missions.some((m) => m.id === currentId),
    };
  });
}
/** The mission a sector features: the picked one, else the one loaded in the game, else its first. */
export function atlasPick(missions: readonly MissionDefinition[], pickedId?: string, currentId?: string) {
  return missions.find((m) => m.id === pickedId) ?? missions.find((m) => m.id === currentId) ?? missions[0];
}
/** Renders a map's terrain to an image URL (`render/terrain-snapshot.ts`); the SVG stays where it fails. */
export type MapImage = (map: MapDefinition) => Promise<string>;
export interface AtlasOptions {
  /** Picking for a multiplayer room: the button chooses instead of starting. */
  lobby: boolean;
  image: MapImage;
}
/** Wide screens have room for the enemy list; narrow ones fold it away. */
const intelOpen = () => matchMedia("(min-width: 1100px) and (min-height: 700px)").matches;
const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id: string) => document.getElementById(id)!;
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
/** Scrolls a rail sideways so `item` sits in its centre; never scrolls the page. */
export function centreInRail(rail: HTMLElement, item: HTMLElement, smooth = true) {
  rail.scrollTo({ left: item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2, behavior: smooth && motion() ? "smooth" : "auto" });
}
/** Pages the sector gallery by about one view. */
export function stepRail(direction: number) {
  const rail = $("sector-tabs");
  rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: motion() ? "smooth" : "auto" });
}
/** Enables the gallery's arrow buttons only where there is more to scroll to. */
export function syncRailSteps() {
  const rail = $("sector-tabs"),
    end = rail.scrollWidth - rail.clientWidth;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-rail-step]")) {
    const back = button.dataset.railStep === "-1";
    button.disabled = back ? rail.scrollLeft <= 2 : rail.scrollLeft >= end - 2;
  }
  rail.parentElement!.toggleAttribute("data-scrolls", end > 2);
}
/** The mode (Campaign or Circuit) the gallery shows, or null before the first render. */
const shownMode = () => {
  const page = $("mission-page");
  return page.dataset.mode === undefined ? null : page.dataset.mode === "circle";
};
/**
 * Fills the whole page; called each time it opens. It opens on `sectorIndex`, else the sector of the loaded
 * mission, and features `pickedId`, else the loaded mission when listed, else the sector's first.
 */
export function renderAtlas(game: Game, options: AtlasOptions, sectorIndex?: number, pickedId?: string) {
  const sectors = game.content.sectors ?? [],
    current = sectorOf(game.mission, sectors),
    selected = sectors[sectorIndex ?? (current ? sectors.indexOf(current) : 0)];
  renderModes(game, !!selected && isCircleSector(selected), options);
  showSector(game, selected, options, pickedId, false);
}
/** Switches to another sector (a card or a mode tab); a different mode rebuilds the gallery. */
export function selectSector(game: Game, index: number, options: AtlasOptions) {
  const sector = (game.content.sectors ?? [])[index];
  if (!sector) return;
  if (shownMode() !== isCircleSector(sector)) renderModes(game, isCircleSector(sector), options);
  showSector(game, sector, options, undefined, true);
}
/** Features another mission of the shown sector. */
export function selectMission(game: Game, id: string, options: AtlasOptions) {
  const m = game.content.missions.find((mission) => mission.id === id);
  if (!m) return;
  for (const node of document.querySelectorAll<HTMLElement>("#mission-list [data-pick]")) node.setAttribute("aria-pressed", String(node.dataset.pick === id));
  const node = document.querySelector<HTMLElement>(`#mission-list [data-pick="${id}"]`);
  if (node) centreInRail($("mission-list"), node);
  renderFeatured(game, m, options);
}
/** Header, mode toggle and the gallery of one mode. */
function renderModes(game: Game, circle: boolean, { lobby, image }: AtlasOptions) {
  const { content } = game,
    sectors = content.sectors ?? [],
    campaign = atlasGroup(sectors, false),
    rings = atlasGroup(sectors, true),
    current = sectorOf(game.mission, sectors),
    page = $("mission-page"),
    count = (members: readonly MissionSector[]) => members.reduce((n, s) => n + s.missions.length, 0);
  page.dataset.mode = circle ? "circle" : "campaign";
  page.toggleAttribute("data-circle", circle);
  const modes = $("mission-modes");
  modes.hidden = !campaign.length || !rings.length;
  modes.innerHTML = modes.hidden
    ? ""
    : ([
        [false, campaign, "Campaign"],
        [true, rings, "⟳ Circuit"],
      ] as const)
        .map(([ring, members, name]) => {
          const active = ring === circle;
          return `<button class="mode-tab" role="tab" id="mission-mode-${ring ? "circle" : "campaign"}" data-sector="${sectors.indexOf(members[0])}"${ring ? ' data-mode="circle"' : ""} aria-controls="sector-tabs" aria-selected="${active}" tabindex="${active ? 0 : -1}"${!!current && isCircleSector(current) === ring ? ' data-current="true"' : ""}><strong>${name}</strong> <small>${count(members)}<span class="sr-only"> missions</span></small></button>`;
        })
        .join("");
  const group = circle ? rings : campaign;
  $("atlas-mode").textContent = lobby ? "Multiplayer" : modes.hidden && !circle ? "Missions" : circle ? "Circuit" : "Campaign";
  $("atlas-context").textContent = `${group.length} ${plural(group.length, "sector")} · ${count(group)} ${plural(count(group), "mission")}`;
  $("mode-rules").hidden = !circle;
  const rail = $("sector-tabs");
  rail.innerHTML = atlasSectors(content, circle, game.mission.id)
    .map(
      (s) =>
        `<button class="sector-card" role="tab" id="sector-tab-${s.index}" data-sector="${s.index}" aria-controls="mission-list" aria-selected="false" tabindex="-1" style="--accent:${s.accent}"${s.current ? ' data-current="true"' : ""} aria-label="Sector ${s.numeral}: ${escape(s.name)}, ${s.count} ${plural(s.count, "mission")}${s.current ? ", contains the current mission" : ""}"><span class="sector-art" aria-hidden="true">${mapPreviewSvg(s.cover).replace("<svg ", `<svg preserveAspectRatio="xMidYMid slice" `)}<img alt="" data-map="${s.cover.id}"></span><span class="sector-numeral" aria-hidden="true">${s.numeral}</span><span class="sector-copy" aria-hidden="true"><small>SECTOR ${s.numeral}${s.current ? '<b class="sector-current">● CURRENT</b>' : ""}</small><strong>${s.name}</strong><span>${s.count} ${plural(s.count, "mission")} · ${pad(s.first)}–${pad(s.last)}</span></span></button>`,
    )
    .join("");
  rail.scrollLeft = 0;
  rail.dataset.covers = "";
  coverImages = () => {
    // Requested after the featured map, so the large preview comes first.
    if (rail.dataset.covers) return;
    rail.dataset.covers = "1";
    for (const img of rail.querySelectorAll<HTMLImageElement>("img[data-map]")) {
      const map = content.missions.find((m) => m.map.id === img.dataset.map)!.map;
      fillImage(img, map, image);
    }
  };
}
let coverImages = () => {};
/** Marks the sector's card, fills the mission rail and features a mission. */
function showSector(game: Game, sector: MissionSector | undefined, options: AtlasOptions, pickedId: string | undefined, smooth: boolean) {
  const { missions } = game.content,
    sectors = game.content.sectors ?? [],
    shown = sector?.missions ?? missions,
    picked = atlasPick(shown, pickedId, game.mission.id),
    rail = $("sector-tabs");
  for (const card of rail.querySelectorAll<HTMLElement>("[data-sector]")) {
    const active = sector !== undefined && Number(card.dataset.sector) === sectors.indexOf(sector);
    card.setAttribute("aria-selected", String(active));
    card.tabIndex = active ? 0 : -1;
    if (active) centreInRail(rail, card, smooth);
  }
  // Without a selectable card the first one still has to be reachable by Tab.
  if (!rail.querySelector('[tabindex="0"]')) rail.querySelector<HTMLElement>("[data-sector]")?.setAttribute("tabindex", "0");
  const list = $("mission-list");
  list.setAttribute("aria-label", sector ? `Missions of sector ${roman(sectors.indexOf(sector))}, ${sector.name}` : "Missions");
  list.innerHTML = shown
    .map((m) => {
      const n = missionNumber(m, missions),
        loaded = m.id === game.mission.id;
      return `<button class="mission-node" data-pick="${m.id}" aria-pressed="${m === picked}"${loaded ? ' aria-current="true"' : ""} title="${escape(m.focus)}"><span class="node-dot" aria-hidden="true"></span><span class="node-number">${pad(n)}</span><span class="node-name">${m.name}${loaded ? '<span class="sr-only"> (current)</span>' : ""}</span></button>`;
    })
    .join("");
  // Restarts the entry animation of the rail.
  list.classList.remove("is-entering");
  void list.offsetWidth;
  list.classList.add("is-entering");
  list.scrollLeft = 0;
  const node = list.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (node) centreInRail(list, node, false);
  renderFeatured(game, picked, options);
  requestAnimationFrame(syncRailSteps);
}
/** The large battlefield preview and the briefing beside it. */
export function renderFeatured(game: Game, m: MissionDefinition | undefined, { lobby, image }: AtlasOptions) {
  const preview = $("atlas-preview"),
    body = $("brief-body"),
    actions = $("brief-actions");
  if (!m) {
    body.innerHTML = actions.innerHTML = "";
    return;
  }
  const { content } = game,
    { missions, enemies, towers } = content,
    sectors = content.sectors ?? [],
    sector = sectorOf(m, sectors),
    numeral = sector ? roman(sectors.indexOf(sector)) : "";
  // Preview: a new layer over the old one, crossfaded; the SVG shows at once and the terrain picture fades in.
  preview.style.setProperty("--accent", hex(themeAccent(m.map)));
  $("preview-sector").textContent = sector ? `SECTOR ${numeral}` : "OPERATION";
  $("preview-sector-name").textContent = sector?.name ?? m.map.name;
  $("preview-map").textContent = m.map.name;
  $("preview-legend").innerHTML = m.map.loop
    ? '<span class="legend-portal">Portal</span><span>Closed ring</span>'
    : '<span class="legend-entry">Entry</span><span class="legend-reactor">Reactor</span>';
  const stage = $("preview-stage"),
    top = stage.lastElementChild as HTMLElement | null;
  if (top?.dataset.map !== m.map.id) {
    const layer = document.createElement("div");
    layer.className = "preview-layer is-loading";
    layer.dataset.map = m.map.id;
    layer.innerHTML = `${mapPreviewSvg(m.map)}<img alt="Battlefield ${escape(m.map.name)}">`;
    stage.append(layer);
    // Older layers fade out under the new one and leave once it is in.
    for (const old of [...stage.children].slice(0, -1) as HTMLElement[]) {
      old.classList.add("is-leaving");
      setTimeout(() => old.remove(), motion() ? 320 : 0);
    }
    void layer.offsetWidth;
    layer.classList.add("is-in");
    const img = layer.querySelector("img")!;
    fillImage(img, m.map, image, () => {
      layer.classList.remove("is-loading");
      coverImages();
    });
  } else coverImages();
  // Briefing.
  const s = game.state,
    loaded = m.id === game.mission.id,
    reset = !lobby && (s.wave > 0 || s.towers.length > 0),
    stat = (label: string, value: string, unit = "") => `<div><dt>${label}</dt><dd>${unit ? `<span class="stat-unit" aria-hidden="true">${unit}</span>` : ""}${value}</dd></div>`,
    stats = [
      stat("Waves", String(m.waves.length)),
      stat("Credits", String(m.startingCredits), "◇"),
      ...(m.circle ? [stat("Ring limit", String(m.circle.limit)), stat("Wave timer", `${m.circle.interval} s`)] : [stat("Reactor", String(m.reactorEnergy), "♡")]),
    ],
    rules = [
      ...missionTags(m, content).filter((tag) => tag !== "Restricted towers"),
      ...(m.circle ? [`Early call +${m.circle.earlyBonus} ◇/s`] : []),
      ...(m.availableTowers ? [`${m.availableTowers.length} towers only`] : []),
    ],
    foes = missionEnemies(m, content),
    fresh = foes.filter((f) => f.isNew).length;
  body.innerHTML = `<p class="brief-kicker">MISSION ${pad(missionNumber(m, missions))}${sector ? ` <span aria-hidden="true">/</span> SECTOR ${numeral} · ${sector.name.toUpperCase()}` : ""}${loaded ? ' <b class="brief-loaded">LOADED</b>' : ""}</p><h2 id="brief-title">${m.name}</h2><p class="brief-focus">${m.focus}</p><dl class="brief-stats">${stats.join("")}</dl>${rules.length ? `<ul class="brief-rules" aria-label="Special rules">${rules.map((r) => `<li>${r}</li>`).join("")}</ul>` : ""}<details class="brief-intel"${intelOpen() ? " open" : ""}><summary><span>Intel</span><small>${foes.length} enemy ${plural(foes.length, "type")}${fresh ? ` · ${fresh} new` : ""}</small></summary><ul class="brief-enemies">${foes.map(({ id, isNew }) => `<li>${enemyIcon(enemies[id].visual, enemies[id].color, id)}<span>${enemies[id].name}</span>${isNew ? '<b class="new-tag">NEW</b>' : ""}</li>`).join("")}</ul>${m.availableTowers ? `<h3>Restricted to these towers</h3><p class="brief-towers">${m.availableTowers.map((id) => towers[id].name).join(" · ")}</p>` : ""}</details>`;
  actions.innerHTML = `${reset ? '<p class="mission-warning">Starting another mission resets your current defense and progress.</p>' : ""}<button class="primary atlas-start" data-mission="${m.id}">${lobby ? "Choose for Room" : "Start Mission"} <span aria-hidden="true">▶</span></button>`;
  body.scrollTop = 0;
  // Restarts the briefing's entry animation.
  body.classList.remove("is-entering");
  void body.offsetWidth;
  body.classList.add("is-entering");
}
