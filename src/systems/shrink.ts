import type { Enemy, Sim, StatusEffect } from "../core/types";
/**
 * Shrink Ray: a shrunk enemy is smaller (Pitfall swallows it by its shrunk size), keeps only part of its armor
 * and leaks one reactor energy less. All of it is read from the running `shrink` status.
 */
type Shrink = Extract<StatusEffect, { kind: "shrink" }>;
/** The running shrink of an enemy, if any. */
export const shrinkOf = (e: Enemy, time: number): Shrink | undefined =>
  e.status.length ? e.status.find((s): s is Shrink => s.kind === "shrink" && time < s.until) : undefined;
/** Body size right now: the definition's, times a running shrink. */
export const sizeOf = (sim: Sim, e: Enemy) => sim.content.enemies[e.type].size * (shrinkOf(e, sim.state.time)?.factor ?? 1);
/** Share of the armor trait's reduction an enemy keeps; 1 unless shrunk. */
export const shrinkArmor = (e: Enemy, time: number) => shrinkOf(e, time)?.armor ?? 1;
/** Reactor energy an enemy takes when it leaks: one less while shrunk, but never below 1 (or below a smaller definition value). */
export function leakOf(sim: Sim, e: Enemy) {
  const leak = sim.content.enemies[e.type].leak;
  return leak > 1 && shrinkOf(e, sim.state.time) ? leak - 1 : leak;
}
