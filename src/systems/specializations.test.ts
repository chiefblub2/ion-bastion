import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { DEFAULT_CONTENT } from "../content";
import { stateHash } from "../core/hash";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { resolveUpgrades } from "../core/upgrades";
import type { ContentPack, Enemy, EnemyId, SpecializationSpec, Tower, TowerId, Trait } from "../core/types";
import { attackEnemies } from "./combat";
import { applyDamage, hitOf } from "./damage";
import { applyStatus, BURN_TICK, damageTaken, hasStatus, speedFactor, tickStatus } from "./status";
import { fireAftershocks } from "./attacks/quake";

const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** Upgrades of a tower specialized up to `tier` on `path`. */
const path = (slug: string, tier: number) => [...LEVELS, ...Array.from({ length: tier }, (_, i) => `${slug}-${i + 1}`)];
/** Content where one enemy type carries the given traits. */
function withTraits(type: EnemyId, traits: Trait[]): ContentPack {
  return { ...DEFAULT_CONTENT, enemies: { ...DEFAULT_CONTENT.enemies, [type]: { ...DEFAULT_CONTENT.enemies[type], traits } } };
}
/** One tower at (7,5) and enemies placed directly into the state; no build rules, no wave. */
function arena(type: TowerId, upgrades: string[], enemies: Enemy[], content: ContentPack = DEFAULT_CONTENT) {
  const g = new Game(undefined, content);
  const tower: Tower = { id: 1, type, x: 7, y: 5, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(tower);
  g.state.nextId = 1000;
  g.state.enemies = enemies;
  return { g, tower, damage: resolveUpgrades(tower, content).stats.damage };
}
/** Fires once (cooldown reset) and lands every projectile. */
function fire(g: Game, tower: Tower) {
  tower.cooldown = 0;
  attackEnemies(g, 0);
  landProjectiles(g);
}
const lost = (e: Enemy) => e.maxHp - e.hp;
const enemy = (id: number, type: EnemyId, x: number, y: number, hp = 1000, maxHp = 1000, distance = 10): Enemy => ({ ...makeEnemy(id, type, x, y, distance), hp, maxHp });
const src = (special?: SpecializationSpec) => ({ tower: 1, type: "lance" as const, ...(special ? { special } : {}) });

describe("damage and armor", () => {
  it("armor pierce and dissolver multiply their shares of the reduction (M-003, M-004)", () => {
    const g = new Game(undefined, withTraits("drone", [{ kind: "armor", reduction: 0.5 }]));
    const target = enemy(1, "drone", 7, 6);
    g.state.enemies = [target];
    applyDamage(g, src(), target, 100, false, hitOf("pierce", src()));
    expect(lost(target)).toBeCloseTo(50);
    const pierce = src({ kind: "armor-pierce", fraction: 0.4 });
    applyDamage(g, pierce, target, 100, false, hitOf("pierce", pierce));
    expect(lost(target)).toBeCloseTo(50 + 70);
    applyStatus(g, target, { kind: "armorDissolved", fraction: 0.2, until: 5 });
    applyDamage(g, pierce, target, 100, false, hitOf("pierce", pierce));
    expect(lost(target)).toBeCloseTo(50 + 70 + 76);
    // A dot carries no hit, so it gets the dissolver but no pierce.
    applyDamage(g, pierce, target, 100, true);
    expect(lost(target)).toBeCloseTo(50 + 70 + 76 + 60);
  });
  it("conditional damage checks heavy targets on impact", () => {
    const heavy = enemy(1, "drone", 7, 6), light = enemy(2, "drone", 7, 6, 999, 999);
    const a = arena("pulse", path("sharpshooter", 3), [heavy]);
    fire(a.g, a.tower);
    expect(lost(heavy)).toBeCloseTo(a.damage * 1.7);
    const b = arena("pulse", path("sharpshooter", 3), [light]);
    fire(b.g, b.tower);
    expect(light.maxHp - light.hp).toBeCloseTo(b.damage);
  });
  it("Siegebreaker only boosts the blast against armored enemies", () => {
    const content = withTraits("drone", [{ kind: "armor", reduction: 0.25 }]);
    const armored = enemy(1, "drone", 7, 6), plainOne = enemy(2, "runner", 7, 6);
    const { g, tower, damage } = arena("blast", path("siegebreaker", 2), [armored, plainOne], content);
    fire(g, tower);
    expect(lost(armored)).toBeCloseTo(damage * 1.4 * 0.75);
    expect(lost(plainOne)).toBeCloseTo(damage);
  });
  it("Overload strengthens the chain only for a lone enemy in range", () => {
    const lone = arena("tesla", path("overload", 1), [enemy(1, "drone", 7, 6)]);
    fire(lone.g, lone.tower);
    expect(lost(lone.g.state.enemies[0])).toBeCloseTo(lone.damage * 1.3);
    const pair = arena("tesla", path("overload", 1), [enemy(1, "drone", 7, 6, 1000, 1000, 11), enemy(2, "drone", 8, 6.5)]);
    fire(pair.g, pair.tower);
    expect(lost(pair.g.state.enemies[0])).toBeCloseTo(pair.damage);
  });
  it("Searing Heat only counts a burn that was there before the hit", () => {
    const target = enemy(1, "drone", 7, 6);
    const { g, tower, damage } = arena("inferno", path("searing-heat", 3), [target]);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage + damage * 1.4);
  });
  it("Final Decay adds its points strictly below the threshold (M-005)", () => {
    const hit = (hp: number) => {
      const target = enemy(1, "drone", 7, 6, hp);
      const { g, tower, damage } = arena("decay", path("final-decay", 3), [target]);
      fire(g, tower);
      return hp - target.hp - damage;
    };
    expect(hit(549)).toBeCloseTo(80);
    expect(hit(550)).toBeCloseTo(60);
  });
  it("Hunter's Mark executes strictly below its threshold (M-006)", () => {
    const hit = (hp: number) => {
      const target = enemy(1, "drone", 7, 6, hp, 1000);
      const { g, tower, damage } = arena("executioner", path("hunters-mark", 3), [target]);
      fire(g, tower);
      return (hp - target.hp) / damage;
    };
    expect(hit(500)).toBeCloseTo(1);
    expect(hit(499)).toBeCloseTo(5);
  });
});

describe("extra hits and procs", () => {
  it("Ricochet II bounces exactly on the third shot (M-007)", () => {
    const main = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), side = enemy(2, "drone", 7.5, 6.5, 1e6, 1e6, 5);
    const { g, tower, damage } = arena("pulse", path("ricochet", 2), [main, side]);
    fire(g, tower);
    fire(g, tower);
    expect(lost(side)).toBe(0);
    expect(tower.specialShots).toBe(2);
    fire(g, tower);
    expect(lost(side)).toBeCloseTo(damage * 0.5);
    expect(tower.specialShots).toBe(0);
  });
  it("a Ricochet shot still bounces after its tower was sold (T-011)", () => {
    const main = enemy(1, "drone", 7, 8, 1e6, 1e6, 12), side = enemy(2, "drone", 7.5, 8.5, 1e6, 1e6, 5);
    const { g, tower, damage } = arena("pulse", path("ricochet", 3), [main, side]);
    tower.specialShots = 1;
    attackEnemies(g, 0);
    expect(g.state.projectiles[0]).toMatchObject({ proc: 1, special: { kind: "ricochet" } });
    g.state.towers = [];
    landProjectiles(g);
    expect(lost(side)).toBeCloseTo(damage * 0.65);
  });
  it("Flak Curtain III adds at most three weaker shots (M-008)", () => {
    const flyers = [0, 1, 2, 3, 4].map((i) => enemy(i + 1, "glider", 7 + i * 0.3, 6, 1e6, 1e6, 20 - i));
    const { g, tower, damage } = arena("flak", path("flak-curtain", 3), flyers);
    fire(g, tower);
    expect(flyers.map(lost).map((v) => Math.round(v / damage * 100) / 100)).toEqual([1, 0.45, 0.45, 0.45, 0]);
  });
  it("Wingclip slows hit flyers", () => {
    const flyer = enemy(1, "glider", 7, 6, 1e6, 1e6);
    const { g, tower } = arena("flak", path("wingclip", 3), [flyer]);
    fire(g, tower);
    expect(speedFactor(flyer, g.state.time)).toBeCloseTo(0.7);
  });
  it("Twin Arc starts a second chain on its fourth salvo, never on an enemy hit twice", () => {
    const near = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), far = enemy(2, "drone", 7, 2.5, 1e6, 1e6, 5);
    const { g, tower, damage } = arena("tesla", path("twin-arc", 1), [near, far]);
    for (let i = 0; i < 3; i++) fire(g, tower);
    expect(lost(far)).toBe(0);
    fire(g, tower);
    expect(lost(far)).toBeCloseTo(damage * 0.45);
    expect(lost(near)).toBeCloseTo(damage * 4);
  });
  it("Contagion strikes nearby enemies for a capped share of their max HP", () => {
    const main = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), side = enemy(2, "drone", 7.5, 6.5, 1000, 1000, 5);
    const { g, tower } = arena("decay", path("contagion", 1), [main, side]);
    fire(g, tower);
    expect(lost(side)).toBeCloseTo(10);
  });
  it("Prism Beam hits the first enemy behind the target without building stacks", () => {
    const front = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), back = enemy(2, "drone", 7, 7.2, 1e6, 1e6, 5);
    const { g, tower, damage } = arena("focus", path("prism-beam", 1), [front, back]);
    fire(g, tower);
    expect(lost(back)).toBeCloseTo(damage * 0.3);
    expect(tower.focus).toEqual({ target: 1, stacks: 0 });
  });
  it("Adaptive Lens keeps a share of the stacks on a target switch", () => {
    const first = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), second = enemy(2, "drone", 7, 6.5, 1e6, 1e6, 5);
    const { g, tower } = arena("focus", path("adaptive-lens", 3), [first, second]);
    for (let i = 0; i < 9; i++) fire(g, tower);
    expect(tower.focus).toEqual({ target: 1, stacks: 8 });
    first.hp = 0;
    fire(g, tower);
    expect(tower.focus).toEqual({ target: 2, stacks: 6 });
  });
  it("Chain Reaction explodes at most three kills once each (M-009)", () => {
    const weak = Array.from({ length: 10 }, (_, i) => enemy(i + 1, "drone", 7 + (i % 3) * 0.2, 6 + Math.floor(i / 3) * 0.2, 1, 1));
    const { g, tower } = arena("blast", path("chain-reaction", 3), weak);
    fire(g, tower);
    expect(g.state.events.filter((e) => e.type === "pulse")).toHaveLength(3);
  });
  it("Concentrated Volley III adds one hit per unused shard on a lone target (M-015)", () => {
    const target = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const { g, tower, damage } = arena("shrapnel", path("concentrated-volley", 3), [target]);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage * 3);
    expect(g.state.events.filter((e) => e.type === "damage")).toHaveLength(2);
  });
  it("Blood Transfer passes only real overkill of the main target (M-018)", () => {
    const victim = enemy(1, "drone", 7, 6, 10, 1000, 12), next = enemy(2, "drone", 7.5, 6.5, 1e6, 1e6, 5);
    const { g, tower, damage } = arena("executioner", path("blood-transfer", 3), [victim, next]);
    fire(g, tower);
    // Below 35% HP: executed for 5×; 60% of the overkill, capped by the hit.
    expect(lost(next)).toBeCloseTo(Math.min((damage * 5 - 10) * 0.6, damage * 5));
    const shielded = withTraits("drone", [{ kind: "shield", capacity: 0.9, delay: 3 }]);
    const tough = { ...enemy(1, "drone", 7, 6, 1000, 1000, 12), shield: 1e6 }, bystander = enemy(2, "runner", 7.5, 6.5, 1e6, 1e6, 5);
    const b = arena("executioner", path("blood-transfer", 3), [tough, bystander], shielded);
    fire(b.g, b.tower);
    expect(lost(bystander)).toBe(0);
  });
});

describe("status specializations", () => {
  it("Brittle Ice needs a slow that took hold (M-012)", () => {
    const immune = enemy(1, "skater", 7, 6, 1e6, 1e6), normal = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const a = arena("frost", path("brittle-ice", 3), [immune]);
    fire(a.g, a.tower);
    expect(immune.status).toHaveLength(0);
    const b = arena("frost", path("brittle-ice", 3), [normal]);
    fire(b.g, b.tower);
    expect(damageTaken(normal, b.g.state.time)).toBeCloseTo(1.16);
  });
  it("Frostburst slows enemies around the target without damaging them", () => {
    const main = enemy(1, "drone", 7, 6, 1e6, 1e6, 12), side = enemy(2, "drone", 7.8, 6.5, 1e6, 1e6, 5);
    const { g, tower } = arena("frost", path("frostburst", 2), [main, side]);
    fire(g, tower);
    expect(lost(side)).toBe(0);
    expect(speedFactor(side, g.state.time)).toBeCloseTo(0.45);
  });
  it("Temporal Exposure starts only when the stun ends (M-013)", () => {
    const target = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const { g, tower } = arena("stasis", path("temporal-exposure", 2), [target]);
    fire(g, tower);
    expect(hasStatus(target, "vulnerable", g.state.time)).toBe(false);
    g.state.time += 1.2;
    tickStatus(g, 0);
    expect(damageTaken(target, g.state.time)).toBeCloseTo(1.15);
    const vulnerable = target.status.find((s) => s.kind === "vulnerable")!;
    expect(vulnerable.until).toBeCloseTo(g.state.time + 2);
  });
  it("a stronger vulnerability is never added to (M-014)", () => {
    const target = enemy(1, "drone", 7, 6);
    const g = new Game();
    applyStatus(g, target, { kind: "vulnerable", amount: 0.4, until: 5 });
    expect(applyStatus(g, target, { kind: "vulnerable", amount: 0.16, until: 6 })).toBe(false);
    expect(damageTaken(target, 0)).toBeCloseTo(1.4);
  });
  it("Compression needs a pull that took hold (M-016)", () => {
    const berserker = enemy(1, "berserker", 7, 6, 1e6, 1e6), drone = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const a = arena("gravity", path("compression", 1), [berserker]);
    fire(a.g, a.tower);
    expect(berserker.status).toHaveLength(0);
    const b = arena("gravity", path("compression", 1), [drone]);
    fire(b.g, b.tower);
    expect(damageTaken(drone, b.g.state.time)).toBeCloseTo(1.1);
    // A second pulse during recovery is rejected, so it grants nothing new.
    drone.status = drone.status.filter((s) => s.kind !== "vulnerable");
    fire(b.g, b.tower);
    expect(hasStatus(drone, "vulnerable", b.g.state.time)).toBe(false);
  });
  it("Weak Signal and Exposed Target weaken for as long as their status runs", () => {
    const jammed = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const a = arena("jammer", path("weak-signal", 3), [jammed]);
    fire(a.g, a.tower);
    expect(damageTaken(jammed, a.g.state.time)).toBeCloseTo(1.16);
    const netted = enemy(1, "glider", 7, 6, 1e6, 1e6);
    const b = arena("net", path("exposed-target", 2), [netted]);
    fire(b.g, b.tower);
    expect(damageTaken(netted, b.g.state.time)).toBeCloseTo(1.15);
  });
  it("Net Cloud catches other flyers without damage and never ground enemies (M-017)", () => {
    const main = enemy(1, "glider", 7, 6, 1e6, 1e6, 12), flyer = enemy(2, "glider", 7.5, 6.3, 1e6, 1e6, 5), walker = enemy(3, "drone", 7.3, 6, 1e6, 1e6, 4);
    const { g, tower } = arena("net", path("net-cloud", 3), [main, flyer, walker]);
    fire(g, tower);
    expect(hasStatus(flyer, "netted", g.state.time)).toBe(true);
    expect(lost(flyer)).toBe(0);
    expect(hasStatus(walker, "netted", g.state.time)).toBe(false);
  });
  it("Armor Dissolver marks corroded enemies for every tower", () => {
    const target = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const { g, tower } = arena("acid", path("armor-dissolver", 3), [target]);
    fire(g, tower);
    expect(target.status.find((s) => s.kind === "armorDissolved")).toMatchObject({ fraction: 0.3 });
  });
  it("Fracture weakens after the wave, so the wave itself is not amplified", () => {
    const target = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const { g, tower, damage } = arena("quake", path("fracture", 3), [target]);
    fire(g, tower);
    // Edge damage is 100% from level 5 on, so the wave deals its full damage and nothing more.
    expect(lost(target)).toBeCloseTo(damage);
    expect(damageTaken(target, g.state.time)).toBeCloseTo(1.2);
  });
  it("Wildfire passes a share of the remaining burn on, once (M-011)", () => {
    const carrier = enemy(1, "drone", 7, 6, 1, 1000), neighbour = enemy(2, "drone", 7.5, 6, 1e6, 1e6);
    const g = new Game();
    g.state.enemies = [carrier, neighbour];
    applyStatus(g, carrier, { kind: "burn", dps: 20, next: BURN_TICK, until: 2, source: { tower: 1, type: "inferno" }, spread: { factor: 0.4, radius: 1, count: 1 } });
    applyDamage(g, { tower: 1, type: "inferno" }, carrier, 10);
    const passed = neighbour.status.find((s) => s.kind === "burn")!;
    expect(passed).toMatchObject({ dps: 8, until: 2 });
    expect("spread" in passed).toBe(false);
  });
  it("Aftershock fires one weaker wave after its delay (M-010)", () => {
    const target = enemy(1, "drone", 7, 6, 1e6, 1e6);
    const { g, tower } = arena("quake", path("aftershock", 2), [target]);
    fire(g, tower);
    const first = lost(target);
    expect(g.state.pending).toHaveLength(1);
    g.state.time += 0.34;
    fireAftershocks(g);
    expect(lost(target)).toBe(first);
    g.state.time += 0.01;
    fireAftershocks(g);
    expect(lost(target)).toBeCloseTo(first * 1.4);
    expect(g.state.pending).toBeUndefined();
  });
});

describe("multiplayer", () => {
  it("only the owner can specialize a tower in co-op (T-012)", () => {
    const g = new Game();
    g.setPlayers(2);
    g.state.wallets = [5000, 5000];
    const id = g.command({ type: "build", tower: "pulse", x: 4, y: 4, player: 1 }).id!;
    for (const upgrade of LEVELS) g.command({ type: "upgrade", id, upgrade, player: 1 });
    const before = JSON.stringify(g.state);
    expect(g.command({ type: "upgrade", id, upgrade: "ricochet-1", player: 0 }).code).toBe("tower-foreign");
    expect(JSON.stringify(g.state)).toBe(before);
    expect(g.command({ type: "upgrade", id, upgrade: "ricochet-1", player: 1 }).ok).toBe(true);
  });
});

describe("determinism", () => {
  it("two identical games with specialized towers keep identical hashes (M-019)", () => {
    const run = () => {
      const g = new Game();
      g.state.wallets[0] = 100000;
      const towers: [TowerId, string[], number, number][] = [
        ["pulse", path("ricochet", 3), 4, 4],
        ["quake", path("aftershock", 3), 6, 4],
        ["tesla", path("twin-arc", 3), 8, 4],
        ["inferno", path("wildfire", 3), 10, 4],
      ];
      for (const [tower, upgrades, x, y] of towers) {
        const id = g.command({ type: "build", tower, x, y }).id!;
        for (const upgrade of upgrades) g.command({ type: "upgrade", id, upgrade });
      }
      g.command({ type: "start" });
      const hashes: number[] = [];
      for (let i = 0; i < 900 && g.state.status === "wave"; i++) {
        g.tick();
        g.drainEvents();
        hashes.push(stateHash(g.state));
      }
      return { hashes, shots: g.state.towers.map((t) => t.specialShots) };
    };
    const a = run(), b = run();
    expect(a.hashes.length).toBeGreaterThan(100);
    expect(a.hashes).toEqual(b.hashes);
    expect(a.shots.some((n) => n !== undefined)).toBe(true);
  });
});
