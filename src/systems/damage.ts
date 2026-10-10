import type { AttackKind, DamageSource, Enemy, SpecializationSpec, Sim } from "../core/types";
import { earn } from "../core/economy";
import { damageTaken, hasStatus, statusDeath } from "./status";
import { bountyBonus, markFactor } from "./support";
import { afterHit, hasTrait, layerOf, linkedGroup, modifyDamage, onDeath } from "./traits";
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
  /** Specialization of the firing tower (conditional damage, armor pierce); absent for secondary hits. */
  special?: SpecializationSpec;
}
/** What a hit did to its primary enemy; kill-based specializations read it. */
export interface DamageOutcome {
  hpBefore: number;
  /** Damage that reached HP after every defence. */
  dealt: number;
  killed: boolean;
  overkill: number;
}
/** Max HP from which an enemy counts as a heavy target for specializations. */
export const HEAVY_HP = 1000;
const INSTANT: ReadonlySet<AttackKind> = new Set(["chain", "pierce", "focus", "quake", "pull", "disrupt"]);
const AREA: ReadonlySet<AttackKind> = new Set(["splash", "mortar", "quake", "charge"]);
/** Hit context for an attack of `kind`; `extra` overrides the derived flags (`chain`, `execution`). */
export const hitOf = (kind: AttackKind, src: DamageSource, extra: Partial<Hit> = {}): Hit => ({
  kind,
  area: AREA.has(kind),
  chain: false,
  instant: INSTANT.has(kind),
  tower: src.tower,
  ...(src.special ? { special: src.special } : {}),
  ...extra,
});
/** The source without its specialization: secondary hits never trigger another proc. */
export const plain = (src: DamageSource): DamageSource => ({ tower: src.tower, type: src.type });
/** Conditional damage bonus of a specialization, judged on impact; `isolated` is judged at fire time instead. */
function conditionalFactor(sim: Sim, e: Enemy, hit?: Hit) {
  const special = hit?.special;
  if (special?.kind !== "conditional-damage") return 1;
  const applies = {
    heavy: () => e.maxHp >= HEAVY_HP,
    "heavy-air": () => e.maxHp >= HEAVY_HP && layerOf(sim, e) === "air",
    armored: () => hasTrait(sim, e, "armor"),
    // Checked before the hit's own burn is applied, so only an earlier burn counts.
    burning: () => hasStatus(e, "burn", sim.state.time),
    isolated: () => false,
  }[special.predicate]();
  return applies ? 1 + special.bonus : 1;
}
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
function deal(sim: Sim, src: DamageSource, e: Enemy, amount: number, dot: boolean, hit?: Hit): DamageOutcome | undefined {
  if (e.hp <= 0) return undefined;
  const s = sim.state,
    hpBefore = e.hp,
    // Weakening and marking first, so armor absorbs a share of the amplified hit.
    raw = modifyDamage(sim, e, amount * damageTaken(e, s.time) * markFactor(sim, e) * conditionalFactor(sim, e, hit), dot, hit),
    dealt = Number.isFinite(raw) || raw <= 0 ? raw : e.hp;
  e.hp -= dealt;
  s.events.push({ type: "damage", at: { x: e.x, y: e.y }, amount: dealt, enemy: e.id });
  afterHit(sim, e, dot, hit);
  const outcome = { hpBefore, dealt, killed: e.hp <= 0, overkill: Math.max(0, dealt - hpBefore) };
  if (e.hp > 0) return outcome;
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
  return outcome;
}
