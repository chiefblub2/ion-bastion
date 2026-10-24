import type { MissionSector } from "../core/types";
import { isCircleSector } from "../content/missions";
import type { BiomeId } from "./planet-surface";
import type { Point } from "./world-map";
/**
 * The worlds of the Sector Atlas, display only: the campaign's sectors in play order on three planets, the Circuit
 * on a moon. The simulation and the unlocks never see them. Each world lays its sectors out by hand (`centres`, in
 * world units on the 200 × 100 plane), may hold one sector as a station in orbit above the horizon, and paints its
 * unclaimed land in its own biome.
 */
export interface World {
  id: string;
  name: string;
  epithet: string;
  moon?: boolean;
  /** Campaign sectors on this planet, in play order; the last planet takes any beyond. The moon takes the Circuit. */
  count?: number;
  /** The territory centre of each sector in play order; a station's is its deck above the horizon. */
  centres: Point[];
  /** The sector (index on this world) that is a station in orbit instead of a territory. */
  station?: number;
  wild: BiomeId;
  /** The atmosphere's colour, on the planet's horizon and around its sphere in the system view. */
  atmosphere: string;
  /** The world's place and size in the system view, on wide views and on phones (`SYSTEM` units). */
  orbit: { x: number; y: number; r: number };
  orbitNarrow: { x: number; y: number; r: number };
}
export const WORLDS: readonly World[] = [
  {
    id: "vigil",
    name: "Vigil",
    epithet: "Frontier world",
    count: 4,
    centres: [
      { x: 40, y: 62 },
      { x: 98, y: 40 },
      { x: 152, y: 68 },
      { x: 138, y: -26 },
    ],
    station: 3,
    wild: "tundra",
    atmosphere: "#7fd0ff",
    orbit: { x: 270, y: 270, r: 62 },
    orbitNarrow: { x: 270, y: 210, r: 95 },
  },
  {
    id: "ashkar",
    name: "Ashkar",
    epithet: "Dead world",
    count: 4,
    centres: [
      { x: 38, y: 40 },
      { x: 82, y: 72 },
      { x: 126, y: 36 },
      { x: 168, y: 68 },
    ],
    wild: "waste",
    atmosphere: "#ffb070",
    orbit: { x: 500, y: 180, r: 70 },
    orbitNarrow: { x: 730, y: 190, r: 100 },
  },
  {
    id: "thessaly",
    name: "Thessaly Prime",
    epithet: "Wild world",
    count: 4,
    centres: [
      { x: 36, y: 66 },
      { x: 78, y: 34 },
      { x: 124, y: 66 },
      { x: 168, y: 38 },
    ],
    wild: "verdant",
    atmosphere: "#8cffb4",
    orbit: { x: 730, y: 270, r: 78 },
    orbitNarrow: { x: 300, y: 520, r: 100 },
  },
  {
    id: "kepler",
    name: "Kepler's Ring",
    epithet: "The Circuit · moon",
    moon: true,
    centres: [
      { x: 44, y: 60 },
      { x: 100, y: 36 },
      { x: 156, y: 62 },
    ],
    wild: "regolith",
    atmosphere: "#ff8fe0",
    orbit: { x: 880, y: 150, r: 34 },
    orbitNarrow: { x: 730, y: 510, r: 70 },
  },
];
/** The system view's plane and its sun, in the units of `World.orbit`; phones arrange the worlds two by two. */
export const SYSTEM = {
  wide: { w: 1000, h: 444, sun: { x: -130, y: 230, r: 360 } },
  narrow: { w: 1000, h: 750, sun: { x: -200, y: -150, r: 560 } },
};
/** A world with the sectors it shows. */
export interface WorldEntry {
  world: World;
  sectors: MissionSector[];
}
/** Splits the sectors over the worlds: campaign sectors in order by each planet's `count`, the Circuit on the moon. */
export function worldsOf(sectors: readonly MissionSector[], worlds: readonly World[] = WORLDS): WorldEntry[] {
  const campaign = sectors.filter((s) => !isCircleSector(s)),
    planets = worlds.filter((w) => !w.moon);
  let from = 0;
  return worlds
    .map((world) => {
      if (world.moon) return { world, sectors: sectors.filter(isCircleSector) };
      const last = world === planets.at(-1),
        to = last ? campaign.length : from + (world.count ?? 0),
        entry = { world, sectors: campaign.slice(from, to) };
      from = to;
      return entry;
    })
    .filter((e) => e.sectors.length);
}
/** The world entry that holds a sector. */
export const worldOf = (entries: readonly WorldEntry[], sector: MissionSector) => entries.find((e) => e.sectors.includes(sector));
