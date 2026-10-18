import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { stateHash } from "../core/hash";
import { TOWERS } from "../content/towers";
import type { ConfuseAttack, EncaseAttack, GatherAttack, PullAttack, StrikeAttack, Tower, TowerId } from "../core/types";
import { attackEnemies } from "./combat";
import { applyDamage } from "./damage";
import { positionOnPath } from "./path";
import { applyStatus, speedFactor, tickStatus } from "./status";
import { landStrikes } from "./strikes";
// Orbital, Mesmer, Amber, Magnetar and Cyclone.
function place(g: Game, type: TowerId, x: number, y: number) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
/** Advances the clock and status effects only. */
function wait(g: Game, until: number) {
  g.state.time = until;
  tickStatus(g, 0);
}
describe("Orbital", () => {
  const { delay, radius } = TOWERS.orbital.attack as StrikeAttack,
    d = TOWERS.orbital.damage;
  it("paints the strongest enemy and lands on that point after the delay, so a runner escapes", () => {
    const g = new Game();
    place(g, "orbital", 0, 0);
    const weak = { ...makeEnemy(1, "drone", 10, 10), hp: 500 },
      strong = makeEnemy(2, "drone", 20, 20),
      near = makeEnemy(3, "drone", 20 + radius - 0.1, 20);
    g.state.enemies = [weak, strong, near];
    attackEnemies(g, 0);
    landProjectiles(g);
    const hash = stateHash(g.state);
    expect(g.state.strikes).toHaveLength(1);
    expect(g.state.strikes![0].at).toEqual({ x: 20, y: 20 });
    // The strongest walks off before it lands.
    Object.assign(strong, { x: 20 + radius + 1 });
    g.state.time = g.state.strikes![0].due - 0.05;
    landStrikes(g);
    expect(near.hp).toBe(1000);
    g.state.time += 0.05;
    landStrikes(g);
    expect([weak.hp, strong.hp, near.hp]).toEqual([500, 1000, 1000 - d]);
    expect(g.state.strikes).toBeUndefined();
    expect(stateHash(g.state)).not.toBe(hash);
    expect(delay).toBeGreaterThan(1);
  });
});
describe("Mesmer", () => {
  const { duration, recovery } = TOWERS.mesmer.attack as ConfuseAttack;
  it("turns the target around for the trance, then it is immune for the recovery", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 0);
    expect(applyStatus(g, e, { kind: "confuse", release: duration, until: duration + recovery })).toBe(true);
    expect(speedFactor(e, 0.1)).toBe(-1);
    expect(speedFactor(e, duration + 0.1)).toBe(1);
    expect(applyStatus(g, e, { kind: "confuse", release: duration + 1, until: duration + 2 })).toBe(false);
  });
  it("an unstoppable unit shrugs the trance off", () => {
    const g = new Game();
    place(g, "mesmer", 0, 0);
    g.state.enemies = [makeEnemy(1, "berserker", 1, 0)];
    attackEnemies(g, 0);
    landProjectiles(g);
    expect(g.state.enemies[0].status).toHaveLength(0);
  });
});
describe("Amber", () => {
  const { duration, bonus } = TOWERS.amber.attack as EncaseAttack,
    d = TOWERS.amber.damage;
  it("holds the enemy and stores every hit, then shatters for the stored damage plus the bonus", () => {
    const g = new Game();
    place(g, "amber", 0, 0);
    const e = makeEnemy(1, "drone", 1, 0);
    g.state.enemies = [e];
    attackEnemies(g, 0);
    landProjectiles(g);
    expect(e.hp).toBe(1000 - d);
    applyDamage(g, { tower: 0, type: "pulse" }, e, 100);
    expect(e.hp).toBe(1000 - d);
    // Neither a pull nor a trance moves it while encased.
    applyStatus(g, e, { kind: "pull", factor: 2, release: 9, until: 9 });
    expect(speedFactor(e, g.state.time)).toBe(0);
    wait(g, g.state.time + duration);
    expect(e.hp).toBeCloseTo(1000 - d - 100 * (1 + bonus));
    // Shattered once: the next hit lands normally.
    applyDamage(g, { tower: 0, type: "pulse" }, e, 10);
    expect(e.hp).toBeCloseTo(1000 - d - 100 * (1 + bonus) - 10);
  });
});
describe("Magnetar", () => {
  const { strength } = TOWERS.magnetar.attack as GatherAttack;
  it("drags the crowd towards the target's path position, ahead and behind, capped by the strength", () => {
    const g = new Game(),
      path = g.mission.map.path,
      at = (distance: number) => positionOnPath(path, distance),
      ahead = { ...makeEnemy(1, "drone", at(3.4).x, at(3.4).y, 3.4), hp: 900 },
      target = makeEnemy(2, "drone", at(3).x, at(3).y, 3),
      behind = { ...makeEnemy(3, "drone", at(2.8).x, at(2.8).y, 2.8), hp: 900 };
    place(g, "magnetar", path[3].x, path[3].y + 1);
    g.state.enemies = [ahead, target, behind];
    // First priority would pick the one ahead; make the middle one the target.
    g.state.towers[0].priority = "strong";
    attackEnemies(g, 0);
    expect(target.distance).toBe(3);
    expect(ahead.distance).toBeCloseTo(3);
    expect(behind.distance).toBeCloseTo(3);
    expect(strength).toBeLessThan(1);
  });
});
describe("Cyclone", () => {
  const { radius } = TOWERS.cyclone.attack as PullAttack;
  it("gusts flyers back and leaves walkers alone", () => {
    const g = new Game();
    place(g, "cyclone", 0, 0);
    const flyer = makeEnemy(1, "glider", 1, 0),
      walker = makeEnemy(2, "drone", 1, radius / 2);
    g.state.enemies = [flyer, walker];
    attackEnemies(g, 0);
    expect(speedFactor(flyer, g.state.time)).toBeLessThan(0);
    expect(speedFactor(walker, g.state.time)).toBe(1);
    expect(walker.hp).toBe(1000);
  });
});
