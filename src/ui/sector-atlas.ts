import type { Game } from "../core/game";
import type { MissionSector } from "../core/types";
import { isCircleSector, missionNumber, sectorOf } from "../content/missions";
import { escape } from "./format";
import { starText } from "../campaign/rating";
import { sectorLocked } from "../campaign/campaign-unlock";
import { headingOf, link, type Region, routePoints, routeShape, stars, type Point } from "./world-map";
import { arc, type Spot, surfaceSpot, toSphere, type Vec3 } from "./globe";
import { type WorldEntry, worldOf, worldsOf } from "./planets";
import { biomeGround } from "./planet-surface";
import { asideOf, atlasGroup, atlasNext, type AtlasOptions, atlasPick, atlasSectors, fresh, LOCK_ICON, lockText, modeNext, NO_LOCKS, pad, plural, progressOf, roman, routeLinks } from "./atlas/model";
import { $, entries, layoutOf, setEntries, setOnGlobe, setSeeds, setWorld, setZoom, world, zoom } from "./atlas/state";
import { fitWorld, paint, paintGlobe, paintTile, spotOf } from "./atlas/globe-view";
import { renderSystem } from "./atlas/system";
import { renderFeatured, showBriefTab } from "./atlas/card";
/**
 * The mission page as a Sector Atlas: a world map with every sector of the mode as a landmass (its terrain, its
 * missions as stations on a route, sea lanes to the next sector) that zooms into the selected sector, then the
 * featured mission's whole battlefield and its briefing. Campaign and Circuit sectors
 * are separate modes and never share a gallery. Campaign missions unlock with progress (`campaign/campaign-unlock.ts`):
 * locked ones can be looked at but not started. Each region is updated on its own, so picking a mission never rebuilds the gallery.
 */
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
  setEntries(worldsOf(sectors));
  showBriefTab("overview");
  renderHeader(game, !!selected && isCircleSector(selected), options);
  renderWorld(game, (selected && worldOf(entries, selected)) ?? entries[0], options);
  renderSystem(game, options);
  setZoom("planet");
  fitWorld(false);
  showSector(game, selected, options, pickedId);
}
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
    setZoom("planet");
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
/** The world on screen: its surface, territories (or deck), routes, links and every sector's label. */
function renderWorld(game: Game, entry: WorldEntry, options: AtlasOptions) {
  const { record = {}, locks = NO_LOCKS } = options;
  const { content } = game,
    sectors = content.sectors ?? [],
    circle = !!entry.world.moon,
    group = entry.sectors,
    { regions, biomes, seeds: surface } = layoutOf(entry),
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
  setWorld({ entry, sectors: group, regions, stations, selected: -1 });
  setSeeds(surface);
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
  setOnGlobe({
    outlines: outlines.map((pts, k) => ({ els: byOutline.get(k) ?? [], pts })),
    links: links.flatMap((spots, k) => (byLink.get(k) ?? []).map((el) => ({ el, spots }))),
    dots: dotSpots.flatMap((spot, k) => (byDot.get(k) ?? []).map((el) => ({ el, spot }))),
    decks: [...svg.querySelectorAll<SVGGElement>(".deck-frame")].map((el) => ({ el, c: regions[Number(el.dataset.deck)] })),
    rings: [...svg.querySelectorAll("[data-ring]")],
  });
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
  setZoom(fly ? "sector" : "planet");
  paintTile(at);
  // A frame later, so a fresh render shows the whole world first and then flies in.
  requestAnimationFrame(() => fitWorld(true));
  renderFeatured(game, picked, options);
}
