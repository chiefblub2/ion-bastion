import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import { TOWERS } from "../content/towers";
import type { AlarmAttack, BleedAttack, ChargeAttack, Enemy, EnemyId, Point, SplashAttack, Tower, TowerId } from "../core/types";
import { ENEMIES } from "../content/enemies";
import { validateTower } from "../core/validation";
import { attackEnemies } from "./combat";
import { applyStatus, speedFactor, tickStatus } from "./status";
import { applyDamage } from "./damage";
/** A Game on the default map with a trap on the third path cell; returns the game and that cell. */
function trap(type: TowerId) {
  const g = new Game(),
    at = g.mission.map.path[2];
  g.state.wallets[0] = 10000;
  expect(g.command({ type: "build", tower: type, ...at }).ok).toBe(true);
  return { g, at, tower: g.state.towers[0] };
}
const enemyOn = (id: number, type: EnemyId, p: Point, dx = 0, dy = 0): Enemy => makeEnemy(id, type, p.x + dx, p.y + dy, 2);
describe("trap placement", () => {
  it("builds traps only on free path cells, other towers only beside the path", () => {
    const g = new Game(),
      path = g.mission.map.path;
    g.state.wallets[0] = 10000;
    expect(g.canBuild(path[2].x, path[2].y, "mine")).toBe(true);
    expect(g.canBuild(path[2].x, path[2].y, "pulse")).toBe(false);
    expect(g.canBuild(path[2].x, path[2].y)).toBe(false);
    // Entry and reactor stay free.
    expect(g.canBuild(path[0].x, path[0].y, "mine")).toBe(false);
    expect(g.canBuild(path.at(-1)!.x, path.at(-1)!.y, "mine")).toBe(false);
    expect(g.command({ type: "build", tower: "mine", x: 4, y: 4 }).code).toBe("trap-off-path");
    expect(g.command({ type: "build", tower: "mine", ...path[2] }).ok).toBe(true);
    expect(g.command({ type: "build", tower: "spikes", ...path[2] }).code).toBe("trap-off-path");
  });
  it("keeps the trigger radius at every level", () => {
    const { g, tower } = trap("mine");
    for (const level of [2, 3, 4, 5]) expect(g.command({ type: "upgrade", id: tower.id, upgrade: `level-${level}` }).ok).toBe(true);
    expect(TOWERS.mine.upgrades.every((u) => u.effects.stats?.range === TOWERS.mine.range)).toBe(true);
  });
});
describe("traps", () => {
  it("a mine waits until an enemy steps on it, blasts its neighbours and then re-arms", () => {
    const { g, at, tower } = trap("mine"),
      { radius } = TOWERS.mine.attack as SplashAttack;
    g.state.enemies = [enemyOn(1, "drone", at, 0.8)];
    attackEnemies(g, 0);
    expect(g.state.enemies[0].hp).toBe(1000);
    g.state.enemies.push(enemyOn(2, "drone", at, 0.2), enemyOn(3, "drone", at, 0, radius + 0.5));
    attackEnemies(g, 0);
    expect(g.state.enemies.map((e) => 1000 - e.hp)).toEqual([TOWERS.mine.damage, TOWERS.mine.damage, 0]);
    expect(tower.cooldown).toBe(1);
    attackEnemies(g, TOWERS.mine.interval / 2);
    expect(g.state.enemies[1].hp).toBe(1000 - TOWERS.mine.damage);
  });
  it("flyers pass over, stealthed walkers trigger it without a detector", () => {
    const { g, at } = trap("spikes");
    g.state.enemies = [enemyOn(1, "glider", at), enemyOn(2, "phantom", at, 0.1)];
    attackEnemies(g, 0);
    expect(g.state.enemies.map((e) => 1000 - e.hp)).toEqual([0, TOWERS.spikes.damage]);
  });
  it("tar slows and a spring throws enemies back", () => {
    const tar = trap("tar");
    tar.g.state.enemies = [enemyOn(1, "drone", tar.at)];
    attackEnemies(tar.g, 0);
    expect(speedFactor(tar.g.state.enemies[0], 0.1)).toBe(0.45);
    const spring = trap("spring");
    spring.g.state.enemies = [enemyOn(1, "drone", spring.at)];
    attackEnemies(spring.g, 0);
    expect(speedFactor(spring.g.state.enemies[0], 0.1)).toBeLessThan(0);
  });
});
/** Places a tower straight into the state, wherever the test needs it. */
function place(g: Game, type: TowerId, x: number, y: number, cooldown = 0.7) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades: [], cooldown, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
/** Advances only the clock and status effects. */
function wait(g: Game, until: number) {
  g.state.time = until;
  tickStatus(g, 0);
}
describe("trap-only attack kinds", () => {
  it("are rejected on towers that are not traps", () => {
    expect(() => validateTower({ ...TOWERS.tesla, attack: { kind: "pit", size: 0.2 } }, "Tower")).toThrow(/only for traps/);
    expect(() => validateTower(TOWERS.pit, "Tower")).not.toThrow();
  });
});
describe("Caltrops", () => {
  const { perCell } = TOWERS.spikes.attack as BleedAttack,
    d = TOWERS.spikes.damage;
  it("an enemy bleeds for every cell it walks on, but not while standing or pushed back", () => {
    const { g, at } = trap("spikes");
    g.state.enemies = [enemyOn(1, "drone", at), enemyOn(2, "drone", at, 0.1), enemyOn(3, "drone", at, -0.1)];
    attackEnemies(g, 0);
    const [walker, stander, pushed] = g.state.enemies;
    expect(walker.hp).toBe(1000 - d);
    walker.distance += 2;
    pushed.distance -= 1;
    wait(g, 0.5);
    expect(walker.hp).toBeCloseTo(1000 - d - 2 * perCell);
    expect(stander.hp).toBe(1000 - d);
    expect(pushed.hp).toBe(1000 - d);
  });
});
describe("Haftmine", () => {
  const { fuse, radius } = TOWERS.limpet.attack as ChargeAttack,
    d = TOWERS.limpet.damage;
  it("goes off after its fuse wherever the carrier walked, hitting its neighbours but no gliders", () => {
    const { g, at } = trap("limpet");
    g.state.enemies = [enemyOn(1, "drone", at)];
    attackEnemies(g, 0);
    const carrier = g.state.enemies[0];
    expect(carrier.hp).toBe(1000);
    // The carrier walked on and is now next to others.
    Object.assign(carrier, { x: 20, y: 20 });
    g.state.enemies.push(makeEnemy(2, "drone", 20 + radius - 0.1, 20), makeEnemy(3, "glider", 20, 20.2), makeEnemy(4, "drone", 20, 20 + radius + 0.5));
    wait(g, fuse - 0.1);
    expect(carrier.hp).toBe(1000);
    wait(g, fuse);
    expect(g.state.enemies.map((e) => 1000 - e.hp)).toEqual([d, d, 0, 0]);
    // Spent: it never goes off twice.
    wait(g, fuse + 1);
    expect(carrier.hp).toBe(1000 - d);
  });
  it("blows up with a dying carrier and sets off other bombs it kills", () => {
    const { g, at } = trap("limpet");
    const a = enemyOn(1, "drone", at),
      b = { ...makeEnemy(2, "drone", 20, 20), hp: 10 },
      // Out of reach of the first blast, but next to b.
      c = makeEnemy(3, "drone", 20 + radius - 0.1, 20);
    g.state.enemies = [a, b, c];
    attackEnemies(g, 0);
    applyStatus(g, b, { kind: "charged", damage: d, radius, until: 99, source: { tower: 0, type: "limpet" } });
    Object.assign(a, { x: 20 - radius + 0.1, y: 20 });
    applyDamage(g, { tower: 0, type: "pulse" }, a, 5000);
    // a's blast kills b, whose bomb then reaches c.
    expect(b.hp).toBeLessThanOrEqual(0);
    expect(c.hp).toBe(1000 - d);
  });
  it("puts only one bomb on each enemy", () => {
    const { g, at, tower } = trap("limpet");
    g.state.enemies = [enemyOn(1, "drone", at)];
    attackEnemies(g, 0);
    tower.cooldown = 0;
    attackEnemies(g, 0);
    expect(g.state.enemies[0].status.filter((s) => s.kind === "charged")).toHaveLength(1);
  });
});
describe("Fallgrube", () => {
  it("swallows small enemies whatever their HP, and pays their reward", () => {
    const { g, at } = trap("pit");
    const before = g.state.wallets[0];
    g.state.enemies = [{ ...enemyOn(1, "drone", at), hp: 1e6, maxHp: 1e6 }];
    attackEnemies(g, 0);
    expect(g.state.enemies[0].hp).toBeLessThanOrEqual(0);
    expect(g.state.wallets[0] - before).toBe(ENEMIES.drone.reward);
  });
  it("prefers a small target, only damages big ones and never swallows a Berserker", () => {
    const { g, at, tower } = trap("pit");
    const tank = { ...enemyOn(1, "tank", at), distance: 3 },
      drone = enemyOn(2, "drone", at, 0.1);
    g.state.enemies = [tank, drone];
    attackEnemies(g, 0);
    expect([tank.hp, drone.hp <= 0]).toEqual([1000, true]);
    tower.cooldown = 0;
    attackEnemies(g, 0);
    expect(tank.hp).toBe(1000 - TOWERS.pit.damage);
    const deep = trap("pit");
    for (const level of [2, 3, 4, 5]) deep.g.command({ type: "upgrade", id: deep.tower.id, upgrade: `level-${level}` });
    deep.g.state.enemies = [enemyOn(1, "berserker", deep.at)];
    attackEnemies(deep.g, 0);
    expect(deep.g.state.enemies[0].hp).toBeGreaterThan(0);
  });
});
describe("Alarmdraht", () => {
  const { radius } = TOWERS.tripwire.attack as AlarmAttack;
  it("reloads attack towers in its radius, but not those outside, support towers or other traps", () => {
    const { g, at } = trap("tripwire");
    const near = place(g, "pulse", at.x, at.y + 1),
      far = place(g, "pulse", at.x + radius + 1, at.y),
      aura = place(g, "aura", at.x + 1, at.y),
      mine = place(g, "mine", at.x - 1, at.y);
    g.state.enemies = [enemyOn(1, "drone", at)];
    attackEnemies(g, 0);
    // The alerted tower comes later in the list, so it already fired in the same tick.
    expect([near.cooldown, far.cooldown, aura.cooldown, mine.cooldown]).toEqual([1, 0.7, 0.7, 0.7]);
    expect(g.state.projectiles.map((p) => p.tower)).toEqual([near.id]);
    expect(g.drainEvents().filter((e) => e.type === "chain")).toHaveLength(1);
  });
});
