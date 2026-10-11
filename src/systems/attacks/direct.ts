import type { DirectAttack } from "../../core/types";
import { applyDamage, hitOf, plain } from "../damage";
import { applyStatus } from "../status";
import { layerOf } from "../traits";
import { canAcquire, nearest } from "./targeting";
import type { AttackModule } from "./types";
export const direct: AttackModule<DirectAttack> = {
  aim: "enemy",
  projectile: "optional",
  params: {},
  apply: (sim, src, { enemy, proc }, damage) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("direct", src));
    const special = src.special;
    // Wingclip: a hit flyer is slowed; slow immunity still holds.
    if (special?.kind === "wingclip" && enemy.hp > 0 && layerOf(sim, enemy) === "air")
      applyStatus(sim, enemy, { kind: "slow", factor: 1 - special.slow, until: sim.state.time + special.duration });
    // Ricochet: a marked shot bounces once to the nearest other enemy the tower could aim at.
    if (special?.kind === "ricochet" && proc) {
      const [next] = nearest(sim, enemy, special.radius, 1, (c) => c !== enemy && canAcquire(sim, src.type, c));
      if (!next) return;
      sim.state.events.push({ type: "chain", from: { x: enemy.x, y: enemy.y }, to: { x: next.x, y: next.y }, color: sim.content.towers[src.type].color });
      applyDamage(sim, plain(src), next, damage * special.factor, false, hitOf("direct", plain(src)));
    }
  },
};
