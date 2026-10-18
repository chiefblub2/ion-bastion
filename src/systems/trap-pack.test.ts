import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { makeEnemy, landProjectiles } from "../core/test-helpers";
import { validateTower } from "../core/validation";
import { TOWERS } from "../content/towers";
import type { BlockAttack, ChainAttack, Enemy, EnemyId, GrindAttack, HarpoonAttack, OilAttack, TowerId, WarpAttack } from "../core/types";
import { CHEW, clampToWall, WALL_GAP, wallShare } from "./barricade";
import { attackEnemies } from "./combat";
import { moveEnemies } from "./movement";
import { positionOnPath } from "./path";
import { applyStatus, hasStatus, isNetted, statusFlags, tickStatus } from "./status";
import { settleWave } from "./waves";
/** A Game on the default map with a trap on path cell `cell`. */
function trap(type: TowerId, cell = 4) {
  const g = new Game(),
    at = g.mission.map.path[cell];
  g.state.wallets[0] = 10000;
  expect(g.command({ type: "build", tower: type, ...at }).ok).toBe(true);
  return { g, at, cell, tower: g.state.towers[0] };
}
/** An enemy at path distance `distance`. */
function walker(g: Game, id: number, type: EnemyId, distance: number): Enemy {
  const p = positionOnPath(g.mission.map.path, distance);
  return makeEnemy(id, type, p.x, p.y, distance);
}
describe("Barricade", () => {
  const { hp } = TOWERS.barricade.attack as BlockAttack;
  it("halts walkers in front of its cell while they chew on the wall; flyers pass", () => {
    const { g, cell, tower } = trap("barricade");
    g.state.enemies = [walker(g, 1, "drone", cell - 1), walker(g, 2, "glider", cell - 1)];
    moveEnemies(g, 1);
    const [drone, glider] = g.state.enemies;
    expect(drone.distance).toBe(cell - WALL_GAP);
    expect(glider.distance).toBeGreaterThan(cell);
    expect(tower.wall).toBeCloseTo(CHEW * 0.19 * 1);
    // The spikes hit only the enemy pressing against it.
    attackEnemies(g, 0);
    expect(drone.hp).toBe(1000 - TOWERS.barricade.damage);
  });
  it("gives way once chewed through, and stands whole again after the wave", () => {
    const { g, cell, tower } = trap("barricade");
    tower.wall = hp - 1;
    g.state.enemies = [walker(g, 1, "drone", cell - 1)];
    moveEnemies(g, 1);
    expect(g.drainEvents().some((e) => e.type === "breach")).toBe(true);
    expect(wallShare(tower, g.content)).toBe(0);
    moveEnemies(g, 1);
    expect(g.state.enemies[0].distance).toBeGreaterThan(cell);
    g.state.status = "wave";
    g.state.wave = 1;
    g.state.enemies = [];
    settleWave(g);
    expect(tower.wall).toBeUndefined();
  });
  it("stops a forward drag at the wall, and a netted flyer still flies over it", () => {
    const { g, cell } = trap("barricade");
    const drone = walker(g, 1, "drone", cell - 0.8),
      glider = walker(g, 2, "glider", cell - 1);
    g.state.enemies = [drone, glider];
    drone.distance = cell + 0.5;
    clampToWall(g, drone, cell - 0.8);
    expect(drone.distance).toBe(cell - WALL_GAP);
    applyStatus(g, glider, { kind: "netted", factor: 0.7, until: 9 });
    moveEnemies(g, 1);
    expect(glider.distance).toBeGreaterThan(cell);
  });
  it("is smashed at once by an unstoppable enemy", () => {
    const { g, cell, tower } = trap("barricade");
    g.state.enemies = [walker(g, 1, "berserker", cell - 1)];
    moveEnemies(g, 1);
    expect(g.state.enemies[0].distance).toBeGreaterThan(cell - WALL_GAP);
    expect(wallShare(tower, g.content)).toBe(0);
  });
  it("hashes the wall only while it is damaged", () => {
    const { g, tower } = trap("barricade"),
      whole = stateHash(g.state);
    tower.wall = 10;
    expect(stateHash(g.state)).not.toBe(whole);
  });
});
describe("Warp Pad", () => {
  const { cells, size } = TOWERS.warp.attack as WarpAttack;
  it("sends an enemy back once, never behind the entry, and skips enemies that are too big", () => {
    const { g, cell, tower } = trap("warp", 6);
    const drone = walker(g, 1, "drone", cell);
    g.state.enemies = [drone];
    attackEnemies(g, 0);
    expect(drone.distance).toBe(cell - cells);
    expect(drone.warped).toBe(true);
    expect(g.drainEvents().some((e) => e.type === "warp")).toBe(true);
    // Back on the pad: no second warp.
    Object.assign(drone, walker(g, 1, "drone", cell), { warped: true });
    tower.cooldown = 0;
    attackEnemies(g, 0);
    expect(drone.distance).toBe(cell);
    // A Titan is too big.
    expect(size).toBeLessThan(0.38);
    const titan = walker(g, 2, "boss", cell);
    g.state.enemies = [titan];
    tower.cooldown = 0;
    attackEnemies(g, 0);
    expect(titan.distance).toBe(cell);
    expect(titan.warped).toBeUndefined();
  });
  it("clamps at the entry", () => {
    const { g, tower } = trap("warp", 2);
    const drone = walker(g, 1, "drone", 2);
    g.state.enemies = [drone];
    tower.cooldown = 0;
    attackEnemies(g, 0);
    expect(drone.distance).toBe(0);
  });
});
describe("Arc Plate", () => {
  it("strikes the walker on it and jumps to a flyer nearby", () => {
    const { g, at } = trap("arc"),
      { falloff } = TOWERS.arc.attack as ChainAttack;
    g.state.enemies = [makeEnemy(1, "drone", at.x, at.y), makeEnemy(2, "glider", at.x + 1, at.y)];
    attackEnemies(g, 0);
    const [drone, glider] = g.state.enemies;
    expect(drone.hp).toBe(1000 - TOWERS.arc.damage);
    expect(glider.hp).toBeCloseTo(1000 - TOWERS.arc.damage * falloff);
  });
});
describe("Oil Slick", () => {
  const { boost } = TOWERS.oil.attack as OilAttack;
  it("doubles burns on oiled enemies and passes the fire to oiled neighbours only", () => {
    const { g, at } = trap("oil");
    const oiled = makeEnemy(1, "drone", at.x, at.y),
      neighbour = makeEnemy(2, "drone", at.x + 0.2, at.y),
      dry = makeEnemy(3, "drone", at.x + 3, at.y);
    g.state.enemies = [oiled, neighbour, dry];
    attackEnemies(g, 0);
    expect(statusFlags(oiled, 0).oiled).toBe(true);
    // The neighbour walked off; a dry enemy stands next to the burning one.
    Object.assign(neighbour, { x: at.x + 1, y: at.y });
    Object.assign(dry, { x: at.x, y: at.y + 0.5 });
    const before = [oiled.hp, dry.hp];
    const burn = { kind: "burn" as const, dps: 10, next: 0.5, until: 3, source: { tower: 0, type: "inferno" as const } };
    applyStatus(g, oiled, burn);
    applyStatus(g, dry, { ...burn });
    g.state.time = 0.5;
    tickStatus(g, 0);
    expect(before[0] - oiled.hp).toBeCloseTo(10 * 0.5 * boost);
    expect(before[1] - dry.hp).toBeCloseTo(10 * 0.5);
    expect(hasStatus(neighbour, "burn", 0.5)).toBe(true);
    // A dry enemy beside the burning one does not catch fire through the oil.
    const third = makeEnemy(4, "drone", at.x - 0.3, at.y);
    g.state.enemies.push(third);
    tickStatus(g, 0);
    expect(hasStatus(third, "burn", 0.5)).toBe(false);
  });
});
describe("Grinder", () => {
  const { bonus } = TOWERS.grinder.attack as GrindAttack,
    d = TOWERS.grinder.damage;
  it("grazes walkers and bites held enemies up to 1 + bonus times", () => {
    const { g, at } = trap("grinder");
    const moving = makeEnemy(1, "drone", at.x, at.y),
      held = makeEnemy(2, "drone", at.x, at.y),
      slowed = makeEnemy(3, "drone", at.x, at.y);
    applyStatus(g, held, { kind: "stun", release: 1, until: 2 });
    applyStatus(g, slowed, { kind: "slow", factor: 0.5, until: 2 });
    g.state.enemies = [moving, held, slowed];
    attackEnemies(g, 0);
    expect(1000 - moving.hp).toBeCloseTo(d);
    expect(1000 - held.hp).toBeCloseTo(d * (1 + bonus));
    expect(1000 - slowed.hp).toBeCloseTo(d * (1 + bonus * 0.5));
  });
  it("counts an enemy blocked by a Barricade as standing still", () => {
    const g = new Game(),
      path = g.mission.map.path;
    g.state.wallets[0] = 10000;
    expect(g.command({ type: "build", tower: "barricade", ...path[5] }).ok).toBe(true);
    expect(g.command({ type: "build", tower: "grinder", ...path[4] }).ok).toBe(true);
    g.state.enemies = [walker(g, 1, "drone", 4)];
    moveEnemies(g, 1);
    g.state.towers[0].cooldown = 1;
    attackEnemies(g, 0);
    expect(1000 - g.state.enemies[0].hp).toBeCloseTo(d * (1 + bonus));
  });
});
describe("Harpoon", () => {
  const { pin, duration } = TOWERS.harpoon.attack as HarpoonAttack;
  it("is a valid air trap and ignores walkers", () => {
    expect(() => validateTower(TOWERS.harpoon, "Tower")).not.toThrow();
    expect(() => validateTower({ ...TOWERS.harpoon, attack: { kind: "harpoon", pin: 3, duration: 2 } }, "Tower")).toThrow(/at least as long/);
    const { g, at } = trap("harpoon");
    g.state.enemies = [makeEnemy(1, "drone", at.x, at.y)];
    attackEnemies(g, 0);
    expect(g.state.projectiles).toHaveLength(0);
  });
  it("pins a flyer and nets it, so ground towers can hit it", () => {
    const { g, at } = trap("harpoon");
    const glider = makeEnemy(1, "glider", at.x, at.y);
    g.state.enemies = [glider];
    attackEnemies(g, 0);
    landProjectiles(g);
    expect(glider.hp).toBe(1000 - TOWERS.harpoon.damage);
    expect(statusFlags(glider, pin - 0.1).stunned).toBe(true);
    expect(statusFlags(glider, pin + 0.1).stunned).toBe(false);
    expect(isNetted(glider, duration - 0.1)).toBe(true);
  });
});
