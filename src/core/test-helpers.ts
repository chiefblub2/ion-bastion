import { expect } from "vitest";
import { Game } from "./game";
import { moveProjectiles } from "../systems/combat";
import type { Enemy, EnemyId, Sim, TowerId } from "./types";
export function finishWave(game: Game) {
  let steps = 0;
  while (game.state.status === "wave" && steps++ < 30000) {
    game.tick();
    game.drainEvents();
  }
  expect(steps).toBeLessThan(30000);
}
/** Flies all projectiles to their targets without moving enemies. */
export function landProjectiles(sim: Sim) {
  for (let i = 0; i < 600 && sim.state.projectiles.length; i++) moveProjectiles(sim, 1 / 30);
  expect(sim.state.projectiles).toHaveLength(0);
}
/** Enemy placed directly into a test state. */
export function makeEnemy(id: number, type: EnemyId, x: number, y: number, distance = 10): Enemy {
  return { id, type, hp: 1000, maxHp: 1000, x, y, distance, status: [] };
}
export { play } from "./play";
export type { Build, Strategy } from "./play";
