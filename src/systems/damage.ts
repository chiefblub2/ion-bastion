import type { AttackKind, CritRider, DamageSource, Enemy, SpecializationSpec, Sim } from "../core/types";
import { earn } from "../core/economy";
import { absorbEncased } from "./encase";
import { statusDeath } from "./status";
import { afterHit, linkedGroup, modifyDamage, onDeath } from "./traits";
import { afterDealt } from "./links";
import { DEFENCE_BREAKERS, HOOKS } from "./damage-modifiers";
import { kindModule } from "./attacks";
export type { DamageSource } from "../core/types";
/**
 * Context of a hit for traits; absent for dots. `instant`: chain, pierce, focus, quake, pull, disrupt. `area`: splash (centre incl.),
 * mortar, airburst, pool (an eruption; the pool itself burns as a dot), quake, charge. `chain`: a Tesla jump. `tower`: the firing tower's id. `execution`: Henker's wounded-target hit.
 */
export interface Hit {
  kind: AttackKind;
  area: boolean;
  chain: boolean;
  instant: boolean;
  tower?: number;
  execution?: boolean;
  /** Specialization of the firing tower (conditional damage, armor pierce); absent for secondary hits. */
  special?: SpecializationSpec;
  /** Fire Control paths carried by a crit; absent for every other hit. */
  crit?: CritRider;
}
/** What a hit did to its primary enemy; kill-based specializations read it. */
export interface DamageOutcome {
  hpBefore: number;
  /** Damage that reached HP after every defence. */
  dealt: number;
  killed: boolean;
  overkill: number;
}
/** Max HP from which an enemy counts as a heavy target (specializations, Beacon paths, Titan Reactor Core). */
export const HEAVY_HP = 1000;
export const isHeavy = (e: Pick<Enemy, "maxHp">) => e.maxHp >= HEAVY_HP;
/** Hit context for an attack of `kind` (`area` and `instant` from its module); `extra` overrides the derived flags (`chain`, `execution`). */
export const hitOf = (kind: AttackKind, src: DamageSource, extra: Partial<Hit> = {}): Hit => ({
  kind,
  area: !!kindModule(kind).area,
  chain: false,
  instant: !!kindModule(kind).instant,
  tower: src.tower,
  ...(src.special ? { special: src.special } : {}),
  ...(src.crit ? { crit: src.crit } : {}),
  ...extra,
});
/** The source without its specialization: secondary hits never trigger another proc. */
export const plain = (src: DamageSource): DamageSource => ({ tower: src.tower, type: src.type });
/**
 * The single damage pipeline: traits, HP, reward, kill credit and events. `dot`: a burn step, not a hit.
 * An infinite amount (Fallgrube) is lethal whatever shield or armor absorb; a dodge still avoids it.
 */
export function applyDamage(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot = false, hit?: Hit): DamageOutcome | undefined {
  if (e.hp <= 0) return undefined;
  // Link: the damage is split evenly among the carrier and its same-type neighbours (id order); an infinite hit (pit) is not split.
  const group = Number.isFinite(amount) ? linkedGroup(sim, e) : undefined;
  if (!group) return deal(sim, src, e, amount, dot, hit);
  let outcome: DamageOutcome | undefined;
  for (const m of group) {
    const result = deal(sim, src, m, amount / group.length, dot, hit);
    if (m === e) outcome = result;
  }
  return outcome;
}
/** One hit on one enemy. Everything besides the enemy's own traits comes from `DAMAGE_MODIFIERS`, hook by hook in its order. */
function deal(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot: boolean, hit?: Hit): DamageOutcome | undefined {
  if (e.hp <= 0) return undefined;
  for (const incoming of HOOKS.incoming) amount *= incoming(sim, src, e, dot, hit);
  if (absorbEncased(sim, e, amount)) return undefined;
  const s = sim.state,
    hpBefore = e.hp;
  // Weakening and marking before armor, so armor absorbs a share of the amplified hit.
  for (const factor of HOOKS.factor) amount *= factor(sim, src, e, dot, hit);
  const raw = modifyDamage(sim, e, amount, DEFENCE_BREAKERS, dot, hit),
    dealt = Number.isFinite(raw) || raw <= 0 ? raw : e.hp;
  e.hp -= dealt;
  s.events.push({ type: "damage", at: { x: e.x, y: e.y }, amount: dealt, enemy: e.id });
  afterDealt(sim, e, Math.min(dealt, hpBefore));
  afterHit(sim, e, dot, hit);
  for (const after of HOOKS.afterHit) after(sim, src, e, dot, hit);
  const outcome = { hpBefore, dealt, killed: e.hp <= 0, overkill: Math.max(0, dealt - hpBefore) };
  if (e.hp > 0) return outcome;
  const d = sim.content.enemies[e.type];
  // Enemies sent by an opponent in versus pay nothing.
  let reward = 0;
  if (e.sentBy === undefined) {
    reward = d.reward;
    for (const bounty of HOOKS.bounty) reward += bounty(sim, e, d.reward);
  }
  earn(s, reward);
  for (const kill of HOOKS.onKill) kill(sim, e);
  s.kills++;
  const tower = s.towers.find((t) => t.id === src.tower);
  if (tower) tower.kills++;
  s.events.push({ type: "kill", at: { x: e.x, y: e.y }, color: d.color, reward });
  onDeath(sim, e);
  statusDeath(sim, e);
  for (const after of HOOKS.afterDeath) after(sim, src, e, outcome, hit);
  return outcome;
}
