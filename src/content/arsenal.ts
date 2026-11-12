import type { MasteryEffect, TowerId } from "../core/types";
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

/**
 * Salvage pay (`campaign/pay.ts`; sector 1-based): per wave cleared `perWave + sector`, a win bonus, a one-time
 * first-win bonus, `star × (1 + sector)` per newly earned star, a sector finale's first win `cache + cachePerSector ×
 * sector`; a loss pays `lossShare` of its cleared waves only; the daily bounty multiplies waves and win by `bounty`.
 */
export const SALVAGE = { perWave: 1, win: 10, firstWin: 20, firstWinPerSector: 5, lossShare: 0.5, bounty: 2, star: 4, cache: 40, cachePerSector: 15 } as const;

/** Tower XP needed for veterancy ranks 1–5. */
export const VETERANCY_XP: readonly number[] = [150, 450, 1000, 2200, 4500];
/** Salvage paid on reaching veterancy rank 1–5. */
export const RANK_BONUS: readonly number[] = [15, 25, 40, 60, 90];
/** In play, per veterancy rank: the tower's build price falls by `build` (and by at least one credit per rank). */
export const RANK_PASSIVE = { build: 0.03 } as const;
/** XP per tower built. */
export const XP_BUILT = 10;
/**
 * XP per tower type built at least once in a mission, on top of kills, `XP_BUILT` and assists, by gear class (see
 * `GEAR_MARKS`). Traps and Support towers without an area rarely kill and earn few or no assists, so they get more:
 * per fielded type and mission that brings them near the Attack tab's median (about 90 XP).
 */
export const XP_FIELDED: Readonly<Record<GearClass, number>> = { armed: 30, trap: 60, support: 30, field: 80 };

/**
 * Loadout slots: `base` at the start, +1 for the first win of the finale of each listed sector (index into the
 * sectors), at most `max`.
 */
export const LOADOUT = { base: 6, finales: [0, 2, 5, 8], max: 10 } as const;

/** Salvage price of gear marks Mk I–V; Mk n needs veterancy rank n. */
export const GEAR_PRICE: readonly number[] = [80, 160, 280, 450, 700];
export const MAX_MARK = GEAR_PRICE.length;

/**
 * Gear marks Mk I–IV by tower class (`campaign/gear.ts` `gearClassOf`): `armed` Attack and Control, `trap`, `support`
 * Support towers with an area, `field` Support towers without one (Refinery, Repair Dock, Vault, Shield Generator).
 * Factors are totals against the base value, so a later mark of the same kind replaces an earlier one:
 * - `stat`: damage (kept to one decimal) or range on the definition and every upgrade that sets it;
 * - `early`: the price of the plain levels 2 and 3 (Aura: the first two tiers of each track);
 * - `paths`: the price of every specialization tier;
 * - `build`: the build price.
 */
export type MarkEffect =
  | { stat: "damage" | "range"; total: number }
  | { early: number }
  | { paths: number }
  | { build: number };
export type GearClass = "armed" | "trap" | "support" | "field";
export const GEAR_MARKS: Readonly<Record<GearClass, readonly MarkEffect[]>> = {
  armed: [{ stat: "damage", total: 1.04 }, { stat: "range", total: 1.05 }, { early: 0.8 }, { stat: "damage", total: 1.08 }],
  trap: [{ stat: "damage", total: 1.04 }, { early: 0.8 }, { stat: "damage", total: 1.08 }, { build: 0.9 }],
  support: [{ stat: "range", total: 1.05 }, { early: 0.8 }, { stat: "range", total: 1.1 }, { build: 0.9 }],
  field: [{ build: 0.95 }, { early: 0.8 }, { paths: 0.85 }, { build: 0.9 }],
};

/**
 * Mk V signature mods (plan tables), one per tower. `hit`: an effect on the tower's hits; `stat`: a stat factor;
 * `param`: an attack parameter factor; `bounty`: credits per kill.
 */
export type Signature =
  | { name: string; hit: MasteryEffect }
  | { name: string; stat: "range" | "damage"; factor: number }
  | { name: string; param: string; factor: number }
  | { name: string; bounty: number };
export const SIGNATURES: Readonly<Partial<Record<TowerId, Signature>>> = {
  pulse: { name: "Tracer Rounds", hit: { kind: "vulnerable", amount: 0.06, duration: 1.5 } },
  blast: { name: "Concussion", hit: { kind: "stun", duration: 0.2, recovery: 2 } },
  flak: { name: "Flight Breaker", hit: { kind: "slow", factor: 0.85, duration: 1 } },
  tesla: { name: "Static Charge", hit: { kind: "slow", factor: 0.85, duration: 1 } },
  lance: { name: "Overpenetration", hit: { kind: "vulnerable", amount: 0.08, duration: 1 } },
  inferno: { name: "Choking Smoke", hit: { kind: "slow", factor: 0.9, duration: 1.5 } },
  decay: { name: "Brittle Rot", hit: { kind: "vulnerable", amount: 0.05, duration: 2 } },
  shrapnel: { name: "Stagger", hit: { kind: "slow", factor: 0.85, duration: 0.5 } },
  frost: { name: "Deep Chill", hit: { kind: "vulnerable", amount: 0.05, duration: 2 } },
  acid: { name: "Caustic Shock", hit: { kind: "stun", duration: 0.15, recovery: 3 } },
  stasis: { name: "Afterchill", hit: { kind: "slow", factor: 0.8, duration: 1 } },
  net: { name: "Weighted Mesh", hit: { kind: "vulnerable", amount: 0.06, duration: 2 } },
  jammer: { name: "Feedback", hit: { kind: "slow", factor: 0.85, duration: 1.5 } },
  siphon: { name: "Overdraw", hit: { kind: "vulnerable", amount: 0.05, duration: 1.5 } },
  tether: { name: "Taut Line", hit: { kind: "vulnerable", amount: 0.05, duration: 3 } },
  aura: { name: "Wide Field", stat: "range", factor: 1.15 },
  detector: { name: "Long Sight", stat: "range", factor: 1.2 },
  refinery: { name: "Dividend", param: "amount", factor: 1.2 },
  executioner: { name: "Reaper's Due", bounty: 1 },
  // Attack
  mortar: { name: "Danger Close", param: "minRange", factor: 1 / 1.5 },
  quake: { name: "Tremor", hit: { kind: "slow", factor: 0.8, duration: 0.6 } },
  focus: { name: "Overcharge", param: "stacks", factor: 1.2 },
  skyburst: { name: "Flechette Cloud", param: "radius", factor: 1.1 / 0.9 },
  catalyst: { name: "Volatile Mix", param: "cap", factor: 1.25 },
  orbital: { name: "Rapid Uplink", param: "delay", factor: 1 / 1.4 },
  // Control
  gravity: { name: "Event Horizon", hit: { kind: "vulnerable", amount: 0.06, duration: 2 } },
  cyclone: { name: "Downdraft", hit: { kind: "slow", factor: 0.8, duration: 1.5 } },
  amber: { name: "Fault Lines", param: "bonus", factor: 1.3 },
  shrink: { name: "Lasting Shrink", param: "duration", factor: 1.25 },
  magnetar: { name: "Strong Field", param: "radius", factor: 1.9 / 1.6 },
  mesmer: { name: "Lingering Daze", hit: { kind: "slow", factor: 0.85, duration: 2.5 } },
  hex: { name: "Deep Curse", param: "share", factor: 1.25 },
  plasma: { name: "Long Burn", param: "duration", factor: 1.25 },
  // Traps
  mine: { name: "Shaped Charge", param: "radius", factor: 1.3 / 1.1 },
  spikes: { name: "Hobble", hit: { kind: "slow", factor: 0.9, duration: 4 } },
  tar: { name: "Sticky Residue", param: "duration", factor: 2.5 / 1.5 },
  snare: { name: "Torn Tendon", hit: { kind: "vulnerable", amount: 0.08, duration: 2 } },
  pit: { name: "Wider Mouth", param: "size", factor: 1.2 },
  grill: { name: "White Heat", param: "ratio", factor: 1.2 },
  oil: { name: "Slick Coat", hit: { kind: "slow", factor: 0.85, duration: 4 } },
  barricade: { name: "Reinforced", param: "hp", factor: 1.25 },
  limpet: { name: "Short Fuse", param: "fuse", factor: 0.75 },
  spring: { name: "Hard Landing", hit: { kind: "vulnerable", amount: 0.06, duration: 2 } },
  harpoon: { name: "Barbed Head", param: "duration", factor: 4 / 3 },
  arc: { name: "Grounded Coil", param: "jumps", factor: 4 / 3 },
  grinder: { name: "Chew", hit: { kind: "slow", factor: 0.85, duration: 1 } },
  warp: { name: "Deep Warp", param: "cells", factor: 1.25 },
  tripwire: { name: "Long Wire", param: "radius", factor: 1.2 },
  // Support
  beacon: { name: "Finder's Fee", param: "bonus", factor: 1.2 },
  tracker: { name: "Painted Target", param: "amount", factor: 1.2 },
  workshop: { name: "Master Tools", param: "amount", factor: 1.25 },
  dock: { name: "Spare Cells", param: "amount", factor: 2 },
  vault: { name: "Compound Interest", param: "cap", factor: 55 / 40 },
  firectl: { name: "Hot Rounds", param: "multiplier", factor: 1.2 },
  armory: { name: "AP Rounds", param: "fraction", factor: 1.2 },
  skylink: { name: "Sky Lock", param: "factor", factor: 0.7 / 0.6 },
  nexus: { name: "Wider Net", param: "cap", factor: 7 / 6 },
  overclock: { name: "Long Burst", param: "window", factor: 4 / 3 },
  recycler: { name: "Long Chain", param: "reach", factor: 1.3 },
  shieldgen: { name: "Hardened Cells", param: "amount", factor: 4 / 3 },
};
