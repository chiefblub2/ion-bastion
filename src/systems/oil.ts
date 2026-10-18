import type { Enemy, Sim, StatusEffect } from "../core/types";
import { canTarget } from "./attacks/targeting";
import { plain } from "./damage";
import { dist } from "./path";
import { applyStatus, BURN_TICK, hasStatus } from "./status";
type Oiled = Extract<StatusEffect, { kind: "oiled" }>;
type Burn = Extract<StatusEffect, { kind: "burn" }>;
/** Seconds a Plasma pool sets an oiled enemy alight for. */
export const POOL_IGNITION = 1.5;
const oilOf = (e: Enemy, time: number) =>
  e.status.length ? (e.status.find((s) => s.kind === "oiled" && time < s.until) as Oiled | undefined) : undefined;
/** Burn multiplier of an oiled enemy; 1 without oil. */
export const oilBoost = (e: Enemy, time: number) => oilOf(e, time)?.boost ?? 1;
/**
 * Status tick of oil: a burning oiled enemy sets oiled neighbours within `radius` alight with the same burn (no
 * spread of their own), and a Plasma pool ignites an oiled enemy standing in it. Copies keep the burn's end, so two
 * oiled enemies never keep each other burning.
 */
export function igniteOiled(sim: Sim, e: Enemy, oil: Oiled) {
  const s = sim.state,
    time = s.time;
  if (e.hp <= 0) return;
  for (const z of s.zones ?? [])
    if (!hasStatus(e, "burn", time) && dist(e, z.at) <= z.radius && canTarget(sim, z.source.type, e))
      applyStatus(sim, e, { kind: "burn", dps: z.dps, next: time + BURN_TICK, until: time + POOL_IGNITION, source: plain(z.source) });
  const burn = e.status.find((x): x is Burn => x.kind === "burn" && time < x.until);
  if (!burn) return;
  const color = sim.content.towers[burn.source.type].color;
  for (const other of s.enemies) {
    if (other === e || other.hp <= 0 || dist(other, e) > oil.radius || !oilOf(other, time) || hasStatus(other, "burn", time)) continue;
    if (applyStatus(sim, other, { kind: "burn", dps: burn.dps, next: time + BURN_TICK, until: burn.until, source: plain(burn.source) }))
      s.events.push({ type: "chain", from: { x: e.x, y: e.y }, to: { x: other.x, y: other.y }, color });
  }
}
