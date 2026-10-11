import type { Enemy, Sim, StatusEffect, StatusKind } from "../core/types";
import { applyDamage, hitOf } from "./damage";
import { canTarget } from "./attacks/targeting";
import { dist } from "./path";
import { resists, tickTraits } from "./traits";
/** Seconds between two burn damage steps; fewer, larger hits instead of one per tick. */
export const BURN_TICK = 0.5;
const active = (effect: StatusEffect, time: number) => time < effect.until;
type Of<K extends StatusKind> = Extract<StatusEffect, { kind: K }>;
interface StatusModule<S extends StatusEffect> {
  /** Combines a new effect with a running one of the same kind; mutates `existing`. True if the new effect took hold. */
  merge(existing: S, incoming: S): boolean;
  /** Movement factor while active; 1 means full speed. */
  speed?(effect: S, time: number): number;
  /** Damage factor while active; 1 means unchanged. */
  damageTaken?(effect: S): number;
  tick?(sim: Sim, enemy: Enemy, effect: S): void;
  /** When the enemy dies while the effect is running. */
  onDeath?(sim: Sim, enemy: Enemy, effect: S): void;
}
/** Haftmine blast around the carrier; marked spent first, so a chain reaction never repeats it. */
function detonate(sim: Sim, carrier: Enemy, s: Of<"charged">) {
  s.until = -Infinity;
  sim.state.events.push({ type: "pulse", at: { x: carrier.x, y: carrier.y }, radius: s.radius, color: sim.content.towers[s.source.type].color });
  // A copy: fragments released by a death in the blast must not catch it.
  for (const target of [...sim.state.enemies])
    if (target.hp > 0 && canTarget(sim, s.source.type, target) && dist(target, carrier) <= s.radius) applyDamage(sim, s.source, target, s.damage, false, hitOf("charge", s.source));
}
/** Overwrites an entry completely, so optional fields of the old effect (spread, exposure) do not survive. */
function replace(existing: StatusEffect, incoming: StatusEffect) {
  for (const key of Object.keys(existing)) if (!(key in incoming)) delete (existing as unknown as Record<string, unknown>)[key];
  Object.assign(existing, incoming);
}
/** Rule for effects with one strength value: stronger replaces, equal extends, weaker never overrides (and fails). */
const strongest =
  <S extends StatusEffect>(strength: (effect: S) => number) =>
  (existing: S, incoming: S) => {
    if (strength(incoming) > strength(existing)) replace(existing, incoming);
    else if (strength(incoming) === strength(existing)) existing.until = Math.max(existing.until, incoming.until);
    else return false;
    return true;
  };
/** Wildfire: a dying carrier passes a share of its remaining burn to the nearest enemies; passed burns never spread again. */
function spreadBurn(sim: Sim, carrier: Enemy, s: Of<"burn">) {
  const spread = s.spread!,
    time = sim.state.time,
    left = Math.max(0, s.until - time),
    budget = left * s.dps * spread.factor,
    duration = Math.max(BURN_TICK, left);
  if (budget <= 0) return;
  const targets = sim.state.enemies
    .filter((e) => e !== carrier && e.hp > 0 && canTarget(sim, s.source.type, e) && dist(e, carrier) <= spread.radius)
    .sort((a, b) => dist(a, carrier) - dist(b, carrier) || a.id - b.id)
    .slice(0, spread.count);
  const color = sim.content.towers[s.source.type].color;
  for (const target of targets) {
    sim.state.events.push({ type: "chain", from: { x: carrier.x, y: carrier.y }, to: { x: target.x, y: target.y }, color });
    applyStatus(sim, target, { kind: "burn", dps: budget / duration, next: time + BURN_TICK, until: time + duration, source: { tower: s.source.tower, type: s.source.type } });
  }
}
/** Status effects. A new effect is one member of `StatusEffect` plus one entry here. */
const STATUSES: { [K in StatusKind]: StatusModule<Of<K>> } = {
  slow: {
    merge: strongest((s) => -s.factor),
    speed: (s) => s.factor,
  },
  // A running entry includes the recovery window, so a stun never chains into the next one.
  stun: {
    merge: () => false,
    speed: (s, time) => (time < s.release ? 0 : 1),
    // Temporal Exposure: once the stun ends, the enemy takes more damage for a while.
    tick: (sim, e, s) => {
      if (!s.exposure || sim.state.time < s.release) return;
      const { amount, duration } = s.exposure;
      delete s.exposure;
      applyStatus(sim, e, { kind: "vulnerable", amount, until: sim.state.time + duration });
    },
  },
  burn: {
    merge: strongest((s) => s.dps),
    tick: (sim, e, s) => {
      while (s.next <= sim.state.time && s.next <= s.until && e.hp > 0) {
        s.next += BURN_TICK;
        applyDamage(sim, s.source, e, s.dps * BURN_TICK, true);
      }
    },
    onDeath: (sim, e, s) => {
      if (s.spread) spreadBurn(sim, e, s);
    },
  },
  vulnerable: {
    merge: strongest((s) => s.amount),
    damageTaken: (s) => 1 + s.amount,
  },
  disrupted: {
    merge: strongest(() => 0),
  },
  netted: {
    merge: strongest((s) => -s.factor),
    speed: (s) => s.factor,
  },
  bleeding: {
    merge: strongest((s) => s.perCell),
    // Only forward steps hurt: a stunned or pulled-back enemy does not bleed.
    tick: (sim, e, s) => {
      while (s.next <= sim.state.time && s.next <= s.until && e.hp > 0) {
        s.next += BURN_TICK;
        const walked = Math.max(0, e.distance - s.last);
        s.last = e.distance;
        if (walked > 0) applyDamage(sim, s.source, e, walked * s.perCell, true);
      }
    },
  },
  // One bomb per enemy; it goes off on time or with its carrier.
  charged: {
    merge: () => false,
    tick: (sim, e, s) => {
      if (s.until !== -Infinity && sim.state.time >= s.until) detonate(sim, e, s);
    },
    onDeath: (sim, e, s) => {
      if (s.until !== -Infinity) detonate(sim, e, s);
    },
  },
  // Like stun: the running entry includes the recovery window, and a negative factor walks backwards.
  pull: {
    merge: () => false,
    speed: (s, time) => (time < s.release ? -s.factor : 1),
  },
  // Read by the armor trait through `armorDissolved`.
  armorDissolved: {
    merge: strongest((s) => s.fraction),
  },
};
const moduleOf = (effect: StatusEffect) => STATUSES[effect.kind] as StatusModule<StatusEffect>;
/**
 * Adds or merges a status effect; traits may make an enemy immune.
 * An expired entry is always replaced; otherwise the kind's `merge` rule decides.
 * True if the effect took hold; immunity or a rejected merge (a running stun or pull) is false.
 */
export function applyStatus(sim: Sim, e: Enemy, effect: StatusEffect): boolean {
  if (resists(sim, e, effect.kind)) return false;
  const existing = e.status.find((s) => s.kind === effect.kind);
  if (!existing) e.status.push({ ...effect });
  else if (!active(existing, sim.state.time)) replace(existing, effect);
  else return moduleOf(existing).merge(existing, effect);
  return true;
}
/** Share of the armor reduction removed by the strongest running Armor Dissolver. */
export function armorDissolved(e: Enemy, time: number) {
  const s = e.status.length ? e.status.find((effect) => effect.kind === "armorDissolved") : undefined;
  return s && active(s, time) ? (s as Of<"armorDissolved">).fraction : 0;
}
/** Movement factor from all active effects; 1 means full speed, 0 stunned, negative pulled back. */
export function speedFactor(e: Enemy, time: number) {
  let factor = 1;
  for (const s of e.status) if (active(s, time)) factor = Math.min(factor, moduleOf(s).speed?.(s, time) ?? 1);
  return factor;
}
/** Damage multiplier from all active effects, applied before armor. */
export function damageTaken(e: Enemy, time: number) {
  let factor = 1;
  for (const s of e.status) if (active(s, time)) factor = Math.max(factor, moduleOf(s).damageTaken?.(s) ?? 1);
  return factor;
}
export interface StatusFlags {
  slowed: boolean;
  stunned: boolean;
  burning: boolean;
  vulnerable: boolean;
  pulled: boolean;
  disrupted: boolean;
  netted: boolean;
  bleeding: boolean;
  charged: boolean;
}
/** Visible states for drawing. */
export function statusFlags(e: Enemy, time: number): StatusFlags {
  const on = (kind: StatusKind) => e.status.some((s) => s.kind === kind && active(s, time));
  const stun = e.status.find((s): s is Of<"stun"> => s.kind === "stun"),
    pull = e.status.find((s): s is Of<"pull"> => s.kind === "pull");
  return {
    slowed: on("slow"),
    stunned: !!stun && time < stun.release,
    burning: on("burn"),
    vulnerable: on("vulnerable"),
    pulled: !!pull && time < pull.release,
    disrupted: on("disrupted"),
    netted: on("netted"),
    bleeding: on("bleeding"),
    charged: on("charged"),
  };
}
export const isSlowed = (e: Enemy, time: number) => statusFlags(e, time).slowed;
/** Whether an effect of this kind is running; cheap enough for hot paths such as targeting. */
export const hasStatus = (e: Enemy, kind: StatusKind, time: number) => e.status.some((s) => s.kind === kind && active(s, time));
export const isNetted = (e: Enemy, time: number) => e.status.length > 0 && hasStatus(e, "netted", time);
/** Death hooks of running effects, e.g. a Haftmine going off with its carrier. */
export function statusDeath(sim: Sim, e: Enemy) {
  for (const s of e.status) if (active(s, sim.state.time) || s.kind === "charged") moduleOf(s).onDeath?.(sim, e, s);
}
/** Runs effect ticks such as burning, expires effects and runs per-tick enemy traits such as regeneration. */
export function tickStatus(sim: Sim, dt: number) {
  const time = sim.state.time;
  for (const e of sim.state.enemies) {
    if (!e.status.length) continue;
    for (const s of e.status) moduleOf(s).tick?.(sim, e, s);
    e.status = e.status.filter((s) => active(s, time));
  }
  tickTraits(sim, dt);
}
