import { expect } from "vitest";
import { Game } from "./game";
import { upgradeOptions } from "./upgrades";
import { moveProjectiles } from "../systems/combat";
import type { Enemy, EnemyId, MissionDefinition, Sim, TowerId } from "./types";
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
export interface Build {
  tower: TowerId;
  x: number;
  y: number;
}
/** Deterministic test player: before each wave it spends all affordable credits. */
export interface Strategy {
  builds: readonly Build[];
  /** Upgrade existing towers before building the next one. */
  upgradeFirst?: boolean;
}
export function play(
  mission: MissionDefinition,
  strategy?: Strategy,
  afterWave?: (game: Game) => void,
) {
  const g = new Game(mission),
    lives: number[] = [];
  const build = () => {
    const next = strategy!.builds.find(
      (b) => !g.state.towers.some((t) => t.x === b.x && t.y === b.y),
    );
    return !!next && g.command({ type: "build", ...next }).ok;
  };
  const upgrade = () => {
    const options = g.state.towers
      .flatMap((t) =>
        upgradeOptions(t, g.state.wallets[0])
          .filter((o) => o.status === "available")
          .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost })),
      )
      .sort((a, b) => a.cost - b.cost);
    return (
      !!options.length &&
      g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok
    );
  };
  const spend = () => {
    if (strategy) while (strategy.upgradeFirst ? upgrade() || build() : build() || upgrade());
  };
  if (mission.circle) {
    // Waves overlap on a ring: spend whenever the timer starts the next one.
    spend();
    g.command({ type: "start" });
    let wave = g.state.wave,
      steps = 0;
    while (g.state.status === "wave" && steps++ < 100000) {
      g.tick();
      g.drainEvents();
      if (g.state.wave === wave) continue;
      lives.push(g.state.lives);
      afterWave?.(g);
      wave = g.state.wave;
      spend();
    }
    expect(steps).toBeLessThan(100000);
    lives.push(g.state.lives);
    afterWave?.(g);
    return { game: g, lives };
  }
  while (g.state.status === "ready") {
    spend();
    g.command({ type: "start" });
    finishWave(g);
    lives.push(g.state.lives);
    afterWave?.(g);
  }
  return { game: g, lives };
}
