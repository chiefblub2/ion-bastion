import type { Sim } from "../core/types";
import { positionOnPath } from "./path";
import { speedFactor } from "./status";
import { absorbLeak } from "./support";
import { blinkJump, traitSpeedFactor } from "./traits";
import { blockMove } from "./barricade";
import { leakOf } from "./shrink";
import { tetherStep } from "./tether";
export function moveEnemies(sim: Sim, dt: number) {
  const s = sim.state,
    { path, loop } = sim.mission.map;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = sim.content.enemies[e.type];
    const from = e.distance;
    e.distance += d.speed * speedFactor(e, s.time) * traitSpeedFactor(sim, e) * dt;
    // Tether: no faster than the slowest linked enemy.
    e.distance = tetherStep(sim, e, from, dt);
    // Blink: a forward move across a boundary adds one jump, never more than the reactor cell.
    const jump = blinkJump(sim, e, from);
    if (jump) e.distance = loop ? e.distance + jump : Math.min(e.distance + jump, path.length - 1);
    // Barricade: a walker halts in front of a standing wall and chews on it.
    blockMove(sim, e, from, dt);
    // A Gravitron pull walks backwards, but never behind the entry of a reactor map.
    if (!loop && e.distance < 0) e.distance = 0;
    // On a ring there is no reactor: enemies circle until they die.
    if (!loop && e.distance >= path.length - 1) {
      e.hp = 0;
      // Shrink Ray: a shrunk enemy leaks one energy less; the Shield Generator absorbs what it can.
      const leak = absorbLeak(sim, e, leakOf(sim, e));
      s.lives = Math.max(0, s.lives - leak);
      if (leak > 0) s.events.push({ type: "leak", at: { x: e.x, y: e.y }, amount: leak });
      continue;
    }
    const p = positionOnPath(path, e.distance, loop);
    e.x = p.x;
    e.y = p.y;
  }
}
