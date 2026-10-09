import { DEFAULT_CONTENT } from "../content";
import { resolveUpgrades, type UpgradeProgress } from "../core/upgrades";
import { isSupport } from "./attacks";
import type { AuraBonuses, AuraStat, ContentPack, Point, TowerId } from "../core/types";

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
): AuraBonuses {
  const combined = emptyBonuses();
  for (const source of towers) {
    if (!isInAura(source, target, content)) continue;
    const bonuses = auraBonuses(source, content);
    for (const key of AURA_STATS) combined[key] = Math.max(combined[key], bonuses[key]);
  }
  return combined;
}

export function effectiveTowerStats(
  target: TowerPosition,
  towers: readonly TowerPosition[],
  content: ContentPack = DEFAULT_CONTENT,
) {
  const base = resolveUpgrades(target, content).stats;
  const bonuses = receivedAuraBonuses(target, towers, content);
  return {
    base,
    bonuses,
    damage: base.damage * (1 + bonuses.damage),
    range: base.range * (1 + bonuses.range),
    interval: base.interval / (1 + bonuses.speed),
  };
}
