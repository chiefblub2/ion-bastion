import type { ShrinkAttack } from "../../core/types";
import { applyDamage, hitOf } from "../damage";
import { positionOnPath } from "../path";
import { isEncased } from "../encase";
import { shrinkOf } from "../shrink";
import { applyStatus } from "../status";
import { resists } from "../traits";
import type { AttackModule } from "./types";
/**
 * Shrink Ray: an instant beam that shrinks its target (see `systems/shrink.ts`). It prefers the biggest enemy
 * in range that is not shrunk yet, so Pitfall gets the big units.
 */
export const shrink: AttackModule<ShrinkAttack> = {
  aim: "enemy",
  projectile: "forbidden",
  params: {
    factor: { label: "Size", valid: (v) => v > 0 && v < 1, unit: " %", show: (v) => Math.round(v * 100) },
    armor: { label: "Armor kept", valid: (v) => v >= 0 && v < 1, unit: " %", show: (v) => Math.round(v * 100) },
    duration: { label: "Duration", valid: (v) => v > 0, unit: " s" },
  },
  choose: (sim, _type, _from, _reach, candidates) => {
    const time = sim.state.time,
      size = (c: (typeof candidates)[number]) => sim.content.enemies[c.type].size;
    let best: (typeof candidates)[number] | undefined;
    for (const c of candidates) if (!shrinkOf(c, time) && (!best || size(c) > size(best))) best = c;
    return best ?? candidates[0];
  },
  apply: (sim, src, { enemy, from }, damage, spec) => {
    if (!enemy) return;
    const s = sim.state,
      special = src.special;
    if (from) s.events.push({ type: "beam", from: { ...from }, to: { x: enemy.x, y: enemy.y }, color: sim.content.towers[src.type].color });
    // Shrunk first, so the beam's own hit already meets the thinner armor.
    applyStatus(sim, enemy, {
      kind: "shrink",
      factor: spec.factor,
      armor: spec.armor,
      until: s.time + spec.duration,
      ...(special?.kind === "brittle-frame" ? { bonus: special.bonus } : {}),
    });
    applyDamage(sim, src, enemy, damage, false, hitOf("shrink", src));
    // Featherweight: a shrunk survivor is knocked back along the path; whatever resists a pull stands firm.
    if (special?.kind !== "shrink-knock" || enemy.hp <= 0 || !shrinkOf(enemy, s.time) || resists(sim, enemy, "pull") || isEncased(enemy, s.time)) return;
    const { path, loop } = sim.mission.map;
    enemy.distance = Math.max(0, enemy.distance - special.cells);
    const p = positionOnPath(path, enemy.distance, loop);
    enemy.x = p.x;
    enemy.y = p.y;
  },
};
