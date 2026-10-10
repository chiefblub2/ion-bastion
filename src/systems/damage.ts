import type { DamageSource, Enemy, Sim } from "../core/types";
import { earn } from "../core/economy";
import { damageTaken } from "./status";
import { bountyBonus, markFactor } from "./support";
import { afterHit, modifyDamage, onDeath } from "./traits";
export type { DamageSource } from "../core/types";
/** The single damage pipeline: traits, HP, reward, kill credit and events. `dot`: a burn step, not a hit. */
export function applyDamage(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot = false) {
  if (e.hp <= 0) return;
  const s = sim.state,
    // Weakening and marking first, so armor absorbs a share of the amplified hit.
    dealt = modifyDamage(sim, e, amount * damageTaken(e, s.time) * markFactor(sim, e), dot);
  e.hp -= dealt;
  s.events.push({ type: "damage", at: { x: e.x, y: e.y }, amount: dealt, enemy: e.id });
  afterHit(sim, e, dot);
  if (e.hp > 0) return;
  const d = sim.content.enemies[e.type],
    // Enemies sent by an opponent in versus pay nothing.
    reward = e.sentBy === undefined ? d.reward + bountyBonus(sim, e, d.reward) : 0;
  earn(s, reward);
  s.kills++;
  const tower = s.towers.find((t) => t.id === src.tower);
  if (tower) tower.kills++;
  s.events.push({ type: "kill", at: { x: e.x, y: e.y }, color: d.color, reward });
  onDeath(sim, e);
}
