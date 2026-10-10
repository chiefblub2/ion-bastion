import { specializationUpgrades, specializationVisuals } from "./specializations";
import type { TowerStats, UpgradeDefinition, TowerDefinition, AttackSpec, SupportAttack } from "../core/types";
/** Extra effects and text for individual late levels of one tower. */
export type LevelSpecials = Partial<Record<number, { attack: Readonly<Record<string, number>>; description: string }>>;

/**
 * Per level: cost factor of the build cost and stat multipliers against level 1.
 * Levels 4 and 5 are expensive but yield more damage per credit than extra towers.
 */
const ATTACK_LEVELS = [
  { level: 2, cost: 0.9, damage: 1.65, range: 0.3, interval: 0.9 },
  { level: 3, cost: 1.5, damage: 1.65 ** 2, range: 0.6, interval: 0.81 },
  { level: 4, cost: 3.0, damage: 4.8, range: 0.8, interval: 0.66 },
  { level: 5, cost: 4.5, damage: 7.0, range: 1.0, interval: 0.6 },
] as const;

/** Content factory only: costs and stat snapshots preserve the original balance. */
export function attackUpgrades(base: TowerStats, buildCost: number, specials: LevelSpecials = {}, growsRange = true): readonly UpgradeDefinition[] {
  return ATTACK_LEVELS.map(({ level, cost, damage, range, interval }) => ({
    id: `level-${level}`,
    label: `Level ${level}`,
    description: specials[level]?.description ?? (level <= 3
      ? "More damage, longer range and 10% less time between shots."
      : "Late upgrade: expensive, but stronger per credit than another tower. Much more damage and less time between shots."),
    cost: Math.round(buildCost * cost),
    requires: level === 2 ? [] : [`level-${level - 1}`],
    effects: {
      level,
      stats: {
        damage: Math.round(base.damage * damage),
        range: growsRange ? base.range + range : base.range,
        interval: base.interval * interval,
      },
      ...(specials[level] ? { attack: specials[level].attack } : {}),
    },
  }));
}

/**
 * Per aura stat: one path of three tiers, each requiring the previous one. Tier 1 keeps the
 * plain stat ID and fixes the tower's path; the other paths are excluded from then on.
 */
const AURA_TRACKS = [
  { stat: "damage", label: "Damage", tiers: [[100, 0.25], [180, 0.40], [300, 0.55]], effect: "damage for supported attack towers" },
  { stat: "speed", label: "Attack Speed", tiers: [[120, 0.20], [200, 0.35], [320, 0.50]], effect: "attacks per second for supported towers" },
  { stat: "range", label: "Range", tiers: [[100, 0.15], [170, 0.25], [280, 0.35]], effect: "attack range for supported towers" },
] as const;

const auraId = (stat: string, tier: number) => (tier === 1 ? stat : `${stat}-${tier}`);
const pct = (value: number) => `${Math.round(value * 100)}%`;

export const AURA_UPGRADES: readonly UpgradeDefinition[] = AURA_TRACKS.flatMap(({ stat, label, tiers, effect }) =>
  tiers.map(([cost, value], index) => ({
    id: auraId(stat, index + 1),
    label: `${label}${["", " II", " III"][index]}`,
    cost,
    requires: index === 0 ? [] : [auraId(stat, index)],
    path: stat,
    description: index === 0
      ? `Locks in the path: +${pct(value)} ${effect}. The other paths are locked for this tower.`
      : `Raises the bonus from +${pct(tiers[index - 1][1])} to +${pct(value)} ${effect}.`,
    effects: { aura: { [stat]: value } },
  })),
);

/** Refinery: two levels that raise the credits paid after every wave. */
const REFINERY_LEVELS = [
  { level: 2, cost: 100, amount: 40 },
  { level: 3, cost: 160, amount: 60 },
] as const;

export const REFINERY_UPGRADES: readonly UpgradeDefinition[] = REFINERY_LEVELS.map(({ level, cost, amount }) => ({
  id: `level-${level}`,
  label: `Level ${level}`,
  description: `More output: ${amount} credits after every completed wave.`,
  cost,
  requires: level === 2 ? [] : [`level-${level - 1}`],
  effects: { level, attack: { amount } },
}));

/** Detector: two levels that widen the revealed area. */
const DETECTOR_LEVELS = [
  { level: 2, cost: 70, range: 4.25 },
  { level: 3, cost: 120, range: 5 },
] as const;

export const DETECTOR_UPGRADES: readonly UpgradeDefinition[] = DETECTOR_LEVELS.map(({ level, cost, range }) => ({
  id: `level-${level}`,
  label: `Level ${level}`,
  description: `Stronger Scanner: reveals stealthed enemies within ${range} cells.`,
  cost,
  requires: level === 2 ? [] : [`level-${level - 1}`],
  effects: { level, stats: { range } },
}));

/** Support levels: cost plus attack and stat overrides; level 1 is the build itself. */
function supportUpgrades(levels: readonly { cost: number; attack: Record<string, number>; range?: number; description: string }[]): readonly UpgradeDefinition[] {
  return levels.map(({ cost, attack, range, description }, i) => ({
    id: `level-${i + 2}`,
    label: `Level ${i + 2}`,
    description,
    cost,
    requires: i === 0 ? [] : [`level-${i + 1}`],
    effects: { level: i + 2, attack, ...(range === undefined ? {} : { stats: { range } }) },
  }));
}

/** Bounty Beacon: more bonus per kill, the last level also a wider radius. */
export const BEACON_UPGRADES = supportUpgrades([
  { cost: 90, attack: { bonus: 0.75 }, description: "Higher Bounty: kills in the radius pay 75% more credits." },
  { cost: 150, attack: { bonus: 1 }, range: 3, description: "Head Money: double credits for kills within a radius of three cells." },
]);
/** Repair Dock: more reactor energy per completed wave. */
export const DOCK_UPGRADES = supportUpgrades([
  { cost: 160, attack: { amount: 2 }, description: "Second Crew: restores 2 reactor energy after every wave." },
  { cost: 260, attack: { amount: 3 }, description: "Shipyard: restores 3 reactor energy after every wave." },
]);
/** Tracker: stronger marking in a wider radius. */
export const TRACKER_UPGRADES = supportUpgrades([
  { cost: 120, attack: { amount: 0.2 }, range: 2.5, description: "Fine Bearing: enemies within radius 2.5 take 20% more damage." },
  { cost: 200, attack: { amount: 0.25 }, range: 2.8, description: "Target Lock: enemies within radius 2.8 take 25% more damage." },
]);

/** A trap: an attack tower on a path cell; its trigger radius stays the same at every level. */
export function trapTower<T extends Omit<TowerDefinition, "upgrades" | "attack" | "placement"> & { attack: Exclude<AttackSpec, SupportAttack> }>(definition: T, specials: LevelSpecials = {}) {
  return { ...definition, placement: "path" as const, upgrades: attackUpgrades(definition, definition.cost, specials, false) };
}

/**
 * Derive the default level path from the single base-tower definition, followed by the three
 * specialization paths (levels 6 to 8) that branch off level 5.
 */
export function attackTower<T extends Omit<TowerDefinition, "upgrades" | "attack"> & { attack: Exclude<AttackSpec, SupportAttack> }>(definition: T, specials: LevelSpecials = {}) {
  const levels = attackUpgrades(definition, definition.cost, specials);
  const l5 = { damage: definition.damage, range: definition.range, interval: definition.interval, ...levels[levels.length - 1].effects.stats };
  const paths = specializationVisuals(definition.id);
  return {
    ...definition,
    ...(paths ? { visual: { ...definition.visual, paths } } : {}),
    upgrades: [...levels, ...specializationUpgrades(definition.id, definition.cost, l5)],
  };
}
