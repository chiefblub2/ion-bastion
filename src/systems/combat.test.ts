import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { attackEnemies, moveProjectiles } from "./combat";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import { ENEMIES } from "../content/enemies";
import type { ChainAttack, Enemy, EnemyId, PierceAttack, SplashAttack, TowerId } from "../core/types";
import { applyDamage } from "./damage";
import { damageTaken, speedFactor, tickStatus } from "./status";
/** Tower at (7,5) on the outpost map; enemies are placed directly into the state. */
function setup(tower: TowerId, enemies: [EnemyId, number, number][]) {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower, x: 7, y: 5 });
  expect(g.state.towers).toHaveLength(1);
  g.state.enemies = enemies.map(([type, x, y], i) => makeEnemy(100 + i, type, x, y, 10 - i));
  attackEnemies(g, 0);
  landProjectiles(g);
  return g.state.enemies.map((e) => 1000 - e.hp);
}
describe("ground and air targeting", () => {
  it("Nova ignores gliders and its splash spares them", () => {
    expect(setup("blast", [["glider", 7, 6]])).toEqual([0]);
    const [glider, drone] = setup("blast", [["glider", 7, 6], ["drone", 7, 6.3]]);
    expect(glider).toBe(0);
    expect(drone).toBe(TOWERS.blast.damage);
  });
  it("Flak hits only air", () => {
    expect(setup("flak", [["drone", 7, 6]])).toEqual([0]);
    expect(setup("flak", [["glider", 7, 6]])).toEqual([TOWERS.flak.damage]);
  });
  it("Impuls and Kryo hit gliders", () => {
    expect(setup("pulse", [["glider", 7, 6]])).toEqual([TOWERS.pulse.damage]);
    expect(setup("frost", [["glider", 7, 6]])).toEqual([TOWERS.frost.damage]);
  });
  it("Tesla chains to at most three nearby targets with falloff", () => {
    const d = TOWERS.tesla.damage,
      f = (TOWERS.tesla.attack as ChainAttack).falloff;
    const hits = setup("tesla", [
      ["drone", 7, 6],
      ["glider", 7, 7],
      ["tank", 7, 8],
      ["runner", 7, 9],
      ["drone", 7, 10],
    ]);
    expect(hits).toEqual([d, d * f, d * f * f, d * f ** 3, 0]);
    // Out of jump range: only the primary target is hit.
    expect(setup("tesla", [["drone", 7, 6], ["drone", 7, 7.7]])).toEqual([d, 0]);
  });
  it("rejects attack towers without targets and enemies without layer", () => {
    expect(() =>
      validateContent({ ...DEFAULT_CONTENT, towers: { ...TOWERS, pulse: { ...TOWERS.pulse, targets: [] } } }),
    ).toThrow("Turmziele");
    expect(() =>
      validateContent({ ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, layer: "space" as never } } }),
    ).toThrow("Gegnerebene");
  });
});

const enemyAt = (id: number, type: EnemyId, x: number, y: number): Enemy => makeEnemy(id, type, x, y);
function fire(tower: TowerId, enemies: Enemy[]) {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower, x: 7, y: 5 });
  g.state.enemies = enemies;
  attackEnemies(g, 0);
  return g;
}
describe("projectiles", () => {
  it("deal damage on arrival, not when fired", () => {
    const g = fire("pulse", [enemyAt(100, "drone", 7, 7)]);
    expect(g.state.enemies[0].hp).toBe(1000);
    expect(g.state.projectiles).toHaveLength(1);
    moveProjectiles(g, 1 / 30);
    expect(g.state.enemies[0].hp).toBe(1000);
    landProjectiles(g);
    expect(g.state.enemies[0].hp).toBe(1000 - TOWERS.pulse.damage);
    expect(g.drainEvents().some((e) => e.type === "impact")).toBe(true);
  });
  it("homing projectiles retarget nearby when the target dies, otherwise fizzle", () => {
    const g = fire("pulse", [enemyAt(100, "drone", 7, 7), enemyAt(101, "drone", 7.5, 6.2)]);
    g.state.enemies[0].hp = 0;
    landProjectiles(g);
    expect(g.state.enemies[1].hp).toBe(1000 - TOWERS.pulse.damage);
    const lone = fire("pulse", [enemyAt(100, "drone", 7, 7), enemyAt(101, "drone", 7, 9.5)]);
    lone.state.enemies[0].hp = 0;
    landProjectiles(lone);
    expect(lone.state.enemies[1].hp).toBe(1000);
  });
  it("Nova shells land on the fire-time position and miss enemies that moved away", () => {
    const g = fire("blast", [enemyAt(100, "drone", 7, 7)]);
    g.state.enemies[0].y = 7 + (TOWERS.blast.attack as SplashAttack).radius + 0.5;
    landProjectiles(g);
    expect(g.state.enemies[0].hp).toBe(1000);
    const stay = fire("blast", [enemyAt(100, "drone", 7, 7)]);
    landProjectiles(stay);
    expect(stay.state.enemies[0].hp).toBe(1000 - TOWERS.blast.damage);
  });
  it("projectiles of a sold tower still land", () => {
    const g = fire("pulse", [enemyAt(100, "drone", 7, 7)]);
    g.command({ type: "sell", id: g.state.towers[0].id });
    landProjectiles(g);
    expect(g.state.enemies[0].hp).toBe(1000 - TOWERS.pulse.damage);
  });
  it("Tesla lightning still hits instantly", () => {
    const g = fire("tesla", [enemyAt(100, "drone", 7, 7)]);
    expect(g.state.projectiles).toHaveLength(0);
    expect(g.state.enemies[0].hp).toBe(1000 - TOWERS.tesla.damage);
  });
  it("pausing freezes projectiles", () => {
    const g = fire("pulse", [enemyAt(100, "drone", 7, 7)]);
    g.state.status = "wave";
    g.command({ type: "pause" });
    const before = JSON.stringify(g.state.projectiles);
    for (let i = 0; i < 30; i++) g.tick();
    expect(JSON.stringify(g.state.projectiles)).toBe(before);
  });
});
describe("late-level special values in combat", () => {
  const upgraded = (tower: TowerId, enemies: Enemy[]) => {
    const g = new Game();
    g.state.wallets[0] = 100000;
    g.command({ type: "build", tower, x: 7, y: 5 });
    for (let l = 2; l <= 5; l++) g.command({ type: "upgrade", id: g.state.towers[0].id, upgrade: `level-${l}` });
    g.state.enemies = enemies;
    attackEnemies(g, 0);
    landProjectiles(g);
    return g.state;
  };
  it("Kryo level 5 slows harder and longer", () => {
    const s = upgraded("frost", [enemyAt(100, "drone", 7, 7)]);
    expect(s.enemies[0].status).toEqual([{ kind: "slow", factor: 0.35, until: expect.closeTo(s.time + 2.8) }]);
  });
  it("Tesla level 5 jumps five times over two cells", () => {
    const s = upgraded("tesla", Array.from({ length: 7 }, (_, i) => enemyAt(100 + i, "drone", 7, 6 + i * 1.9)));
    expect(s.enemies.filter((e) => e.hp < 1000)).toHaveLength(6);
  });
});

describe("newer attack mechanics", () => {
  /** Advances only the clock and status effects, so burning can be observed in isolation. */
  const wait = (g: Game, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      g.state.time += 1 / 30;
      tickStatus(g, 1 / 30);
    }
  };
  it("Lanze pierces every enemy on its line with falloff, but nothing beside or behind it", () => {
    const d = TOWERS.lance.damage,
      f = (TOWERS.lance.attack as PierceAttack).falloff;
    const [first, second, beside, behind] = setup("lance", [
      ["drone", 7, 7],
      ["glider", 7, 8.5],
      ["drone", 7.6, 8],
      ["drone", 7, 4],
    ]);
    expect(first).toBe(d);
    expect(second).toBeCloseTo(d * f);
    expect([beside, behind]).toEqual([0, 0]);
  });
  it("Lanze aims where its beam hits the most enemies, not at the frontmost one", () => {
    // Frontmost enemy alone to the right; three trailing enemies in a column below the tower.
    const g = fire("lance", [
      { ...enemyAt(100, "drone", 9, 5), distance: 20 },
      { ...enemyAt(101, "drone", 7, 6), distance: 12 },
      { ...enemyAt(102, "drone", 7, 7), distance: 11 },
      { ...enemyAt(103, "drone", 7, 8), distance: 10 },
    ]);
    expect(g.state.enemies.map((e) => e.hp < 1000)).toEqual([false, true, true, true]);
    // With no better line it keeps the frontmost target.
    const lone = fire("lance", [{ ...enemyAt(100, "drone", 9, 5), distance: 20 }, { ...enemyAt(101, "drone", 7, 7), distance: 12 }]);
    expect(lone.state.enemies.map((e) => e.hp < 1000)).toEqual([true, false]);
  });
  it("Lanze fires instantly and leaves a beam to the end of its range", () => {
    const g = fire("lance", [enemyAt(100, "drone", 7, 7)]);
    expect(g.state.projectiles).toHaveLength(0);
    const beam = g.drainEvents().find((e) => e.type === "beam");
    expect(beam).toMatchObject({ from: { x: 7, y: 5 }, to: { x: 7, y: expect.closeTo(5 + TOWERS.lance.range) } });
  });
  it("Stasis stuns every enemy in the pulse radius, then they recover and are immune for a while", () => {
    const g = fire("stasis", [enemyAt(100, "drone", 7, 7), enemyAt(101, "glider", 7.5, 7.5), enemyAt(102, "drone", 7, 9)]);
    const [a, b, far] = g.state.enemies;
    expect([a.hp, b.hp, far.hp]).toEqual([1000 - TOWERS.stasis.damage, 1000 - TOWERS.stasis.damage, 1000]);
    expect(speedFactor(a, 0.5)).toBe(0);
    expect(speedFactor(b, 0.5)).toBe(0);
    expect(speedFactor(far, 0.5)).toBe(1);
    // Recovered after 0.8 s; a second pulse during recovery does nothing.
    expect(speedFactor(a, 0.8)).toBe(1);
    g.state.time = 1;
    g.state.towers[0].cooldown = 0;
    attackEnemies(g, 0);
    expect(speedFactor(a, 1.2)).toBe(1);
    // After the recovery window the next pulse stuns again.
    g.state.time = 2.4;
    g.state.towers[0].cooldown = 0;
    attackEnemies(g, 0);
    expect(speedFactor(a, 2.5)).toBe(0);
  });
  it("Glut burns for a multiple of its hit over time", () => {
    const g = fire("inferno", [enemyAt(100, "drone", 7, 7)]);
    landProjectiles(g);
    const e = g.state.enemies[0];
    expect(e.hp).toBe(1000 - TOWERS.inferno.damage);
    wait(g, 3.5);
    expect(e.hp).toBeCloseTo(1000 - TOWERS.inferno.damage * 3.5);
    expect(e.status).toEqual([]);
  });
  it("a burn kill is credited even after the tower was sold", () => {
    const g = fire("inferno", [enemyAt(100, "drone", 7, 7)]);
    landProjectiles(g);
    g.state.enemies[0].hp = 5;
    g.command({ type: "sell", id: g.state.towers[0].id });
    const gold = g.state.wallets[0];
    wait(g, 1.2);
    expect(g.state.enemies[0].hp).toBeLessThanOrEqual(0);
    expect(g.state.kills).toBe(1);
    expect(g.state.wallets[0]).toBe(gold + ENEMIES.drone.reward);
  });
  it("Korrosion makes every hit stronger for a while, before armor", () => {
    const g = fire("acid", [enemyAt(100, "drone", 7, 7)]);
    landProjectiles(g);
    const e = g.state.enemies[0];
    expect(e.hp).toBeCloseTo(1000 - TOWERS.acid.damage * 1.25);
    applyDamage(g, { tower: 0, type: "pulse" }, e, 100);
    expect(e.hp).toBeCloseTo(1000 - TOWERS.acid.damage * 1.25 - 125);
    expect(damageTaken(e, 3)).toBe(1);
    const armored = new Game(undefined, {
      ...DEFAULT_CONTENT,
      enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits: [{ kind: "armor", reduction: 0.5 }] } },
    });
    const tough = enemyAt(100, "drone", 7, 7);
    tough.status.push({ kind: "vulnerable", amount: 0.25, until: 3 });
    armored.state.enemies = [tough];
    applyDamage(armored, { tower: 0, type: "pulse" }, tough, 100);
    expect(tough.hp).toBeCloseTo(1000 - 62.5);
  });
  it("Zerfall deals a share of max HP on top, so big enemies lose much more", () => {
    const big = fire("decay", [enemyAt(100, "tank", 7, 7)]);
    landProjectiles(big);
    expect(big.state.enemies[0].hp).toBeCloseTo(1000 - TOWERS.decay.damage - 40);
    const small = { ...enemyAt(100, "drone", 7, 7), hp: 100, maxHp: 100 };
    const g = fire("decay", [small]);
    landProjectiles(g);
    expect(small.hp).toBeCloseTo(100 - TOWERS.decay.damage - 4);
  });
});
