import { credit, earn } from "../core/economy";
import { resolveUpgrades } from "../core/upgrades";
import type { Sim } from "../core/types";
import { createEnemy } from "./spawn";
import { repairReactor } from "./support";
export { DEFAULT_HP_GROWTH } from "./spawn";
/** Seconds of build time after a wave before the next one starts by itself. */
export const WAVE_BREAK = 10;
export function spawnEnemies(sim: Sim) {
  const s = sim.state;
  while (s.queue.length && s.queue[0].at <= s.waveTime) {
    const spawn = s.queue.shift()!,
      enemy = createEnemy(sim, spawn.type, 0, spawn.wave);
    if (spawn.sentBy !== undefined) enemy.sentBy = spawn.sentBy;
  }
}
export function settleWave(sim: Sim) {
  const s = sim.state,
    waves = sim.mission.waves;
  if (s.lives <= 0) {
    s.status = "lost";
    s.events.push({ type: "end", result: "lost" });
    return;
  }
  if (!s.enemies.length && !s.queue.length) {
    const bonus = waves[s.wave - 1].bonus;
    s.projectiles = [];
    delete s.pending;
    earn(s, bonus);
    payIncome(sim);
    repairReactor(sim);
    s.status = s.wave === waves.length ? "won" : "ready";
    if (s.status === "ready") s.nextWave = WAVE_BREAK;
    s.events.push({ type: "waveEnd", wave: s.wave, bonus });
    if (s.status === "won") s.events.push({ type: "end", result: "won" });
  }
}
/** Refineries pay out once per completed wave. */
export function payIncome(sim: Sim) {
  const s = sim.state;
  for (const t of s.towers) {
    const attack = resolveUpgrades(t, sim.content).attack;
    if (attack.kind !== "income") continue;
    credit(s, t.owner, attack.amount);
    s.events.push({ type: "income", at: { x: t.x, y: t.y }, amount: attack.amount, color: sim.content.towers[t.type].color });
  }
}
