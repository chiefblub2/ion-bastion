// The atlas's star system view: a sun, the orbits and every world as a turning sphere.
import type { Game } from "../../core/game";
import { escape } from "../format";
import { type Lock, sectorLocked } from "../../campaign/campaign-unlock";
import { GLOBE_BOX, type Point, WRAP } from "../world-map";
import { SYSTEM, type WorldEntry } from "../planets";
import { surfaceImage } from "../planet-texture";
import { type AtlasOptions, LOCK_ICON, lockText, modeNext, NO_LOCKS, progressOf, roman } from "./model";
import { $, entries, layoutOf, round, world } from "./state";
/** Worlds whose every sector is locked: shown as silhouettes in the system view. */
const worldLocked = (entry: WorldEntry, locks: ReadonlyMap<string, Lock>) => entry.sectors.every((s) => sectorLocked(s, locks));
/** The coarse surface picture of each world, for its sphere in the system view. */
const spheres = new Map<string, Promise<string>>();
/**
 * The star system: a sun on the left, the planets on their orbits and the moon around the last planet, each a
 * slowly turning sphere of its own painted surface with a ring of the missions won. Locked worlds show dark.
 */
export function renderSystem(game: Game, options: AtlasOptions) {
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
export function placeSystem() {
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
