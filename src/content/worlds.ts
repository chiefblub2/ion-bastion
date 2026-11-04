import type { MissionSector } from "../core/types";
import { isCircleSector } from "./missions";
/**
 * The worlds the sectors belong to: the campaign's sectors in play order on three planets, the Circuit on a moon.
 * The Run's acts draw their source missions planet by planet (`run/acts.ts`); the Sector Atlas (`ui/planets.ts`)
 * adds the display data (globe layout, biome, orbit). The simulation and the unlocks never see them.
 */
export interface WorldTier {
  id: string;
  name: string;
  moon?: boolean;
  /** Campaign sectors on this planet, in play order; the last planet takes any beyond. The moon takes the Circuit. */
  count?: number;
  /** The atmosphere's colour, on the planet's horizon, around its sphere in the system view and on a Run act's page. */
  atmosphere: string;
}
export const WORLD_TIERS: readonly WorldTier[] = [
  { id: "vigil", name: "Vigil", count: 4, atmosphere: "#7fd0ff" },
  { id: "ashkar", name: "Ashkar", count: 4, atmosphere: "#ffb070" },
  { id: "thessaly", name: "Thessaly Prime", count: 4, atmosphere: "#8cffb4" },
  { id: "kepler", name: "Kepler's Ring", moon: true, atmosphere: "#ff8fe0" },
];
/** A world with the sectors it holds. */
export interface WorldEntry<W extends WorldTier = WorldTier> {
  world: W;
  sectors: MissionSector[];
}
/** Splits the sectors over the worlds: campaign sectors in order by each planet's `count`, the Circuit on the moon. */
export function worldsOf<W extends WorldTier>(sectors: readonly MissionSector[], worlds: readonly W[]): WorldEntry<W>[] {
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
