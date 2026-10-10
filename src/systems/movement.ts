import type { Sim } from "../core/types";
import { positionOnPath } from "./path";
import { speedFactor } from "./status";
import { traitSpeedFactor } from "./traits";
export function moveEnemies(sim: Sim, dt: number) {
  const s = sim.state,
    { path, loop } = sim.mission.map;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = sim.content.enemies[e.type];
    e.distance += d.speed * speedFactor(e, s.time) * traitSpeedFactor(sim, e) * dt;
    // A Gravitron pull walks backwards, but never behind the entry of a reactor map.
    if (!loop && e.distance < 0) e.distance = 0;
    // On a ring there is no reactor: enemies circle until they die.
    if (!loop && e.distance >= path.length - 1) {
      e.hp = 0;
      s.lives = Math.max(0, s.lives - d.leak);
      s.events.push({ type: "leak", at: { x: e.x, y: e.y }, amount: d.leak });
      continue;
    }
    const p = positionOnPath(path, e.distance, loop);
    e.x = p.x;
    e.y = p.y;
  }
}
