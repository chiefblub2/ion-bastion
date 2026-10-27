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
import { type Box, GLOBE_BOX, headingOf, link, planetLayout, type Region, routePoints, routeShape, serpentine, stars, type Point, WRAP } from "./world-map";
import { arc, type Camera, DECK_SCALE, deckAnchor, deckSpot, dragCamera, facing, fitCamera, lerpCamera, outlineOnScreen, type Spot, spotOnScreen, surfaceSpot, toSphere, UNIT, type Vec3 } from "./globe";
import { GlobeGL } from "./globe-gl";
import { SYSTEM, type WorldEntry, worldOf, worldsOf } from "./planets";
import { type BiomeId, biomeGround, type SurfaceSeed } from "./planet-surface";
import { surfaceImage } from "./planet-texture";
import { FIT_QUERY } from "../app/compact";
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
 * played, else the sector's next unwon mission, else its first. That sector's world shows whole for a moment, then
 * the view flies into the sector.
 */
export function renderAtlas(game: Game, options: AtlasOptions, sectorIndex?: number, pickedId?: string) {
  const sectors = game.content.sectors ?? [],
    loaded = sectorOf(game.mission, sectors),
    next = modeNext(sectors, !!loaded && isCircleSector(loaded), options.record, options.locks),
    home = (options.playing ? loaded : undefined) ?? (next ? sectorOf(next, sectors) : undefined) ?? loaded,
    selected = sectors[sectorIndex ?? (home ? sectors.indexOf(home) : 0)];
  entries = worldsOf(sectors);
  showBriefTab("overview");
  renderHeader(game, !!selected && isCircleSector(selected), options);
  renderWorld(game, (selected && worldOf(entries, selected)) ?? entries[0], options);
  renderSystem(game, options);
  zoom = "planet";
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
/** Switches to another sector (a territory, its label or a mode tab); another world or mode is rendered first. */
export function selectSector(game: Game, index: number, options: AtlasOptions) {
  const sector = (game.content.sectors ?? [])[index],
    entry = sector && worldOf(entries, sector);
  if (!sector || !entry) return;
  showWorld(game, entry, options);
  showSector(game, sector, options, undefined);
}
/**
 * Lands on a world (a planet in the system view or the world bar): its next sector selected, the whole planet in
 * view.
 */
export function selectWorld(game: Game, index: number, options: AtlasOptions) {
  const entry = entries[index];
  if (!entry) return;
  const next = atlasNext(
      entry.sectors.flatMap((s) => s.missions),
      options.record ?? {},
      options.locks,
    ),
    sector = (next && sectorOf(next, entry.sectors)) ?? entry.sectors[0];
  showWorld(game, entry, options);
  showSector(game, sector, options, undefined, false);
}
/** Renders `entry`'s world (and the header when the mode changes) unless it is already on screen. */
function showWorld(game: Game, entry: WorldEntry, options: AtlasOptions) {
  if (world.entry === entry) return;
  const circle = !!entry.world.moon;
  if (shownMode() !== circle) renderHeader(game, circle, options);
  renderWorld(game, entry, options);
  renderSystem(game, options);
  // From the system view the world is entered whole; from another world it appears at once.
  if (zoom !== "system") {
    zoom = "planet";
    fitWorld(false);
  }
}
/** Features another mission of the shown sector. */
export function selectMission(game: Game, id: string, options: AtlasOptions) {
  const m = game.content.missions.find((mission) => mission.id === id);
  if (!m) return;
  for (const node of document.querySelectorAll<HTMLElement>("#mission-list [data-pick]")) node.setAttribute("aria-pressed", String(node.dataset.pick === id));
  renderFeatured(game, m, options);
}
/** Every world of the content (`worldsOf`), in system order. */
let entries: WorldEntry[] = [];
/** The world on screen: its sectors, their territories and stations, and the sector selected. */
let world: { entry: WorldEntry | null; sectors: readonly MissionSector[]; regions: Region[]; stations: Point[][]; selected: number } = {
    entry: null,
    sectors: [],
    regions: [],
    stations: [],
    selected: -1,
  },
  zoom: "system" | "planet" | "sector" = "planet";
/** The map's zoom button steps out, sector → planet → star system, and from the system back onto the planet. */
export function toggleWorld() {
  zoom = zoom === "sector" ? "planet" : zoom === "planet" ? "system" : "planet";
  fitWorld(true);
}
/** Where a point of sector `i`'s territory (or of its deck in orbit) sits on the globe. */
function spotOf(i: number, p: Point): Spot {
  const r = world.regions[i];
  return r?.station ? deckSpot(r, p) : surfaceSpot(p);
}
/**
 * The camera of the planet view: the whole globe and any deck in orbit, smaller than the view, turned to the
 * world's sectors and seen from a little north of them.
 */
function planetCamera(width: number, height: number): Camera {
  const ground = world.regions.filter((r) => !r.station).map((r) => toSphere(r)),
    { lon, lat } = facing(ground.length ? ground : [toSphere({ x: 100, y: 50 })]),
    decks = world.regions.flatMap((r) => (r.station ? r.border.map((p) => deckSpot(r, p)) : [])),
    nav = $("world-nav").offsetHeight + 18,
    side = Math.max(16, width * 0.06),
    // A narrow map keeps the zoom button's corner clear of the globe.
    top = width < 600 ? $("world-zoom").offsetHeight + 14 : 22;
  return fitCamera(decks, lon, Math.min(0.9, lat + 0.2), width, height, { top, right: side, bottom: nav, left: side }, { disc: 1.08 });
}
/**
 * The camera of a sector zoom: the globe turned until the sector's stations face the viewer, close enough that they
 * fill the view between the legend above and the world bar below. Phones keep less room beside them (their station
 * labels shrink to the number).
 */
function sectorCamera(width: number, height: number): Camera {
  const at = world.selected,
    spots = world.stations[at].map((p) => spotOf(at, p)),
    region = world.regions[at],
    face = region.station ? deckAnchor(region) : facing(spots.map((s) => s.v)),
    { lon, lat } = "lon" in face ? face : facing([face]),
    side = width < 600 ? 44 : 90;
  // A station's badge stands about 50 px above its point and its name hangs about 40 px below it.
  return fitCamera(spots, lon, lat, width, height, {
    top: $("missions-label").parentElement!.offsetHeight + 62,
    right: side,
    bottom: $("world-nav").offsetHeight + 54,
    left: side,
  });
}
/**
 * Turns and zooms the globe so the selected sector (or the whole planet) fills the view, flying there when
 * `smooth`: the globe spins until the target faces the viewer while it zooms; the system view fades over it.
 * Territories, links and labels are projected onto the globe every frame (`place`). Called on every change and,
 * unanimated, when the view is resized.
 */
export function fitWorld(smooth = false) {
  const view = $("world-view"),
    region = world.regions[world.selected],
    sector = zoom === "sector" && !!region,
    width = view.clientWidth,
    height = view.clientHeight;
  if (!width) return;
  view.dataset.zoom = zoom === "sector" && !sector ? "planet" : zoom;
  const target = sector ? sectorCamera(width, height) : planetCamera(width, height);
  const button = $("world-zoom"),
    name = escape(world.entry?.world.name ?? "Planet");
  button.setAttribute("aria-label", zoom === "sector" ? `Show all of ${name}` : zoom === "planet" ? "Show the star system" : `Back to ${name}`);
  button.innerHTML =
    zoom === "sector" ? `<span aria-hidden="true">◱</span> ${name}` : zoom === "planet" ? '<span aria-hidden="true">◎</span> Star system' : `<span aria-hidden="true">⊕</span> ${name}`;
  button.hidden = !world.entry;
  placeSystem();
  cancelAnimationFrame(flight);
  if (!smooth || !motion() || !shown) return place(target);
  const from = shown;
  // New stations get their place at once, before the first frame of the flight.
  place(from);
  const start = performance.now(),
    ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    frame = (now: number) => {
      const t = Math.min(1, (now - start) / FLIGHT_MS);
      place(lerpCamera(from, target, ease(t)));
      if (t < 1) flight = requestAnimationFrame(frame);
    };
  flight = requestAnimationFrame(frame);
}
const FLIGHT_MS = 950;
let flight = 0,
  shown: Camera | null = null;
/** The SVG pieces that follow the globe, collected when a world renders: outlines, links, dots and decks. */
let onGlobe: {
  outlines: { els: Element[]; pts: Vec3[] }[];
  links: { el: Element; spots: Spot[] }[];
  dots: { el: Element; spot: Spot }[];
  decks: { el: SVGGElement; c: Point }[];
  rings: Element[];
} = { outlines: [], links: [], dots: [], decks: [], rings: [] };
/** The painted globe (WebGL), created with the first world; absent or not `ok`, the territories stay flat. */
let globe: GlobeGL | null = null;
const num = (n: number) => Math.round(n * 10) / 10;
/**
 * Applies one camera: the painted globe, every territory outline, link and dot projected onto it, the decks in orbit
 * and every label's screen position; what the globe hides is hidden.
 */
function place(cam: Camera) {
  const view = $("world-view"),
    width = view.clientWidth,
    height = view.clientHeight,
    cx = width / 2 + cam.ox,
    cy = height / 2 + cam.oy;
  shown = cam;
  globe?.draw(cam, width, height, Math.min(2, devicePixelRatio || 1));
  const svg = $("world-svg"),
    box = `0 0 ${width} ${height}`;
  if (svg.getAttribute("viewBox") !== box) svg.setAttribute("viewBox", box);
  for (const ring of onGlobe.rings) {
    ring.setAttribute("cx", String(num(cx)));
    ring.setAttribute("cy", String(num(cy)));
    ring.setAttribute("r", String(num(cam.r)));
  }
  for (const { els, pts } of onGlobe.outlines) {
    const out = outlineOnScreen(pts, cam, width, height),
      d = out ? `M${out.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z` : "";
    for (const el of els) el.setAttribute("d", d);
  }
  for (const { el, spots } of onGlobe.links) {
    const at = spots.map((s) => spotOnScreen(s, cam, width, height));
    el.setAttribute("d", at.some((p) => p.hidden) ? "" : `M${at.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}`);
  }
  for (const { el, spot } of onGlobe.dots) {
    const p = spotOnScreen(spot, cam, width, height);
    el.toggleAttribute("hidden", p.hidden);
    el.setAttribute("cx", String(num(p.x)));
    el.setAttribute("cy", String(num(p.y)));
  }
  // A deck faces the viewer, so it is the flat drawing moved and scaled to its anchor.
  const k = cam.r * UNIT * DECK_SCALE;
  for (const { el, c } of onGlobe.decks) {
    const p = spotOnScreen({ v: deckAnchor(c) }, cam, width, height);
    el.toggleAttribute("hidden", p.hidden);
    el.setAttribute("transform", `translate(${num(p.x)} ${num(p.y)}) scale(${k}) translate(${-c.x} ${-c.y})`);
    el.style.setProperty("--px", String(1 / k));
  }
  for (const el of view.querySelectorAll<HTMLElement>(":is(#sector-tabs, #mission-list) [data-wx]")) {
    const at = { x: Number(el.dataset.wx), y: Number(el.dataset.wy) },
      deck = el.dataset.deck?.split(",").map(Number),
      p = spotOnScreen(deck ? deckSpot({ x: deck[0], y: deck[1] }, at) : surfaceSpot(at), cam, width, height);
    el.style.transform = `translate(${num(p.x)}px, ${num(p.y)}px)`;
    // Labels give way near the horizon, where the land turns away.
    el.classList.toggle("is-behind", p.hidden || (!deck && p.z < 0.12));
  }
}
/**
 * Dragging the map turns the globe under the finger (or mouse); a drag never counts as a tap on what it started on.
 * Bound once by the app.
 */
export function bindGlobe() {
  const view = $("world-view");
  let start: { x: number; y: number; cam: Camera; id: number } | null = null,
    moved = false;
  view.addEventListener("pointerdown", (e) => {
    if (zoom === "system" || !shown || e.button > 0 || (e.target as Element).closest(".world-nav, .world-legend, .world-zoom")) return;
    start = { x: e.clientX, y: e.clientY, cam: shown, id: e.pointerId };
    moved = false;
  });
  view.addEventListener("pointermove", (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (!moved && dx * dx + dy * dy < 64) return;
    if (!moved) view.setPointerCapture(e.pointerId);
    moved = true;
    cancelAnimationFrame(flight);
    view.classList.add("is-turning");
    place(dragCamera(start.cam, dx, dy));
  });
  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    view.classList.remove("is-turning");
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  // The click that ends a drag is swallowed before the app sees it.
  view.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      moved = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );
}
const round = (n: number) => Math.round(n * 100) / 100;
/** Content index of each shown sector, which numbers it. */
let contentIndex = new Map<MissionSector, number>();
/** The header of one mode: title, context line, rules and the Campaign/Circuit toggle. */
function renderHeader(game: Game, circle: boolean, options: AtlasOptions) {
  const { lobby, record = {} } = options;
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
}
/** A world's territories and the seeds and biomes of its surface (the station deck paints apart). */
function layoutOf(entry: WorldEntry) {
  const { world: w, sectors } = entry,
    centres = w.centres.length >= sectors.length ? w.centres.slice(0, sectors.length) : serpentine(sectors.length),
    station = w.centres.length >= sectors.length ? w.station : undefined,
    { regions, wilds } = planetLayout(centres, station),
    biomes: BiomeId[] = sectors.map((s) => s.missions[0].map.theme ?? "outpost"),
    seeds: SurfaceSeed[] = [
      ...regions.flatMap((r, i) => (r.station ? [] : [{ x: r.x, y: r.y, biome: biomes[i] }])),
      ...wilds.map((t) => ({ x: t.x, y: t.y, biome: w.wild })),
    ];
  return { regions, wilds, biomes, seeds };
}
/** The world on screen: its surface, territories (or deck), routes, links and every sector's label. */
function renderWorld(game: Game, entry: WorldEntry, options: AtlasOptions) {
  const { record = {}, locks = NO_LOCKS } = options;
  const { content } = game,
    sectors = content.sectors ?? [],
    circle = !!entry.world.moon,
    group = entry.sectors,
    { regions, wilds, biomes, seeds: surface } = layoutOf(entry),
    all = atlasSectors(content, circle, record, locks),
    cards = group.map((s) => all.find((c) => c.index === sectors.indexOf(s))!);
  const stations = group.map((s, i) =>
    routePoints(regions[i], s.missions.length, {
      shape: routeShape(s.missions[0].map.theme ?? "outpost", circle),
      heading: headingOf(regions, i),
      mirror: i % 2 === 1,
      aside: asideOf(s.missions),
    }),
  );
  world = { entry, sectors: group, regions, stations, selected: -1 };
  seeds = surface;
  contentIndex = new Map(group.map((s) => [s, sectors.indexOf(s)]));
  // Every piece that follows the globe carries an index into `onGlobe`: outlines (`data-o`), links (`data-l`) and
  // dots (`data-d`). Its coordinates are filled in by `place`.
  const outlines: Vec3[][] = [],
    links: Spot[][] = [],
    dotSpots: Spot[] = [],
    outline = (pts: readonly Point[]) => outlines.push(pts.map(toSphere)) - 1,
    joint = (spots: Spot[]) => links.push(spots) - 1;
  // Links from each sector's last station to the next sector's first; lit once the next sector is open. Between two
  // territories they follow the globe's curve; to and from a deck in orbit they run straight.
  const lanes = stations
      .slice(1)
      .map((points, i) => {
        const a = spotOf(i, stations[i].at(-1)!),
          b = spotOf(i + 1, points[0]),
          spots = regions[i].station || regions[i + 1].station ? [a, b] : arc(a.v, b.v, 14).map((v) => ({ v }));
        return `<path class="lane" data-l="${joint(spots)}" data-state="${cards[i + 1].locked ? "locked" : "open"}"/>`;
      })
      .join(""),
    grounds = regions.map((r, i) => (r.station ? "" : `<path class="ground" style="fill:${biomeGround(biomes[i])}" data-o="${outline(r.border)}"/>`)).join(""),
    land = (r: Region, i: number) => {
      const s = cards[i],
        list = group[i].missions,
        // A deck is drawn flat in its own plane units (the frame moves and scales it); territories follow the globe.
        flat = !!r.station,
        o = flat ? -1 : outline(r.border),
        shape = flat ? ` d="${r.outline}"` : ` data-o="${o}"`,
        routes = routeLinks(list, !circle)
          .map(([a, b, skip]) => {
            const state = record[list[a].id] && record[list[b].id] ? "lit" : locks.has(list[b].id) ? "locked" : "open";
            return `<path class="route${skip ? " skip" : ""}" data-state="${state}"${flat ? ` d="${link(stations[i][a], stations[i][b])}"` : ` data-l="${joint([surfaceSpot(stations[i][a]), surfaceSpot(stations[i][b])])}"`}/>`;
          })
          .join(""),
        dots = stations[i]
          .map((p, j) => {
            const state = record[list[j].id] ? "won" : locks.has(list[j].id) ? "locked" : "open";
            return `<circle class="dot" data-state="${state}"${flat ? ` cx="${p.x}" cy="${p.y}"` : ` data-d="${dotSpots.push(surfaceSpot(p)) - 1}"`} r="1"/>`;
          })
          .join(""),
        // The border is clipped to the territory, so two neighbours draw their shared edge side by side, each in its
        // own state's colour: held (all won), contested (open) or hostile (locked).
        state = s.locked ? "hostile" : s.won === s.count ? "held" : "open",
        // A station's deck carries its own painted plating under the tint.
        deck = flat
          ? `<path class="deck-hull" d="${r.outline}"/><image class="surface deck-plating" clip-path="url(#land-clip-${i})" x="${r.box.x}" y="${r.box.y}" width="${r.box.w}" height="${r.box.h}" preserveAspectRatio="none"/>`
          : "";
      return `<g class="land${flat ? " station" : ""}" data-sector="${s.index}" data-state="${state}" style="--accent:${s.accent}"${s.next ? ' data-next="true"' : ""}><clipPath id="land-clip-${i}"><path${shape}/></clipPath>${deck}<path class="tint"${shape}/><path class="border" clip-path="url(#land-clip-${i})"${shape}/>${routes}${dots}</g>`;
    },
    lands = regions.map((r, i) => (r.station ? "" : land(r, i))).join(""),
    decks = regions.map((r, i) => (r.station ? `<g class="deck-frame" data-deck="${i}">${land(r, i)}</g>` : "")).join("");
  // The planet: a flat globe of the wild biome with the territories' ground colours until the painted surface is on
  // the GPU (globe-gl.ts paints it under this SVG, lit from the upper left), then only tints, borders and links;
  // the atmosphere's glow and rim around it; decks in orbit above. Stars sit on their own layer behind the globe.
  const view = $("world-view");
  $("world-sky").innerHTML = stars(160)
    .map((p) => `<circle cx="${p.x * 100}%" cy="${p.y * 100}%" r="${p.r}"/>`)
    .join("");
  $("world-svg").innerHTML = `<defs><radialGradient id="globe-shade" cx="0.32" cy="0.28" r="0.85"><stop offset="0.45" class="shade-day"/><stop offset="1" class="shade-night"/></radialGradient></defs><circle class="atmo atmo-wide" data-ring/><circle class="atmo atmo-mid" data-ring/><g class="planet"><circle class="globe-base" data-ring style="fill:${biomeGround(entry.world.wild)}"/>${grounds}<circle class="globe-shade" data-ring fill="url(#globe-shade)"/>${lands}${lanes}</g><circle class="atmo atmo-rim" data-ring/>${decks}`;
  const svg = $("world-svg"),
    each = (attr: string) => {
      const map = new Map<number, Element[]>();
      for (const el of svg.querySelectorAll(`[${attr}]`)) {
        const k = Number(el.getAttribute(attr));
        map.set(k, [...(map.get(k) ?? []), el]);
      }
      return map;
    };
  const byOutline = each("data-o"),
    byLink = each("data-l"),
    byDot = each("data-d");
  onGlobe = {
    outlines: outlines.map((pts, k) => ({ els: byOutline.get(k) ?? [], pts })),
    links: links.flatMap((spots, k) => (byLink.get(k) ?? []).map((el) => ({ el, spots }))),
    dots: dotSpots.flatMap((spot, k) => (byDot.get(k) ?? []).map((el) => ({ el, spot }))),
    decks: [...svg.querySelectorAll<SVGGElement>(".deck-frame")].map((el) => ({ el, c: regions[Number(el.dataset.deck)] })),
    rings: [...svg.querySelectorAll("[data-ring]")],
  };
  // The painted globe: a quick coarse surface first; the selected sector's sharp tile and the full surface follow
  // (`paintTile`).
  view.style.setProperty("--atmo", entry.world.atmosphere);
  paintGlobe(entry);
  regions.forEach((r, i) => {
    const plating = r.station && svg.querySelector<SVGImageElement>(`.land[data-sector="${cards[i].index}"] .deck-plating`);
    if (plating) paint(plating, r.box, 768, [{ x: r.x, y: r.y, biome: biomes[i] }]);
  });
  // Region labels: buttons in the north of each territory, the sector tabs of the page (the land itself is clickable too).
  $("sector-tabs").innerHTML = cards
    .map((s, i) => {
      const r = regions[i],
        isNew = !s.locked && fresh(group[i].missions[0], options),
        state = s.locked && s.lock ? lockText(s.lock, content.missions, sectors) : "",
        line = s.locked
          ? `<b class="sector-lock">${LOCK_ICON} Locked</b>`
          : `${s.won}/${s.count}${s.stars ? ` · <i class="sector-stars">${s.stars} ★</i>` : ""}`;
      return `<button class="region" role="tab" id="sector-tab-${s.index}" data-sector="${s.index}" aria-controls="mission-list" aria-selected="false" tabindex="-1" style="--accent:${s.accent};--done:${s.won / s.count};" data-wx="${r.label.x}" data-wy="${r.label.y}"${r.station ? ` data-deck="${r.x},${r.y}"` : ""}${s.next ? ' data-next="true"' : ""}${s.won === s.count ? ' data-done="true"' : ""}${s.locked ? ' data-locked="true"' : ""}${isNew ? ' data-fresh="true"' : ""}${state ? ` title="${state}"` : ""} aria-label="Sector ${s.numeral}: ${escape(s.name)}${r.station ? ", a station in orbit" : ""}, ${s.count} ${plural(s.count, "mission")}${s.locked ? `, locked. ${state}` : ""}${s.won ? `, ${s.won} cleared, ${s.stars} of ${s.count * 3} stars` : ""}${s.next ? ", holds the next mission" : ""}"><span class="region-label" aria-hidden="true"><small>${s.numeral}${r.station ? '<b class="sector-orbit">IN ORBIT</b>' : ""}${s.next ? '<b class="sector-next">NEXT</b>' : ""}${isNew ? '<b class="sector-next sector-new">NEW</b>' : ""}</small><strong>${s.name}</strong><span class="region-line">${line}</span><span class="sector-bar"></span></span></button>`;
    })
    .join("");
  // The world bar: this world's name, the worlds before and after it.
  const at = entries.indexOf(entry),
    hop = (i: number, dir: "prev" | "next") => {
      const other = entries[i];
      return other
        ? `<button class="world-hop" data-planet="${i}" data-dir="${dir}" aria-label="Go to ${escape(other.world.name)}">${dir === "prev" ? "‹ " : ""}${escape(other.world.name)}${dir === "next" ? " ›" : ""}</button>`
        : '<span class="world-hop" aria-hidden="true"></span>';
    };
  $("world-nav").innerHTML = `${hop(at - 1, "prev")}<p class="world-name"><strong>${escape(entry.world.name)}</strong><small>${escape(entry.world.epithet)}</small></p>${hop(at + 1, "next")}`;
}
/** Worlds whose every sector is locked: shown as silhouettes in the system view. */
const worldLocked = (entry: WorldEntry, locks: ReadonlyMap<string, Lock>) => entry.sectors.every((s) => sectorLocked(s, locks));
/** The coarse surface picture of each world, for its sphere in the system view. */
const spheres = new Map<string, Promise<string>>();
/**
 * The star system: a sun on the left, the planets on their orbits and the moon around the last planet, each a
 * slowly turning sphere of its own painted surface with a ring of the missions won. Locked worlds show dark.
 */
function renderSystem(game: Game, options: AtlasOptions) {
  const { record = {}, locks = NO_LOCKS } = options,
    { missions } = game.content,
    sectors = game.content.sectors ?? [];
  drawn = null;
  const next = [false, true].map((circle) => modeNext(sectors, circle, record, locks));
  $("system-bodies").innerHTML = entries
    .map((entry, i) => {
      const { world: w } = entry,
        list = entry.sectors.flatMap((s) => s.missions),
        { won, stars, count } = progressOf(list, record),
        locked = worldLocked(entry, locks),
        lock = locked ? locks.get(entry.sectors[0].missions[0].id) : undefined,
        holdsNext = next.some((m) => !!m && list.includes(m)),
        line = locked && lock ? lockText(lock, missions, sectors) : `${won}/${count} cleared${stars ? ` · ${stars} ★` : ""}`,
        short = locked ? `${LOCK_ICON} Locked` : `${won}/${count}${stars ? ` · ${stars} ★` : ""}`,
        span = `${roman(sectors.indexOf(entry.sectors[0]))}–${roman(sectors.indexOf(entry.sectors.at(-1)!))}`;
      return `<button class="world-body" data-planet="${i}" style="--atmo:${w.atmosphere};--done:${count ? won / count : 0}"${w.moon ? ' data-moon="true"' : ""}${locked ? ' data-locked="true"' : ""}${holdsNext ? ' data-next="true"' : ""}${entry === world.entry ? ' aria-current="true"' : ""} aria-label="${escape(w.name)}, ${escape(w.epithet)}, sectors ${span}. ${escape(line)}"><span class="body-sphere" aria-hidden="true"><svg class="body-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="1"/><circle class="body-done" cx="50" cy="50" r="48" pathLength="1"/></svg></span><span class="body-label" aria-hidden="true"><small>${escape(w.epithet)} · ${span}${holdsNext ? ' <b class="sector-next">NEXT</b>' : ""}</small><strong>${escape(w.name)}</strong><span class="body-line">${locked ? `${LOCK_ICON} ` : ""}${escape(line)}</span><span class="body-short">${short}</span></span></button>`;
    })
    .join("");
  entries.forEach((entry, i) => {
    let picture = spheres.get(entry.world.id);
    if (!picture) {
      picture = surfaceImage(layoutOf(entry).seeds, GLOBE_BOX, 512, 256, WRAP);
      picture.catch(() => spheres.delete(entry.world.id));
      spheres.set(entry.world.id, picture);
    }
    picture.then(
      (url) => {
        const sphere = $("system-bodies").querySelector<HTMLElement>(`[data-planet="${i}"] .body-sphere`);
        sphere?.style.setProperty("--surface", `url("${url}")`);
      },
      () => {},
    );
  });
  placeSystem();
}
/** The system layout the SVG shows ("wide" or "narrow"), redrawn when the view crosses the phone width. */
let drawn: keyof typeof SYSTEM | null = null;
/** The sun and the orbits of one layout: planets around the sun, the moon around the last planet. */
function drawOrbits(layout: keyof typeof SYSTEM) {
  const { w, h, sun } = SYSTEM[layout],
    at = (e: WorldEntry) => (layout === "narrow" ? e.world.orbitNarrow : e.world.orbit),
    // An orbit through `p` around `c`, flattened by `k`.
    orbit = (c: Point, p: Point, k: number) => {
      const rx = Math.sqrt((p.x - c.x) ** 2 + ((p.y - c.y) / k) ** 2);
      return `<ellipse class="orbit" cx="${c.x}" cy="${c.y}" rx="${round(rx)}" ry="${round(rx * k)}"/>`;
    },
    host = entries.filter((e) => !e.world.moon).at(-1),
    orbits = entries.map((e) => (e.world.moon && host ? orbit(at(host), at(e), 0.55) : orbit(sun, at(e), layout === "narrow" ? 0.7 : 0.4))).join(""),
    svg = $("system-svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = `<defs><radialGradient id="sun-glow"><stop offset="0" class="sun-core"/><stop offset="0.25" class="sun-mid"/><stop offset="1" class="sun-edge"/></radialGradient></defs><circle class="sun" cx="${sun.x}" cy="${sun.y}" r="${sun.r}" fill="url(#sun-glow)"/>${orbits}`;
  drawn = layout;
}
/** Places the worlds of the system view over its SVG, which fits the layout's plane into the view (meet). */
function placeSystem() {
  const view = $("world-view"),
    width = view.clientWidth,
    height = view.clientHeight,
    layout = width < 600 ? "narrow" : "wide",
    { w, h } = SYSTEM[layout],
    scale = Math.min(width / w, height / h),
    ox = (width - w * scale) / 2,
    oy = (height - h * scale) / 2;
  if (!width) return;
  if (drawn !== layout) drawOrbits(layout);
  $("system-view").toggleAttribute("data-narrow", layout === "narrow");
  for (const el of $("system-bodies").querySelectorAll<HTMLElement>("[data-planet]")) {
    const world = entries[Number(el.dataset.planet)]?.world,
      o = world && (layout === "narrow" ? world.orbitNarrow : world.orbit);
    if (!o) continue;
    el.style.transform = `translate(${Math.round(ox + o.x * scale)}px, ${Math.round(oy + o.y * scale)}px)`;
    el.style.setProperty("--size", `${Math.round(o.r * 2 * scale)}px`);
  }
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
/** Pixels across the painted globe and a sector's tile: powers of two (the GPU wraps and mipmaps them), less on phones. */
const globeSize = () => ($("world-view").clientWidth < 700 ? 1024 : 2048);
/** Bumped with every world painted, so a picture for the world before is dropped when it arrives late. */
let painting = 0;
/** Starts the globe's surface for a world: a quick coarse picture; `paintTile` asks for the sharp ones. */
function paintGlobe(entry: WorldEntry) {
  const view = $("world-view");
  if (!globe) {
    globe = new GlobeGL($("world-globe") as HTMLCanvasElement);
    globe.onChange = () => {
      view.dataset.globe = "ready";
      if (shown) place(shown);
    };
    // QA scripts read the globe's state in dev builds.
    if (import.meta.env.DEV) (window as Window & { __globe?: GlobeGL }).__globe = globe;
  }
  const id = ++painting,
    stale = () => id !== painting;
  delete view.dataset.globe;
  fullPainted = false;
  if (!globe.ok) return;
  globe.clear();
  globe.setAtmosphere(entry.world.atmosphere);
  surfaceImage(seeds, GLOBE_BOX, 512, 256, WRAP).then(
    (url) => globe!.setBase(url, stale),
    () => {},
  );
}
let fullPainted = false;
/** Paints the surface in `box` into an SVG image, which fades in once the picture is there. */
function paint(el: SVGImageElement, box: Box, width: number, from: readonly SurfaceSeed[] = seeds) {
  surfaceImage(from, box, width, Math.round((width * box.h) / box.w)).then(
    (url) => {
      if (!el.isConnected) return;
      el.onload = () => el.classList.add("is-ready");
      el.setAttribute("href", url);
    },
    () => {},
  );
}
/**
 * A sharper picture of the selected sector's territory over the globe's, then the whole surface at full size (the
 * worker paints in order, so the zoomed sector comes first). A deck has its own plating, so it needs no tile.
 */
function paintTile(at: number) {
  if (!globe?.ok) return;
  const region = world.regions[at],
    id = painting,
    stale = () => id !== painting || world.selected !== at,
    size = globeSize();
  if (region && !region.station) {
    const pad = 5,
      x = Math.max(0, region.box.x - pad),
      y = Math.max(0, region.box.y - pad),
      box = { x, y, w: Math.min(GLOBE_BOX.w, region.box.x + region.box.w + pad) - x, h: Math.min(GLOBE_BOX.h, region.box.y + region.box.h + pad) - y };
    surfaceImage(seeds, box, size, size).then(
      (url) => globe!.setDetail(url, box, stale),
      () => {},
    );
  } else globe.setDetail(null, null);
  if (!fullPainted) {
    fullPainted = true;
    surfaceImage(seeds, GLOBE_BOX, size, size / 2, WRAP).then(
      (url) => globe!.setBase(url, () => id !== painting),
      () => {},
    );
  }
}
/** Marks the sector's territory, places its stations, zooms into it (unless `fly` is false) and features a mission. */
function showSector(game: Game, sector: MissionSector | undefined, options: AtlasOptions, pickedId: string | undefined, fly = true) {
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
    // A deck's stations are placed on the deck in orbit, not on the ground.
    deckAt = at >= 0 && world.regions[at].station ? ` data-deck="${world.regions[at].x},${world.regions[at].y}"` : "",
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
      return `<button class="mission-node" data-pick="${m.id}" data-wx="${p.x}" data-wy="${p.y}"${deckAt} aria-pressed="${m === picked}"${loaded ? ' aria-current="true"' : ""}${flags} title="${escape(title)}"><span class="node-mark"><span class="node-number">${pad(n)}</span>${lock ? LOCK_ICON : ""}</span><span class="node-stem" aria-hidden="true"></span><span class="node-copy"><span class="node-name">${m.name}${loaded ? '<span class="sr-only"> (in progress)</span>' : ""}${m === next ? '<span class="sr-only"> (next)</span>' : ""}${lock ? '<span class="sr-only"> (locked)</span>' : ""}${best ? `<span class="sr-only">, cleared with ${best} of 3 stars</span>` : ""}</span><small class="node-meta">${best ? `<span class="node-stars" aria-hidden="true">${starText(best)}</span>` : ""}${lock ? "Locked" : `${i === aside ? "Special op · " : ""}${m.waves.length} ${plural(m.waves.length, "wave")}${m.circle ? " · ring" : ""}`}</small></span>${tags}</button>`;
    })
    .join("");
  zoom = fly ? "sector" : "planet";
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
