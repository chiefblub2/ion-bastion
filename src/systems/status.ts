import type { Enemy, Sim, StatusEffect, StatusKind } from "../core/types";
import { applyDamage } from "./damage";
import { resists, tickTraits } from "./traits";
/** Seconds between two burn damage steps; fewer, larger hits instead of one per tick. */
export const BURN_TICK = 0.5;
const active = (effect: StatusEffect, time: number) => time < effect.until;
type Of<K extends StatusKind> = Extract<StatusEffect, { kind: K }>;
interface StatusModule<S extends StatusEffect> {
  /** Combines a new effect with a running one of the same kind; mutates `existing`. */
  merge(existing: S, incoming: S): void;
  /** Movement factor while active; 1 means full speed. */
  speed?(effect: S, time: number): number;
  /** Damage factor while active; 1 means unchanged. */
  damageTaken?(effect: S): number;
  tick?(sim: Sim, enemy: Enemy, effect: S): void;
}
/** Rule for effects with one strength value: stronger replaces, equal extends, weaker never overrides. */
const strongest =
  <S extends StatusEffect>(strength: (effect: S) => number) =>
  (existing: S, incoming: S) => {
    if (strength(incoming) > strength(existing)) Object.assign(existing, incoming);
    else if (strength(incoming) === strength(existing)) existing.until = Math.max(existing.until, incoming.until);
  };
/** Status effects. A new effect is one member of `StatusEffect` plus one entry here. */
const STATUSES: { [K in StatusKind]: StatusModule<Of<K>> } = {
  slow: {
    merge: strongest((s) => -s.factor),
    speed: (s) => s.factor,
  },
  // A running entry includes the recovery window, so a stun never chains into the next one.
  stun: {
    merge: () => {},
    speed: (s, time) => (time < s.release ? 0 : 1),
  },
  burn: {
    merge: strongest((s) => s.dps),
    tick: (sim, e, s) => {
      while (s.next <= sim.state.time && s.next <= s.until && e.hp > 0) {
        s.next += BURN_TICK;
        applyDamage(sim, s.source, e, s.dps * BURN_TICK, true);
      }
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
  // Like stun: the running entry includes the recovery window, and a negative factor walks backwards.
  pull: {
    merge: () => {},
    speed: (s, time) => (time < s.release ? -s.factor : 1),
  },
};
const moduleOf = (effect: StatusEffect) => STATUSES[effect.kind] as StatusModule<StatusEffect>;
/**
 * Adds or merges a status effect; traits may make an enemy immune.
 * An expired entry is always replaced; otherwise the kind's `merge` rule decides.
 */
export function applyStatus(sim: Sim, e: Enemy, effect: StatusEffect) {
  if (resists(sim, e, effect.kind)) return;
  const existing = e.status.find((s) => s.kind === effect.kind);
  if (!existing) e.status.push({ ...effect });
  else if (!active(existing, sim.state.time)) Object.assign(existing, effect);
  else moduleOf(existing).merge(existing, effect);
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
  };
}
export const isSlowed = (e: Enemy, time: number) => statusFlags(e, time).slowed;
/** Whether an effect of this kind is running; cheap enough for hot paths such as targeting. */
export const hasStatus = (e: Enemy, kind: StatusKind, time: number) => e.status.some((s) => s.kind === kind && active(s, time));
export const isNetted = (e: Enemy, time: number) => e.status.length > 0 && hasStatus(e, "netted", time);
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
