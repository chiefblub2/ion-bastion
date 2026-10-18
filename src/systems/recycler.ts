import { resolveUpgrades } from "../core/upgrades";
import type { DamageSource, Enemy, Sim } from "../core/types";
import { applyDamage, hitOf, plain, type DamageOutcome, type Hit } from "./damage";
import { dist } from "./path";
import { isSuppressed } from "./traits";
/** The strongest Recycler whose range covers `at`: share of the overkill passed on and its jump distance. */
export function recyclerAt(sim: Sim, at: Enemy) {
  let best: { share: number; reach: number; color: number; x: number; y: number } | undefined;
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
  if (outcome.overkill <= 0 || !Number.isFinite(outcome.overkill) || hit?.kind === "overkill") return;
  // Blood Transfer passes this overkill on itself; the Recycler never passes it a second time.
  if (src.special?.kind === "overkill-transfer") return;
  const recycler = recyclerAt(sim, victim);
  if (!recycler) return;
  let next: Enemy | undefined,
    best = recycler.reach;
  for (const e of sim.state.enemies) {
    if (e === victim || e.hp <= 0) continue;
    const d = dist(e, victim);
    if (d <= best && (!next || d < best)) {
      next = e;
      best = d;
    }
  }
  if (!next) return;
  const amount = outcome.overkill * recycler.share;
  sim.state.events.push({ type: "recycle", from: { x: victim.x, y: victim.y }, to: { x: next.x, y: next.y }, amount, color: recycler.color });
  const scrap = plain(src);
  applyDamage(sim, scrap, next, amount, false, hitOf("overkill", scrap));
}
