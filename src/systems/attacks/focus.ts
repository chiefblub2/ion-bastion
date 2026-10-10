import type { FocusAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import type { AttackModule } from "./types";
/** Fokus: an instant beam that grows stronger with every consecutive hit on the same target. */
export const focus: AttackModule<FocusAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    ramp: { label: "Aufladung je Treffer", valid: (v) => v > 0, unit: " %", show: (v) => v * 100 },
    stacks: { label: "Max. Stufen", valid: (v) => Number.isInteger(v) && v >= 1 },
  },
  // Holds the locked target while it stays in range, whatever the priority says.
  choose: (_sim, _type, _from, _reach, candidates, _spec, tower) =>
    candidates.find((c) => c.id === tower.focus?.target) ?? candidates[0],
  apply: (sim, src, { enemy, from }, damage, spec) => {
    if (!enemy || !from) return;
    const tower = sim.state.towers.find((t) => t.id === src.tower);
    let stacks = 0;
    if (tower) {
      stacks = tower.focus?.target === enemy.id ? Math.min(spec.stacks, tower.focus.stacks + 1) : 0;
      tower.focus = { target: enemy.id, stacks };
    }
    sim.state.events.push({
      type: "beam",
      from: { ...from },
      to: { x: enemy.x, y: enemy.y },
      color: sim.content.towers[src.type].color,
      power: stacks / spec.stacks,
    });
    applyDamage(sim, src, enemy, damage * (1 + spec.ramp * stacks), false, hitOf("focus", src));
  },
};
