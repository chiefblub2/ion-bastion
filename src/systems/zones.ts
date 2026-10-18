import type { Sim } from "../core/types";
import { canTarget } from "./attacks/targeting";
import { blast } from "./attacks/splash";
import { applyDamage, plain } from "./damage";
import { dist } from "./path";
import { applyStatus, BURN_TICK } from "./status";
/**
 * Plasma pools: every `BURN_TICK` each pool burns the enemies its tower can target inside it, hidden and
 * burrowed ones included (like traps). Pools of one tower overlap without stacking: an enemy takes one step
 * per tower. Expired pools are removed, and Eruption pools burst once on the way out.
 */
export function tickZones(sim: Sim) {
  const s = sim.state,
    zones = s.zones;
  if (!zones) return;
  const time = s.time,
    burnt = new Set<string>();
  for (const z of zones) {
    if (z.next > time) continue;
    const step = z.next;
    z.next += BURN_TICK;
    if (step >= z.until) continue;
    const special = z.source.special;
    // A copy: fragments released by a death in the pool step in only from the next step on.
    for (const e of [...s.enemies]) {
      if (e.hp <= 0 || dist(e, z.at) > z.radius || !canTarget(sim, z.source.type, e)) continue;
      const key = `${z.source.tower}:${e.id}`;
      if (burnt.has(key)) continue;
      burnt.add(key);
      applyDamage(sim, plain(z.source), e, z.dps * BURN_TICK, true);
      if (e.hp <= 0) continue;
      if (special?.kind === "pool-dissolve") applyStatus(sim, e, { kind: "armorDissolved", fraction: special.fraction, until: time + special.duration });
      else if (special?.kind === "pool-slow") applyStatus(sim, e, { kind: "slow", factor: special.factor, until: time + special.duration });
    }
  }
  const left = zones.filter((z) => z.until > time);
  for (const z of zones) {
    const special = z.source.special;
    if (z.until > time || special?.kind !== "eruption") continue;
    s.events.push({ type: "pulse", at: z.at, radius: z.radius, color: sim.content.towers[z.source.type].color });
    blast(sim, plain(z.source), z.at, z.radius, z.dps * z.duration * special.factor, "pool");
  }
  if (left.length) s.zones = left;
  else delete s.zones;
}
