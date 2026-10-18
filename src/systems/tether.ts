import type { Enemy, Sim, StatusEffect, StatusKind } from "../core/types";
import { applyDamage, plain } from "./damage";
import { applyStatus, speedFactor } from "./status";
import { traitSpeedFactor } from "./traits";
/**
 * Tether: enemies linked by one shot share a `group` in their `tether` status. What happens to one of them
 * spreads (slow, stun, burn), none walks faster than the slowest, and the specializations pass damage on
 * (Shared Pain) or stun the others when one dies (Whiplash). Everything is derived from the statuses.
 */
type Tether = Extract<StatusEffect, { kind: "tether" }>;
/** The running tether of an enemy, if any. */
export const tetherOf = (e: Enemy, time: number): Tether | undefined =>
  e.status.length ? e.status.find((s): s is Tether => s.kind === "tether" && time < s.until) : undefined;
/** Living enemies linked to `e` (without `e`), in list order; empty without a running tether. */
export function partners(sim: Sim, e: Enemy): Enemy[] {
  const time = sim.state.time,
    own = tetherOf(e, time);
  if (!own) return [];
  return sim.state.enemies.filter((o) => o !== e && o.hp > 0 && tetherOf(o, time)?.group === own.group);
}
/** Effects that travel along a tether. */
const SPREADS: ReadonlySet<StatusKind> = new Set(["slow", "stun", "burn"]);
// Guards against a spread (or a shared hit) spreading again from the partner it reached; the simulation is single-threaded.
let spreading = false,
  sharing = false;
/** Called by `applyStatus` once an effect took hold: slow, stun and burn reach every partner too, with the same values. */
export function spreadTether(sim: Sim, e: Enemy, effect: StatusEffect) {
  if (spreading || !SPREADS.has(effect.kind)) return;
  const others = partners(sim, e);
  if (!others.length) return;
  const color = sim.content.towers[tetherOf(e, sim.state.time)!.source.type].color;
  spreading = true;
  try {
    for (const o of others) if (applyStatus(sim, o, { ...effect })) sim.state.events.push({ type: "chain", from: { x: e.x, y: e.y }, to: { x: o.x, y: o.y }, color });
  } finally {
    spreading = false;
  }
}
/** Own speed of an enemy in cells per second: base speed, effects and traits, without any tether. */
const ownSpeed = (sim: Sim, e: Enemy) => sim.content.enemies[e.type].speed * speedFactor(e, sim.state.time) * traitSpeedFactor(sim, e);
/**
 * Called by `moveEnemies` after a step from `from`: a linked enemy walks forward no faster than its slowest
 * partner. Only forward steps are capped; a partner that is pulled back never drags the others with it.
 */
export function tetherStep(sim: Sim, e: Enemy, from: number, dt: number): number {
  if (e.distance <= from || !e.status.length) return e.distance;
  const others = partners(sim, e);
  if (!others.length) return e.distance;
  let cap = Infinity;
  for (const o of others) cap = Math.min(cap, Math.max(0, ownSpeed(sim, o)));
  return Math.min(e.distance, from + cap * dt);
}
/** Shared Pain: damage that reached a linked enemy's HP hits each partner for a share of it, as a dot that is never shared again. */
export function shareTether(sim: Sim, e: Enemy, amount: number) {
  if (sharing || amount <= 0 || !e.status.length) return;
  const own = tetherOf(e, sim.state.time),
    special = own?.source.special;
  if (special?.kind !== "tether-share") return;
  const others = partners(sim, e);
  if (!others.length) return;
  sharing = true;
  try {
    for (const o of others) applyDamage(sim, plain(own!.source), o, amount * special.share, true);
  } finally {
    sharing = false;
  }
}
/** Whiplash: a linked enemy died; its partners snap back and are stunned (with the usual recovery). */
export function whiplash(sim: Sim, e: Enemy, s: Tether) {
  if (s.source.special?.kind !== "whiplash") return;
  const time = sim.state.time,
    { duration } = s.source.special,
    color = sim.content.towers[s.source.type].color;
  for (const o of sim.state.enemies) {
    if (o === e || o.hp <= 0 || tetherOf(o, time)?.group !== s.group) continue;
    sim.state.events.push({ type: "chain", from: { x: e.x, y: e.y }, to: { x: o.x, y: o.y }, color });
    applyStatus(sim, o, { kind: "stun", release: time + duration, until: time + duration + WHIPLASH_RECOVERY });
  }
}
/** Seconds after a Whiplash stun in which the enemy cannot be stunned again, like a Stasis pulse. */
export const WHIPLASH_RECOVERY = 1.5;
