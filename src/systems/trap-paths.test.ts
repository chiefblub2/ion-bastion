import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { resolveUpgrades } from "../core/upgrades";
import type { ContentPack, Enemy, EnemyId, Tower, TowerId, Trait } from "../core/types";
import { attackEnemies } from "./combat";
import { applyDamage } from "./damage";
import { updateDetection } from "./detection";
import { moveEnemies } from "./movement";
import { positionOnPath } from "./path";
import { damageTaken, hasStatus, speedFactor, tickStatus } from "./status";
import { settleWave } from "./waves";

const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** Upgrades of a trap specialized up to `tier` on `path`. */
const path = (slug: string, tier: number) => [...LEVELS, ...Array.from({ length: tier }, (_, i) => `${slug}-${i + 1}`)];
function withTraits(type: EnemyId, traits: Trait[]): ContentPack {
  return { ...DEFAULT_CONTENT, enemies: { ...DEFAULT_CONTENT.enemies, [type]: { ...DEFAULT_CONTENT.enemies[type], traits } } };
}
const enemy = (id: number, type: EnemyId, x: number, y: number, hp = 1000, maxHp = 1000, distance = 10): Enemy => ({ ...makeEnemy(id, type, x, y, distance), hp, maxHp });
/** Towers at fixed spots (the first at (7,5)) and enemies placed directly into the state; no build rules, no wave. */
function arena(type: TowerId, upgrades: string[], enemies: Enemy[], content: ContentPack = DEFAULT_CONTENT) {
  const g = new Game(undefined, content);
  const tower: Tower = { id: 1, type, x: 7, y: 5, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(tower);
  g.state.nextId = 1000;
  g.state.enemies = enemies;
  return { g, tower, damage: resolveUpgrades(tower, content).stats.damage };
}
function fire(g: Game, tower: Tower) {
  tower.cooldown = 0;
  attackEnemies(g, 0);
  landProjectiles(g);
}
const lost = (e: Enemy) => e.maxHp - e.hp;
const statusOf = (e: Enemy, kind: string) => e.status.find((s) => s.kind === kind) as Record<string, number> | undefined;

describe("ported abilities fire through their traps", () => {
  it("Mine Chain Reaction: a kill explodes again beyond the mine's own blast", () => {
    // The blast centres on the enemy on the mine; the victim's own explosion reaches one beyond it.
    const trigger = enemy(1, "drone", 7, 5, 100000, 100000, 11),
      victim = enemy(2, "drone", 8.4, 5, 1),
      outside = enemy(3, "drone", 9.4, 5);
    const { g, tower, damage } = arena("mine", path("chain-reaction", 3), [trigger, victim, outside]);
    fire(g, tower);
    expect(victim.hp).toBeLessThanOrEqual(0);
    expect(lost(outside)).toBeCloseTo(damage * 0.55);
  });
  it("Sticky Mine Chain Reaction: kills of the bomb explode again", () => {
    const carrier = enemy(1, "drone", 7, 5, 100000, 100000, 11),
      victim = enemy(2, "drone", 8.5, 5, 1),
      outside = enemy(3, "drone", 9.4, 5);
    const { g, tower, damage } = arena("limpet", path("chain-reaction", 3), [carrier, victim, outside]);
    fire(g, tower);
    g.state.time += 5;
    tickStatus(g, 0);
    expect(victim.hp).toBeLessThanOrEqual(0);
    expect(lost(outside)).toBeCloseTo(damage * 0.55);
  });
  it("Pitfall Spike Bed: an enemy too big to fall in takes a share of its max HP while wounded", () => {
    const content = withTraits("boss", []);
    const wounded = enemy(1, "boss", 7, 5, 700, 1000),
      healthy = enemy(2, "boss", 7, 5, 800, 1000);
    const a = arena("pit", path("spike-bed", 1), [wounded], content);
    fire(a.g, a.tower);
    expect(700 - wounded.hp).toBeCloseTo(a.damage + 50);
    const b = arena("pit", path("spike-bed", 1), [healthy], content);
    fire(b.g, b.tower);
    expect(800 - healthy.hp).toBeCloseTo(b.damage);
  });
  it("Grinder Bonesaw: a wounded enemy loses a share of its max HP per turn", () => {
    const target = enemy(1, "drone", 7, 5, 30000, 100000);
    const { g, tower, damage } = arena("grinder", path("bonesaw", 1), [target]);
    fire(g, tower);
    expect(30000 - target.hp).toBeCloseTo(damage + 200);
  });
  it("Oil Slick Slick: slows everyone around the slick, the coated ones included", () => {
    const coated = enemy(1, "drone", 7, 5),
      near = enemy(2, "drone", 7.7, 5),
      far = enemy(3, "drone", 8, 5);
    const { g, tower } = arena("oil", path("slick", 1), [coated, near, far]);
    fire(g, tower);
    expect(hasStatus(coated, "oiled", g.state.time)).toBe(true);
    expect(speedFactor(coated, g.state.time)).toBeCloseTo(0.7);
    expect(speedFactor(near, g.state.time)).toBeCloseTo(0.7);
    expect(speedFactor(far, g.state.time)).toBe(1);
  });
  it("Harpoon Exposed Target and Net Cloud", () => {
    const struck = enemy(1, "glider", 7, 5),
      other = enemy(2, "glider", 7.8, 5);
    const exposed = arena("harpoon", path("exposed-target", 3), [struck]);
    fire(exposed.g, exposed.tower);
    expect(damageTaken(struck, exposed.g.state.time)).toBeCloseTo(1.2);
    const cloud = arena("harpoon", path("net-cloud", 1), [enemy(1, "glider", 7, 5), other]);
    fire(cloud.g, cloud.tower);
    expect(hasStatus(other, "netted", cloud.g.state.time)).toBe(true);
    expect(lost(other)).toBe(0);
  });
});

describe("reused abilities fire through their traps", () => {
  it("Tar Pit Brittle Tar weakens and Spreading Bog slows the neighbours", () => {
    const tarred = enemy(1, "drone", 7, 5);
    const a = arena("tar", path("brittle-tar", 1), [tarred]);
    fire(a.g, a.tower);
    expect(damageTaken(tarred, a.g.state.time)).toBeCloseTo(1.08);
    const near = enemy(2, "drone", 7.6, 5);
    const b = arena("tar", path("spreading-bog", 1), [enemy(1, "drone", 7, 5), near]);
    fire(b.g, b.tower);
    expect(speedFactor(near, b.g.state.time)).toBeCloseTo(0.6);
  });
  it("Bear Trap Exposure weakens the enemy once the trap lets go", () => {
    const held = enemy(1, "drone", 7, 5);
    const { g, tower } = arena("snare", path("exposure", 1), [held]);
    fire(g, tower);
    g.state.time += 3;
    tickStatus(g, 0);
    expect(damageTaken(held, g.state.time)).toBeCloseTo(1.1);
  });
  it("Spring Compression and Flame Grate Wildfire", () => {
    const thrown = enemy(1, "drone", 7, 5);
    const a = arena("spring", path("compression", 1), [thrown]);
    fire(a.g, a.tower);
    expect(damageTaken(thrown, a.g.state.time)).toBeCloseTo(1.1);
    const burning = enemy(1, "drone", 7, 5),
      near = enemy(2, "drone", 7.8, 5);
    const b = arena("grill", path("wildfire", 1), [burning, near]);
    fire(b.g, b.tower);
    applyDamage(b.g, { tower: 1, type: "grill" }, burning, 5000);
    expect(hasStatus(near, "burn", b.g.state.time)).toBe(true);
  });
  it("Sticky Mine Breaching Charge and Grinder Shredder hit armor harder", () => {
    const content = withTraits("drone", [{ kind: "armor", reduction: 0.5 }]);
    const carrier = enemy(1, "drone", 7, 5);
    const a = arena("limpet", path("breaching-charge", 1), [carrier], content);
    fire(a.g, a.tower);
    a.g.state.time += 5;
    tickStatus(a.g, 0);
    expect(lost(carrier)).toBeCloseTo(a.damage * 1.25 * 0.5);
    const minced = enemy(1, "drone", 7, 5);
    const b = arena("grinder", path("shredder", 3), [minced], content);
    fire(b.g, b.tower);
    expect(lost(minced)).toBeCloseTo(b.damage * 0.8);
  });
  it("Arc Plate Twin Arc starts a second chain at an enemy the first one missed", () => {
    const content = withTraits("runner", [{ kind: "insulated" }]);
    const insulated = enemy(1, "runner", 7, 5, 100000, 100000, 11),
      second = enemy(2, "drone", 7.2, 5, 1000, 1000, 10);
    const { g, tower, damage } = arena("arc", path("twin-arc", 3), [insulated, second], content);
    fire(g, tower);
    expect(lost(second)).toBe(0);
    fire(g, tower);
    expect(lost(second)).toBeCloseTo(damage * 0.65);
  });
});

describe("new trap abilities", () => {
  it("Caltrops Hamstring slows and Open Wounds weakens while the bleed runs", () => {
    const a = arena("spikes", path("hamstring", 3), [enemy(1, "drone", 7, 5)]);
    fire(a.g, a.tower);
    const slowed = a.g.state.enemies[0];
    expect(speedFactor(slowed, a.g.state.time)).toBeCloseTo(0.7);
    expect(statusOf(slowed, "slow")!.until).toBe(statusOf(slowed, "bleeding")!.until);
    const b = arena("spikes", path("open-wounds", 2), [enemy(1, "drone", 7, 5)]);
    fire(b.g, b.tower);
    expect(damageTaken(b.g.state.enemies[0], b.g.state.time)).toBeCloseTo(1.12);
  });
  it("Tar Pit Flammable Tar oils the tarred enemy, so burns on it deal more", () => {
    const tarred = enemy(1, "drone", 7, 5);
    const { g, tower } = arena("tar", path("flammable-tar", 3), [tarred]);
    fire(g, tower);
    expect(statusOf(tarred, "oiled")).toMatchObject({ boost: 2, until: g.state.time + 3.5 });
  });
  it("Spring Concussion weakens the thrown enemy until a while after it lands", () => {
    const thrown = enemy(1, "drone", 7, 5);
    const { g, tower } = arena("spring", path("concussion", 2), [thrown]);
    fire(g, tower);
    const release = g.state.time + (resolveUpgrades(tower).attack as { duration: number }).duration;
    expect(statusOf(thrown, "vulnerable")).toMatchObject({ amount: 0.15, until: release + 2 });
  });
  it("Tripwire Volley Signal strengthens only the alerted towers' next shot", () => {
    const target = enemy(1, "drone", 7, 5, 100000, 100000);
    const { g, tower, damage } = arena("tripwire", path("volley-signal", 1), [target]);
    const pulse: Tower = { id: 2, type: "pulse", x: 8, y: 5, upgrades: [], cooldown: 1, spent: 0, angle: 0, kills: 0, owner: 0 };
    g.state.towers.push(pulse);
    const shot = resolveUpgrades(pulse).stats.damage;
    fire(g, tower);
    expect(100000 - target.hp).toBeCloseTo(damage + shot * 1.5);
    expect(pulse.alerted).toBeUndefined();
    fire(g, pulse);
    expect(100000 - target.hp).toBeCloseTo(damage + shot * 2.5);
  });
  it("Tripwire Flare reveals stealthed enemies in the alarm radius for a while", () => {
    const content = withTraits("drone", [{ kind: "stealth" }]);
    const near = enemy(2, "drone", 9, 5),
      far = enemy(3, "drone", 12, 5);
    const { g, tower } = arena("tripwire", path("flare", 1), [enemy(1, "drone", 7, 5), near, far], content);
    fire(g, tower);
    updateDetection(g);
    expect(near.revealed).toBe(true);
    expect(far.revealed).toBe(false);
    g.state.time += 1.6;
    updateDetection(g);
    expect(near.revealed).toBe(false);
  });
  it("Barricade Choke Point weakens enemies held at the wall", () => {
    const g = new Game(),
      cell = 4,
      at = g.mission.map.path[cell];
    g.state.wallets[0] = 10000;
    expect(g.command({ type: "build", tower: "barricade", ...at }).ok).toBe(true);
    const wall = g.state.towers[0];
    wall.upgrades = path("choke-point", 3);
    const p = positionOnPath(g.mission.map.path, cell - 1);
    g.state.enemies = [makeEnemy(1, "drone", p.x, p.y, cell - 1)];
    moveEnemies(g, 1);
    attackEnemies(g, 0);
    const held = g.state.enemies[0];
    expect(damageTaken(held, g.state.time)).toBeCloseTo(1.2);
    expect(lost(held)).toBeCloseTo(resolveUpgrades(wall).stats.damage * 1.2);
  });
  it("Warp Pad Disorient confuses the warped enemy", () => {
    const warped = enemy(1, "drone", 7, 5);
    const { g, tower } = arena("warp", path("disorient", 1), [warped]);
    fire(g, tower);
    expect(warped.warped).toBe(true);
    expect(speedFactor(warped, g.state.time)).toBe(-1);
    g.state.time += 1.1;
    expect(speedFactor(warped, g.state.time)).toBe(1);
  });
  it("leaves plain traps' towers untouched and clears path state after a wave", () => {
    const plain = arena("tripwire", LEVELS, [enemy(1, "drone", 7, 5)]);
    fire(plain.g, plain.tower);
    expect("flare" in plain.tower).toBe(false);
    const { g, tower } = arena("tripwire", path("flare", 1), [enemy(1, "drone", 7, 5)]);
    const pulse: Tower = { id: 2, type: "pulse", x: 20, y: 20, upgrades: [], cooldown: 1, spent: 0, angle: 0, kills: 0, owner: 0, alerted: 0.5 };
    g.state.towers.push(pulse);
    fire(g, tower);
    expect(tower.flare).toBeDefined();
    g.state.status = "wave";
    g.state.wave = 1;
    g.state.enemies = [];
    g.state.queue = [];
    settleWave(g);
    expect("flare" in tower || "alerted" in pulse).toBe(false);
    expect(TOWERS.tripwire.upgrades).toHaveLength(13);
  });
});
