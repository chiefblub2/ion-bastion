import { DEFAULT_CONTENT } from "../content";
import { resolveUpgrades, type UpgradeProgress } from "../core/upgrades";
import { isSupport } from "./attacks";
import type { AuraBonuses, AuraStat, ContentPack, Point, Sim, TowerId } from "../core/types";
import { isSuppressed, towerDebuffs } from "./traits";

export const AURA_STATS: readonly AuraStat[] = ["damage", "speed", "range"];
const emptyBonuses = (): AuraBonuses => ({ damage: 0, speed: 0, range: 0 });
export type TowerPosition = Point & UpgradeProgress;

/** Pure queries shared by simulation, drawing, UI and upgrade previews. */
export function auraBonuses(source: UpgradeProgress, content: ContentPack = DEFAULT_CONTENT): AuraBonuses {
  return resolveUpgrades(source, content).aura;
}

export const isAuraSource = (tower: { type: TowerId }, content: ContentPack = DEFAULT_CONTENT) =>
  content.towers[tower.type].attack.kind === "aura";

export function isInAura(
  source: Point & { type: TowerId },
  target: Point & { type: TowerId },
  content: ContentPack = DEFAULT_CONTENT,
): boolean {
  return isAuraSource(source, content) &&
    !isSupport(content.towers[target.type].attack) &&
    Math.hypot(source.x - target.x, source.y - target.y) <= content.towers[source.type].range;
}

export function receivedAuraBonuses(
  target: TowerPosition,
  towers: readonly TowerPosition[],
  content: ContentPack = DEFAULT_CONTENT,
  sim?: Sim,
): AuraBonuses {
  const combined = emptyBonuses();
  for (const source of towers) {
    if (!isInAura(source, target, content) || (sim && isSuppressed(sim, source))) continue;
    const bonuses = auraBonuses(source, content);
    for (const key of AURA_STATS) combined[key] = Math.max(combined[key], bonuses[key]);
  }
  return combined;
}

export function effectiveTowerStats(
  target: TowerPosition,
  towers: readonly TowerPosition[],
  content: ContentPack = DEFAULT_CONTENT,
  /** With the running simulation, enemy effects apply: suppressed aura sources, blind (range) and jam (interval). UI previews omit it. */
  sim?: Sim,
) {
  const base = resolveUpgrades(target, content).stats;
  const bonuses = receivedAuraBonuses(target, towers, content, sim);
  // Blind and jam only touch attack towers: traps and support towers keep their stats.
  const d = content.towers[target.type],
    debuffs = sim && d.placement !== "path" && !isSupport(d.attack) ? towerDebuffs(sim, target) : { range: 0, interval: 0 };
  return {
    base,
    bonuses,
    damage: base.damage * (1 + bonuses.damage),
    range: base.range * (1 + bonuses.range) * (1 - debuffs.range),
    interval: (base.interval / (1 + bonuses.speed)) * (1 + debuffs.interval),
  };
}
