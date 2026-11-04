import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { arena, fire, foe, landProjectiles, LEVELS, lost, spec, tiers, withTraits } from "../core/test-helpers";
import { resolveUpgrades } from "../core/upgrades";
import type { ExecuteAttack, SpecializationSpec, TowerId } from "../core/types";
import { attackEnemies } from "./combat";
import { applyDamage, hitOf } from "./damage";
import { applyStatus, BURN_TICK, damageTaken, hasStatus, speedFactor, tickStatus } from "./status";
import { fireAftershocks } from "./attacks/quake";

const src = (special?: SpecializationSpec) => ({ tower: 1, type: "lance" as const, ...(special ? { special } : {}) });

describe("damage and armor", () => {
  it("armor pierce and dissolver multiply their shares of the reduction (M-003, M-004)", () => {
    const g = new Game(undefined, withTraits({ drone: [{ kind: "armor", reduction: 0.5 }] }));
    const target = foe(1, "drone", 7, 6);
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
    const heavy = foe(1, "drone", 7, 6), light = foe(2, "drone", 7, 6, { hp: 999, maxHp: 999 });
    const a = arena("pulse", tiers("sharpshooter", 3), [heavy]);
    fire(a.g, a.tower);
    expect(lost(heavy)).toBeCloseTo(a.damage * (1 + spec("pulse", "sharpshooter", 3).bonus));
    const b = arena("pulse", tiers("sharpshooter", 3), [light]);
    fire(b.g, b.tower);
    expect(lost(light)).toBeCloseTo(b.damage);
  });
  it("Siegebreaker only boosts the blast against armored enemies", () => {
    const content = withTraits({ drone: [{ kind: "armor", reduction: 0.25 }] });
    const armored = foe(1, "drone", 7, 6), plainOne = foe(2, "runner", 7, 6);
    const { g, tower, damage } = arena("blast", tiers("siegebreaker", 2), [armored, plainOne], content);
    fire(g, tower);
    expect(lost(armored)).toBeCloseTo(damage * (1 + spec("blast", "siegebreaker", 2).bonus) * (1 - 0.25));
    expect(lost(plainOne)).toBeCloseTo(damage);
  });
  it("Overload strengthens the chain only for a lone enemy in range", () => {
    const lone = arena("tesla", tiers("overload", 1), [foe(1, "drone", 7, 6)]);
    fire(lone.g, lone.tower);
    expect(lost(lone.g.state.enemies[0])).toBeCloseTo(lone.damage * (1 + spec("tesla", "overload", 1).bonus));
    const pair = arena("tesla", tiers("overload", 1), [foe(1, "drone", 7, 6, { distance: 11 }), foe(2, "drone", 8, 6.5)]);
    fire(pair.g, pair.tower);
    expect(lost(pair.g.state.enemies[0])).toBeCloseTo(pair.damage);
  });
  it("Searing Heat only counts a burn that was there before the hit", () => {
    const target = foe(1, "drone", 7, 6);
    const { g, tower, damage } = arena("inferno", tiers("searing-heat", 3), [target]);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage + damage * (1 + spec("inferno", "searing-heat", 3).bonus));
  });
  it("Final Decay adds its points strictly below the threshold (M-005)", () => {
    const hit = (hp: number) => {
      const target = foe(1, "drone", 7, 6, { hp: hp, maxHp: 1000 });
      const { g, tower, damage } = arena("decay", tiers("final-decay", 3), [target]);
      fire(g, tower);
      return hp - target.hp - damage;
    };
    expect(hit(549)).toBeCloseTo(80);
    expect(hit(550)).toBeCloseTo(60);
  });
  it("Hunter's Mark executes strictly below its threshold (M-006)", () => {
    const hit = (hp: number) => {
      const target = foe(1, "drone", 7, 6, { hp: hp });
      const { g, tower, damage } = arena("executioner", tiers("hunters-mark", 3), [target]);
      fire(g, tower);
      return (hp - target.hp) / damage;
    };
    expect(hit(500)).toBeCloseTo(1);
    expect(hit(499)).toBeCloseTo(5);
  });
});

describe("extra hits and procs", () => {
  it("Ricochet II bounces exactly on the third shot (M-007)", () => {
    const main = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), side = foe(2, "drone", 7.5, 6.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower, damage } = arena("pulse", tiers("ricochet", 2), [main, side]);
    const { every, factor } = spec("pulse", "ricochet", 2);
    for (let i = 1; i < every; i++) fire(g, tower);
    expect(lost(side)).toBe(0);
    expect(tower.specialShots).toBe(every - 1);
    fire(g, tower);
    expect(lost(side)).toBeCloseTo(damage * factor);
    expect(tower.specialShots).toBe(0);
  });
  it("a Ricochet shot still bounces after its tower was sold (T-011)", () => {
    const main = foe(1, "drone", 7, 8, { hp: 1e6, maxHp: 1e6, distance: 12 }), side = foe(2, "drone", 7.5, 8.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower, damage } = arena("pulse", tiers("ricochet", 3), [main, side]);
    tower.specialShots = 1;
    attackEnemies(g, 0);
    expect(g.state.projectiles[0]).toMatchObject({ proc: 1, special: { kind: "ricochet" } });
    g.state.towers = [];
    landProjectiles(g);
    expect(lost(side)).toBeCloseTo(damage * spec("pulse", "ricochet", 3).factor);
  });
  it("Flak Curtain III adds at most three weaker shots (M-008)", () => {
    const flyers = [0, 1, 2, 3, 4].map((i) => foe(i + 1, "glider", 7 + i * 0.3, 6, { hp: 1e6, maxHp: 1e6, distance: 20 - i }));
    const { g, tower, damage } = arena("flak", tiers("flak-curtain", 3), flyers);
    fire(g, tower);
    const { count, factor } = spec("flak", "flak-curtain", 3);
    expect(count).toBeLessThan(flyers.length - 1);
    flyers.forEach((f, i) => expect(lost(f) / damage).toBeCloseTo(i === 0 ? 1 : i <= count ? factor : 0));
  });
  it("Wingclip slows hit flyers", () => {
    const flyer = foe(1, "glider", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower } = arena("flak", tiers("wingclip", 3), [flyer]);
    fire(g, tower);
    expect(speedFactor(flyer, g.state.time)).toBeCloseTo(1 - spec("flak", "wingclip", 3).slow);
  });
  it("Twin Arc starts a second chain on its fourth salvo, never on an enemy hit twice", () => {
    const near = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), far = foe(2, "drone", 7, 2.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower, damage } = arena("tesla", tiers("twin-arc", 1), [near, far]);
    const { every, factor } = spec("tesla", "twin-arc", 1);
    for (let i = 1; i < every; i++) fire(g, tower);
    expect(lost(far)).toBe(0);
    fire(g, tower);
    expect(lost(far)).toBeCloseTo(damage * factor);
    expect(lost(near)).toBeCloseTo(damage * every);
  });
  it("Contagion strikes nearby enemies for a capped share of their max HP", () => {
    const main = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), side = foe(2, "drone", 7.5, 6.5, { distance: 5 });
    const { g, tower } = arena("decay", tiers("contagion", 1), [main, side]);
    fire(g, tower);
    expect(lost(side)).toBeCloseTo(10);
  });
  it("Prism Beam hits the first enemy behind the target without building stacks", () => {
    const front = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), back = foe(2, "drone", 7, 7.2, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower, damage } = arena("focus", tiers("prism-beam", 1), [front, back]);
    fire(g, tower);
    expect(lost(back)).toBeCloseTo(damage * spec("focus", "prism-beam", 1).factor);
    expect(tower.focus).toEqual({ target: 1, stacks: 0 });
  });
  it("Adaptive Lens keeps a share of the stacks on a target switch", () => {
    const first = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), second = foe(2, "drone", 7, 6.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower } = arena("focus", tiers("adaptive-lens", 3), [first, second]);
    for (let i = 0; i < 9; i++) fire(g, tower);
    expect(tower.focus).toEqual({ target: 1, stacks: 8 });
    first.hp = 0;
    fire(g, tower);
    expect(tower.focus).toEqual({ target: 2, stacks: 6 });
  });
  it("Chain Reaction explodes at most three kills once each (M-009)", () => {
    const weak = Array.from({ length: 10 }, (_, i) => foe(i + 1, "drone", 7 + (i % 3) * 0.2, 6 + Math.floor(i / 3) * 0.2, { hp: 1, maxHp: 1 }));
    const { g, tower } = arena("blast", tiers("chain-reaction", 3), weak);
    fire(g, tower);
    expect(g.state.events.filter((e) => e.type === "pulse")).toHaveLength(3);
  });
  it("Concentrated Volley III adds one hit per unused shard on a lone target (M-015)", () => {
    const target = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower, damage } = arena("shrapnel", tiers("concentrated-volley", 3), [target]);
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage * 3);
    expect(g.state.events.filter((e) => e.type === "damage")).toHaveLength(2);
  });
  it("Blood Transfer passes only real overkill of the main target (M-018)", () => {
    const victim = foe(1, "drone", 7, 6, { hp: 10, distance: 12 }), next = foe(2, "drone", 7.5, 6.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower, damage } = arena("executioner", tiers("blood-transfer", 3), [victim, next]);
    fire(g, tower);
    // Below the threshold: executed for its multiplier; a share of the overkill, capped by the hit.
    const { multiplier } = resolveUpgrades(tower, g.content).attack as ExecuteAttack,
      { factor } = spec("executioner", "blood-transfer", 3);
    expect(lost(next)).toBeCloseTo(Math.min((damage * multiplier - 10) * factor, damage * multiplier));
    const shielded = withTraits({ drone: [{ kind: "shield", capacity: 0.9, delay: 3 }] });
    const tough = { ...foe(1, "drone", 7, 6, { distance: 12 }), shield: 1e6 }, bystander = foe(2, "runner", 7.5, 6.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const b = arena("executioner", tiers("blood-transfer", 3), [tough, bystander], shielded);
    fire(b.g, b.tower);
    expect(lost(bystander)).toBe(0);
  });
});

describe("status specializations", () => {
  it("Brittle Ice needs a slow that took hold (M-012)", () => {
    const immune = foe(1, "skater", 7, 6, { hp: 1e6, maxHp: 1e6 }), normal = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const a = arena("frost", tiers("brittle-ice", 3), [immune]);
    fire(a.g, a.tower);
    expect(immune.status).toHaveLength(0);
    const b = arena("frost", tiers("brittle-ice", 3), [normal]);
    fire(b.g, b.tower);
    expect(damageTaken(normal, b.g.state.time)).toBeCloseTo(1.16);
  });
  it("Frostburst slows enemies around the target without damaging them", () => {
    const main = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), side = foe(2, "drone", 7.8, 6.5, { hp: 1e6, maxHp: 1e6, distance: 5 });
    const { g, tower } = arena("frost", tiers("frostburst", 2), [main, side]);
    fire(g, tower);
    expect(lost(side)).toBe(0);
    expect(speedFactor(side, g.state.time)).toBeCloseTo(spec("frost", "frostburst", 2).factor);
  });
  it("Temporal Exposure starts only when the stun ends (M-013)", () => {
    const target = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower } = arena("stasis", tiers("temporal-exposure", 2), [target]);
    fire(g, tower);
    expect(hasStatus(target, "vulnerable", g.state.time)).toBe(false);
    g.state.time += 1.2;
    tickStatus(g, 0);
    expect(damageTaken(target, g.state.time)).toBeCloseTo(1.15);
    const vulnerable = target.status.find((s) => s.kind === "vulnerable")!;
    expect(vulnerable.until).toBeCloseTo(g.state.time + 2);
  });
  it("a stronger vulnerability is never added to (M-014)", () => {
    const target = foe(1, "drone", 7, 6);
    const g = new Game();
    applyStatus(g, target, { kind: "vulnerable", amount: 0.4, until: 5 });
    expect(applyStatus(g, target, { kind: "vulnerable", amount: 0.16, until: 6 })).toBe(false);
    expect(damageTaken(target, 0)).toBeCloseTo(1.4);
  });
  it("Compression needs a pull that took hold (M-016)", () => {
    const berserker = foe(1, "berserker", 7, 6, { hp: 1e6, maxHp: 1e6 }), drone = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const a = arena("gravity", tiers("compression", 1), [berserker]);
    fire(a.g, a.tower);
    expect(berserker.status).toHaveLength(0);
    const b = arena("gravity", tiers("compression", 1), [drone]);
    fire(b.g, b.tower);
    expect(damageTaken(drone, b.g.state.time)).toBeCloseTo(1.1);
    // A second pulse during recovery is rejected, so it grants nothing new.
    drone.status = drone.status.filter((s) => s.kind !== "vulnerable");
    fire(b.g, b.tower);
    expect(hasStatus(drone, "vulnerable", b.g.state.time)).toBe(false);
  });
  it("Weak Signal and Exposed Target weaken for as long as their status runs", () => {
    const jammed = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const a = arena("jammer", tiers("weak-signal", 3), [jammed]);
    fire(a.g, a.tower);
    expect(damageTaken(jammed, a.g.state.time)).toBeCloseTo(1.16);
    const netted = foe(1, "glider", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const b = arena("net", tiers("exposed-target", 2), [netted]);
    fire(b.g, b.tower);
    expect(damageTaken(netted, b.g.state.time)).toBeCloseTo(1.15);
  });
  it("Net Cloud catches other flyers without damage and never ground enemies (M-017)", () => {
    const main = foe(1, "glider", 7, 6, { hp: 1e6, maxHp: 1e6, distance: 12 }), flyer = foe(2, "glider", 7.5, 6.3, { hp: 1e6, maxHp: 1e6, distance: 5 }), walker = foe(3, "drone", 7.3, 6, { hp: 1e6, maxHp: 1e6, distance: 4 });
    const { g, tower } = arena("net", tiers("net-cloud", 3), [main, flyer, walker]);
    fire(g, tower);
    expect(hasStatus(flyer, "netted", g.state.time)).toBe(true);
    expect(lost(flyer)).toBe(0);
    expect(hasStatus(walker, "netted", g.state.time)).toBe(false);
  });
  it("Armor Dissolver marks corroded enemies for every tower", () => {
    const target = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower } = arena("acid", tiers("armor-dissolver", 3), [target]);
    fire(g, tower);
    expect(target.status.find((s) => s.kind === "armorDissolved")).toMatchObject({ fraction: 0.3 });
  });
  it("Fracture weakens after the wave, so the wave itself is not amplified", () => {
    const target = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower, damage } = arena("quake", tiers("fracture", 3), [target]);
    fire(g, tower);
    // Edge damage is 100% from level 5 on, so the wave deals its full damage and nothing more.
    expect(lost(target)).toBeCloseTo(damage);
    expect(damageTaken(target, g.state.time)).toBeCloseTo(1.2);
  });
  it("Wildfire passes a share of the remaining burn on, once (M-011)", () => {
    const carrier = foe(1, "drone", 7, 6, { hp: 1 }), neighbour = foe(2, "drone", 7.5, 6, { hp: 1e6, maxHp: 1e6 });
    const g = new Game();
    g.state.enemies = [carrier, neighbour];
    applyStatus(g, carrier, { kind: "burn", dps: 20, next: BURN_TICK, until: 2, source: { tower: 1, type: "inferno" }, spread: { factor: 0.4, radius: 1, count: 1 } });
    applyDamage(g, { tower: 1, type: "inferno" }, carrier, 10);
    const passed = neighbour.status.find((s) => s.kind === "burn")!;
    expect(passed).toMatchObject({ dps: 8, until: 2 });
    expect("spread" in passed).toBe(false);
  });
  it("Aftershock fires one weaker wave after its delay (M-010)", () => {
    const target = foe(1, "drone", 7, 6, { hp: 1e6, maxHp: 1e6 });
    const { g, tower } = arena("quake", tiers("aftershock", 2), [target]);
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
        ["pulse", tiers("ricochet", 3), 4, 4],
        ["quake", tiers("aftershock", 3), 6, 4],
        ["tesla", tiers("twin-arc", 3), 8, 4],
        ["inferno", tiers("wildfire", 3), 10, 4],
      ];
      for (const [tower, upgrades, x, y] of towers) {
        const id = g.command({ type: "build", tower, x, y }).id!;
        for (const upgrade of upgrades) g.command({ type: "upgrade", id, upgrade });
      }
      g.command({ type: "start" });
      const hashes: number[] = [];
      for (let i = 0; i < 300 && g.state.status === "wave"; i++) {
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
