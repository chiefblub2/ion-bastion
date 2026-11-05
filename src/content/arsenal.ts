import type { TowerId } from "../core/types";
// Campaign Arsenal content (plan: docs/superpowers/plans/2026-11-05-campaign-arsenal.md): the core kit, the research
// catalogue by price band, Salvage pay, veterancy thresholds and gear marks. Campaign only; balance scripts never read it.

/** Owned from the start of the campaign. */
export const CORE_KIT: readonly TowerId[] = ["pulse", "blast", "frost", "flak", "tesla", "aura"];

/** Price per band; the band is only a price, research has no gates beyond Salvage. */
export const TIER_PRICE = [60, 150, 250, 400] as const;
export type Tier = 0 | 1 | 2 | 3;

/** Every researchable tower with its price band (index into TIER_PRICE). */
export const CATALOGUE: Readonly<Partial<Record<TowerId, Tier>>> = {
  // Attack
  lance: 0, inferno: 0, decay: 1, shrapnel: 1, executioner: 1, mortar: 2, quake: 2, focus: 2, skyburst: 2, catalyst: 3, orbital: 3,
  // Control
  acid: 0, stasis: 0, net: 1, jammer: 1, siphon: 1, tether: 1, gravity: 2, cyclone: 2, amber: 2, shrink: 2,
  magnetar: 3, mesmer: 3, hex: 3, plasma: 3,
  // Traps
  mine: 0, spikes: 0, tar: 0, snare: 1, pit: 1, grill: 1, oil: 1, barricade: 2, limpet: 2, spring: 2, harpoon: 2,
  arc: 3, grinder: 3, warp: 3, tripwire: 3,
  // Support
  detector: 0, refinery: 0, beacon: 1, tracker: 1, workshop: 1, dock: 1, vault: 2, firectl: 2, armory: 2, skylink: 2,
  overclock: 3, recycler: 3, nexus: 3, shieldgen: 3,
};

/** Salvage pay: per wave cleared `perWave + sector` (sector 1-based), a win bonus, a one-time first-win bonus. */
export const SALVAGE = { perWave: 1, win: 10, firstWin: 20, firstWinPerSector: 5, lossShare: 0.5, bounty: 2 } as const;

/** Tower XP needed for veterancy ranks 1–5. */
export const VETERANCY_XP: readonly number[] = [200, 600, 1500, 3500, 7000];
/** XP per tower built. */
export const XP_BUILT = 10;

/** Salvage price of gear marks Mk I–V; Mk n needs veterancy rank n. */
export const GEAR_PRICE: readonly number[] = [80, 160, 280, 450, 700];
export const MAX_MARK = GEAR_PRICE.length;
