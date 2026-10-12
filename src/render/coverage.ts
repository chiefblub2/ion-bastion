import type { ContentPack, MapDefinition, Sim, Tower, UnitLayer } from "../core/types";
import { resolveUpgrades } from "../core/upgrades";
import { attackModule, isSupport } from "../systems/attacks";
import { effectiveTowerStats } from "../systems/auras";
/**
 * What the coverage overlay shows, as pure queries over the state (render only): each attack tower's reach, and how
 * many towers cover every path cell. Support towers and traps have no reach here.
 */
export interface Reach {
  tower: Tower;
  /** Range and dead zone (Mortar) in cells, with aura bonuses and, given `sim`, blind and jam. */
  range: number;
  min: number;
  targets: readonly UnitLayer[];
}
export function towerReach(towers: readonly Tower[], content: ContentPack, sim?: Sim): Reach[] {
  return towers.flatMap((tower) => {
    const d = content.towers[tower.type];
    if (isSupport(d.attack) || d.placement === "path") return [];
    const { attack } = resolveUpgrades(tower, content),
      range = effectiveTowerStats(tower, towers, content, sim).range;
    return [{ tower, range, min: attackModule(attack)?.minRange?.(attack) ?? 0, targets: d.targets }];
  });
}
/** Per path cell (in path order), how many towers can hit a unit of `layer` standing on its centre. */
export function pathCoverage(map: MapDefinition, reach: readonly Reach[], layer: UnitLayer = "ground"): number[] {
  return map.path.map((cell) =>
    reach.filter((r) => {
      if (!r.targets.includes(layer)) return false;
      const d = Math.hypot(cell.x - r.tower.x, cell.y - r.tower.y);
      return d <= r.range && d >= r.min;
    }).length,
  );
}
