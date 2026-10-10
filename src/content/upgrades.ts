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
export function attackUpgrades(base: TowerStats, buildCost: number, specials: LevelSpecials = {}): readonly UpgradeDefinition[] {
  return ATTACK_LEVELS.map(({ level, cost, damage, range, interval }) => ({
    id: `level-${level}`,
    label: `Stufe ${level}`,
    description: specials[level]?.description ?? (level <= 3
      ? "Mehr Schaden, größere Reichweite und 10 % kürzere Zeit zwischen Schüssen."
      : "Spätausbau: teuer, aber pro Credit stärker als ein weiterer Turm. Deutlich mehr Schaden und kürzere Zeit zwischen Schüssen."),
    cost: Math.round(buildCost * cost),
    requires: level === 2 ? [] : [`level-${level - 1}`],
    effects: {
      level,
      stats: {
        damage: Math.round(base.damage * damage),
        range: base.range + range,
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
  { stat: "damage", label: "Schaden", tiers: [[100, 0.25], [180, 0.40], [300, 0.55]], effect: "Schaden für unterstützte Angriffstürme" },
  { stat: "speed", label: "Angriffstempo", tiers: [[120, 0.20], [200, 0.35], [320, 0.50]], effect: "Angriffe pro Sekunde für unterstützte Türme" },
  { stat: "range", label: "Reichweite", tiers: [[100, 0.15], [170, 0.25], [280, 0.35]], effect: "Angriffsreichweite für unterstützte Türme" },
] as const;

const auraId = (stat: string, tier: number) => (tier === 1 ? stat : `${stat}-${tier}`);
const pct = (value: number) => `${Math.round(value * 100)} %`;

export const AURA_UPGRADES: readonly UpgradeDefinition[] = AURA_TRACKS.flatMap(({ stat, label, tiers, effect }) =>
  tiers.map(([cost, value], index) => ({
    id: auraId(stat, index + 1),
    label: `${label}${["", " II", " III"][index]}`,
    cost,
    requires: index === 0 ? [] : [auraId(stat, index)],
    path: stat,
    description: index === 0
      ? `Legt den Pfad fest: +${pct(value)} ${effect}. Die anderen Pfade werden für diesen Turm gesperrt.`
      : `Erhöht den Bonus von +${pct(tiers[index - 1][1])} auf +${pct(value)} ${effect}.`,
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
  label: `Stufe ${level}`,
  description: `Mehr Förderleistung: ${amount} Credits nach jeder abgeschlossenen Welle.`,
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
  label: `Stufe ${level}`,
  description: `Stärkerer Scanner: deckt getarnte Gegner in ${range} Feldern auf.`,
  cost,
  requires: level === 2 ? [] : [`level-${level - 1}`],
  effects: { level, stats: { range } },
}));

/** Support levels: cost plus attack and stat overrides; level 1 is the build itself. */
function supportUpgrades(levels: readonly { cost: number; attack: Record<string, number>; range?: number; description: string }[]): readonly UpgradeDefinition[] {
  return levels.map(({ cost, attack, range, description }, i) => ({
    id: `level-${i + 2}`,
    label: `Stufe ${i + 2}`,
    description,
    cost,
    requires: i === 0 ? [] : [`level-${i + 1}`],
    effects: { level: i + 2, attack, ...(range === undefined ? {} : { stats: { range } }) },
  }));
}

/** Prämienbake: more bonus per kill, the last level also a wider radius. */
export const BEACON_UPGRADES = supportUpgrades([
  { cost: 90, attack: { bonus: 0.75 }, description: "Höhere Prämie: Abschüsse im Radius zahlen 75 % mehr Credits." },
  { cost: 150, attack: { bonus: 1 }, range: 3, description: "Kopfgeld: doppelte Credits für Abschüsse in drei Feldern Radius." },
]);
/** Reparaturdock: more reactor energy per completed wave. */
export const DOCK_UPGRADES = supportUpgrades([
  { cost: 160, attack: { amount: 2 }, description: "Zweite Crew: stellt nach jeder Welle 2 Reaktorenergie wieder her." },
  { cost: 260, attack: { amount: 3 }, description: "Werft: stellt nach jeder Welle 3 Reaktorenergie wieder her." },
]);
/** Peilsender: stronger marking in a wider radius. */
export const TRACKER_UPGRADES = supportUpgrades([
  { cost: 120, attack: { amount: 0.2 }, range: 2.5, description: "Feinpeilung: Gegner im Radius 2,5 erleiden 20 % mehr Schaden." },
  { cost: 200, attack: { amount: 0.25 }, range: 2.8, description: "Zielerfassung: Gegner im Radius 2,8 erleiden 25 % mehr Schaden." },
]);

/** Derive the default level path from the single base-tower definition. */
export function attackTower<T extends Omit<TowerDefinition, "upgrades" | "attack"> & { attack: Exclude<AttackSpec, SupportAttack> }>(definition: T, specials: LevelSpecials = {}) {
  return { ...definition, upgrades: attackUpgrades(definition, definition.cost, specials) };
}
