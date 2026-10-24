import type { Game } from "../core/game";
import type { ContentPack, MapDefinition, MissionDefinition, MissionSector } from "../core/types";
import { isCircleSector, missionNumber, sectorOf } from "../content/missions";
import { themeAccent } from "../render/terrain";
import { escape } from "./format";
import { mapPreviewSvg, missionEnemies } from "./mission-brief";
import { missionTags } from "./mission-tags";
import { enemyIcon } from "./wave-forecast";
import type { CampaignRecord } from "../app/progress";
import { starText } from "../app/rating";
import { type Lock, sectorLocked, type Unlocked } from "../app/campaign-unlock";
import { type Box, fitBox, headingOf, HORIZON, link, planetLayout, project, type Region, routePoints, routeShape, stars, stationBox, type Point, SURFACE, tiltFor, WORLD_BOX, WORLD_H, WORLD_W } from "./world-map";
import { biomeGround, type SurfaceSeed } from "./planet-surface";
import { surfaceImage } from "./planet-texture";
/**
 * The mission page as a Sector Atlas: a world map with every sector of the mode as a landmass (its terrain, its
 * missions as stations on a route, sea lanes to the next sector) that zooms into the selected sector, then the
 * featured mission's whole battlefield and its briefing. Campaign and Circuit sectors
 * are separate modes and never share a gallery. Campaign missions unlock with progress (`app/campaign-unlock.ts`):
 * locked ones can be looked at but not started. Each region is updated on its own, so picking a mission never rebuilds the gallery.
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
  /** Holds the mode's next mission (`atlasNext`). */
  next: boolean;
  /** Won missions and their best stars, from the campaign record. */
  won: number;
  stars: number;
  /** Every mission is locked; `lock` says what opens the sector. */
  locked: boolean;
  lock?: Lock;
}
/** Won missions and best stars among `missions`; at most `3 × missions.length` stars. */
export function progressOf(missions: readonly MissionDefinition[], record: CampaignRecord) {
  const won = missions.filter((m) => record[m.id]);
  return { won: won.length, stars: won.reduce((n, m) => n + record[m.id], 0), count: missions.length };
}
/** The sectors of one mode (Campaign, or Circuit with `circle`), in content order. */
export function atlasGroup(sectors: readonly MissionSector[], circle: boolean) {
  return sectors.filter((sector) => isCircleSector(sector) === circle);
}
export function atlasSectors(content: ContentPack, circle: boolean, record: CampaignRecord = {}, locks: ReadonlyMap<string, Lock> = NO_LOCKS): AtlasSector[] {
  const sectors = content.sectors ?? [],
    group = atlasGroup(sectors, circle),
    next = atlasNext(
      group.flatMap((s) => s.missions),
      record,
      locks,
    );
  return group.map((sector) => {
    const first = missionNumber(sector.missions[0], content.missions),
      { won, stars } = progressOf(sector.missions, record);
    return {
      index: sectors.indexOf(sector),
      numeral: roman(sectors.indexOf(sector)),
      name: sector.name,
      count: sector.missions.length,
      first,
      last: first + sector.missions.length - 1,
      cover: sector.missions[0].map,
      accent: hex(themeAccent(sector.missions[0].map)),
      next: !!next && sector.missions.includes(next),
      won,
      stars,
      locked: sectorLocked(sector, locks),
      lock: locks.get(sector.missions[0].id),
    };
  });
}
const NO_LOCKS: ReadonlyMap<string, Lock> = new Map();
/** The next mission to play: the first one neither won nor locked, undefined once every open one is won. */
export function atlasNext(missions: readonly MissionDefinition[], record: CampaignRecord, locks: ReadonlyMap<string, Lock> = NO_LOCKS) {
  return missions.find((m) => !record[m.id] && !locks.has(m.id));
}
/** Why a locked mission or sector cannot be started yet, in the player's words. */
export function lockText(lock: Lock, missions: readonly MissionDefinition[], sectors: readonly MissionSector[]) {
  if (lock.kind === "mission") return `Clear Mission ${pad(missionNumber(lock.after, missions))} to unlock`;
  return `Clear ${lock.need} more ${plural(lock.need, "mission")} in Sector ${roman(sectors.indexOf(lock.sector))} to unlock`;
}
/** The win overlay's line about what the win opened, or "" when it opened nothing. */
export function unlockNotice({ sectors: opened, missions: newer }: Unlocked, missions: readonly MissionDefinition[], sectors: readonly MissionSector[]) {
  const names = [
    ...opened.map((s) => `Sector ${roman(sectors.indexOf(s))} · ${s.name}`),
    ...newer.map((m) => `Mission ${pad(missionNumber(m, missions))} · ${m.name}`),
  ];
  return names.length ? `Unlocked: ${names.join(", ")}` : "";
}
/**
 * The mission a sector features: the picked one, else the one being played (`playingId`), else the sector's next
 * unwon one, else its first.
 */
export function atlasPick(
  missions: readonly MissionDefinition[],
  record: CampaignRecord,
  pickedId?: string,
  playingId?: string,
  locks: ReadonlyMap<string, Lock> = NO_LOCKS,
) {
  return missions.find((m) => m.id === pickedId) ?? missions.find((m) => m.id === playingId) ?? atlasNext(missions, record, locks) ?? missions[0];
}
/** Renders a map's terrain to an image URL (`render/terrain-snapshot.ts`); the SVG stays where it fails. */
export type MapImage = (map: MapDefinition) => Promise<string>;
export interface AtlasOptions {
  /** Picking for a multiplayer room: the button chooses instead of starting. */
  lobby: boolean;
  image: MapImage;
  /** Best stars per won mission; absent shows nothing as cleared. */
  record?: CampaignRecord;
  /** A game is under way on the loaded mission, so the atlas opens on it instead of the next mission. */
  playing?: boolean;
  /** Locked campaign missions (`campaignLocks`); absent (multiplayer, `?unlock=all`) locks nothing. */
  locks?: ReadonlyMap<string, Lock>;
  /** Unlocked mission ids shown before; others play their reveal. Absent: nothing is fresh. */
  seen?: ReadonlySet<string>;
}
/** From tablets up the card has room for the enemy list; phones fold it away. */
const intelOpen = () => matchMedia("(min-width: 700px)").matches;
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
/** The mode (Campaign or Circuit) the world shows, or null before the first render. */
const shownMode = () => {
  const page = $("mission-page");
  return page.dataset.mode === undefined ? null : page.dataset.mode === "circle";
};
/**
 * Fills the whole page; called each time it opens. It opens on `sectorIndex`, else the sector of the game under way,
 * else the sector of the next mission of the loaded mission's mode, and features `pickedId`, else the mission being
 * played, else the sector's next unwon mission, else its first. The world shows whole for a moment, then flies into
 * that sector.
 */
export function renderAtlas(game: Game, options: AtlasOptions, sectorIndex?: number, pickedId?: string) {
  const sectors = game.content.sectors ?? [],
    loaded = sectorOf(game.mission, sectors),
    next = modeNext(sectors, !!loaded && isCircleSector(loaded), options.record, options.locks),
    home = (options.playing ? loaded : undefined) ?? (next ? sectorOf(next, sectors) : undefined) ?? loaded,
    selected = sectors[sectorIndex ?? (home ? sectors.indexOf(home) : 0)];
  renderModes(game, !!selected && isCircleSector(selected), options);
  zoom = "world";
  fitWorld(false);
  showSector(game, selected, options, pickedId);
}
/** The next mission of one mode (Campaign, or Circuit with `circle`). */
const modeNext = (sectors: readonly MissionSector[], circle: boolean, record: CampaignRecord = {}, locks?: ReadonlyMap<string, Lock>) =>
  atlasNext(
    atlasGroup(sectors, circle).flatMap((s) => s.missions),
    record,
    locks,
  );
/** An unlocked mission the atlas has not shown unlocked before (only once a first visit is stored). */
const fresh = (m: MissionDefinition, { locks, seen }: AtlasOptions) => !!seen && !locks?.has(m.id) && !seen.has(m.id);
/** Switches to another sector (a landmass, its label or a mode tab); a different mode rebuilds the world. */
export function selectSector(game: Game, index: number, options: AtlasOptions) {
  const sector = (game.content.sectors ?? [])[index];
  if (!sector) return;
  if (shownMode() !== isCircleSector(sector)) {
    renderModes(game, isCircleSector(sector), options);
    zoom = "world";
    fitWorld(false);
  }
  showSector(game, sector, options, undefined);
}
/** Features another mission of the shown sector. */
export function selectMission(game: Game, id: string, options: AtlasOptions) {
  const m = game.content.missions.find((mission) => mission.id === id);
  if (!m) return;
  for (const node of document.querySelectorAll<HTMLElement>("#mission-list [data-pick]")) node.setAttribute("aria-pressed", String(node.dataset.pick === id));
  renderFeatured(game, m, options);
}
/** The world on screen: the mode's sectors, their landmasses and the one zoomed into. */
let world: { sectors: readonly MissionSector[]; regions: Region[]; stations: Point[][]; selected: number } = { sectors: [], regions: [], stations: [], selected: -1 },
  zoom: "world" | "sector" = "world";
/** Shows the whole world or flies back into the selected sector (the map's World button). */
export function toggleWorld() {
  zoom = zoom === "world" && world.selected >= 0 ? "sector" : "world";
  fitWorld(true);
}
/**
 * Moves and scales the plane so the selected sector (or the whole world) fills the view, flying there when `smooth`.
 * The surface is tilted (CSS); labels and stations stay upright on a flat layer above it, placed where their world
 * point lands on screen (`project`). Called on every change and, unanimated, when the view is resized.
 */
export function fitWorld(smooth = false) {
  const view = $("world-view"),
    region = world.regions[world.selected],
    sector = zoom === "sector" && !!region;
  if (!view.clientWidth) return;
  // Phones show the stations closer together (their labels shrink to the number), so the margin is smaller there.
  // A sector zoom keeps the band under the legend free.
  const narrow = view.clientWidth < 600,
    top = sector ? $("missions-label").parentElement!.offsetHeight + 12 : 0,
    box = sector ? stationBox(world.stations[world.selected], narrow ? 7 : 9, narrow ? 5 : 8) : WORLD_BOX,
    fit = fitBox(box, view.clientWidth, view.clientHeight - top);
  fit.y += top;
  view.dataset.zoom = sector ? "sector" : "world";
  const button = $("world-zoom");
  button.setAttribute("aria-pressed", String(!sector));
  button.innerHTML = sector
    ? '<span aria-hidden="true">◱</span> World map'
    : `<span aria-hidden="true">⊕</span> Sector ${roman(contentIndex.get(world.sectors[world.selected]) ?? 0)}`;
  button.hidden = !region;
  cancelAnimationFrame(flight);
  if (!smooth || !motion() || !shown) return place(fit);
  const from = shown;
  // New stations get their place at once, before the first frame of the flight.
  place(from);
  const start = performance.now(),
    ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    frame = (now: number) => {
      const t = Math.min(1, (now - start) / FLIGHT_MS),
        e = ease(t);
      place({ x: from.x + (fit.x - from.x) * e, y: from.y + (fit.y - from.y) * e, scale: from.scale + (fit.scale - from.scale) * e });
      if (t < 1) flight = requestAnimationFrame(frame);
    };
  flight = requestAnimationFrame(frame);
}
const FLIGHT_MS = 800;
let flight = 0,
  shown: { x: number; y: number; scale: number } | null = null;
/** Applies one placement of the plane: its transform, the tilt and every label's screen position. */
function place(fit: { x: number; y: number; scale: number }) {
  const view = $("world-view"),
    plane = $("world-plane"),
    width = view.clientWidth,
    height = view.clientHeight,
    tilt = tiltFor(width);
  shown = fit;
  plane.style.transform = `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`;
  plane.style.setProperty("--inv", String(1 / fit.scale));
  // World units per screen pixel, for sizes in the SVG (dot radii) that stay constant on screen.
  plane.style.setProperty("--px", String(WORLD_W / (width * fit.scale)));
  const lean = $("world-tilt");
  lean.style.transform = `perspective(${tilt.perspective}px) rotateX(${tilt.deg}deg)`;
  for (const el of view.querySelectorAll<HTMLElement>("[data-wx]")) {
    const p = project({ x: Number(el.dataset.wx), y: Number(el.dataset.wy) }, fit, width, height, tilt);
    el.style.transform = `translate(${Math.round(p.x * 10) / 10}px, ${Math.round(p.y * 10) / 10}px)`;
  }
}
const round = (n: number) => Math.round(n * 100) / 100;
/** Content index of each shown sector, which numbers it. */
let contentIndex = new Map<MissionSector, number>();
/** Header, mode toggle and the world of one mode: ocean, landmasses, sea lanes and every sector's stations. */
function renderModes(game: Game, circle: boolean, options: AtlasOptions) {
  const { lobby, record = {}, locks = NO_LOCKS } = options;
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
  const progress = progressOf(
    group.flatMap((s) => s.missions),
    record,
  );
  $("atlas-context").textContent = `${group.length} ${plural(group.length, "sector")} · ${count(group)} ${plural(count(group), "mission")}${progress.won ? ` · ${progress.won} cleared · ${progress.stars}/${progress.count * 3} ★` : ""}`;
  $("mode-rules").hidden = !circle;
  const { regions, wilds } = planetLayout(group.length),
    cards = atlasSectors(content, circle, record, locks);
  const stations = group.map((s, i) =>
    routePoints(regions[i], s.missions.length, {
      shape: routeShape(s.missions[0].map.theme ?? "outpost", isCircleSector(s)),
      heading: headingOf(regions, i),
      mirror: i % 2 === 1,
      aside: asideOf(s.missions),
    }),
  );
  world = { sectors: group, regions, stations, selected: -1 };
  seeds = [...regions.map((r, i) => ({ x: r.x, y: r.y, biome: group[i].missions[0].map.theme ?? "outpost" })), ...wilds.map((w) => ({ x: w.x, y: w.y, biome: "waste" as const }))];
  contentIndex = new Map(group.map((s) => [s, sectors.indexOf(s)]));
  // Links from each sector's last station to the next sector's first; lit once the next sector is open.
  const lanes = stations
      .slice(1)
      .map((points, i) => `<path class="lane" data-state="${cards[i + 1].locked ? "locked" : "open"}" d="${link(stations[i].at(-1)!, points[0])}"/>`)
      .join(""),
    grounds = [
      ...wilds.map((w) => `<path class="ground" style="fill:${biomeGround("waste")}" d="${w.outline}"/>`),
      ...regions.map((r, i) => `<path class="ground" style="fill:${biomeGround(seeds[i].biome)}" d="${r.outline}"/>`),
    ].join(""),
    wildBorders = wilds.map((w) => `<path class="wild-border" d="${w.outline}"/>`).join(""),
    lands = regions
      .map((r, i) => {
        const s = cards[i],
          list = group[i].missions,
          routes = routeLinks(list, !circle)
            .map(([a, b, skip]) => `<path class="route${skip ? " skip" : ""}" data-state="${record[list[a].id] && record[list[b].id] ? "lit" : locks.has(list[b].id) ? "locked" : "open"}" d="${link(stations[i][a], stations[i][b])}"/>`)
            .join(""),
          dots = stations[i]
            .map((p, j) => `<circle class="dot" data-state="${record[list[j].id] ? "won" : locks.has(list[j].id) ? "locked" : "open"}" cx="${p.x}" cy="${p.y}" r="1"/>`)
            .join("");
        // The border is clipped to the territory, so two neighbours draw their shared edge side by side, each in its
        // own state's colour: held (all won), contested (open) or hostile (locked).
        const state = s.locked ? "hostile" : s.won === s.count ? "held" : "open";
        return `<g class="land" data-sector="${s.index}" data-state="${state}" style="--accent:${s.accent}"${s.next ? ' data-next="true"' : ""}><clipPath id="land-clip-${i}"><path d="${r.outline}"/></clipPath><path class="tint" d="${r.outline}"/><path class="border" clip-path="url(#land-clip-${i})" d="${r.outline}"/>${routes}${dots}</g>`;
      })
      .join("");
  // Space with stars, the planet clipped to its curve, light from the upper left with the night side to the right,
  // and the atmosphere's haze and rim along the horizon.
  const { x: hx, y: hy, r: hr } = HORIZON,
    cy = hy + hr,
    sky = stars(140)
      .filter((s) => (s.x - hx) ** 2 + (s.y - cy) ** 2 > (hr + 1) ** 2)
      .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}"/>`)
      .join(""),
    atmosphere = ["wide", "mid", "rim"].map((k) => `<circle class="atmo atmo-${k}" cx="${hx}" cy="${cy}" r="${hr}"/>`).join("");
  $("world-svg").innerHTML = `<defs><clipPath id="planet-clip"><circle cx="${hx}" cy="${cy}" r="${hr}"/></clipPath><linearGradient id="planet-day" gradientUnits="userSpaceOnUse" x1="-40" y1="-20" x2="260" y2="60"><stop offset="0" class="day-lit"/><stop offset="0.45" class="day-mid"/><stop offset="1" class="day-night"/></linearGradient><radialGradient id="planet-haze" gradientUnits="userSpaceOnUse" cx="${hx}" cy="${cy}" r="${hr}"><stop offset="${(hr - 18) / hr}" class="haze-clear"/><stop offset="1" class="haze-thick"/></radialGradient></defs><rect class="space" x="-200" y="-150" width="${WORLD_W + 400}" height="${WORLD_H + 300}"/><g class="stars">${sky}</g><g class="planet" clip-path="url(#planet-clip)">${grounds}${`<image class="surface" x="${SURFACE.x}" y="${SURFACE.y}" width="${SURFACE.w}" height="${SURFACE.h}" preserveAspectRatio="none"/>`.repeat(2)}<g class="tiles"></g>${wildBorders}<rect class="daylight" x="${SURFACE.x}" y="${SURFACE.y}" width="${SURFACE.w}" height="${SURFACE.h}" fill="url(#planet-day)"/><rect class="haze" x="${SURFACE.x}" y="${SURFACE.y}" width="${SURFACE.w}" height="${SURFACE.h}" fill="url(#planet-haze)"/>${lands}${lanes}</g>${atmosphere}`;
  // A quick coarse surface first; the sharp one follows the zoomed sector's tile (`paintTile`).
  paint($("world-svg").querySelector<SVGImageElement>("image.surface")!, SURFACE, 512);
  // Region labels: buttons on each landmass's northern shore, the sector tabs of the page (the land itself is clickable too).
  $("sector-tabs").innerHTML = cards
    .map((s, i) => {
      const r = regions[i],
        isNew = !s.locked && fresh(group[i].missions[0], options),
        state = s.locked && s.lock ? lockText(s.lock, content.missions, sectors) : "",
        line = s.locked
          ? `<b class="sector-lock">${LOCK_ICON} Locked</b>`
          : `${s.won}/${s.count}${s.stars ? ` · <i class="sector-stars">${s.stars} ★</i>` : ""}`;
      return `<button class="region" role="tab" id="sector-tab-${s.index}" data-sector="${s.index}" aria-controls="mission-list" aria-selected="false" tabindex="-1" style="--accent:${s.accent};--done:${s.won / s.count};" data-wx="${r.x}" data-wy="${round(r.y - r.ry * 0.95)}"${s.next ? ' data-next="true"' : ""}${s.won === s.count ? ' data-done="true"' : ""}${s.locked ? ' data-locked="true"' : ""}${isNew ? ' data-fresh="true"' : ""}${state ? ` title="${state}"` : ""} aria-label="Sector ${s.numeral}: ${escape(s.name)}, ${s.count} ${plural(s.count, "mission")}${s.locked ? `, locked. ${state}` : ""}${s.won ? `, ${s.won} cleared, ${s.stars} of ${s.count * 3} stars` : ""}${s.next ? ", holds the next mission" : ""}"><span class="region-label" aria-hidden="true"><small>${s.numeral}${s.next ? '<b class="sector-next">NEXT</b>' : ""}${isNew ? '<b class="sector-next sector-new">NEW</b>' : ""}</small><strong>${s.name}</strong><span class="region-line">${line}</span><span class="sector-bar"></span></span></button>`;
    })
    .join("");
}
/**
 * The mission that steps aside from its sector's route: the special operation with restricted towers, unless it
 * is the finale.
 */
export function asideOf(missions: readonly MissionDefinition[]) {
  const i = missions.findIndex((m) => m.availableTowers);
  return i >= 0 && i < missions.length - 1 ? i : undefined;
}
/**
 * The links between a sector's missions as index pairs: each to the next and, where campaign unlocks apply (a win
 * opens the next two), a fainter skip link to the one after (`true`).
 */
export function routeLinks(missions: readonly unknown[], skips: boolean): [number, number, boolean][] {
  const links: [number, number, boolean][] = [];
  for (let j = 0; j + 1 < missions.length; j++) {
    links.push([j, j + 1, false]);
    if (skips && j + 2 < missions.length) links.push([j, j + 2, true]);
  }
  return links;
}
/** The territories' seeds and biomes of the shown world, for its surface pictures. */
let seeds: SurfaceSeed[] = [];
/**
 * Pixels across for a surface picture of `box` that stays sharp while `span` world units fill the view's width;
 * phones get less, a tile never more than about 3 megapixels.
 */
function surfaceWidth(box: Box, span: number) {
  const view = $("world-view"),
    cap = view.clientWidth < 600 ? 1536 : 2048,
    wide = Math.round(((view.clientWidth || 1200) * Math.min(2, devicePixelRatio || 1) * box.w) / span);
  return Math.max(256, Math.min(cap, wide, Math.floor(Math.sqrt((3e6 * box.w) / box.h))));
}
/** Paints the surface in `box` into an SVG image, which fades in once the picture is there. */
function paint(el: SVGImageElement, box: Box, width: number) {
  surfaceImage(seeds, box, width, Math.round((width * box.h) / box.w)).then(
    (url) => {
      if (!el.isConnected) return;
      el.onload = () => el.classList.add("is-ready");
      el.setAttribute("href", url);
    },
    () => {},
  );
}
/**
 * A sharper picture of the selected sector's territory over the whole surface's, once per sector and world, then
 * the whole surface at full size (the worker paints in order, so the zoomed sector comes first).
 */
function paintTile(at: number) {
  const svg = $("world-svg"),
    tiles = svg.querySelector(".tiles"),
    region = world.regions[at],
    full = svg.querySelectorAll<SVGImageElement>("image.surface")[1];
  if (tiles && region && !tiles.querySelector(`[data-tile="${at}"]`)) tile(tiles, at, region);
  if (full && !full.dataset.painted) {
    full.dataset.painted = "true";
    paint(full, SURFACE, surfaceWidth(SURFACE, WORLD_BOX.w));
  }
}
function tile(tiles: Element, at: number, region: Region) {
  const pad = 4,
    x = Math.max(SURFACE.x, region.box.x - pad),
    y = Math.max(SURFACE.y, region.box.y - pad),
    box = { x, y, w: Math.min(SURFACE.x + SURFACE.w, region.box.x + region.box.w + pad) - x, h: Math.min(SURFACE.y + SURFACE.h, region.box.y + region.box.h + pad) - y },
    el = document.createElementNS("http://www.w3.org/2000/svg", "image");
  el.classList.add("surface");
  el.dataset.tile = String(at);
  for (const [k, v] of Object.entries({ x: box.x, y: box.y, width: box.w, height: box.h, preserveAspectRatio: "none" })) el.setAttribute(k, String(v));
  tiles.append(el);
  paint(el, box, surfaceWidth(box, stationBox(world.stations[at], 9, 8).w));
}
/** Marks the sector's landmass, places its stations, zooms into it and features a mission. */
function showSector(game: Game, sector: MissionSector | undefined, options: AtlasOptions, pickedId: string | undefined) {
  const { missions } = game.content,
    sectors = game.content.sectors ?? [],
    record = options.record ?? {},
    locks = options.locks ?? NO_LOCKS,
    shown = sector?.missions ?? missions,
    playing = options.playing ? game.mission.id : undefined,
    picked = atlasPick(shown, record, pickedId, playing, locks),
    next = sector ? modeNext(sectors, isCircleSector(sector), record, locks) : atlasNext(shown, record, locks),
    at = sector ? world.sectors.indexOf(sector) : -1,
    tabs = $("sector-tabs");
  world.selected = at;
  for (const tab of tabs.querySelectorAll<HTMLElement>("[data-sector]")) {
    const active = sector !== undefined && Number(tab.dataset.sector) === sectors.indexOf(sector);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  for (const land of $("world-svg").querySelectorAll<SVGGElement>(".land")) land.toggleAttribute("data-selected", sector !== undefined && Number(land.dataset.sector) === sectors.indexOf(sector));
  // Without a selectable tab the first one still has to be reachable by Tab.
  if (!tabs.querySelector('[tabindex="0"]')) tabs.querySelector<HTMLElement>("[data-sector]")?.setAttribute("tabindex", "0");
  const list = $("mission-list"),
    progress = progressOf(shown, record),
    closed = !!sector && sectorLocked(sector, locks),
    points = at >= 0 ? world.stations[at] : [],
    aside = asideOf(shown);
  list.setAttribute("aria-label", sector ? `Missions of sector ${roman(sectors.indexOf(sector))}, ${sector.name}` : "Missions");
  $("missions-label").innerHTML = sector ? `<small>Sector ${roman(sectors.indexOf(sector))}</small> ${sector.name}` : "Missions";
  $("missions-progress").textContent = closed
    ? `Locked · ${lockText(locks.get(shown[0].id)!, missions, sectors)}`
    : `${progress.won} of ${shown.length} cleared${progress.stars ? ` · ${progress.stars}/${shown.length * 3} ★` : ""}`;
  list.innerHTML = shown
    .map((m, i) => {
      const n = missionNumber(m, missions),
        loaded = m.id === playing,
        best = record[m.id],
        lock = locks.get(m.id),
        isNew = fresh(m, options),
        p = points[i] ?? { x: 0, y: 0 },
        flags = `${best ? ' data-won="true"' : ""}${m === next ? ' data-next="true"' : ""}${i === shown.length - 1 && shown.length > 1 ? ' data-final="true"' : ""}${i === aside ? ' data-special="true"' : ""}${lock ? ' data-locked="true"' : ""}${isNew ? ' data-fresh="true"' : ""}`,
        tags = `${m === next ? '<b class="node-tag" data-tag="next">Next</b>' : ""}${loaded ? '<b class="node-tag" data-tag="loaded">Loaded</b>' : ""}${isNew && m !== next ? '<b class="node-tag" data-tag="new">New</b>' : ""}`,
        title = lock ? `${m.focus} · ${lockText(lock, missions, sectors)}` : m.focus;
      return `<button class="mission-node" data-pick="${m.id}" data-wx="${p.x}" data-wy="${p.y}" aria-pressed="${m === picked}"${loaded ? ' aria-current="true"' : ""}${flags} title="${escape(title)}"><span class="node-mark"><span class="node-number">${pad(n)}</span>${lock ? LOCK_ICON : ""}</span><span class="node-stem" aria-hidden="true"></span><span class="node-copy"><span class="node-name">${m.name}${loaded ? '<span class="sr-only"> (in progress)</span>' : ""}${m === next ? '<span class="sr-only"> (next)</span>' : ""}${lock ? '<span class="sr-only"> (locked)</span>' : ""}${best ? `<span class="sr-only">, cleared with ${best} of 3 stars</span>` : ""}</span><small class="node-meta">${best ? `<span class="node-stars" aria-hidden="true">${starText(best)}</span>` : ""}${lock ? "Locked" : `${i === aside ? "Special op · " : ""}${m.waves.length} ${plural(m.waves.length, "wave")}${m.circle ? " · ring" : ""}`}</small></span>${tags}</button>`;
    })
    .join("");
  zoom = "sector";
  paintTile(at);
  // A frame later, so a fresh render shows the whole world first and then flies in.
  requestAnimationFrame(() => fitWorld(true));
  renderFeatured(game, picked, options);
}
/** A small padlock for locked stations and sectors. */
const LOCK_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="currentColor"/></svg>';
/** The battlefield preview, shown whole, and the briefing beside it. */
export function renderFeatured(game: Game, m: MissionDefinition | undefined, { lobby, image, record = {}, locks }: AtlasOptions) {
  const preview = $("atlas-preview"),
    body = $("brief-body"),
    actions = $("brief-actions"),
    intel = $("brief-intel");
  if (!m) {
    body.innerHTML = actions.innerHTML = intel.innerHTML = "";
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
  actions.innerHTML = lock
    ? `<p class="mission-lock" id="mission-lock">${lockText(lock, missions, sectors)}</p><button class="primary atlas-start" aria-describedby="mission-lock" disabled>Locked <span aria-hidden="true">${LOCK_ICON}</span></button>`
    : `${reset ? '<p class="mission-warning">Starting another mission resets your current defense and progress.</p>' : ""}<button class="primary atlas-start" data-mission="${m.id}">${lobby ? "Choose for Room" : "Start Mission"} <span aria-hidden="true">▶</span></button>`;
  body.scrollTop = 0;
  // Restarts the briefing's entry animation.
  body.classList.remove("is-entering");
  void body.offsetWidth;
  body.classList.add("is-entering");
}
