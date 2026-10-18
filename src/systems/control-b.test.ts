import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import { TOWERS } from "../content/towers";
import type { DamageSource, Enemy, EnemyId, ShrinkAttack, SiphonAttack, Tower, TowerId } from "../core/types";
import { validateTower } from "../core/validation";
import { effectiveTowerStats } from "./auras";
import { attackEnemies } from "./combat";
import { applyDamage } from "./damage";
import { moveEnemies } from "./movement";
import { leakOf, sizeOf } from "./shrink";
import { siphonBoost } from "./siphon";
import { applyStatus, hasStatus, speedFactor, tickStatus } from "./status";
import { partners } from "./tether";
/** Places a tower straight into the state. */
function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = []) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
/** An enemy on the default map's path, `distance` cells in. */
function walker(g: Game, id: number, type: EnemyId, distance: number): Enemy {
  const p = g.mission.map.path[Math.floor(distance)];
  return makeEnemy(id, type, p.x, p.y, distance);
}
const source = (type: TowerId, tower = 99): DamageSource => ({ tower, type });
function linked(g: Game, enemies: Enemy[], group = 500, src = source("tether")) {
  g.state.enemies = enemies;
  for (const e of enemies) applyStatus(g, e, { kind: "tether", group, until: 5, source: src });
}
describe("Tether", () => {
  it("links the target with its nearest neighbours", () => {
    const g = new Game(),
      t = place(g, "tether", 4, 4),
      path = g.mission.map.path,
      near = path.findIndex((p) => Math.hypot(p.x - t.x, p.y - t.y) <= 2);
    g.state.enemies = [walker(g, 1, "drone", near), walker(g, 2, "drone", near + 0.5), walker(g, 3, "drone", near + 1), walker(g, 4, "drone", near + 6)];
    attackEnemies(g, 0);
    const [a] = g.state.enemies;
    expect(partners(g, a).map((e) => e.id)).toEqual([2, 3]);
    expect(hasStatus(g.state.enemies[3], "tether", 0)).toBe(false);
  });
  it("spreads a slow, stun or burn to every linked enemy, and a spread effect never spreads on", () => {
    const g = new Game(),
      [a, b, c, d] = [1, 2, 3, 4].map((id) => makeEnemy(id, "drone", 3, 2 + id));
    linked(g, [a, b, c]);
    g.state.enemies.push(d);
    g.drainEvents();
    applyStatus(g, a, { kind: "slow", factor: 0.5, until: 2 });
    expect([a, b, c, d].map((e) => speedFactor(e, 0))).toEqual([0.5, 0.5, 0.5, 1]);
    // One link effect per partner: the copies did not bounce back and forth.
    expect(g.drainEvents().filter((e) => e.type === "chain")).toHaveLength(2);
    applyStatus(g, b, { kind: "burn", dps: 10, next: 0.5, until: 2, source: source("inferno") });
    applyStatus(g, c, { kind: "stun", release: 1, until: 2 });
    expect([a, c].map((e) => hasStatus(e, "burn", 0))).toEqual([true, true]);
    expect([a, b].map((e) => speedFactor(e, 0))).toEqual([0, 0]);
    // Other effects stay with their enemy.
    applyStatus(g, a, { kind: "vulnerable", amount: 0.2, until: 2 });
    expect(hasStatus(b, "vulnerable", 0)).toBe(false);
  });
  it("holds every linked enemy to the slowest one's speed", () => {
    const g = new Game(),
      fast = walker(g, 1, "runner", 3),
      slow = walker(g, 2, "tank", 3);
    linked(g, [fast, slow]);
    moveEnemies(g, 1);
    expect(fast.distance).toBeCloseTo(3 + 0.95);
    expect(slow.distance).toBeCloseTo(3 + 0.95);
  });
});
describe("Shrink Ray", () => {
  it("shrinks size, armor and leak (never below 1), and Pitfall then swallows the unit", () => {
    const g = new Game(),
      tank = walker(g, 1, "tank", 3),
      drone = walker(g, 2, "drone", 3),
      bulwark = walker(g, 3, "bulwark", 3),
      plain = walker(g, 4, "bulwark", 3);
    g.state.enemies = [tank, drone, bulwark, plain];
    for (const e of [tank, drone, bulwark]) applyStatus(g, e, { kind: "shrink", factor: 0.6, armor: 0.5, until: 4 });
    expect(sizeOf(g, tank)).toBeCloseTo(0.27 * 0.6);
    expect([leakOf(g, tank), leakOf(g, drone)]).toEqual([1, 1]);
    applyDamage(g, source("pulse"), bulwark, 100);
    applyDamage(g, source("pulse"), plain, 100);
    // Armor 0.35 halves to 0.175.
    expect(1000 - bulwark.hp).toBeCloseTo(100 * (1 - 0.175));
    expect(1000 - plain.hp).toBeCloseTo(100 * (1 - 0.35));
    // A Pitfall (size 0.2) swallows the shrunk tank.
    const pit = g.mission.map.path[3];
    place(g, "pit", pit.x, pit.y);
    g.state.enemies = [tank];
    attackEnemies(g, 0);
    expect(tank.hp).toBeLessThanOrEqual(0);
  });
  it("aims at the biggest unshrunk enemy in range", () => {
    const g = new Game(),
      t = place(g, "shrink", 4, 4),
      near = g.mission.map.path.findIndex((p) => Math.hypot(p.x - t.x, p.y - t.y) <= 2);
    g.state.enemies = [walker(g, 1, "drone", near + 0.5), walker(g, 2, "tank", near)];
    attackEnemies(g, 0);
    expect(g.state.enemies.map((e) => hasStatus(e, "shrink", 0))).toEqual([false, true]);
    expect((TOWERS.shrink.attack as ShrinkAttack).factor).toBe(0.6);
  });
});
describe("Hex", () => {
  it("echoes a share of the damage taken during the curse once, and the echo is never echoed", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 3, 3);
    g.state.enemies = [e];
    applyStatus(g, e, { kind: "echo", share: 0.4, stored: 0, delay: 3, until: 3, source: source("hex") });
    applyDamage(g, source("pulse"), e, 100);
    applyDamage(g, source("pulse"), e, 50);
    g.drainEvents();
    g.state.time = 3;
    tickStatus(g, 1 / 30);
    expect(1000 - e.hp).toBeCloseTo(150 + 60);
    expect(g.drainEvents().some((ev) => ev.type === "echo")).toBe(true);
    g.state.time = 6;
    tickStatus(g, 1 / 30);
    expect(1000 - e.hp).toBeCloseTo(210);
  });
});
describe("Siphon", () => {
  it("speeds up attack towers near it by 6 % per hindered enemy in its range, up to 5", () => {
    const g = new Game(),
      siphon = place(g, "siphon", 4, 4),
      pulse = place(g, "pulse", 5, 4),
      far = place(g, "pulse", 12, 12),
      { bonus, cap } = TOWERS.siphon.attack as SiphonAttack,
      base = TOWERS.pulse.interval;
    g.state.enemies = Array.from({ length: 7 }, (_, i) => makeEnemy(i + 1, "drone", 4 + (i % 2) * 0.5, 5));
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).interval).toBeCloseTo(base);
    for (const e of g.state.enemies.slice(0, 2)) applyStatus(g, e, { kind: "slow", factor: 0.7, until: 3 });
    expect(siphonBoost(g, pulse).rate).toBeCloseTo(2 * bonus);
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).interval).toBeCloseTo(base / (1 + 2 * bonus));
    for (const e of g.state.enemies) applyStatus(g, e, { kind: "slow", factor: 0.7, until: 3 });
    expect(siphonBoost(g, pulse).rate).toBeCloseTo(cap * bonus);
    // Out of reach, and never the Siphon itself.
    expect(siphonBoost(g, far).rate).toBe(0);
    expect(siphonBoost(g, siphon).rate).toBe(0);
  });
  it("rejects invalid values", () => {
    expect(() => validateTower({ ...TOWERS.siphon, attack: { ...(TOWERS.siphon.attack as SiphonAttack), cap: 0 } }, "siphon")).toThrow();
    expect(() => validateTower({ ...TOWERS.tether, attack: { kind: "tether", links: 1, radius: 1, duration: 3 } }, "tether")).toThrow();
  });
});
describe("Control B specializations", () => {
  it("Shared Pain passes a share of a linked enemy's damage to the others, never on again", () => {
    const g = new Game(),
      [a, b, c] = [1, 2, 3].map((id) => makeEnemy(id, "drone", 3, 2 + id));
    linked(g, [a, b, c], 500, { ...source("tether"), special: { kind: "tether-share", share: 0.4 } });
    applyDamage(g, source("pulse"), a, 100);
    expect([a, b, c].map((e) => 1000 - e.hp)).toEqual([100, 40, 40]);
  });
  it("Doom finishes an enemy that its echo leaves below the threshold", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 3, 3);
    g.state.enemies = [e];
    applyStatus(g, e, { kind: "echo", share: 0.5, stored: 0, delay: 3, until: 3, source: { ...source("hex"), special: { kind: "doom", threshold: 0.2 } } });
    applyDamage(g, source("pulse"), e, 600);
    g.state.time = 3;
    tickStatus(g, 1 / 30);
    // 600 + 300 echo leaves 100 HP (10 %), below 20 %: dead.
    expect(e.hp).toBeLessThanOrEqual(0);
  });
});
