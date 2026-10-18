import type { TetherAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { applyStatus } from "../status";
import { tetherOf } from "../tether";
import { canTarget, nearest } from "./targeting";
import type { AttackModule } from "./types";
/**
 * Tether: an instant grapple that links its target with the nearest enemies around it (see `systems/tether.ts`).
 * It prefers an enemy that is not linked yet, so the links spread over the crowd.
 */
export const tether: AttackModule<TetherAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    links: { label: "Linked enemies", valid: (v) => Number.isInteger(v) && v >= 2, unit: "" },
    radius: { label: "Link radius", valid: (v) => v > 0, unit: " cells" },
    duration: { label: "Link duration", valid: (v) => v > 0, unit: " s" },
  },
  choose: (sim, _type, _from, _reach, candidates) => candidates.find((c) => !tetherOf(c, sim.state.time)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("tether", src));
    if (enemy.hp <= 0) return;
    const s = sim.state,
      others = nearest(sim, enemy, spec.radius, spec.links - 1, (c) => c !== enemy && canTarget(sim, src.type, c));
    // A lone enemy has nobody to share with.
    if (!others.length) return;
    const group = s.nextId++,
      until = s.time + spec.duration,
      color = sim.content.towers[src.type].color;
    for (const e of [enemy, ...others]) applyStatus(sim, e, { kind: "tether", group, until, source: src });
    for (const o of others) s.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: o.x, y: o.y }, color });
  },
};
