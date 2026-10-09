import type { Sim } from "../core/types";
import { positionOnPath } from "./path";
import { speedFactor } from "./status";
import { traitSpeedFactor } from "./traits";
export function moveEnemies(sim: Sim, dt: number) {
  const s = sim.state,
    path = sim.mission.map.path;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = sim.content.enemies[e.type];
    e.distance += d.speed * speedFactor(e, s.time) * traitSpeedFactor(sim, e) * dt;
    if (e.distance >= path.length - 1) {
      e.hp = 0;
      s.lives = Math.max(0, s.lives - d.leak);
      s.events.push({ type: "leak", at: { x: e.x, y: e.y }, amount: d.leak });
      continue;
    }
    const p = positionOnPath(path, e.distance);
    e.x = p.x;
    e.y = p.y;
  }
}
