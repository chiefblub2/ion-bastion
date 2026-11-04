// The atlas's globe: its cameras (planet and sector), the flight between them, projecting every piece each frame, dragging, and painting the surface.
import { escape } from "../format";
import { type Box, GLOBE_BOX, type Point, WRAP } from "../world-map";
import { type Camera, DECK_SCALE, deckAnchor, deckSpot, dragCamera, facing, fitCamera, lerpCamera, outlineOnScreen, type Spot, spotOnScreen, surfaceSpot, toSphere, UNIT } from "../globe";
import { GlobeGL } from "../globe-gl";
import type { WorldEntry } from "../planets";
import type { SurfaceSeed } from "../planet-surface";
import { surfaceImage } from "../planet-texture";
import { $, motion, num, onGlobe, seeds, setZoom, world, zoom } from "./state";
import { placeSystem } from "./system";
/** The map's zoom button steps out, sector → planet → star system, and from the system back onto the planet. */
export function toggleWorld() {
  setZoom(zoom === "sector" ? "planet" : zoom === "planet" ? "system" : "planet");
  fitWorld(true);
}
/** Where a point of sector `i`'s territory (or of its deck in orbit) sits on the globe. */
export function spotOf(i: number, p: Point): Spot {
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
/** The painted globe (WebGL), created with the first world; absent or not `ok`, the territories stay flat. */
export let globe: GlobeGL | null = null;
/**
 * Applies one camera: the painted globe, every territory outline, link and dot projected onto it, the decks in orbit
 * and every label's screen position; what the globe hides is hidden.
 */
export function place(cam: Camera) {
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
/** Pixels across the painted globe and a sector's tile: powers of two (the GPU wraps and mipmaps them), less on phones. */
const globeSize = () => ($("world-view").clientWidth < 700 ? 1024 : 2048);
/** Bumped with every world painted, so a picture for the world before is dropped when it arrives late. */
let painting = 0;
/** Starts the globe's surface for a world: a quick coarse picture; `paintTile` asks for the sharp ones. */
export function paintGlobe(entry: WorldEntry) {
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
export function paint(el: SVGImageElement, box: Box, width: number, from: readonly SurfaceSeed[] = seeds) {
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
export function paintTile(at: number) {
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
