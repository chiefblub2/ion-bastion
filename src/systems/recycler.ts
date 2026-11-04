import { resolveUpgrades } from "../core/upgrades";
import type { DamageSource, Enemy, Sim } from "../core/types";
import { applyDamage, hitOf, plain, type DamageOutcome, type Hit } from "./damage";
import { dist } from "./path";
import { isSuppressed } from "./traits";
import { recyclerPaths, scrapYard } from "./target-paths";
export interface Recycler {
  share: number;
  reach: number;
  color: number;
  x: number;
  y: number;
}
/** The strongest Recycler whose range covers `at`: share of the overkill passed on and its jump distance. */
export function recyclerAt(sim: Sim, at: Enemy) {
  let best: Recycler | undefined;
  for (const t of sim.state.towers) {
    const r = resolveUpgrades(t, sim.content);
    if (r.attack.kind !== "overkill" || dist(at, t) > r.stats.range || isSuppressed(sim, t)) continue;
    if (!best || r.attack.share > best.share)
      best = { share: r.attack.share, reach: r.attack.reach, color: sim.content.towers[t.type].color, x: t.x, y: t.y };
  }
  return best;
}
/**
 * Recycler: the overkill of a kill within a Recycler's range jumps to the living enemy nearest the victim
 * (within `reach`, ties by spawn order). The jump is a plain hit of kind `overkill`, so it never jumps again
 * and never procs a specialization. Called by `applyDamage` after a kill.
 */
export function recycleOverkill(sim: Sim, src: DamageSource, victim: Enemy, outcome: DamageOutcome, hit?: Hit) {
  scrapYard(sim, victim, outcome); // support combat: Scrap Yard counts every kill's overkill, jumps included
  if (outcome.overkill <= 0 || !Number.isFinite(outcome.overkill) || hit?.kind === "overkill") return;
  // Blood Transfer passes this overkill on itself; the Recycler never passes it a second time.
  if (src.special?.kind === "overkill-transfer") return;
  const recycler = recyclerAt(sim, victim);
  if (!recycler) return;
  const jump = jumpOverkill(sim, src, victim, outcome.overkill * recycler.share, recycler.reach, recycler.color);
  if (jump) recyclerPaths(sim, src, victim, jump, recycler); // support combat: Cascade, Meltdown
}
/**
 * One jump of `amount` overkill from `from` to the living enemy nearest it (within `reach`, ties by spawn order), as a
 * plain hit of kind `overkill`. Returns the target, the amount and the hit's outcome, or nothing without a target.
 */
export function jumpOverkill(sim: Sim, src: DamageSource, from: Enemy, amount: number, reach: number, color: number) {
  let next: Enemy | undefined,
    best = reach;
  for (const e of sim.state.enemies) {
    if (e === from || e.hp <= 0) continue;
    const d = dist(e, from);
    if (d <= best && (!next || d < best)) {
      next = e;
      best = d;
    }
  }
  if (!next) return undefined;
  sim.state.events.push({ type: "recycle", from: { x: from.x, y: from.y }, to: { x: next.x, y: next.y }, amount, color });
  const scrap = plain(src);
  return { target: next, amount, outcome: applyDamage(sim, scrap, next, amount, false, hitOf("overkill", scrap)) };
}
