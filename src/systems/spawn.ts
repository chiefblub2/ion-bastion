import type { Enemy, EnemyId, MissionDefinition, Sim } from "../core/types";
import { positionOnPath } from "./path";
import { initTraits, traitHpFactor } from "./traits";
export const DEFAULT_HP_GROWTH = 0.14;
/** HP factor of a wave (1-based): the wave's own multiplier or the mission's linear growth. */
export function waveHpScale(mission: MissionDefinition, wave: number) {
  return (
    mission.waves[wave - 1]?.hpMultiplier ??
    1 + Math.max(0, wave - 1) * (mission.hpGrowth ?? DEFAULT_HP_GROWTH)
  );
}
/** HP factor of the current wave. */
export const hpScale = (sim: Sim) => waveHpScale(sim.mission, sim.state.wave);
/** Adds an enemy at a path distance, scaled to its wave (the current one when absent). */
export function createEnemy(sim: Sim, type: EnemyId, distance = 0, wave?: number): Enemy {
  const s = sim.state,
    scale = wave === undefined ? hpScale(sim) : waveHpScale(sim.mission, wave),
    hp = Math.round(sim.content.enemies[type].hp * scale * traitHpFactor(sim.content, type));
  const enemy: Enemy = {
    id: s.nextId++,
    type,
    hp,
    maxHp: hp,
    ...positionOnPath(sim.mission.map.path, distance, sim.mission.map.loop),
    distance,
    status: [],
  };
  initTraits(sim, enemy);
  s.enemies.push(enemy);
  s.events.push({ type: "spawn", at: { x: enemy.x, y: enemy.y }, enemy: enemy.id });
  return enemy;
}
