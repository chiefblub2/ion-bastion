import type { DamageSource, Enemy, Point, Sim, SpecializationSpec } from "../../core/types";
import { applyStatus } from "../status";
import { layerOf } from "../traits";
import { canAcquire, canTarget, nearest } from "./targeting";
/**
 * Specialization abilities shared by several attack modules (an attack tower's and a trap's), so each lives in one
 * place: Final Decay's max-HP execute (Decay, Pitfall, Grinder), Frostburst (Cryo, Tar Pit, Oil Slick), Exposed
 * Target and Net Cloud (Snare Net, Harpoon). Chain Reaction lives beside the blast (`splash.ts`).
 */
type Of<K extends SpecializationSpec["kind"]> = Extract<SpecializationSpec, { kind: K }>;

/** Final Decay: the extra share of max HP a wounded target (judged on impact, strictly below the threshold) takes. */
export const executePercent = (special: SpecializationSpec | undefined, e: Enemy) =>
  special?.kind === "max-hp-execute" && e.hp < special.threshold * e.maxHp ? special.extraPercent : 0;

/** Frostburst: other enemies around `at` are only slowed, never hit; `except` (the hit target) is skipped. */
export function frostburst(sim: Sim, src: DamageSource, at: Point, special: Of<"frostburst">, except?: Enemy) {
  sim.state.events.push({ type: "pulse", at: { x: at.x, y: at.y }, radius: special.radius, color: sim.content.towers[src.type].color });
  for (const other of nearest(sim, at, special.radius, Infinity, (c) => c !== except && canTarget(sim, src.type, c)))
    applyStatus(sim, other, { kind: "slow", factor: special.factor, until: sim.state.time + special.duration });
}

/** Exposed Target: a net that took hold (`netted`) also weakens the flyer until the net ends. */
export function exposeNetted(sim: Sim, e: Enemy, special: SpecializationSpec | undefined, netted: boolean, until: number) {
  if (netted && special?.kind === "exposed-target") applyStatus(sim, e, { kind: "vulnerable", amount: special.bonus, until });
}

/** Net Cloud: other flyers near the target are caught in the same net (speed `factor` until `until`), without damage. */
export function netCloud(sim: Sim, src: DamageSource, enemy: Enemy, special: Of<"net-cloud">, factor: number, until: number) {
  const color = sim.content.towers[src.type].color;
  for (const other of nearest(sim, enemy, special.radius, special.count, (c) => c !== enemy && layerOf(sim, c) === "air" && canAcquire(sim, src.type, c))) {
    sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: other.x, y: other.y }, color });
    applyStatus(sim, other, { kind: "netted", factor, until });
  }
}
