import type { Enemy, FocusAttack, Point, Sim, TowerId } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { canAcquire } from "./targeting";
import type { AttackModule } from "./types";
/** Prism Beam: the first enemy behind the target on the beam, within `width` of it and the tower's reach. */
function behind(sim: Sim, type: TowerId, from: Point, target: Enemy, reach: number, width: number): Enemy | undefined {
  const dx = target.x - from.x,
    dy = target.y - from.y,
    length = Math.hypot(dx, dy) || 1,
    ux = dx / length,
    uy = dy / length;
  return sim.state.enemies
    .filter((e) => e !== target && e.hp > 0 && canAcquire(sim, type, e))
    .map((e) => ({ e, along: (e.x - from.x) * ux + (e.y - from.y) * uy, off: Math.abs((e.x - from.x) * uy - (e.y - from.y) * ux) }))
    .filter((h) => h.along > length && h.along <= reach && h.off <= width)
    .sort((a, b) => a.along - b.along || a.e.id - b.e.id)[0]?.e;
}
/** Fokus: an instant beam that grows stronger with every consecutive hit on the same target. */
export const focus: AttackModule<FocusAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    ramp: { label: "Charge per hit", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
    stacks: { label: "Max. levels", valid: (v) => Number.isInteger(v) && v >= 1 },
  },
  // Holds the locked target while it stays in range, whatever the priority says.
  choose: (_sim, _type, _from, _reach, candidates, _spec, tower) =>
    candidates.find((c) => c.id === tower.focus?.target) ?? candidates[0],
  apply: (sim, src, { enemy, from, reach }, damage, spec) => {
    if (!enemy || !from) return;
    const tower = sim.state.towers.find((t) => t.id === src.tower),
      special = src.special;
    let stacks = 0;
    if (tower) {
      // Adaptive Lens: a new target starts with a share of the stacks built so far.
      const carried = special?.kind === "focus-carry" && tower.focus ? Math.floor(tower.focus.stacks * special.carry) : 0;
      stacks = tower.focus?.target === enemy.id ? Math.min(spec.stacks, tower.focus.stacks + 1) : carried;
      tower.focus = { target: enemy.id, stacks };
    }
    const color = sim.content.towers[src.type].color,
      raw = damage * (1 + spec.ramp * stacks);
    sim.state.events.push({ type: "beam", from: { ...from }, to: { x: enemy.x, y: enemy.y }, color, power: stacks / spec.stacks });
    applyDamage(sim, src, enemy, raw, false, hitOf("focus", src));
    // Prism Beam: one extra hit behind the target, which never builds stacks.
    if (special?.kind !== "prism-beam" || reach === undefined) return;
    const next = behind(sim, src.type, from, enemy, reach, special.width);
    if (!next) return;
    sim.state.events.push({ type: "beam", from: { x: enemy.x, y: enemy.y }, to: { x: next.x, y: next.y }, color });
    applyDamage(sim, plain(src), next, raw * special.factor, false, hitOf("focus", plain(src)));
  },
};
