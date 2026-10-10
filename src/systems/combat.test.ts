import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { attackEnemies, moveProjectiles } from "./combat";
import { moveEnemies } from "./movement";
import { stateHash } from "../core/hash";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import { ENEMIES } from "../content/enemies";
import type { ChainAttack, DisruptAttack, ExecuteAttack, QuakeAttack, VolleyAttack, Enemy, EnemyId, FocusAttack, MortarAttack, NetAttack, PierceAttack, PullAttack, SplashAttack, TargetPriority, TowerId } from "../core/types";
import { applyDamage } from "./damage";
import { damageTaken, speedFactor, statusFlags, tickStatus } from "./status";
import { isHidden, leaderBonus } from "./traits";
import { canAcquire } from "./attacks";
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
    ).toThrow("tower targets");
    expect(() =>
      validateContent({ ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, layer: "space" as never } } }),
    ).toThrow("enemy layer");
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
describe("Fokus", () => {
  const d = TOWERS.focus.damage,
    { ramp, stacks } = TOWERS.focus.attack as FocusAttack;
  /** Fires `shots` times without waiting for the cooldown; returns the damage of each shot on enemy 100. */
  function burst(g: Game, shots: number) {
    const e = g.state.enemies.find((e) => e.id === 100)!,
      dealt: number[] = [];
    for (let i = 0; i < shots; i++) {
      const before = e.hp;
      g.state.towers[0].cooldown = 0;
      attackEnemies(g, 0);
      dealt.push(before - e.hp);
    }
    return dealt;
  }
  it("hits instantly and ramps up with every consecutive hit on the same target, up to its cap", () => {
    const g = fire("focus", [enemyAt(100, "drone", 7, 7)]);
    expect(g.state.projectiles).toHaveLength(0);
    expect(g.state.enemies[0].hp).toBe(1000 - d);
    const dealt = burst(g, stacks + 2);
    expect(dealt[0]).toBeCloseTo(d * (1 + ramp));
    expect(dealt[1]).toBeCloseTo(d * (1 + 2 * ramp));
    expect(dealt.at(-1)).toBeCloseTo(d * (1 + stacks * ramp));
    expect(g.state.towers[0].focus).toEqual({ target: 100, stacks });
  });
  it("keeps its target against its priority, and starts over on a new one", () => {
    const g = fire("focus", [enemyAt(100, "drone", 7, 7), { ...enemyAt(101, "drone", 7, 6), distance: 20 }]);
    // "first" locks onto 101, the furthest along the path; "last" would now pick 100.
    expect(g.state.towers[0].focus).toEqual({ target: 101, stacks: 0 });
    g.command({ type: "target", id: g.state.towers[0].id, priority: "last" });
    g.state.towers[0].cooldown = 0;
    attackEnemies(g, 0);
    expect(g.state.towers[0].focus).toEqual({ target: 101, stacks: 1 });
    // Once 101 leaves the range, the beam switches and loses its charge.
    g.state.enemies[1].x = 20;
    expect(burst(g, 1)).toEqual([d]);
    expect(g.state.towers[0].focus).toEqual({ target: 100, stacks: 0 });
  });
  it("its charge is part of the state hash", () => {
    const g = fire("focus", [enemyAt(100, "drone", 7, 7)]),
      before = stateHash(g.state);
    g.state.towers[0].focus!.stacks++;
    expect(stateHash(g.state)).not.toBe(before);
  });
});
describe("Gravitron", () => {
  const { radius, strength, duration, recovery } = TOWERS.gravity.attack as PullAttack;
  /** Moves enemies for `seconds`, keeping the clock in step. */
  const walk = (g: Game, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      g.state.time += 1 / 30;
      moveEnemies(g, 1 / 30);
    }
  };
  it("pulls ground enemies in its radius back along the path, but no gliders", () => {
    const g = fire("gravity", [enemyAt(100, "drone", 7, 7), enemyAt(101, "glider", 7, 7), enemyAt(102, "drone", 7, 7 + radius + 1)]);
    const [drone, glider, far] = g.state.enemies;
    expect([drone.hp, glider.hp, far.hp]).toEqual([1000 - TOWERS.gravity.damage, 1000, 1000]);
    // The clock advances before each step, so the last step inside the pull ends just before its release.
    const pulled = duration - 1 / 30;
    walk(g, pulled);
    expect(drone.distance).toBeCloseTo(10 - ENEMIES.drone.speed * strength * pulled, 5);
    expect(glider.distance).toBeGreaterThan(10);
    expect(far.distance).toBeGreaterThan(10);
  });
  it("recovery blocks a second pull, and unstoppable enemies resist", () => {
    const g = fire("gravity", [enemyAt(100, "drone", 7, 7), enemyAt(101, "berserker", 7, 7.3)]);
    const [drone, boss] = g.state.enemies;
    expect(speedFactor(drone, 0.1)).toBe(-strength);
    expect(speedFactor(boss, 0.1)).toBe(1);
    g.state.time = duration + 0.1;
    g.state.towers[0].cooldown = 0;
    attackEnemies(g, 0);
    expect(speedFactor(drone, g.state.time)).toBe(1);
    g.state.time = duration + recovery + 0.1;
    g.state.towers[0].cooldown = 0;
    attackEnemies(g, 0);
    expect(speedFactor(drone, g.state.time)).toBe(-strength);
  });
  it("never pulls an enemy behind the entry", () => {
    const g = fire("gravity", [{ ...enemyAt(100, "drone", 7, 7), distance: 0.2 }]);
    walk(g, duration - 1 / 30);
    expect(g.state.enemies[0].distance).toBe(0);
  });
});
describe("Mortar", () => {
  const { radius, minRange } = TOWERS.mortar.attack as MortarAttack;
  it("cannot aim inside its dead zone, but fires at enemies beyond it", () => {
    const close = fire("mortar", [enemyAt(100, "drone", 7, 5 + minRange - 0.2)]);
    expect(close.state.projectiles).toHaveLength(0);
    const g = fire("mortar", [enemyAt(100, "drone", 7, 5 + minRange - 0.2), { ...enemyAt(101, "drone", 7, 9), distance: 5 }]);
    expect(g.state.projectiles).toHaveLength(1);
    expect(g.state.projectiles[0]).toMatchObject({ target: null, tx: 7, ty: 9 });
  });
  it("its shell hits every ground enemy in the blast, but no gliders", () => {
    const [hit, beside, glider, far] = setup("mortar", [
      ["drone", 7, 9],
      ["drone", 7 + radius - 0.1, 9],
      ["glider", 7, 9.2],
      ["drone", 7, 9 + radius + 0.3],
    ]);
    expect([hit, beside, glider, far]).toEqual([TOWERS.mortar.damage, TOWERS.mortar.damage, 0, 0]);
  });
});
describe("Beben", () => {
  const { edge } = TOWERS.quake.attack as QuakeAttack,
    d = TOWERS.quake.damage,
    range = TOWERS.quake.range;
  it("hits every ground enemy in range, weaker towards the edge, and spares gliders", () => {
    const g = fire("quake", [enemyAt(100, "drone", 7, 5.5), enemyAt(101, "drone", 7 + range * 0.99, 5), enemyAt(102, "glider", 7, 6), enemyAt(103, "drone", 7, 5 + range + 0.2)]);
    expect(g.state.projectiles).toHaveLength(0);
    const [near, rim, glider, far] = g.state.enemies.map((e) => 1000 - e.hp);
    expect(near).toBeCloseTo(d * (1 - (1 - edge) * (0.5 / range)));
    expect(rim).toBeCloseTo(d * (1 - (1 - edge) * 0.99));
    expect([glider, far]).toEqual([0, 0]);
    expect(g.drainEvents().find((e) => e.type === "pulse")).toMatchObject({ at: { x: 7, y: 5 }, radius: range });
  });
});
describe("Henker", () => {
  const { threshold, multiplier } = TOWERS.executioner.attack as ExecuteAttack,
    d = TOWERS.executioner.damage;
  it("multiplies its hit on targets below the threshold at impact", () => {
    const healthy = enemyAt(100, "drone", 7, 7),
      wounded = { ...enemyAt(101, "drone", 7, 7), hp: threshold * 1000 - 1 };
    const a = fire("executioner", [healthy]);
    landProjectiles(a);
    expect(healthy.hp).toBe(1000 - d);
    const b = fire("executioner", [wounded]);
    landProjectiles(b);
    expect(wounded.hp).toBe(threshold * 1000 - 1 - d * multiplier);
  });
});
describe("Schrapnell", () => {
  const { targets } = TOWERS.shrapnel.attack as VolleyAttack;
  it("fires at several different enemies per salvo, in priority order", () => {
    const g = fire("shrapnel", [
      { ...enemyAt(100, "drone", 7, 6), distance: 4 },
      { ...enemyAt(101, "glider", 7, 7), distance: 9 },
      { ...enemyAt(102, "drone", 6, 6), distance: 7 },
      { ...enemyAt(103, "drone", 8, 6), distance: 2 },
    ]);
    expect(g.state.projectiles.map((p) => p.target)).toEqual([101, 102, 100].slice(0, targets));
    landProjectiles(g);
    expect(g.state.enemies.map((e) => 1000 - e.hp)).toEqual([TOWERS.shrapnel.damage, TOWERS.shrapnel.damage, TOWERS.shrapnel.damage, 0]);
  });
  it("shoots once with a single enemy, and more targets after level 5", () => {
    expect(fire("shrapnel", [enemyAt(100, "drone", 7, 7)]).state.projectiles).toHaveLength(1);
    const g = new Game();
    g.state.wallets[0] = 100000;
    const id = g.command({ type: "build", tower: "shrapnel", x: 7, y: 5 }).id!;
    for (const level of [2, 3, 4, 5]) expect(g.command({ type: "upgrade", id, upgrade: `level-${level}` }).ok).toBe(true);
    g.state.enemies = Array.from({ length: 7 }, (_, i) => enemyAt(100 + i, "drone", 7, 6 + i * 0.2));
    attackEnemies(g, 0);
    expect(g.state.projectiles).toHaveLength(5);
  });
});
describe("Jammer", () => {
  const { duration } = TOWERS.jammer.attack as DisruptAttack;
  it("breaks shields, which stay down until their delay after the disruption", () => {
    const g = new Game(),
      e = makeEnemy(100, "aegis", 7, 7);
    g.state.wallets[0] = 1000;
    g.command({ type: "build", tower: "jammer", x: 7, y: 5 });
    e.shield = 600;
    g.state.enemies = [e];
    attackEnemies(g, 0);
    expect(e.shield).toBe(0);
    // Hits during the disruption land on HP; no recharge until `delay` after it ends.
    g.state.time = duration + 2.9;
    tickStatus(g, 1 / 30);
    expect(e.shield).toBe(0);
    g.state.time = duration + 3;
    tickStatus(g, 1 / 30);
    expect(e.shield).toBeGreaterThan(0);
  });
  it("switches off regen, stealth and leader bonuses until the disruption ends", () => {
    const g = fire("jammer", [enemyAt(100, "slime", 7, 7), enemyAt(101, "phantom", 7, 7.2), enemyAt(102, "warlord", 7.2, 7), enemyAt(103, "drone", 7.3, 7.3)]);
    const [slime, phantom, , drone] = g.state.enemies;
    const hp = slime.hp;
    tickStatus(g, 1);
    expect(slime.hp).toBe(hp);
    expect(isHidden(g, phantom)).toBe(false);
    expect(canAcquire(g, "pulse", phantom)).toBe(true);
    // The warlord is disrupted, so the drone beside it gets no bonus.
    expect(leaderBonus(g, drone)).toEqual({ speed: 0, resist: 0 });
    expect(statusFlags(slime, 0).disrupted).toBe(true);
    g.state.time = duration + 0.1;
    expect(isHidden(g, phantom)).toBe(true);
    expect(leaderBonus(g, drone).speed).toBeGreaterThan(0);
    tickStatus(g, 1);
    expect(slime.hp).toBeGreaterThan(hp);
  });
});
describe("Fangnetz", () => {
  const { factor, duration } = TOWERS.net.attack as NetAttack;
  it("hits only flyers, slows them and lets ground-only towers hit them while netted", () => {
    expect(setup("net", [["drone", 7, 7]])).toEqual([0]);
    const g = fire("net", [enemyAt(100, "glider", 7, 7)]);
    landProjectiles(g);
    const glider = g.state.enemies[0];
    expect(glider.hp).toBe(1000 - TOWERS.net.damage);
    expect(speedFactor(glider, 0.1)).toBe(factor);
    expect(statusFlags(glider, 0.1).netted).toBe(true);
    // Nova only targets ground, but a netted glider counts as both.
    g.state.time = 0.1;
    expect(canAcquire(g, "blast", glider)).toBe(true);
    expect(canAcquire(g, "flak", glider)).toBe(true);
    g.state.time = duration + 0.1;
    expect(canAcquire(g, "blast", glider)).toBe(false);
  });
});
describe("target priorities", () => {
  /** Pulse tower at (7,5); returns the id its first shot aims at. */
  function aim(priority: TargetPriority | undefined, enemies: Enemy[]) {
    const g = new Game();
    const id = g.command({ type: "build", tower: "pulse", x: 7, y: 5 }).id!;
    if (priority) expect(g.command({ type: "target", id, priority }).ok).toBe(true);
    g.state.enemies = enemies;
    attackEnemies(g, 0);
    return g.state.projectiles[0].target;
  }
  const field = () => {
    const near = makeEnemy(1, "drone", 7, 6, 10),
      ahead = makeEnemy(2, "drone", 8.5, 5, 12),
      behind = makeEnemy(3, "drone", 6, 4, 8);
    near.hp = 50;
    ahead.hp = 20;
    behind.hp = 90;
    return [near, ahead, behind];
  };
  it.each([
    [undefined, 2],
    ["first", 2],
    ["last", 3],
    ["strong", 3],
    ["weak", 2],
    ["close", 1],
  ] as const)("%s aims at enemy %i", (priority, expected) => {
    expect(aim(priority, field())).toBe(expected);
  });
  it("breaks ties by path progress, then id", () => {
    const [a, b, c] = [makeEnemy(5, "drone", 7, 6, 9), makeEnemy(4, "drone", 7, 4, 11), makeEnemy(6, "drone", 7, 4, 11)];
    expect(aim("strong", [a, b, c])).toBe(4);
  });
});
