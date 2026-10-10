import type { AttackKind, DamageSource, Enemy, Sim } from "../core/types";
import { earn } from "../core/economy";
import { damageTaken, statusDeath } from "./status";
import { bountyBonus, markFactor } from "./support";
import { afterHit, linkedGroup, modifyDamage, onDeath } from "./traits";
export type { DamageSource } from "../core/types";
/**
 * Context of a hit for traits; absent for dots. `instant`: chain, pierce, focus, quake, pull, disrupt. `area`: splash (centre incl.),
 * mortar, quake, charge. `chain`: a Tesla jump. `tower`: the firing tower's id. `execution`: Henker's wounded-target hit.
 */
export interface Hit {
  kind: AttackKind;
  area: boolean;
  chain: boolean;
  instant: boolean;
  tower?: number;
  execution?: boolean;
}
const INSTANT: ReadonlySet<AttackKind> = new Set(["chain", "pierce", "focus", "quake", "pull", "disrupt"]);
const AREA: ReadonlySet<AttackKind> = new Set(["splash", "mortar", "quake", "charge"]);
/** Hit context for an attack of `kind`; `extra` overrides the derived flags (`chain`, `execution`). */
export const hitOf = (kind: AttackKind, src: DamageSource, extra: Partial<Hit> = {}): Hit => ({
  kind,
  area: AREA.has(kind),
  chain: false,
  instant: INSTANT.has(kind),
  tower: src.tower,
  ...extra,
});
/**
 * The single damage pipeline: traits, HP, reward, kill credit and events. `dot`: a burn step, not a hit.
 * An infinite amount (Fallgrube) is lethal whatever shield or armor absorb; a dodge still avoids it.
 */
export function applyDamage(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot = false, hit?: Hit) {
  if (e.hp <= 0) return;
  // Link: the damage is split evenly among the carrier and its same-type neighbours (id order); an infinite hit (pit) is not split.
  const group = Number.isFinite(amount) ? linkedGroup(sim, e) : undefined;
  if (group) for (const m of group) deal(sim, src, m, amount / group.length, dot, hit);
  else deal(sim, src, e, amount, dot, hit);
}
function deal(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot: boolean, hit?: Hit) {
  if (e.hp <= 0) return;
  const s = sim.state,
    // Weakening and marking first, so armor absorbs a share of the amplified hit.
    raw = modifyDamage(sim, e, amount * damageTaken(e, s.time) * markFactor(sim, e), dot, hit),
    dealt = Number.isFinite(raw) || raw <= 0 ? raw : e.hp;
  e.hp -= dealt;
  s.events.push({ type: "damage", at: { x: e.x, y: e.y }, amount: dealt, enemy: e.id });
  afterHit(sim, e, dot, hit);
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
  statusDeath(sim, e);
}
