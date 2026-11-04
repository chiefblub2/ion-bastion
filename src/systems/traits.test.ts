import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMIES } from "../content/enemies";
import { TOWERS } from "../content/towers";
import { Game } from "../core/game";
import { finishWave, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import type { AttackKind, ContentPack, Enemy, EnemyDefinition, Tower, Trait } from "../core/types";
import { applyDamage, hitOf } from "./damage";
import { attackEnemies } from "./combat";
import { blast } from "./attacks/splash";
import { attackModule, canAcquire, canTarget } from "./attacks";
import { MISSIONS } from "../content/missions";
import { hasStealth } from "../core/mission-checks";
import { createEnemy } from "./spawn";
import { applyStatus, tickStatus } from "./status";
import { updateDetection } from "./detection";
import { stateHash } from "../core/hash";
import { parseMap } from "../content/maps";
import { g as group, wave } from "../content/waves";
import { isBurrowed, isHidden, layerOf, tickTraits, traitFlags, traitSpeedFactor } from "./traits";
import { moveEnemies } from "./movement";
import { effectiveTowerStats } from "./auras";
import { bountyBonus, markFactor, repairReactor } from "./support";

/** The shipped content with extra traits on the drone. */
function withDroneTraits(...traits: Trait[]): ContentPack {
  return { ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits } } };
}
/** Pack where the drone carries `drone` traits and the runner `runner` traits. */
const duo = (drone: Trait[], runner: Trait[] = []): ContentPack => ({
  ...DEFAULT_CONTENT,
  enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits: drone }, runner: { ...ENEMIES.runner, traits: runner } },
});
/** A game whose drone carries `traits`, with `enemies` on the field (default: one drone at 0,3); `e` is the first. */
function traitGame(traits: Trait | Trait[], ...enemies: Enemy[]) {
  const g = new Game(undefined, withDroneTraits(...[traits].flat()));
  if (enemies.length === 0) enemies = [makeEnemy(1, "drone", 0, 3)];
  g.state.enemies = enemies;
  return { g, e: enemies[0], enemies };
}
const src = { tower: 0, type: "pulse" as const };
const towerAt = (id: number, type: Tower["type"], x: number, y: number): Tower => ({ id, type, x, y, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 });

/** One validation row: malformed variants of a trait kind validation must reject, and one it accepts. */
type Spec<K extends Trait["kind"]> = Omit<Extract<Trait, { kind: K }>, "kind">;
const row = <K extends Trait["kind"]>(kind: K, bad: Spec<K>[], good: Spec<K>) =>
  [kind, bad.map((b) => ({ kind, ...b }) as Trait), { kind, ...good } as Trait] as const;
const VALIDATION = [
  row("burrow", [{ every: 3, length: 3 }, { every: 0, length: 0.5 }], { every: 3, length: 1.2 }),
  row("surge", [{ every: 0, length: 0.5, factor: 2 }, { every: 4, length: 0, factor: 2 }, { every: 4, length: 4, factor: 2 }, { every: 4, length: 1, factor: 1 }], { every: 4, length: 1, factor: 2.2 }),
  row("swarm", [{ radius: 0, per: 0.1, max: 0.5 }, { radius: 1, per: 0, max: 0.5 }, { radius: 1, per: 0.1, max: 1 }], { radius: 1, per: 0.1, max: 0.5 }),
  row("rage", [{ max: 0 }, { max: -0.5 }], { max: 1 }),
  row("facet", [{ every: 0, length: 1, reduction: 0.5 }, { every: 4, length: 0, reduction: 0.5 }, { every: 4, length: 4, reduction: 0.5 }, { every: 4, length: 2, reduction: 0 }, { every: 4, length: 2, reduction: 1 }], { every: 4, length: 2, reduction: 0.7 }),
  row("leap", [{ every: 0, length: 0.5 }, { every: 4, length: 0 }, { every: 4, length: 4 }], { every: 4, length: 1.5 }),
  row("dampen", [{ radius: 0 }], { radius: 1.5 }),
  row("brood", [{ type: "nope" as Spec<"brood">["type"], every: 2, max: 2 }, { type: "runner", every: 0, max: 2 }, { type: "runner", every: 2, max: 0 }, { type: "runner", every: 2, max: 1.5 }], { type: "runner", every: 2, max: 2 }),
  row("overload", [{ radius: 0, cycles: 2 }, { radius: 2, cycles: 0 }], { radius: 2, cycles: 2 }),
  row("molt", [{ threshold: 0, armor: 0.5, speed: 1.5 }, { threshold: 1, armor: 0.5, speed: 1.5 }, { threshold: 0.5, armor: 0, speed: 1.5 }, { threshold: 0.5, armor: 1, speed: 1.5 }, { threshold: 0.5, armor: 0.5, speed: 1 }], { threshold: 0.5, armor: 0.5, speed: 1.5 }),
  row("momentum", [{ per: 0, max: 0.5 }, { per: 0.02, max: 0 }], { per: 0.02, max: 2 }),
  row("lap", [{ per: 0, max: 0.5 }, { per: 1.1, max: 0.5 }, { per: 0.1, max: 0 }, { per: 0.1, max: 1.5 }], { per: 0.1, max: 1 }),
  row("refract", [{ factor: 0.3 }, { factor: 0.7 }], { factor: 0.4 }),
  row("blastproof", [{ reduction: 0.2 }, { reduction: 0.8 }], { reduction: 0.5 }),
  row("insulated", [], {}),
  row("heatshield", [], {}),
  row("mirror", [{ cap: 0.01 }, { cap: 0.3 }], { cap: 0.06 }),
  row("link", [{ radius: 1 }, { radius: 2.5 }], { radius: 1.6 }),
  row("taunt", [{ radius: 1 }], { radius: 2.5 }),
  row("martyr", [{ radius: 3, heal: 0.2 }, { radius: 1.8, heal: 0.5 }], { radius: 1.8, heal: 0.2 }),
  row("cloakField", [{ radius: 3 }], { radius: 1.6 }),
  row("retaliate", [{ radius: 1, cycles: 0.5 }, { radius: 1.8, cycles: 1 }], { radius: 1.8, cycles: 0.5 }),
  row("pack", [{ radius: 1.5, perAlly: 0.2, max: 0.4 }, { radius: 1.5, perAlly: 0.08, max: 0.9 }], { radius: 1.5, perAlly: 0.08, max: 0.4 }),
  row("blink", [{ every: 2, jump: 2 }, { every: 4, jump: 5 }], { every: 4, jump: 2 }),
  row("tunnel", [{ every: 5, length: 2, speed: 3 }, { every: 5, length: 5, speed: 2 }], { every: 5, length: 2, speed: 2 }),
  row("phase", [{ period: 5, air: 1.5 }, { period: 3.5, air: 0.5 }], { period: 3.5, air: 1.5 }),
  row("blind", [{ radius: 2.5, range: 0.5 }], { radius: 2.5, range: 0.3 }),
  row("jam", [{ radius: 2, slow: 0.1 }], { radius: 2, slow: 0.4 }),
  row("defuse", [{ radius: 3 }], { radius: 1.5 }),
  row("suppress", [{ radius: 1 }], { radius: 2.5 }),
];

describe("trait validation", () => {
  it.each(VALIDATION)("%s rejects malformed variants", (_, bad, good) => {
    for (const trait of bad) expect(() => validateContent(withDroneTraits(trait)), JSON.stringify(trait)).toThrow();
    expect(() => validateContent(withDroneTraits(good))).not.toThrow();
  });
  it("names the position of a malformed trait", () => {
    expect(() => validateContent(withDroneTraits({ kind: "armor", reduction: 1 }))).toThrow("Enemy drone › Trait 1: reduction");
    expect(() => validateContent(withDroneTraits({ kind: "splitOnDeath", type: "ghost", count: 1 }))).toThrow("Unknown enemy 'ghost'");
  });
  it("explains malformed values", () => {
    expect(() => validateContent(withDroneTraits({ kind: "shield", capacity: 1, delay: 2 }))).toThrow("capacity must be in (0, 1)");
    expect(() => validateContent(withDroneTraits({ kind: "evade", every: 1 }))).toThrow("every must be an integer");
    expect(() => validateContent(withDroneTraits({ kind: "regen" }))).toThrow("exactly one of perSecond or percent");
    expect(() => validateContent(withDroneTraits({ kind: "regen", perSecond: 2, percent: 0.02 }))).toThrow("exactly one");
    expect(() => validateContent(withDroneTraits({ kind: "leader", radius: 0, speed: 0.2, resist: 0.15 }))).toThrow("radius must be > 0");
  });
});

describe("enemy traits", () => {
  it("armor absorbs a share of every hit", () => {
    const { g, e } = traitGame({ kind: "armor", reduction: 0.5 });
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(950);
  });
  it("regeneration heals up to max HP", () => {
    const { g, e } = traitGame({ kind: "regen", perSecond: 30 });
    e.hp = 980;
    tickStatus(g, 0.5);
    expect(e.hp).toBe(995);
    tickStatus(g, 1);
    expect(e.hp).toBe(1000);
  });
  it("percent regeneration heals a share of max HP per second", () => {
    const { g, e } = traitGame({ kind: "regen", percent: 0.02 });
    e.hp = 900;
    tickStatus(g, 1);
    expect(e.hp).toBe(920);
  });
  it("splitting releases enemies behind the dead one, rewards are paid once", () => {
    const { g, e } = traitGame({ kind: "splitOnDeath", type: "runner", count: 2 }, makeEnemy(1, "drone", 0, 3, 4));
    g.state.wave = 1;
    const gold = g.state.wallets[0];
    applyDamage(g, src, e, 5000);
    expect(g.state.wallets[0] - gold).toBe(ENEMIES.drone.reward);
    const spawned = g.state.enemies.filter((x) => x.type === "runner");
    expect(spawned.map((x) => x.distance)).toEqual([4, 3.85]);
    expect(spawned[0].hp).toBe(ENEMIES.runner.hp);
  });
  it("slow immunity ignores Kryo", () => {
    const { g, e } = traitGame({ kind: "slowImmune" });
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 5 });
    expect(e.status).toEqual([]);
  });
  it("unstoppable enemies ignore slows and stuns", () => {
    const { g, e } = traitGame({ kind: "unstoppable" });
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 5 });
    applyStatus(g, e, { kind: "stun", release: 1, until: 3 });
    expect(e.status).toEqual([]);
  });
  it("a shield absorbs hits before HP and recharges after a quiet spell", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "shield", capacity: 0.5, delay: 2 })),
      e = createEnemy(g, "drone"),
      hp = ENEMIES.drone.hp,
      cap = hp * 0.5;
    expect(e.shield).toBe(cap);
    applyDamage(g, src, e, 20);
    expect([e.hp, e.shield]).toEqual([hp, cap - 20]);
    applyDamage(g, src, e, 20);
    expect([e.hp, e.shield]).toEqual([hp - (40 - cap), 0]);
    g.state.time = 1.9;
    tickStatus(g, 0);
    expect(e.shield).toBe(0);
    g.state.time = 2;
    tickStatus(g, 0);
    expect(e.shield).toBe(cap);
  });
  it("sprint triggers once when a hit drops HP below the threshold", () => {
    const { g, e } = traitGame({ kind: "sprint", threshold: 0.5, factor: 1.6, duration: 2 });
    applyDamage(g, src, e, 400);
    expect(traitSpeedFactor(g, e)).toBe(1);
    applyDamage(g, src, e, 200);
    expect(traitSpeedFactor(g, e)).toBe(1.6);
    g.state.time = 2;
    applyDamage(g, src, e, 100);
    expect(traitSpeedFactor(g, e)).toBe(1);
  });
  it("evasion dodges every n-th hit, burning always lands and does not count", () => {
    const { g, e } = traitGame({ kind: "evade", every: 3 });
    applyDamage(g, src, e, 100);
    applyDamage(g, src, e, 100);
    applyDamage(g, src, e, 10, true);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(790);
    expect(g.state.events.filter((x) => x.type === "evade")).toHaveLength(1);
  });
  it("a healer heals other enemies in its radius, not itself", () => {
    const {
      g,
      enemies: [healer, near, far],
    } = traitGame({ kind: "healer", radius: 2, percent: 0.1 }, makeEnemy(1, "drone", 0, 3), makeEnemy(2, "runner", 1, 3), makeEnemy(3, "runner", 5, 3));
    for (const e of [healer, near, far]) e.hp = 500;
    tickStatus(g, 1);
    expect([healer.hp, near.hp, far.hp]).toEqual([500, 600, 500]);
  });
  it("a leader speeds up and shields others nearby; leaders do not stack", () => {
    const leader = makeEnemy(1, "drone", 0, 3),
      second = makeEnemy(2, "drone", 0.5, 3),
      follower = makeEnemy(3, "runner", 1, 3),
      { g } = traitGame({ kind: "leader", radius: 2, speed: 0.2, resist: 0.15 }, leader, follower);
    expect(traitSpeedFactor(g, leader)).toBe(1);
    expect(traitSpeedFactor(g, follower)).toBe(1.2);
    applyDamage(g, src, follower, 100);
    expect(follower.hp).toBe(915);
    g.state.enemies = [leader, second, follower];
    expect(traitSpeedFactor(g, follower)).toBe(1.2);
    // Each leader is buffed by the other one, never by itself.
    expect(traitSpeedFactor(g, leader)).toBe(1.2);
  });
  it("swift enemies are faster but have less HP", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "swift", speed: 0.5, hp: 0.2 })),
      e = createEnemy(g, "drone");
    expect(e.hp).toBe(Math.round(ENEMIES.drone.hp * 0.8));
    expect(traitSpeedFactor(g, e)).toBe(1.5);
  });
});

describe("extending content without touching systems, render or UI", () => {
  it("a new armored enemy and a new tower on an existing attack module play a full mission", () => {
    const juggernaut: EnemyDefinition = {
      ...ENEMIES.tank,
      id: "juggernaut",
      name: "Koloss",
      traits: [{ kind: "armor", reduction: 0.3 }, { kind: "slowImmune" }],
      visual: { shape: "polygon", sides: 6 },
    };
    const sniper = {
      ...TOWERS.pulse,
      id: "sniper",
      name: "Scout",
      range: 5,
      interval: 1.2,
      damage: 60,
      visual: { ...TOWERS.pulse.visual, icon: "⊕" },
    };
    const base = DEFAULT_CONTENT.missions[0];
    const content = {
      towers: { ...TOWERS, sniper },
      enemies: { ...ENEMIES, juggernaut },
      missions: [
        {
          ...base,
          id: "probe",
          availableTowers: ["sniper", "frost"],
          waves: [{ bonus: 10, groups: [{ type: "juggernaut", count: 2, interval: 2, delay: 0 }] }],
        },
      ],
    } as unknown as ContentPack;
    const g = new Game(undefined, content);
    g.state.wallets[0] = 1000;
    expect(g.command({ type: "build", tower: "pulse", x: 4, y: 4 }).code).toBe("tower-unavailable");
    expect(g.command({ type: "build", tower: "sniper" as never, x: 4, y: 4 }).ok).toBe(true);
    expect(g.command({ type: "build", tower: "sniper" as never, x: 6, y: 5 }).ok).toBe(true);
    g.command({ type: "start" });
    finishWave(g);
    expect(g.state.status).toBe("won");
    expect(g.state.kills).toBe(2);
  });
});

describe("marker flags", () => {
  it("traitFlags reports armor, split and slowImmune, and stays neutral without traits", () => {
    const { g, e } = traitGame([{ kind: "armor", reduction: 0.3 }, { kind: "splitOnDeath", type: "runner", count: 2 }, { kind: "slowImmune" }]);
    expect(traitFlags(g, e)).toMatchObject({ armor: true, split: true, slowImmune: true });
    // A wounded drone far along the path: no rage, momentum or dampen without the traits.
    const plain = makeEnemy(2, "drone", 0, 3, 10);
    plain.hp = 1;
    expect(traitFlags(new Game(), plain)).toMatchObject({ armor: false, split: false, slowImmune: false, rage: 0, momentum: 0, dampen: 0 });
  });
});

describe("burrow", () => {
  const burrowing = () => new Game(undefined, withDroneTraits({ kind: "burrow", every: 3, length: 1.2 }));
  it("is underground in the last `length` cells of each cycle, so towers cannot pick it", () => {
    const g = burrowing();
    const under = makeEnemy(1, "drone", 0, 3, 5.0), up = makeEnemy(2, "drone", 0, 3, 4.5);
    expect(isBurrowed(g, under)).toBe(true);
    expect(isHidden(g, under)).toBe(true);
    expect(canAcquire(g, "pulse", under)).toBe(false);
    expect(canTarget(g, "pulse", under)).toBe(true);
    expect(isBurrowed(g, up)).toBe(false);
    expect(canAcquire(g, "pulse", up)).toBe(true);
    expect(traitFlags(g, under).burrowed).toBe(true);
  });
  it("starts on the surface and resurfaces when pulled back", () => {
    const g = burrowing(), e = makeEnemy(1, "drone", 0, 3, 0);
    expect(isBurrowed(g, e)).toBe(false);
    e.distance = 2.5;
    expect(isBurrowed(g, e)).toBe(true);
    e.distance = 1.5;
    expect(isBurrowed(g, e)).toBe(false);
  });
  it("a detector does not reveal it", () => {
    const g = burrowing();
    g.state.wallets[0] = 1000;
    expect(g.command({ type: "build", tower: "detector", x: 7, y: 5 }).ok).toBe(true);
    const e = makeEnemy(1, "drone", 7, 6, 5);
    g.state.enemies = [e];
    updateDetection(g);
    expect(isHidden(g, e)).toBe(true);
  });
});

describe("harden", () => {
  /** Hits a drone at `hpShare` of its HP for 100; returns the damage taken and the flags before the hit. */
  const hit = (hpShare: number, dot = false) => {
    const { g, e } = traitGame({ kind: "harden", max: 0.6 });
    e.hp = e.maxHp * hpShare;
    const before = e.hp,
      flags = traitFlags(g, e);
    applyDamage(g, src, e, 100, dot);
    return { taken: before - e.hp, flags };
  };
  it("reduces hits and burns the more HP is lost, and reports the reduction", () => {
    expect(hit(1).taken).toBeCloseTo(100);
    expect(hit(0.5).taken).toBeCloseTo(70);
    expect(hit(0.1).taken).toBeCloseTo(46);
    expect(hit(0.5, true).taken).toBeCloseTo(70);
    expect(hit(1).flags.harden).toBe(0);
    expect(hit(0.5).flags.harden).toBeCloseTo(0.3);
  });
});

describe("surge", () => {
  it("starts at normal speed and bursts only in the last `length` cells of each cycle", () => {
    const { g, e } = traitGame({ kind: "surge", every: 4, length: 1, factor: 2.2 }, makeEnemy(1, "drone", 0, 3, 0));
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).surging).toBe(false);
    e.distance = 2.9;
    expect(traitSpeedFactor(g, e)).toBe(1);
    e.distance = 3;
    expect(traitSpeedFactor(g, e)).toBe(2.2);
    expect(traitFlags(g, e).surging).toBe(true);
    e.distance = 3.99;
    expect(traitSpeedFactor(g, e)).toBe(2.2);
    e.distance = 4;
    expect(traitSpeedFactor(g, e)).toBe(1);
    e.distance = 7.5;
    expect(traitSpeedFactor(g, e)).toBe(2.2);
  });
});

describe("swarm", () => {
  const SWARM: Trait = { kind: "swarm", radius: 1, per: 0.1, max: 0.5 };
  /** A swarm of `n` extra drones next to the target; returns the damage that landed on the target. */
  const hitWith = (n: number, burn = false) => {
    const { g, e } = traitGame(SWARM, makeEnemy(1, "drone", 5, 5));
    for (let i = 0; i < n; i++) g.state.enemies.push(makeEnemy(2 + i, "drone", 5 + 0.05 * i, 5));
    applyDamage(g, src, e, 100, burn);
    return { taken: 1000 - e.hp, flags: traitFlags(g, e) };
  };
  it("takes full damage alone, 10 % less per neighbour, burns included, capped", () => {
    expect(hitWith(0).taken).toBeCloseTo(100);
    expect(hitWith(1).taken).toBeCloseTo(90);
    expect(hitWith(3).taken).toBeCloseTo(70);
    expect(hitWith(2, true).taken).toBeCloseTo(80);
    expect(hitWith(5).taken).toBeCloseTo(50);
    expect(hitWith(9).taken).toBeCloseTo(50);
    expect(hitWith(9).flags.swarm).toBeCloseTo(0.5);
  });
  it("ignores other types, dead enemies and far ones", () => {
    const dead = makeEnemy(3, "drone", 5, 5),
      { g, e } = traitGame(SWARM, makeEnemy(1, "drone", 5, 5), makeEnemy(2, "runner", 5, 5), dead, makeEnemy(4, "drone", 7, 5));
    dead.hp = 0;
    expect(traitFlags(g, e).swarm).toBe(0);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBeCloseTo(900);
  });
});

describe("rage", () => {
  it("is faster the more HP is missing", () => {
    const { g, e } = traitGame({ kind: "rage", max: 1 });
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).rage).toBe(0);
    e.hp = e.maxHp / 2;
    expect(traitSpeedFactor(g, e)).toBeCloseTo(1.5);
    expect(traitFlags(g, e).rage).toBeCloseTo(0.5);
    e.hp = 0;
    expect(traitSpeedFactor(g, e)).toBeCloseTo(2);
  });
});

describe("facet", () => {
  const hitAt = (time: number, dot = false) => {
    const { g, e } = traitGame({ kind: "facet", every: 4, length: 2, reduction: 0.7 }, makeEnemy(1, "drone", 5, 5));
    g.state.time = time;
    applyDamage(g, src, e, 100, dot);
    return { taken: 1000 - e.hp, flags: traitFlags(g, e) };
  };
  it("reduces hits only in the last `length` seconds of each cycle", () => {
    expect(hitAt(0).taken).toBeCloseTo(100);
    expect(hitAt(1.99).taken).toBeCloseTo(100);
    expect(hitAt(2).taken).toBeCloseTo(30);
    expect(hitAt(3.99).taken).toBeCloseTo(30);
    expect(hitAt(4).taken).toBeCloseTo(100);
    expect(hitAt(6.5).taken).toBeCloseTo(30);
  });
  it("lets dot ticks pass unchanged and reports the flag", () => {
    expect(hitAt(3, true).taken).toBeCloseTo(100);
    expect(hitAt(3).flags.faceted).toBe(true);
    expect(hitAt(1).flags.faceted).toBe(false);
  });
});

describe("leap", () => {
  const leaping = () => new Game(undefined, withDroneTraits({ kind: "leap", every: 4, length: 1.5 }));
  it("flips the layer in the last `length` cells of each cycle", () => {
    const g = leaping(),
      at = (d: number) => layerOf(g, makeEnemy(1, "drone", 0, 3, d));
    expect(at(0)).toBe("ground");
    expect(at(2.49)).toBe("ground");
    expect(at(2.5)).toBe("air");
    expect(at(3.99)).toBe("air");
    expect(at(4)).toBe("ground");
    expect(at(6.6)).toBe("air");
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 3, 3)).leaping).toBe(true);
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 3, 1)).leaping).toBe(false);
  });
  it("makes ground-only towers and traps miss a leaping ground enemy, air-only towers hit it", () => {
    const g = leaping(),
      up = makeEnemy(1, "drone", 0, 3, 3),
      down = makeEnemy(2, "drone", 0, 3, 1);
    expect(canTarget(g, "blast", up)).toBe(false);
    expect(canTarget(g, "spikes", up)).toBe(false);
    expect(canTarget(g, "flak", up)).toBe(true);
    expect(canTarget(g, "blast", down)).toBe(true);
    expect(canTarget(g, "spikes", down)).toBe(true);
    expect(canTarget(g, "flak", down)).toBe(false);
  });
  it("flips an air enemy to the ground", () => {
    const g = new Game(undefined, { ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, layer: "air", traits: [{ kind: "leap", every: 4, length: 1.5 }] } } });
    const up = makeEnemy(1, "drone", 0, 3, 1),
      down = makeEnemy(2, "drone", 0, 3, 3);
    expect(canTarget(g, "flak", up)).toBe(true);
    expect(canTarget(g, "blast", up)).toBe(false);
    expect(canTarget(g, "blast", down)).toBe(true);
    expect(canTarget(g, "flak", down)).toBe(false);
  });
  it("keeps the net rule: a netted leaping ground enemy is hit by ground towers", () => {
    const g = leaping(),
      up = makeEnemy(1, "drone", 0, 3, 3);
    expect(canTarget(g, "blast", up)).toBe(false);
    applyStatus(g, up, { kind: "netted", factor: 0.5, until: 5 });
    expect(canTarget(g, "blast", up)).toBe(true);
  });
});

describe("dampen", () => {
  const DAMPEN: Trait = { kind: "dampen", radius: 1.5 };
  const effects = [
    { kind: "slow", factor: 0.5, until: 5 },
    { kind: "stun", release: 0, until: 5 },
    { kind: "pull", factor: -1, release: 0, until: 5 },
  ] as const;
  it("makes itself immune to slow, stun and pull, and reports its radius", () => {
    const { g, e } = traitGame(DAMPEN);
    for (const fx of effects) applyStatus(g, e, { ...fx });
    expect(e.status).toEqual([]);
    expect(traitFlags(g, e).dampen).toBe(1.5);
  });
  it("covers enemies of any type within the radius but not outside", () => {
    const near = makeEnemy(2, "runner", 1.5, 3),
      far = makeEnemy(3, "runner", 1.6, 3),
      { g } = traitGame(DAMPEN, makeEnemy(1, "drone", 0, 3), near, far);
    // The runner has no dampen trait of its own.
    expect(g.content.enemies.runner.traits ?? []).toEqual([]);
    for (const fx of effects) {
      applyStatus(g, near, { ...fx });
      applyStatus(g, far, { ...fx });
    }
    expect(near.status).toEqual([]);
    expect(far.status.map((s) => s.kind).sort()).toEqual(["pull", "slow", "stun"]);
  });
  it("lets other statuses through, and stops when the dampener is dead or disrupted", () => {
    const near = makeEnemy(2, "runner", 1, 3),
      { g, e: d } = traitGame(DAMPEN, makeEnemy(1, "drone", 0, 3), near);
    applyStatus(g, near, { kind: "vulnerable", factor: 1.3, until: 5 } as never);
    expect(near.status).toHaveLength(1);
    near.status = [];
    applyStatus(g, d, { kind: "disrupted", until: 5 });
    d.status = [{ kind: "disrupted", until: 5 }];
    applyStatus(g, near, { kind: "slow", factor: 0.5, until: 5 });
    expect(near.status.map((s) => s.kind)).toEqual(["slow"]);
    d.status = [];
    near.status = [];
    d.hp = 0;
    applyStatus(g, near, { kind: "slow", factor: 0.5, until: 5 });
    expect(near.status).toHaveLength(1);
  });
});

describe("brood", () => {
  const brooding = (max = 2) => new Game(undefined, withDroneTraits({ kind: "brood", type: "runner", every: 2, max }));
  const eggs = (g: Game) => g.state.enemies.filter((e) => e.type === "runner");
  it("lays one egg per `every` cells up to `max`, at its own distance", () => {
    const g = brooding(),
      e = createEnemy(g, "drone", 0);
    expect(e.brood).toBe(0);
    tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(0);
    e.distance = 2;
    tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(1);
    expect(eggs(g)[0].distance).toBe(2);
    expect(e.brood).toBe(1);
    e.distance = 9;
    for (let i = 0; i < 5; i++) tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(2);
    expect(e.brood).toBe(2);
    expect(traitFlags(g, e).brood).toBe(0);
  });
  it("never re-lays after being pulled back, and does not tick the new egg in its own tick", () => {
    const g = brooding(3),
      e = createEnemy(g, "drone", 4);
    tickTraits(g, 1 / 30);
    expect(e.brood).toBe(1);
    e.distance = 0.5;
    tickTraits(g, 1 / 30);
    e.distance = 3;
    tickTraits(g, 1 / 30);
    expect(e.brood).toBe(1);
    expect(eggs(g)).toHaveLength(1);
    e.distance = 4;
    tickTraits(g, 1 / 30);
    expect(e.brood).toBe(2);
  });
  it("lays at most one egg per tick and not while disrupted", () => {
    const g = brooding(5),
      e = createEnemy(g, "drone", 0);
    e.status = [{ kind: "disrupted", until: 5 }];
    e.distance = 8;
    tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(0);
    e.status = [];
    tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(1);
    tickTraits(g, 1 / 30);
    expect(eggs(g)).toHaveLength(2);
  });
  it("passes sentBy on and exposes progress", () => {
    const g = brooding(),
      e = createEnemy(g, "drone", 0);
    e.sentBy = 1;
    e.distance = 2.5;
    tickTraits(g, 1 / 30);
    expect(eggs(g)[0].sentBy).toBe(1);
    expect(traitFlags(g, e).brood).toBeCloseTo(0.25);
  });
  it("keeps the state hash of enemies without the trait unchanged", () => {
    const plain = new Game(),
      e = createEnemy(plain, "drone", 3);
    expect(e.brood).toBeUndefined();
    const before = stateHash(plain.state);
    e.brood = 0;
    expect(stateHash(plain.state)).not.toBe(before);
    delete e.brood;
    expect(stateHash(plain.state)).toBe(before);
  });
});

describe("overload", () => {
  const OVERLOAD: Trait = { kind: "overload", radius: 2, cycles: 3 };
  it("stalls attack towers in the radius only, with an event", () => {
    const { g, e } = traitGame(OVERLOAD, makeEnemy(1, "drone", 5, 5));
    g.state.towers = [towerAt(1, "pulse", 6, 5), towerAt(2, "pulse", 9, 5), towerAt(3, "aura", 5, 6), towerAt(4, "mine", 5, 4), towerAt(5, "pulse", 5, 7)];
    g.state.towers[4].cooldown = 5;
    applyDamage(g, src, e, 5000);
    expect(g.state.towers.map((t) => t.cooldown)).toEqual([3, 0, 0, 0, 5]);
    expect(g.state.events).toContainEqual({ type: "overload", at: { x: 5, y: 5 }, radius: 2 });
  });
  it("also fires when disrupted, and is flagged", () => {
    const { g, e } = traitGame(OVERLOAD, makeEnemy(1, "drone", 5, 5));
    e.status = [{ kind: "disrupted", until: 99 }];
    g.state.towers = [towerAt(1, "pulse", 6, 5)];
    applyDamage(g, src, e, 5000);
    expect(g.state.towers[0].cooldown).toBe(3);
    expect(traitFlags(g, makeEnemy(2, "drone", 0, 0)).overload).toBe(true);
  });
});

describe("molt", () => {
  const MOLT: Trait = { kind: "molt", threshold: 0.5, armor: 0.6, speed: 1.8 };
  it("reduces all damage while hp share is at or above the threshold", () => {
    const { g, e } = traitGame(MOLT);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBeCloseTo(960);
    applyDamage(g, src, e, 100, true);
    expect(e.hp).toBeCloseTo(920);
    expect(traitFlags(g, e).molt).toBe("plated");
    e.hp = 500;
    applyDamage(g, src, e, 100);
    expect(e.hp).toBeCloseTo(460);
  });
  it("is fast only below the threshold", () => {
    const { g, e } = traitGame(MOLT);
    e.hp = 500;
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).molt).toBe("plated");
    e.hp = 499;
    expect(traitSpeedFactor(g, e)).toBe(1.8);
    expect(traitFlags(g, e).molt).toBe("shed");
    expect(traitFlags(new Game(), e).molt).toBeUndefined();
  });
});

describe("momentum", () => {
  const swift = () => new Game(undefined, withDroneTraits({ kind: "momentum", per: 0.03, max: 0.9 }));
  it("speeds up with the distance walked, is capped and flags the bonus", () => {
    const g = swift();
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 0))).toBe(1);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 10))).toBeCloseTo(1.3);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 30))).toBeCloseTo(1.9);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 500))).toBeCloseTo(1.9);
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 0, 10)).momentum).toBeCloseTo(0.3);
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 0, 99)).momentum).toBeCloseTo(0.9);
  });
  it("gives factor 1 at a negative distance (pulled back on a ring)", () => {
    const g = swift(),
      e = makeEnemy(1, "drone", 0, 0, -4);
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).momentum).toBe(0);
  });
  it("is not disrupted by a Jammer", () => {
    const g = swift(),
      e = makeEnemy(1, "drone", 0, 0, 10);
    applyStatus(g, e, { kind: "disrupted", until: 99 });
    expect(traitSpeedFactor(g, e)).toBeCloseTo(1.3);
  });
});

describe("lap", () => {
  const RING = parseMap("lapring", "Lapring", ["........", ".S====..", ".=...=..", ".=...=..", ".=====..", "........"]);
  const content = withDroneTraits({ kind: "lap", per: 0.15, max: 0.6 });
  const ringGame = () =>
    new Game(
      { id: "lapring", name: "Lapring", focus: "", map: RING, waves: [wave(10, group("drone", 1, 1))], startingCredits: 100, reactorEnergy: 20, circle: { interval: 10, limit: 5, earlyBonus: 2 } },
      content,
    );
  /** Damage that lands on a drone at `distance` after a 100 hit. */
  const landed = (game: Game, distance: number) => {
    const e = makeEnemy(1, "drone", 0, 0, distance);
    game.state.enemies = [e];
    applyDamage(game, src, e, 100);
    return { dealt: 1000 - e.hp, flags: traitFlags(game, e) };
  };
  it("always has 0 laps on a reactor map", () => {
    const r = landed(new Game(undefined, content), 500);
    expect(r.dealt).toBeCloseTo(100);
    expect(r.flags.laps).toBe(0);
  });
  it("counts a lap exactly at path.length on a ring", () => {
    const g = ringGame(),
      n = RING.path.length;
    expect(landed(g, n - 0.01)).toMatchObject({ flags: { laps: 0 } });
    expect(landed(g, n - 0.01).dealt).toBeCloseTo(100);
    expect(landed(g, n).flags.laps).toBe(1);
    expect(landed(g, n).dealt).toBeCloseTo(85);
    expect(landed(g, 2 * n).dealt).toBeCloseTo(70);
  });
  it("caps the reduction at max", () => {
    const g = ringGame(),
      n = RING.path.length;
    expect(landed(g, 4 * n).dealt).toBeCloseTo(40);
    expect(landed(g, 9 * n).dealt).toBeCloseTo(40);
    expect(landed(g, 9 * n).flags.laps).toBe(9);
  });
  it("has 0 laps at a negative distance", () => {
    const g = ringGame();
    expect(landed(g, -3).flags.laps).toBe(0);
    expect(landed(g, -3).dealt).toBeCloseTo(100);
  });
});

const INSTANT_KINDS: AttackKind[] = ["chain", "pierce", "focus", "quake", "pull", "disrupt"];
const AREA_KINDS: AttackKind[] = ["splash", "mortar", "quake", "charge"];
const ALL_KINDS: AttackKind[] = ["direct", "slow", "chain", "pierce", "burn", "stun", "corrode", "decay", "focus", "quake", "execute", "volley", "bleed", "charge", "pit", "alarm", "mortar", "disrupt", "net", "pull", "splash"];
/** Damage lost to a 100-point hit of this kind on the enemy (hp starts at 1000). */
const lost = (g: Game, kind: AttackKind) => {
  const e = makeEnemy(9, "drone", 0, 3);
  g.state.enemies = [e];
  applyDamage(g, src, e, 100, false, hitOf(kind, src));
  return 1000 - e.hp;
};

describe("hit context", () => {
  it("does not change damage without trait", () => {
    const g = new Game();
    for (const k of ALL_KINDS) expect(lost(g, k)).toBe(100);
  });
});

describe("refract", () => {
  const REFRACT: Trait = { kind: "refract", factor: 0.5 };
  it("scales instant hits only", () => {
    const { g } = traitGame(REFRACT);
    for (const k of ALL_KINDS) expect(lost(g, k)).toBe(INSTANT_KINDS.includes(k) ? 50 : 100);
    const e = makeEnemy(1, "drone", 0, 3);
    applyDamage(g, src, e, 100, true);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(800);
  });
  it("is not disruptable", () => {
    const { g, e } = traitGame(REFRACT);
    e.status = [{ kind: "disrupted", until: 9 }];
    applyDamage(g, src, e, 100, false, hitOf("chain", src));
    expect(e.hp).toBe(950);
  });
});

describe("blastproof", () => {
  it("cuts area hits only, including the Nova centre", () => {
    const { g } = traitGame({ kind: "blastproof", reduction: 0.6 });
    for (const k of ALL_KINDS) expect(lost(g, k)).toBeCloseTo(AREA_KINDS.includes(k) ? 40 : 100);
    const e = makeEnemy(1, "drone", 2, 2);
    g.state.enemies = [e];
    blast(g, { tower: 0, type: "blast" }, { x: 2, y: 2 }, 1, 100, "splash");
    expect(e.hp).toBeCloseTo(960);
    blast(g, { tower: 0, type: "mortar" }, { x: 2, y: 2 }, 1, 100, "mortar");
    expect(e.hp).toBeCloseTo(920);
  });
});

describe("insulated", () => {
  const tesla = DEFAULT_CONTENT.towers.tesla.attack;
  const falloff = tesla.kind === "chain" ? tesla.falloff : NaN;
  const fire = (g: Game, e: Enemy) => attackModule(tesla)!.apply(g, { tower: 0, type: "tesla" }, { enemy: e, at: { x: e.x, y: e.y } }, 100, tesla);
  it("is never a jump target and the chain continues past it", () => {
    const g = new Game(undefined, duo([], [{ kind: "insulated" }])),
      a = makeEnemy(1, "drone", 0, 3),
      b = makeEnemy(2, "runner", 0.5, 3),
      c = makeEnemy(3, "drone", 1.5, 3);
    g.state.enemies = [a, b, c];
    fire(g, a);
    expect([a.hp, b.hp, c.hp]).toEqual([900, 1000, 1000 - 100 * falloff]);
  });
  it("as primary target takes the hit and stops the chain", () => {
    const g = new Game(undefined, duo([], [{ kind: "insulated" }])),
      a = makeEnemy(1, "drone", 0, 3),
      b = makeEnemy(2, "runner", 0.5, 3);
    g.state.enemies = [a, b];
    fire(g, b);
    expect([a.hp, b.hp]).toEqual([1000, 900]);
  });
});

describe("heatshield", () => {
  it("blocks burn and bleeding but not slow", () => {
    const { g, e } = traitGame({ kind: "heatshield" }),
      who = { tower: 0, type: "pulse" as const };
    applyStatus(g, e, { kind: "burn", dps: 10, next: 0, until: 5, source: who });
    applyStatus(g, e, { kind: "bleeding", perCell: 5, last: 0, next: 0, until: 5, source: who });
    expect(e.status).toEqual([]);
    applyStatus(g, e, { kind: "slow", factor: 0.5, until: 5 });
    expect(e.status).toHaveLength(1);
  });
});

describe("mirror", () => {
  const MIRROR: Trait = { kind: "mirror", cap: 0.1 };
  it("caps a single hit at cap x maxHp after other reductions", () => {
    const { g, e } = traitGame(MIRROR);
    applyDamage(g, src, e, 500);
    expect(e.hp).toBe(900);
    applyDamage(g, src, e, 50);
    expect(e.hp).toBe(850);
    const { g: h, e: f } = traitGame([{ kind: "armor", reduction: 0.5 }, MIRROR]);
    applyDamage(h, src, f, 400);
    expect(f.hp).toBe(900);
    applyDamage(h, src, f, 100);
    expect(f.hp).toBe(850);
  });
  it("still dies to a pit and ignores the cap on a Henker execution", () => {
    const {
      g,
      enemies: [e, f],
    } = traitGame(MIRROR, makeEnemy(1, "drone", 0, 3), makeEnemy(2, "drone", 0, 3));
    applyDamage(g, src, e, Infinity, false, hitOf("pit", src));
    expect(e.hp).toBeLessThanOrEqual(0);
    applyDamage(g, src, f, 500, false, hitOf("execute", src, { execution: true }));
    expect(f.hp).toBe(500);
    applyDamage(g, src, f, 500, false, hitOf("execute", src, { execution: false }));
    expect(f.hp).toBe(400);
  });
});

describe("link", () => {
  /** Drones 3, 1 and 2 linked in radius, drone 4 far away, runner 5 among them. */
  const linked = () =>
    traitGame({ kind: "link", radius: 1.6 }, makeEnemy(3, "drone", 0, 3), makeEnemy(1, "drone", 0.5, 3), makeEnemy(2, "drone", 1, 3), makeEnemy(4, "drone", 5, 3), makeEnemy(5, "runner", 0.2, 3));
  it("splits among same-type enemies in radius in id order without recursion", () => {
    const {
      g,
      enemies: [a, b, c, far, other],
    } = linked();
    applyDamage(g, src, a, 300);
    expect([a.hp, b.hp, c.hp, far.hp, other.hp]).toEqual([900, 900, 900, 1000, 1000]);
    const order = g.state.events.filter((e) => e.type === "damage").map((e) => (e as { enemy: number }).enemy);
    expect(order).toEqual([1, 2, 3]);
  });
  it("splits dots too, and gives the kill reward per dead member", () => {
    const {
      g,
      enemies: [a, b, c],
    } = linked();
    applyDamage(g, src, a, 300, true);
    expect([a.hp, b.hp, c.hp]).toEqual([900, 900, 900]);
    a.hp = b.hp = 100;
    c.hp = 5000;
    const kills = g.state.kills;
    applyDamage(g, src, c, 600);
    expect(g.state.kills).toBe(kills + 2);
  });
  it("does not split an infinite hit and stops when disrupted", () => {
    const {
      g,
      enemies: [a, b, c],
    } = linked();
    applyDamage(g, src, a, Infinity, false, hitOf("pit", src));
    expect([a.hp <= 0, b.hp, c.hp]).toEqual([true, 1000, 1000]);
    const {
      g: h,
      enemies: [d, e2],
    } = linked();
    d.status = [{ kind: "disrupted", until: 9 }];
    applyDamage(h, src, d, 300);
    expect([d.hp, e2.hp]).toEqual([700, 1000]);
  });
});

describe("taunt", () => {
  const taunting = () => {
      const g = new Game(undefined, duo([{ kind: "taunt", radius: 2 }])),
        tower = towerAt(1, "pulse", 5, 5);
      g.state.towers = [tower];
      return { g, tower };
    },
    shotAt = (g: Game) => g.state.events.filter((e) => e.type === "shot").map((e) => (e as { to: { x: number; y: number } }).to);
  it("forces the target only inside the taunter's radius", () => {
    const { g, tower } = taunting(),
      runner = makeEnemy(1, "runner", 6, 5, 20),
      near = makeEnemy(2, "drone", 5, 6.5, 5);
    g.state.enemies = [runner, near];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 5, y: 6.5 }]);
    // Out of the taunt radius (2.3 > 2) but still in the tower's range.
    near.x = 5;
    near.y = 7.3;
    tower.cooldown = 0;
    g.state.events = [];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 6, y: 5 }]);
  });
  it("is ignored when disrupted, and picks by priority among taunters", () => {
    const { g, tower } = taunting(),
      runner = makeEnemy(1, "runner", 6, 5, 20),
      t1 = makeEnemy(2, "drone", 5, 6.5, 5),
      t2 = makeEnemy(3, "drone", 4, 5, 7);
    g.state.enemies = [runner, t1, t2];
    t1.status = [{ kind: "disrupted", until: 9 }];
    t2.status = [{ kind: "disrupted", until: 9 }];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 6, y: 5 }]);
    t1.status = [];
    t2.status = [];
    tower.cooldown = 0;
    g.state.events = [];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 4, y: 5 }]);
  });
  it("leaves volley extras to the full candidate list", () => {
    const { g } = taunting();
    g.state.towers = [towerAt(1, "shrapnel", 5, 5)];
    g.state.enemies = [makeEnemy(1, "runner", 6, 5, 20), makeEnemy(2, "drone", 5, 6.5, 5)];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 5, y: 6.5 }, { x: 6, y: 5 }]);
  });
  it("never forces traps and not support towers", () => {
    const { g } = taunting();
    g.state.towers = [towerAt(1, "tar", 5, 5)];
    g.state.enemies = [makeEnemy(1, "runner", 5, 5.2, 20), makeEnemy(2, "drone", 5, 5.3, 5)];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 5, y: 5.2 }]);
  });
});

describe("martyr", () => {
  const martyrs = () => new Game(undefined, duo([{ kind: "martyr", radius: 1.8, heal: 0.25 }]));
  it("heals living neighbours in radius on death, capped at max HP", () => {
    const g = martyrs(),
      m = makeEnemy(1, "drone", 0, 3),
      near = makeEnemy(2, "runner", 1, 3),
      full = makeEnemy(3, "runner", 1.5, 3),
      far = makeEnemy(4, "runner", 4, 3);
    near.hp = 400;
    full.hp = 900;
    far.hp = 400;
    g.state.enemies = [m, near, full, far];
    applyDamage(g, src, m, 5000);
    expect([near.hp, full.hp, far.hp]).toEqual([650, 1000, 400]);
  });
  it("does nothing when disrupted", () => {
    const g = martyrs(),
      m = makeEnemy(1, "drone", 0, 3),
      near = makeEnemy(2, "runner", 1, 3);
    near.hp = 400;
    m.status = [{ kind: "disrupted", until: 9 }];
    g.state.enemies = [m, near];
    applyDamage(g, src, m, 5000);
    expect(near.hp).toBe(400);
  });
});

describe("cloakField", () => {
  const cloaking = () => new Game(undefined, duo([{ kind: "cloakField", radius: 1.6 }]));
  it("hides neighbours but not the carrier, unless revealed", () => {
    const g = cloaking(),
      c = makeEnemy(1, "drone", 0, 3),
      n = makeEnemy(2, "runner", 1, 3),
      far = makeEnemy(3, "runner", 4, 3);
    g.state.enemies = [c, n, far];
    expect(isHidden(g, c)).toBe(false);
    expect(isHidden(g, n)).toBe(true);
    expect(isHidden(g, far)).toBe(false);
    expect(canAcquire(g, "pulse", n)).toBe(false);
    expect(canTarget(g, "pulse", n)).toBe(true);
    n.revealed = true;
    expect(isHidden(g, n)).toBe(false);
  });
  it("is lifted by a disrupted or dead carrier", () => {
    const g = cloaking(),
      c = makeEnemy(1, "drone", 0, 3),
      n = makeEnemy(2, "runner", 1, 3);
    g.state.enemies = [c, n];
    c.status = [{ kind: "disrupted", until: 9 }];
    expect(isHidden(g, n)).toBe(false);
    c.status = [];
    expect(isHidden(g, n)).toBe(true);
    c.hp = 0;
    expect(isHidden(g, n)).toBe(false);
  });
  it("is revealed by a detector in range, which leaves other enemies untouched", () => {
    const g = cloaking(),
      c = makeEnemy(1, "drone", 0, 3),
      n = makeEnemy(2, "runner", 1, 3);
    g.state.enemies = [c, n];
    g.state.towers = [towerAt(1, "detector", 1, 4)];
    updateDetection(g);
    expect(n.revealed).toBe(true);
    expect(isHidden(g, n)).toBe(false);
    const plain = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    plain.state.enemies = [e];
    plain.state.towers = [towerAt(1, "detector", 1, 4)];
    updateDetection(plain);
    expect(e.revealed).toBeUndefined();
  });
  it("counts as stealth for the mission rule", () => {
    const m = { ...MISSIONS[0], waves: [wave(0, group("drone", 1, 1, 0))] };
    expect(hasStealth(m, duo([]))).toBe(false);
    expect(hasStealth(m, duo([{ kind: "cloakField", radius: 1.6 }]))).toBe(true);
  });
});

describe("retaliate", () => {
  const retaliating = () => {
    const { g, e } = traitGame({ kind: "retaliate", radius: 1.8, cycles: 0.5 }, makeEnemy(1, "drone", 5, 5));
    g.state.towers = [towerAt(1, "pulse", 6, 5), towerAt(2, "pulse", 9, 5), towerAt(3, "aura", 5, 6), towerAt(4, "mine", 5, 4)];
    return { g, e };
  };
  const hit = (g: Game, e: Enemy, tower: number, dot = false) => {
    const who = { tower, type: g.state.towers.find((t) => t.id === tower)!.type };
    applyDamage(g, who, e, 10, dot, dot ? undefined : hitOf("direct", who));
  };
  it("slows attack towers in radius only, capped at 1 + cycles", () => {
    const { g, e } = retaliating();
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(0.5);
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(1);
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(1.5);
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(1.5);
    hit(g, e, 2);
    expect(g.state.towers[1].cooldown).toBe(0);
  });
  it("never touches traps or support towers, and ignores dots", () => {
    const { g, e } = retaliating();
    hit(g, e, 3);
    hit(g, e, 4);
    hit(g, e, 1, true);
    expect(g.state.towers.map((t) => t.cooldown)).toEqual([0, 0, 0, 0]);
  });
  it("is off when disrupted", () => {
    const { g, e } = retaliating();
    e.status = [{ kind: "disrupted", until: 9 }];
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(0);
  });
});

describe("pack", () => {
  const packed = () => new Game(undefined, duo([], [{ kind: "pack", radius: 1.5, perAlly: 0.08, max: 0.4 }]));
  it("speeds up per living same-type neighbour, capped, without self or other types", () => {
    const g = packed(),
      a = makeEnemy(1, "runner", 0, 3);
    expect(traitSpeedFactor(g, a)).toBe(1);
    g.state.enemies = [a, makeEnemy(2, "runner", 1, 3), makeEnemy(3, "drone", 0.5, 3), makeEnemy(4, "runner", 9, 3)];
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.08);
    for (let i = 0; i < 8; i++) g.state.enemies.push(makeEnemy(10 + i, "runner", 0.2, 3));
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.4);
    g.state.enemies[1].hp = 0;
    expect(traitFlags(g, a).pack).toBeCloseTo(0.4);
  });
  it("is not disruptable", () => {
    const g = packed(),
      a = makeEnemy(1, "runner", 0, 3);
    g.state.enemies = [a, makeEnemy(2, "runner", 1, 3)];
    a.status = [{ kind: "disrupted", until: 9 }];
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.08);
  });
});

describe("blink", () => {
  const blinking = () => traitGame({ kind: "blink", every: 4, jump: 2 });
  const step = (g: Game, e: Enemy, from: number) => {
    e.distance = from;
    g.state.enemies = [e];
    moveEnemies(g, 1 / 30);
    return e.distance;
  };
  it("jumps once when a forward move crosses a multiple of `every`", () => {
    const { g, e } = blinking();
    const speed = ENEMIES.drone.speed / 30;
    expect(step(g, e, 3.99)).toBeCloseTo(3.99 + speed + 2);
    expect(step(g, e, 1)).toBeCloseTo(1 + speed);
    // Even a jump over the next boundary happens only once per tick.
    expect(step(g, e, 3.99)).toBeLessThan(3.99 + speed + 2.01);
  });
  it("never jumps on a pull-back and respects the stun", () => {
    const { g, e } = blinking();
    e.status = [{ kind: "pull", factor: 1, release: 99, until: 99 }];
    expect(step(g, e, 4.01)).toBeLessThan(4.01);
    e.status = [{ kind: "stun", release: 99, until: 99 }];
    expect(step(g, e, 3.99)).toBe(3.99);
  });
  it("clamps at the reactor so the leak is handled normally", () => {
    const { g } = blinking(),
      last = g.mission.map.path.length - 1,
      lives = g.state.lives;
    // Walking to the reactor: no jump ever carries a leak past the last cell.
    const f = makeEnemy(2, "drone", 0, 3, last - 1);
    g.state.enemies = [f];
    for (let i = 0; i < 60 && f.hp > 0; i++) moveEnemies(g, 1 / 30);
    expect(f.hp).toBe(0);
    expect(g.state.lives).toBeLessThan(lives);
  });
  it("is off when disrupted", () => {
    const { g, e } = blinking();
    e.status = [{ kind: "disrupted", until: 99 }];
    expect(step(g, e, 3.99)).toBeLessThan(4.1);
  });
});

describe("tunnel", () => {
  it("is hidden and faster in the last `length` cells of each cycle, traps still hit", () => {
    const {
      g,
      enemies: [under, up],
    } = traitGame({ kind: "tunnel", every: 5, length: 2, speed: 2 }, makeEnemy(1, "drone", 0, 3, 3.5), makeEnemy(2, "drone", 0, 3, 2.9));
    expect(isHidden(g, under)).toBe(true);
    expect(isHidden(g, up)).toBe(false);
    expect(traitSpeedFactor(g, under)).toBe(2);
    expect(traitSpeedFactor(g, up)).toBe(1);
    expect(canAcquire(g, "pulse", under)).toBe(false);
    expect(canTarget(g, "spikes", under)).toBe(true);
    under.revealed = true;
    expect(isHidden(g, under)).toBe(true);
    expect(traitFlags(g, under)).toMatchObject({ burrowed: true, tunnel: true });
  });
});

describe("phase", () => {
  it("is in the air for the first `air` seconds of each period, and canTarget follows", () => {
    const { g, e } = traitGame({ kind: "phase", period: 3.5, air: 1.5 });
    const at = (time: number) => {
      g.state.time = time;
      return layerOf(g, e);
    };
    expect(at(0)).toBe("air");
    expect(at(1.49)).toBe("air");
    expect(at(1.5)).toBe("ground");
    expect(at(3.49)).toBe("ground");
    expect(at(3.5)).toBe("air");
    g.state.time = 1;
    expect(canTarget(g, "flak", e)).toBe(true);
    expect(canTarget(g, "spikes", e)).toBe(false);
    expect(traitFlags(g, e).phase).toBe("air");
    g.state.time = 2;
    expect(canTarget(g, "flak", e)).toBe(false);
    expect(canTarget(g, "spikes", e)).toBe(true);
  });
});

describe("blind and jam", () => {
  const field = (...carriers: Trait[]) => {
    const g = new Game(undefined, duo(carriers.slice(0, 1), carriers.slice(1)));
    g.state.enemies = [makeEnemy(1, "drone", 5, 5), makeEnemy(2, "runner", 5, 6)];
    g.state.towers = [towerAt(1, "pulse", 6, 5), towerAt(2, "pulse", 12, 5), towerAt(3, "spikes", 5, 5), towerAt(4, "detector", 6, 6)];
    return g;
  };
  const stats = (g: Game, i: number, sim = true) => effectiveTowerStats(g.state.towers[i], g.state.towers, g.content, sim ? g : undefined);
  it("blind cuts range, uses the strongest carrier, spares far towers, traps and support towers", () => {
    const g = field({ kind: "blind", radius: 2.5, range: 0.2 }, { kind: "blind", radius: 2.5, range: 0.3 }),
      plain = new Game();
    const range = stats(g, 0, false).range;
    expect(stats(g, 0).range).toBeCloseTo(range * 0.7);
    expect(stats(g, 1).range).toBe(range);
    expect(stats(g, 2).range).toBe(stats(g, 2, false).range);
    expect(stats(g, 3).range).toBe(stats(g, 3, false).range);
    // Games without carriers are unchanged.
    expect(effectiveTowerStats(towerAt(1, "pulse", 6, 5), [], plain.content, plain).range).toBe(range);
  });
  it("jam slows the interval, strongest wins, interval only", () => {
    const g = field({ kind: "jam", radius: 2, slow: 0.3 }, { kind: "jam", radius: 2, slow: 0.5 }),
      base = stats(g, 0, false);
    expect(stats(g, 0).interval).toBeCloseTo(base.interval * 1.5);
    expect(stats(g, 0).range).toBe(base.range);
    expect(stats(g, 1).interval).toBe(base.interval);
    expect(stats(g, 2).interval).toBe(stats(g, 2, false).interval);
  });
  it("a jammed tower reloads slower in the real tick", () => {
    const g = field({ kind: "jam", radius: 2, slow: 0.5 }),
      t = g.state.towers[0];
    t.cooldown = 1;
    attackEnemies(g, 0.1);
    const jammed = 1 - t.cooldown;
    const plain = new Game();
    plain.state.towers = [towerAt(1, "pulse", 6, 5)];
    plain.state.towers[0].cooldown = 1;
    attackEnemies(plain, 0.1);
    expect(jammed).toBeCloseTo((1 - plain.state.towers[0].cooldown) / 1.5);
  });
  it("are switched off by disruption or death", () => {
    const g = field({ kind: "blind", radius: 2.5, range: 0.3 }, { kind: "jam", radius: 2, slow: 0.5 }),
      base = stats(g, 0, false);
    g.state.enemies[0].status = [{ kind: "disrupted", until: 99 }];
    expect(stats(g, 0).range).toBe(base.range);
    g.state.enemies[1].hp = 0;
    expect(stats(g, 0).interval).toBe(base.interval);
  });
});

describe("defuse", () => {
  const defusing = () => {
    const g = new Game(undefined, duo([{ kind: "defuse", radius: 1.5 }])),
      mine = towerAt(1, "mine", 5, 5),
      far = towerAt(2, "mine", 9, 5);
    g.state.towers = [mine, far, towerAt(3, "pulse", 6, 5)];
    g.state.enemies = [makeEnemy(1, "drone", 5.5, 5), makeEnemy(2, "runner", 5, 5), makeEnemy(3, "runner", 9, 5)];
    return { g, mine, far };
  };
  it("keeps traps in its radius from triggering for every enemy, others fire normally", () => {
    const { g, mine, far } = defusing();
    attackEnemies(g, 1 / 30);
    expect(mine.cooldown).toBe(0);
    expect(g.state.enemies[1].hp).toBe(1000);
    expect(far.cooldown).toBe(1);
    expect(g.state.towers[2].cooldown).toBe(1);
  });
  it("is lifted by disruption or death", () => {
    const { g, mine } = defusing();
    g.state.enemies[0].status = [{ kind: "disrupted", until: 99 }];
    attackEnemies(g, 1 / 30);
    expect(mine.cooldown).toBe(1);
    mine.cooldown = 0;
    g.state.enemies[0].status = [];
    g.state.enemies[0].hp = 0;
    attackEnemies(g, 1 / 30);
    expect(mine.cooldown).toBe(1);
  });
});

describe("suppress", () => {
  const suppressing = () => {
    const g = new Game(undefined, duo([{ kind: "suppress", radius: 2.5 }], [{ kind: "stealth" }])),
      aura = { ...towerAt(1, "aura", 5, 5), upgrades: ["damage"] },
      pulse = towerAt(2, "pulse", 6, 5);
    g.state.towers = [aura, pulse, towerAt(3, "detector", 5, 6), towerAt(4, "beacon", 4, 5), towerAt(5, "tracker", 5, 4), towerAt(6, "dock", 5, 3)];
    const carrier = makeEnemy(1, "drone", 5, 5),
      stealthy = makeEnemy(2, "runner", 5, 7);
    g.state.enemies = [carrier, stealthy];
    g.state.lives = g.mission.reactorEnergy - 5;
    return { g, pulse, carrier, stealthy };
  };
  it("silences aura, detector, beacon and tracker in range", () => {
    const { g, pulse, stealthy } = suppressing();
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).bonuses.damage).toBe(0);
    expect(effectiveTowerStats(pulse, g.state.towers, g.content).bonuses.damage).toBeGreaterThan(0);
    updateDetection(g);
    expect(stealthy.revealed).toBe(false);
    expect(bountyBonus(g, stealthy, 100)).toBe(0);
    expect(markFactor(g, makeEnemy(9, "runner", 5, 5))).toBe(1);
  });
  it("does not silence the repair dock and ignores towers out of range", () => {
    const { g, carrier, stealthy } = suppressing(),
      dock = DEFAULT_CONTENT.towers.dock.attack,
      lives = g.state.lives;
    repairReactor(g);
    expect(g.state.lives).toBe(lives + (dock.kind === "repair" ? dock.amount : NaN));
    carrier.x = 20;
    updateDetection(g);
    expect(stealthy.revealed).toBe(true);
    expect(markFactor(g, makeEnemy(9, "runner", 5, 5))).toBeGreaterThan(1);
    expect(bountyBonus(g, stealthy, 100)).toBeGreaterThan(0);
  });
  it("is off when disrupted or dead", () => {
    const { g, pulse, carrier } = suppressing();
    carrier.status = [{ kind: "disrupted", until: 99 }];
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).bonuses.damage).toBeGreaterThan(0);
    carrier.status = [];
    carrier.hp = 0;
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).bonuses.damage).toBeGreaterThan(0);
  });
});
