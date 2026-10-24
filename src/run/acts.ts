import type { ContentPack, MissionDefinition, MissionSector } from "../core/types";
import { isCircleSector } from "../content/missions";
import { WORLDS, worldsOf } from "../ui/planets";
/**
 * The acts of a run follow the campaign's tiers, the planets of the Sector Atlas (`ui/planets.ts`, display data only):
 * act I draws its maps from Vigil, act II from Ashkar, act III from Thessaly Prime. The Final Stand takes the last
 * sectors of the last planet, which act III then leaves out.
 */
export interface ActTier {
  name: string;
  /** The planet's atmosphere colour, for the act's page. */
  color: string;
  missions: readonly MissionDefinition[];
}
/** Sectors of the last planet kept for the Final Stand. */
const FINAL_SECTORS = 2;
export const ACT_COUNT = 3;
/** The three act tiers and the Final Stand's pool, in play order. */
export function actTiers(content: ContentPack): ActTier[] {
  const sectors: readonly MissionSector[] = content.sectors ?? [{ id: "all", name: "All", missions: content.missions }],
    planets = worldsOf(sectors.filter((s) => !isCircleSector(s)), WORLDS.filter((w) => !w.moon)),
    flat = (list: readonly MissionSector[]) => list.flatMap((s) => s.missions);
  const tiers = planets.slice(0, ACT_COUNT).map((e) => ({ name: e.world.name, color: e.world.atmosphere, sectors: e.sectors }));
  // Fewer planets than acts (a small test pack): repeat the last tier.
  while (tiers.length < ACT_COUNT) tiers.push(tiers[tiers.length - 1]);
  const last = tiers[ACT_COUNT - 1],
    keep = Math.max(1, last.sectors.length - FINAL_SECTORS),
    final = last.sectors.length > 1 ? last.sectors.slice(keep) : last.sectors;
  return [
    ...tiers.map((t, i) => ({ name: t.name, color: t.color, missions: flat(i === ACT_COUNT - 1 && last.sectors.length > 1 ? t.sectors.slice(0, keep) : t.sectors) })),
    { name: "Final Stand", color: last.color, missions: flat(final) },
  ];
}
