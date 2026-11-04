import { dist } from "./path";
import { resolveUpgrades, type UpgradeProgress } from "../core/upgrades";
import { isArmed, isSupport } from "./attacks";
import type { AuraBonuses, AuraStat, ContentPack, Point, Sim, TowerId } from "../core/types";
import { isSuppressed, towerDebuffs } from "./traits";
import { siphonBoost } from "./siphon";
import { nexusBoost } from "./fire-support-paths";
import { fieldBonuses } from "./aura-paths";
import { economyBoost } from "./economy-paths";

export const AURA_STATS: readonly AuraStat[] = ["damage", "speed", "range"];
const emptyBonuses = (): AuraBonuses => ({ damage: 0, speed: 0, range: 0 });
export type TowerPosition = Point & UpgradeProgress;

/** Pure queries shared by simulation, drawing, UI and upgrade previews. */
export function auraBonuses(source: UpgradeProgress, content: ContentPack): AuraBonuses {
  return resolveUpgrades(source, content).aura;
}

export const isAuraSource = (tower: { type: TowerId }, content: ContentPack) =>
  content.towers[tower.type].attack.kind === "aura";

export function isInAura(
  source: Point & { type: TowerId },
  target: Point & { type: TowerId },
  content: ContentPack,
): boolean {
  return isAuraSource(source, content) &&
    !isSupport(content.towers[target.type].attack) &&
    dist(source, target) <= content.towers[source.type].range;
}

export function receivedAuraBonuses(
  target: TowerPosition,
  towers: readonly TowerPosition[],
  content: ContentPack,
  sim?: Sim,
): AuraBonuses {
  const combined = emptyBonuses();
  for (const source of towers) {
    if (!isInAura(source, target, content) || (sim && isSuppressed(sim, source))) continue;
    const bonuses = fieldBonuses(source, target, content); // Harmonics: also the stats of the tracks not taken
    for (const key of AURA_STATS) combined[key] = Math.max(combined[key], bonuses[key]);
  }
  return combined;
}

export function effectiveTowerStats(
  target: TowerPosition,
  towers: readonly TowerPosition[],
  content: ContentPack,
  /** With the running simulation, enemy effects apply: suppressed aura sources, blind (range) and jam (interval). UI previews omit it. */
  sim?: Sim,
) {
  const base = resolveUpgrades(target, content).stats;
  const bonuses = receivedAuraBonuses(target, towers, content, sim);
  // Blind and jam only touch attack towers: traps and support towers keep their stats.
  const d = content.towers[target.type],
    debuffs = sim && isArmed(d) ? towerDebuffs(sim, target) : { range: 0, interval: 0 };
  // Siphon: hindered enemies near a Siphon speed up the attack towers around it (Power Tap: and strengthen them).
  const siphon = sim && isArmed(d) ? siphonBoost(sim, target) : { rate: 0, damage: 0 };
  // Nexus Resonance and Harmony: more range and fire rate per tower type around the Nexus.
  const nexus = sim && isArmed(d) ? nexusBoost(sim, target) : { range: 0, rate: 0 };
  // Economy paths: Fuel Line and Damage Control (fire rate), Calibration (damage).
  const economy = sim ? economyBoost(sim, target) : { rate: 0, damage: 0 };
  return {
    base,
    bonuses,
    damage: base.damage * (1 + bonuses.damage) * (1 + siphon.damage) * (1 + economy.damage),
    range: base.range * (1 + bonuses.range) * (1 - debuffs.range) * (1 + nexus.range),
    interval: (base.interval / (1 + bonuses.speed)) * (1 + debuffs.interval) / (1 + siphon.rate) / (1 + nexus.rate) / (1 + economy.rate),
  };
}
