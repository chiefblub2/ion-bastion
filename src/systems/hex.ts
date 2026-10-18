import type { Enemy, Sim, StatusEffect } from "../core/types";
import { canTarget, nearest } from "./attacks/targeting";
import { applyDamage, hitOf, plain } from "./damage";
import { applyStatus, hasStatus } from "./status";
/**
 * Hex: a cursed enemy remembers the damage it takes. When the curse runs out it takes a share of that damage
 * once more (the echo itself is not remembered, as the curse has ended). Doom finishes a weakened enemy, and
 * Plague Hex passes plain curses on.
 */
type Echo = Extract<StatusEffect, { kind: "echo" }>;
/** Called by `applyDamage` with the damage that reached HP: every running curse on the enemy adds it up. */
export function storeEcho(e: Enemy, amount: number, time: number) {
  if (amount <= 0 || !e.status.length) return;
  for (const s of e.status) if (s.kind === "echo" && time < s.until) s.stored += amount;
}
/** The curse runs out: the echo hits, Doom may finish the enemy, and Plague Hex jumps on. */
export function releaseEcho(sim: Sim, e: Enemy, s: Echo) {
  const amount = s.stored * s.share,
    special = s.source.special;
  if (amount > 0 && e.hp > 0) {
    sim.state.events.push({ type: "echo", at: { x: e.x, y: e.y }, amount, color: sim.content.towers[s.source.type].color });
    // A curse, not a shot: it never misses and triggers no further procs.
    applyDamage(sim, plain(s.source), e, amount, true);
    if (special?.kind === "doom" && e.hp > 0 && e.hp < special.threshold * e.maxHp)
      applyDamage(sim, plain(s.source), e, Infinity, false, hitOf("echo", plain(s.source), { execution: true }));
  }
  jumpCurse(sim, e, s);
}
/** Plague Hex: the curse jumps to the nearest uncursed enemies, as plain curses that never jump again. */
export function jumpCurse(sim: Sim, e: Enemy, s: Echo) {
  const special = s.source.special;
  if (special?.kind !== "hex-spread") return;
  const time = sim.state.time,
    source = plain(s.source),
    color = sim.content.towers[s.source.type].color;
  for (const o of nearest(sim, e, special.radius, special.count, (c) => c !== e && !hasStatus(c, "echo", time) && canTarget(sim, source.type, c))) {
    sim.state.events.push({ type: "chain", from: { x: e.x, y: e.y }, to: { x: o.x, y: o.y }, color });
    applyStatus(sim, o, { kind: "echo", share: s.share, stored: 0, delay: s.delay, until: time + s.delay, source });
  }
}
