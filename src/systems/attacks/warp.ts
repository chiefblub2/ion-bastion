import type { Enemy, Sim, WarpAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { positionOnPath } from "../path";
import { isEncased } from "../encase";
import { sizeOf } from "../shrink";
import { hasTrait } from "../traits";
import type { AttackModule } from "./types";
/** Small enough (a shrunk size counts) to send back, not unstoppable, not encased, and never warped before. */
export const canWarp = (sim: Sim, e: Enemy, spec: WarpAttack) =>
  !e.warped && sizeOf(sim, e) <= spec.size && !hasTrait(sim, e, "unstoppable") && !isEncased(e, sim.state.time);
/** Warp Pad: sends one enemy `cells` back along the path (never behind the entry), once per enemy. */
export const warp: AttackModule<WarpAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  trapOnly: true,
  params: {
    cells: { label: "Warp distance", valid: (v) => v > 0, unit: " cells" },
    size: { label: "Max. enemy size", valid: (v) => v > 0, show: (v) => Math.round(v * 100) },
  },
  choose: (sim, _type, _from, _reach, candidates, spec) => candidates.find((c) => canWarp(sim, c, spec)) ?? candidates[0],
  apply: (sim, src, { enemy }, damage, spec) => {
    if (!enemy) return;
    applyDamage(sim, src, enemy, damage, false, hitOf("warp", src));
    if (enemy.hp <= 0 || !canWarp(sim, enemy, spec)) return;
    const { path, loop } = sim.mission.map,
      at = { x: enemy.x, y: enemy.y };
    enemy.warped = true;
    enemy.distance = Math.max(0, enemy.distance - spec.cells);
    const p = positionOnPath(path, enemy.distance, loop);
    enemy.x = p.x;
    enemy.y = p.y;
    sim.state.events.push({ type: "warp", at, to: { x: p.x, y: p.y }, color: sim.content.towers[src.type].color });
  },
};
