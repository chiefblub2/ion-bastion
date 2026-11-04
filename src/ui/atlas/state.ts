// What the Sector Atlas's modules share: the worlds, the world on screen, the zoom, the globe's SVG pieces and the surface seeds.
// Only `sector-atlas.ts` replaces them (through the setters); the globe and system views read them.
import type { MissionSector } from "../../core/types";
import { planetLayout, type Region, type Point } from "../world-map";
import type { Spot, Vec3 } from "../globe";
import type { WorldEntry } from "../planets";
import type { BiomeId, SurfaceSeed } from "../planet-surface";
export const motion = () => !matchMedia("(prefers-reduced-motion: reduce)").matches;
export const $ = (id: string) => document.getElementById(id)!;
/** Every world of the content (`worldsOf`), in system order. */
export let entries: WorldEntry[] = [];
/** The world on screen: its sectors, their territories and stations, and the sector selected. */
export let world: { entry: WorldEntry | null; sectors: readonly MissionSector[]; regions: Region[]; stations: Point[][]; selected: number } = {
  entry: null,
  sectors: [],
  regions: [],
  stations: [],
  selected: -1,
};
/** How far the view is zoomed: the star system, one planet, or one sector. */
export let zoom: "system" | "planet" | "sector" = "planet";
export const setEntries = (to: WorldEntry[]) => void (entries = to);
export const setWorld = (to: typeof world) => void (world = to);
export const setZoom = (to: typeof zoom) => void (zoom = to);

/** The SVG pieces that follow the globe, collected when a world renders: outlines, links, dots and decks. */
export let onGlobe: {
  outlines: { els: Element[]; pts: Vec3[] }[];
  links: { el: Element; spots: Spot[] }[];
  dots: { el: Element; spot: Spot }[];
  decks: { el: SVGGElement; c: Point }[];
  rings: Element[];
} = { outlines: [], links: [], dots: [], decks: [], rings: [] };
export const setOnGlobe = (to: typeof onGlobe) => void (onGlobe = to);
/** The territories' seeds and biomes of the shown world, for its surface pictures. */
export let seeds: SurfaceSeed[] = [];
export const setSeeds = (to: SurfaceSeed[]) => void (seeds = to);
export const num = (n: number) => Math.round(n * 10) / 10;
export const round = (n: number) => Math.round(n * 100) / 100;
/** A world's territories and the seeds and biomes of its surface (the station deck paints apart). */
export function layoutOf(entry: WorldEntry) {
  const { world: w, sectors } = entry,
    // Every world places all its sectors by hand (planets.test.ts).
    { regions, wilds } = planetLayout(w.centres.slice(0, sectors.length), w.station),
    biomes: BiomeId[] = sectors.map((s) => s.missions[0].map.theme ?? "outpost"),
    seeds: SurfaceSeed[] = [
      ...regions.flatMap((r, i) => (r.station ? [] : [{ x: r.x, y: r.y, biome: biomes[i] }])),
      ...wilds.map((t) => ({ x: t.x, y: t.y, biome: w.wild })),
    ];
  return { regions, wilds, biomes, seeds };
}
