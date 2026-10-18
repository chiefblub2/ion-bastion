import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { attackEnemies } from "./combat";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { TOWERS } from "../content/towers";
import type { EnemyId, PoolAttack } from "../core/types";
import { settleWave } from "./waves";
import { tickZones } from "./zones";

const { duration } = TOWERS.plasma.attack as PoolAttack,
  DPS = TOWERS.plasma.damage;
const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** Plasma at (7,5) on the outpost map lands one pool on the first enemy; enemies stand still. */
function land(enemies: [EnemyId, number, number][], upgrades: string[] = []) {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower: "plasma", x: 7, y: 5 });
  g.state.towers[0].upgrades = upgrades;
  g.state.enemies = enemies.map(([type, x, y], i) => makeEnemy(100 + i, type, x, y, 10 - i));
  attackEnemies(g, 0);
  landProjectiles(g);
  return g;
}
/** Steps the pools for `seconds` of game time. */
function burn(g: Game, seconds: number) {
  for (let i = 0; i < seconds * 30; i++) {
    g.state.time += 1 / 30;
    tickZones(g);
  }
}
const lost = (g: Game) => g.state.enemies.map((e) => Math.round(1000 - e.hp));

describe("Plasma pools", () => {
  it("burn every ground unit inside for dps × duration, hidden and burrowed ones included, but no flyer", () => {
    // The burrower stands in its tunnel window (distance 2 of every 3).
    const g = land([["drone", 7, 6], ["phantom", 7.3, 6], ["burrower", 6.7, 6], ["glider", 7, 6], ["drone", 9, 6]]);
    g.state.enemies[2].distance = 2;
    expect(g.state.zones).toHaveLength(1);
    burn(g, duration + 1);
    expect(lost(g)).toEqual([DPS * duration, DPS * duration, DPS * duration, 0, 0]);
    expect(g.state.zones).toBeUndefined();
  });
  it("never stacks two pools of one tower on the same enemy, and keeps burning after a sale", () => {
    const g = land([["drone", 7, 6]]);
    g.state.zones!.push({ ...g.state.zones![0] });
    g.command({ type: "sell", id: g.state.towers[0].id });
    burn(g, duration + 1);
    expect(lost(g)).toEqual([DPS * duration]);
  });
  it("Eruption bursts once when the pool runs out", () => {
    const g = land([["drone", 7, 6]], [...LEVELS, "eruption-1"]),
      z = g.state.zones![0];
    burn(g, z.duration + 1);
    expect(1000 - g.state.enemies[0].hp).toBeCloseTo(z.dps * z.duration * 1.5, 0);
  });
  it("is part of the hash and cleared at wave end", () => {
    const g = land([["drone", 7, 6]]),
      before = stateHash(g.state);
    delete g.state.zones;
    expect(stateHash(g.state)).not.toBe(before);
    const h = land([["drone", 7, 6]]);
    Object.assign(h.state, { status: "wave", wave: 1, enemies: [], queue: [] });
    settleWave(h);
    expect(h.state.zones).toBeUndefined();
  });
});
