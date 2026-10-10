import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMIES } from "../content/enemies";
import { TOWERS } from "../content/towers";
import { Game } from "../core/game";
import { finishWave, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import type { ContentPack, EnemyDefinition, Trait } from "../core/types";
import { applyDamage, hitOf } from "./damage";
import { attackEnemies } from "./combat";
import { blast } from "./attacks/splash";
import { attackModule } from "./attacks";
import { MISSIONS } from "../content/missions";
import { hasStealth } from "../core/mission-checks";
import type { AttackKind } from "../core/types";
import { createEnemy } from "./spawn";
import { applyStatus, speedFactor, tickStatus } from "./status";
import { canAcquire, canTarget } from "./attacks";
import { updateDetection } from "./detection";
import { stateHash } from "../core/hash";
import { parseMap } from "../content/maps";
import { g as group, wave } from "../content/waves";
import type { Tower } from "../core/types";
import { isBurrowed, isHidden, layerOf, tickTraits, traitFlags, traitSpeedFactor } from "./traits";
import { moveEnemies } from "./movement";
import { effectiveTowerStats } from "./auras";
import { bountyBonus, markFactor, repairReactor } from "./support";

/** The shipped content with extra traits on the drone. */
function withDroneTraits(...traits: Trait[]): ContentPack {
  return { ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits } } };
}
const src = { tower: 0, type: "pulse" as const };

describe("slow stacking (B1)", () => {
  it("a weaker slow never overrides a stronger one that is still running", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 2.8 });
    applyStatus(g, e, { kind: "slow", factor: 0.55, until: 1.9 });
    expect(e.status).toEqual([{ kind: "slow", factor: 0.35, until: 2.8 }]);
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 3.5 });
    expect(e.status[0].until).toBe(3.5);
    expect(speedFactor(e, 3)).toBe(0.35);
    expect(speedFactor(e, 3.5)).toBe(1);
  });
  it("after expiry a weaker slow applies again and expired effects are removed", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 1 });
    g.state.time = 1;
    tickStatus(g, 0);
    expect(e.status).toEqual([]);
    applyStatus(g, e, { kind: "slow", factor: 0.55, until: 2 });
    expect(e.status).toEqual([{ kind: "slow", factor: 0.55, until: 2 }]);
  });
});

describe("enemy traits", () => {
  it("armor absorbs a share of every hit", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "armor", reduction: 0.5 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(950);
  });
  it("regeneration heals up to max HP", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "regen", perSecond: 30 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    e.hp = 980;
    tickStatus(g, 0.5);
    expect(e.hp).toBe(995);
    tickStatus(g, 1);
    expect(e.hp).toBe(1000);
  });
  it("splitting releases enemies behind the dead one, rewards are paid once", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "splitOnDeath", type: "runner", count: 2 })),
      e = makeEnemy(1, "drone", 0, 3, 4);
    g.state.enemies = [e];
    g.state.wave = 1;
    const gold = g.state.wallets[0];
    applyDamage(g, src, e, 5000);
    expect(g.state.wallets[0] - gold).toBe(ENEMIES.drone.reward);
    const spawned = g.state.enemies.filter((x) => x.type === "runner");
    expect(spawned.map((x) => x.distance)).toEqual([4, 3.85]);
    expect(spawned[0].hp).toBe(ENEMIES.runner.hp);
  });
  it("slow immunity ignores Kryo", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "slowImmune" })),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 5 });
    expect(e.status).toEqual([]);
  });
  it("malformed traits are rejected with their position", () => {
    expect(() => validateContent(withDroneTraits({ kind: "armor", reduction: 1 }))).toThrow(
      "Gegner drone › Eigenschaft 1: reduction",
    );
    expect(() => validateContent(withDroneTraits({ kind: "splitOnDeath", type: "ghost", count: 1 }))).toThrow(
      "Unbekannter Gegner 'ghost'",
    );
  });
});

describe("new enemy traits", () => {
  it("a shield absorbs hits before HP and recharges after a quiet spell", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "shield", capacity: 0.5, delay: 2 })),
      e = createEnemy(g, "drone");
    expect(e.shield).toBe(27.5);
    applyDamage(g, src, e, 20);
    expect([e.hp, e.shield]).toEqual([55, 7.5]);
    applyDamage(g, src, e, 20);
    expect([e.hp, e.shield]).toEqual([42.5, 0]);
    g.state.time = 1.9;
    tickStatus(g, 0);
    expect(e.shield).toBe(0);
    g.state.time = 2;
    tickStatus(g, 0);
    expect(e.shield).toBe(27.5);
  });
  it("sprint triggers once when a hit drops HP below the threshold", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "sprint", threshold: 0.5, factor: 1.6, duration: 2 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    applyDamage(g, src, e, 400);
    expect(traitSpeedFactor(g, e)).toBe(1);
    applyDamage(g, src, e, 200);
    expect(traitSpeedFactor(g, e)).toBe(1.6);
    g.state.time = 2;
    applyDamage(g, src, e, 100);
    expect(traitSpeedFactor(g, e)).toBe(1);
  });
  it("evasion dodges every n-th hit, burning always lands and does not count", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "evade", every: 3 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    applyDamage(g, src, e, 100);
    applyDamage(g, src, e, 100);
    applyDamage(g, src, e, 10, true);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(790);
    expect(g.state.events.filter((x) => x.type === "evade")).toHaveLength(1);
  });
  it("a healer heals other enemies in its radius, not itself", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "healer", radius: 2, percent: 0.1 })),
      healer = makeEnemy(1, "drone", 0, 3),
      near = makeEnemy(2, "runner", 1, 3),
      far = makeEnemy(3, "runner", 5, 3);
    for (const e of [healer, near, far]) e.hp = 500;
    g.state.enemies = [healer, near, far];
    tickStatus(g, 1);
    expect([healer.hp, near.hp, far.hp]).toEqual([500, 600, 500]);
  });
  it("a leader speeds up and shields others nearby; leaders do not stack", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "leader", radius: 2, speed: 0.2, resist: 0.15 })),
      leader = makeEnemy(1, "drone", 0, 3),
      second = makeEnemy(2, "drone", 0.5, 3),
      follower = makeEnemy(3, "runner", 1, 3);
    g.state.enemies = [leader, follower];
    expect(traitSpeedFactor(g, leader)).toBe(1);
    expect(traitSpeedFactor(g, follower)).toBe(1.2);
    applyDamage(g, src, follower, 100);
    expect(follower.hp).toBe(915);
    g.state.enemies = [leader, second, follower];
    expect(traitSpeedFactor(g, follower)).toBe(1.2);
    // Each leader is buffed by the other one, never by itself.
    expect(traitSpeedFactor(g, leader)).toBe(1.2);
  });
  it("unstoppable enemies ignore slows and stuns", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "unstoppable" })),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "slow", factor: 0.35, until: 5 });
    applyStatus(g, e, { kind: "stun", release: 1, until: 3 });
    expect(e.status).toEqual([]);
  });
  it("swift enemies are faster but have less HP", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "swift", speed: 0.5, hp: 0.2 })),
      e = createEnemy(g, "drone");
    expect(e.hp).toBe(Math.round(ENEMIES.drone.hp * 0.8));
    expect(traitSpeedFactor(g, e)).toBe(1.5);
  });
  it("percent regeneration heals a share of max HP per second", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "regen", percent: 0.02 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    e.hp = 900;
    tickStatus(g, 1);
    expect(e.hp).toBe(920);
  });
  it("rejects malformed new traits", () => {
    expect(() => validateContent(withDroneTraits({ kind: "shield", capacity: 1, delay: 2 }))).toThrow("capacity muss in (0, 1)");
    expect(() => validateContent(withDroneTraits({ kind: "evade", every: 1 }))).toThrow("every muss eine ganze Zahl");
    expect(() => validateContent(withDroneTraits({ kind: "regen" }))).toThrow("Genau eines von perSecond oder percent");
    expect(() => validateContent(withDroneTraits({ kind: "regen", perSecond: 2, percent: 0.02 }))).toThrow("Genau eines");
    expect(() => validateContent(withDroneTraits({ kind: "leader", radius: 0, speed: 0.2, resist: 0.15 }))).toThrow("radius muss > 0");
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
      name: "Späher",
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
  it("traitFlags reports armor, split and slowImmune", () => {
    const g = new Game(
        undefined,
        withDroneTraits({ kind: "armor", reduction: 0.3 }, { kind: "splitOnDeath", type: "runner", count: 2 }, { kind: "slowImmune" }),
      ),
      e = makeEnemy(1, "drone", 0, 3);
    expect(traitFlags(g, e)).toMatchObject({ armor: true, split: true, slowImmune: true });
    expect(traitFlags(new Game(), makeEnemy(2, "drone", 0, 3))).toMatchObject({ armor: false, split: false, slowImmune: false });
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
  it("is rejected by validation when malformed", () => {
    expect(() => validateContent(withDroneTraits({ kind: "burrow", every: 3, length: 3 }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "burrow", every: 0, length: 0.5 }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "burrow", every: 3, length: 1.2 }))).not.toThrow();
  });
});

describe("harden", () => {
  const hit = (hpShare: number) => {
    const g = new Game(undefined, withDroneTraits({ kind: "harden", max: 0.6 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    e.hp = e.maxHp * hpShare;
    const before = e.hp;
    applyDamage(g, src, e, 100);
    return { taken: before - e.hp, flags: traitFlags(g, e) };
  };
  it("reduces damage the more HP is lost", () => {
    expect(hit(1).taken).toBeCloseTo(100);
    expect(hit(0.5).taken).toBeCloseTo(70);
    expect(hit(0.1).taken).toBeCloseTo(46);
  });
  it("reports the current reduction as a flag", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "harden", max: 0.6 })),
      e = makeEnemy(1, "drone", 0, 3);
    expect(traitFlags(g, e).harden).toBe(0);
    e.hp = 500;
    expect(traitFlags(g, e).harden).toBeCloseTo(0.3);
  });
  it("applies to burn damage as well", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "harden", max: 0.6 })),
      e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    e.hp = 500;
    applyDamage(g, src, e, 100, true);
    expect(e.hp).toBeCloseTo(430);
  });
});

describe("surge", () => {
  const surging = () => new Game(undefined, withDroneTraits({ kind: "surge", every: 4, length: 1, factor: 2.2 }));
  it("starts at normal speed and bursts only in the last `length` cells of each cycle", () => {
    const g = surging(), e = makeEnemy(1, "drone", 0, 3, 0);
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
  it("is rejected by validation when malformed", () => {
    for (const t of [
      { every: 0, length: 0.5, factor: 2 },
      { every: 4, length: 0, factor: 2 },
      { every: 4, length: 4, factor: 2 },
      { every: 4, length: 1, factor: 1 },
    ])
      expect(() => validateContent(withDroneTraits({ kind: "surge", ...t }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "surge", every: 4, length: 1, factor: 2.2 }))).not.toThrow();
  });
});

describe("swarm", () => {
  const swarming = () => new Game(undefined, withDroneTraits({ kind: "swarm", radius: 1, per: 0.1, max: 0.5 }));
  /** A swarm of `n` extra drones next to the target; returns the damage that landed on the target. */
  const hitWith = (n: number, burn = false) => {
    const g = swarming(), e = makeEnemy(1, "drone", 5, 5);
    g.state.enemies = [e];
    for (let i = 0; i < n; i++) g.state.enemies.push(makeEnemy(2 + i, "drone", 5 + 0.05 * i, 5));
    applyDamage(g, src, e, 100, burn);
    return { taken: 1000 - e.hp, flags: traitFlags(g, e) };
  };
  it("takes full damage alone, 10 % less with one neighbour and more with many", () => {
    expect(hitWith(0).taken).toBeCloseTo(100);
    expect(hitWith(1).taken).toBeCloseTo(90);
    expect(hitWith(3).taken).toBeCloseTo(70);
  });
  it("caps the reduction", () => {
    expect(hitWith(5).taken).toBeCloseTo(50);
    expect(hitWith(9).taken).toBeCloseTo(50);
    expect(hitWith(9).flags.swarm).toBeCloseTo(0.5);
  });
  it("ignores other types, dead enemies and far ones", () => {
    const g = swarming(), e = makeEnemy(1, "drone", 5, 5), other = makeEnemy(2, "runner", 5, 5), dead = makeEnemy(3, "drone", 5, 5), far = makeEnemy(4, "drone", 7, 5);
    dead.hp = 0;
    g.state.enemies = [e, other, dead, far];
    expect(traitFlags(g, e).swarm).toBe(0);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBeCloseTo(900);
  });
  it("reduces burn damage as well", () => {
    expect(hitWith(2, true).taken).toBeCloseTo(80);
  });
  it("is rejected by validation when malformed", () => {
    for (const t of [{ radius: 0, per: 0.1, max: 0.5 }, { radius: 1, per: 0, max: 0.5 }, { radius: 1, per: 0.1, max: 1 }])
      expect(() => validateContent(withDroneTraits({ kind: "swarm", ...t }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "swarm", radius: 1, per: 0.1, max: 0.5 }))).not.toThrow();
  });
});

describe("rage", () => {
  const raging = () => new Game(undefined, withDroneTraits({ kind: "rage", max: 1 }));
  it("is faster the more HP is missing", () => {
    const g = raging(), e = makeEnemy(1, "drone", 0, 3);
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).rage).toBe(0);
    e.hp = e.maxHp / 2;
    expect(traitSpeedFactor(g, e)).toBeCloseTo(1.5);
    expect(traitFlags(g, e).rage).toBeCloseTo(0.5);
    e.hp = 0;
    expect(traitSpeedFactor(g, e)).toBeCloseTo(2);
  });
  it("has no flag without the trait", () => {
    const g = new Game(), e = makeEnemy(1, "drone", 0, 3);
    e.hp = 1;
    expect(traitFlags(g, e).rage).toBe(0);
  });
  it("is rejected by validation when max is not positive", () => {
    for (const max of [0, -0.5]) expect(() => validateContent(withDroneTraits({ kind: "rage", max }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "rage", max: 1 }))).not.toThrow();
  });
});

describe("facet", () => {
  const faceted = () => new Game(undefined, withDroneTraits({ kind: "facet", every: 4, length: 2, reduction: 0.7 }));
  const hitAt = (time: number, dot = false) => {
    const g = faceted(), e = makeEnemy(1, "drone", 5, 5);
    g.state.enemies = [e];
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
  it("is rejected by validation when malformed", () => {
    for (const t of [
      { every: 0, length: 1, reduction: 0.5 },
      { every: 4, length: 0, reduction: 0.5 },
      { every: 4, length: 4, reduction: 0.5 },
      { every: 4, length: 2, reduction: 0 },
      { every: 4, length: 2, reduction: 1 },
    ])
      expect(() => validateContent(withDroneTraits({ kind: "facet", ...t }))).toThrow();
    expect(() => validateContent(withDroneTraits({ kind: "facet", every: 4, length: 2, reduction: 0.7 }))).not.toThrow();
  });
});

const bad = (trait: Trait) => expect(() => validateContent(withDroneTraits(trait))).toThrow();
const good = (trait: Trait) => expect(() => validateContent(withDroneTraits(trait))).not.toThrow();
const towerAt = (id: number, type: Tower["type"], x: number, y: number): Tower => ({ id, type, x, y, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 });

describe("leap", () => {
  const leaping = () => new Game(undefined, withDroneTraits({ kind: "leap", every: 4, length: 1.5 }));
  it("flips the layer in the last `length` cells of each cycle", () => {
    const g = leaping(), at = (d: number) => layerOf(g, makeEnemy(1, "drone", 0, 3, d));
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
    const g = leaping(), up = makeEnemy(1, "drone", 0, 3, 3), down = makeEnemy(2, "drone", 0, 3, 1);
    expect(canTarget(g, "blast", up)).toBe(false);
    expect(canTarget(g, "spikes", up)).toBe(false);
    expect(canTarget(g, "flak", up)).toBe(true);
    expect(canTarget(g, "blast", down)).toBe(true);
    expect(canTarget(g, "spikes", down)).toBe(true);
    expect(canTarget(g, "flak", down)).toBe(false);
  });
  it("flips an air enemy to the ground", () => {
    const g = new Game(undefined, { ...DEFAULT_CONTENT, enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, layer: "air", traits: [{ kind: "leap", every: 4, length: 1.5 }] } } });
    const up = makeEnemy(1, "drone", 0, 3, 1), down = makeEnemy(2, "drone", 0, 3, 3);
    expect(canTarget(g, "flak", up)).toBe(true);
    expect(canTarget(g, "blast", up)).toBe(false);
    expect(canTarget(g, "blast", down)).toBe(true);
    expect(canTarget(g, "flak", down)).toBe(false);
  });
  it("keeps the net rule: a netted leaping ground enemy is hit by ground towers", () => {
    const g = leaping(), up = makeEnemy(1, "drone", 0, 3, 3);
    expect(canTarget(g, "blast", up)).toBe(false);
    applyStatus(g, up, { kind: "netted", factor: 0.5, until: 5 });
    expect(canTarget(g, "blast", up)).toBe(true);
  });
  it("is rejected by validation when malformed", () => {
    for (const t of [{ every: 0, length: 0.5 }, { every: 4, length: 0 }, { every: 4, length: 4 }]) bad({ kind: "leap", ...t });
    good({ kind: "leap", every: 4, length: 1.5 });
  });
});

describe("dampen", () => {
  const dampening = () => new Game(undefined, withDroneTraits({ kind: "dampen", radius: 1.5 }));
  const effects = [
    { kind: "slow", factor: 0.5, until: 5 },
    { kind: "stun", release: 0, until: 5 },
    { kind: "pull", factor: -1, release: 0, until: 5 },
  ] as const;
  it("makes itself immune to slow, stun and pull", () => {
    const g = dampening(), e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
    for (const fx of effects) applyStatus(g, e, { ...fx });
    expect(e.status).toEqual([]);
  });
  it("covers enemies of any type within the radius but not outside", () => {
    const g = dampening(), d = makeEnemy(1, "drone", 0, 3), near = makeEnemy(2, "runner", 1.5, 3), far = makeEnemy(3, "runner", 1.6, 3);
    g.state.enemies = [d, near, far];
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
    const g = dampening(), d = makeEnemy(1, "drone", 0, 3), near = makeEnemy(2, "runner", 1, 3);
    g.state.enemies = [d, near];
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
  it("reports its radius and is rejected when malformed", () => {
    expect(traitFlags(dampening(), makeEnemy(1, "drone", 0, 3)).dampen).toBe(1.5);
    expect(traitFlags(new Game(), makeEnemy(1, "drone", 0, 3)).dampen).toBe(0);
    bad({ kind: "dampen", radius: 0 });
    good({ kind: "dampen", radius: 1.5 });
  });
});

describe("brood", () => {
  const brooding = (max = 2) => new Game(undefined, withDroneTraits({ kind: "brood", type: "runner", every: 2, max }));
  const eggs = (g: Game) => g.state.enemies.filter((e) => e.type === "runner");
  it("lays one egg per `every` cells up to `max`, at its own distance", () => {
    const g = brooding(), e = createEnemy(g, "drone", 0);
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
    const g = brooding(3), e = createEnemy(g, "drone", 4);
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
    const g = brooding(5), e = createEnemy(g, "drone", 0);
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
    const g = brooding(), e = createEnemy(g, "drone", 0);
    e.sentBy = 1;
    e.distance = 2.5;
    tickTraits(g, 1 / 30);
    expect(eggs(g)[0].sentBy).toBe(1);
    expect(traitFlags(g, e).brood).toBeCloseTo(0.25);
  });
  it("keeps the state hash of enemies without the trait unchanged", () => {
    const plain = new Game(), e = createEnemy(plain, "drone", 3);
    expect(e.brood).toBeUndefined();
    const before = stateHash(plain.state);
    e.brood = 0;
    expect(stateHash(plain.state)).not.toBe(before);
    delete e.brood;
    expect(stateHash(plain.state)).toBe(before);
  });
  it("is rejected by validation when malformed", () => {
    bad({ kind: "brood", type: "nope", every: 2, max: 2 });
    bad({ kind: "brood", type: "runner", every: 0, max: 2 });
    bad({ kind: "brood", type: "runner", every: 2, max: 0 });
    bad({ kind: "brood", type: "runner", every: 2, max: 1.5 });
    good({ kind: "brood", type: "runner", every: 2, max: 2 });
  });
});

describe("overload", () => {
  const overloading = () => new Game(undefined, withDroneTraits({ kind: "overload", radius: 2, cycles: 3 }));
  it("stalls attack towers in the radius only, with an event", () => {
    const g = overloading(), e = makeEnemy(1, "drone", 5, 5);
    g.state.enemies = [e];
    g.state.towers = [towerAt(1, "pulse", 6, 5), towerAt(2, "pulse", 9, 5), towerAt(3, "aura", 5, 6), towerAt(4, "mine", 5, 4), towerAt(5, "pulse", 5, 7)];
    g.state.towers[4].cooldown = 5;
    applyDamage(g, src, e, 5000);
    const cd = g.state.towers.map((t) => t.cooldown);
    expect(cd).toEqual([3, 0, 0, 0, 5]);
    expect(g.state.events).toContainEqual({ type: "overload", at: { x: 5, y: 5 }, radius: 2 });
  });
  it("also fires when disrupted, and is flagged", () => {
    const g = overloading(), e = makeEnemy(1, "drone", 5, 5);
    e.status = [{ kind: "disrupted", until: 99 }];
    g.state.enemies = [e];
    g.state.towers = [towerAt(1, "pulse", 6, 5)];
    applyDamage(g, src, e, 5000);
    expect(g.state.towers[0].cooldown).toBe(3);
    expect(traitFlags(g, makeEnemy(2, "drone", 0, 0)).overload).toBe(true);
  });
  it("is rejected by validation when malformed", () => {
    bad({ kind: "overload", radius: 0, cycles: 2 });
    bad({ kind: "overload", radius: 2, cycles: 0 });
    good({ kind: "overload", radius: 2, cycles: 2 });
  });
});

describe("molt", () => {
  const molting = () => new Game(undefined, withDroneTraits({ kind: "molt", threshold: 0.5, armor: 0.6, speed: 1.8 }));
  it("reduces all damage while hp share is at or above the threshold", () => {
    const g = molting(), e = makeEnemy(1, "drone", 0, 3);
    g.state.enemies = [e];
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
    const g = molting(), e = makeEnemy(1, "drone", 0, 3);
    e.hp = 500;
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).molt).toBe("plated");
    e.hp = 499;
    expect(traitSpeedFactor(g, e)).toBe(1.8);
    expect(traitFlags(g, e).molt).toBe("shed");
    expect(traitFlags(new Game(), e).molt).toBeUndefined();
  });
  it("is rejected by validation when malformed", () => {
    for (const t of [{ threshold: 0, armor: 0.5, speed: 1.5 }, { threshold: 1, armor: 0.5, speed: 1.5 }, { threshold: 0.5, armor: 0, speed: 1.5 }, { threshold: 0.5, armor: 1, speed: 1.5 }, { threshold: 0.5, armor: 0.5, speed: 1 }])
      bad({ kind: "molt", ...t });
    good({ kind: "molt", threshold: 0.5, armor: 0.5, speed: 1.5 });
  });
});

describe("momentum", () => {
  const swift = () => new Game(undefined, withDroneTraits({ kind: "momentum", per: 0.03, max: 0.9 }));
  it("speeds up with the distance walked and is capped", () => {
    const g = swift();
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 0))).toBe(1);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 10))).toBeCloseTo(1.3);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 30))).toBeCloseTo(1.9);
    expect(traitSpeedFactor(g, makeEnemy(1, "drone", 0, 0, 500))).toBeCloseTo(1.9);
  });
  it("gives factor 1 at a negative distance (pulled back on a ring)", () => {
    const g = swift(), e = makeEnemy(1, "drone", 0, 0, -4);
    expect(traitSpeedFactor(g, e)).toBe(1);
    expect(traitFlags(g, e).momentum).toBe(0);
  });
  it("exposes the current bonus as a flag and is 0 without the trait", () => {
    const g = swift();
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 0, 10)).momentum).toBeCloseTo(0.3);
    expect(traitFlags(g, makeEnemy(1, "drone", 0, 0, 99)).momentum).toBeCloseTo(0.9);
    expect(traitFlags(new Game(), makeEnemy(1, "drone", 0, 0, 10)).momentum).toBe(0);
  });
  it("is not disrupted by a Störsender", () => {
    const g = swift(), e = makeEnemy(1, "drone", 0, 0, 10);
    applyStatus(g, e, { kind: "disrupted", until: 99 });
    expect(traitSpeedFactor(g, e)).toBeCloseTo(1.3);
  });
  it("is rejected by validation when malformed", () => {
    bad({ kind: "momentum", per: 0, max: 0.5 });
    bad({ kind: "momentum", per: 0.02, max: 0 });
    good({ kind: "momentum", per: 0.02, max: 2 });
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
    const g = new Game(undefined, content);
    const r = landed(g, 500);
    expect(r.dealt).toBeCloseTo(100);
    expect(r.flags.laps).toBe(0);
  });
  it("counts a lap exactly at path.length on a ring", () => {
    const g = ringGame(), n = RING.path.length;
    expect(landed(g, n - 0.01)).toMatchObject({ flags: { laps: 0 } });
    expect(landed(g, n - 0.01).dealt).toBeCloseTo(100);
    expect(landed(g, n).flags.laps).toBe(1);
    expect(landed(g, n).dealt).toBeCloseTo(85);
    expect(landed(g, 2 * n).dealt).toBeCloseTo(70);
  });
  it("caps the reduction at max", () => {
    const g = ringGame(), n = RING.path.length;
    expect(landed(g, 4 * n).dealt).toBeCloseTo(40);
    expect(landed(g, 9 * n).dealt).toBeCloseTo(40);
    expect(landed(g, 9 * n).flags.laps).toBe(9);
  });
  it("has 0 laps at a negative distance", () => {
    const g = ringGame();
    expect(landed(g, -3).flags.laps).toBe(0);
    expect(landed(g, -3).dealt).toBeCloseTo(100);
  });
  it("is rejected by validation when malformed", () => {
    bad({ kind: "lap", per: 0, max: 0.5 });
    bad({ kind: "lap", per: 1.1, max: 0.5 });
    bad({ kind: "lap", per: 0.1, max: 0 });
    bad({ kind: "lap", per: 0.1, max: 1.5 });
    good({ kind: "lap", per: 0.1, max: 1 });
  });
});

/** Pack where the drone carries `drone` traits and the runner `runner` traits. */
const duo = (drone: Trait[], runner: Trait[] = []): ContentPack => ({
  ...DEFAULT_CONTENT,
  enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits: drone }, runner: { ...ENEMIES.runner, traits: runner } },
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
  it("flags instant, area and chain per attack kind and carries the tower", () => {
    for (const k of ALL_KINDS) {
      const h = hitOf(k, { tower: 7, type: "pulse" });
      expect(h.instant).toBe(INSTANT_KINDS.includes(k));
      expect(h.area).toBe(AREA_KINDS.includes(k));
      expect(h.chain).toBe(false);
      expect(h.tower).toBe(7);
    }
  });
  it("does not change damage without trait", () => {
    const g = new Game();
    for (const k of ALL_KINDS) expect(lost(g, k)).toBe(100);
  });
});

describe("refract", () => {
  it("scales instant hits only", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "refract", factor: 0.5 }));
    for (const k of ALL_KINDS) expect(lost(g, k)).toBe(INSTANT_KINDS.includes(k) ? 50 : 100);
    const e = makeEnemy(1, "drone", 0, 3);
    applyDamage(g, src, e, 100, true);
    applyDamage(g, src, e, 100);
    expect(e.hp).toBe(800);
  });
  it("is not disruptable and rejects bad factors", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "refract", factor: 0.5 }));
    g.state.enemies = [makeEnemy(1, "drone", 0, 3)];
    g.state.enemies[0].status = [{ kind: "disrupted", until: 9 }];
    expect(lost(g, "chain")).toBe(50);
    bad({ kind: "refract", factor: 0.3 });
    bad({ kind: "refract", factor: 0.7 });
    good({ kind: "refract", factor: 0.4 });
  });
});

describe("blastproof", () => {
  it("cuts area hits only, including the Nova centre", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "blastproof", reduction: 0.6 }));
    for (const k of ALL_KINDS) expect(lost(g, k)).toBeCloseTo(AREA_KINDS.includes(k) ? 40 : 100);
    const e = makeEnemy(1, "drone", 2, 2);
    g.state.enemies = [e];
    blast(g, { tower: 0, type: "blast" }, { x: 2, y: 2 }, 1, 100, "splash");
    expect(e.hp).toBeCloseTo(960);
    blast(g, { tower: 0, type: "mortar" }, { x: 2, y: 2 }, 1, 100, "mortar");
    expect(e.hp).toBeCloseTo(920);
  });
  it("rejects bad reductions", () => {
    bad({ kind: "blastproof", reduction: 0.2 });
    bad({ kind: "blastproof", reduction: 0.8 });
    good({ kind: "blastproof", reduction: 0.5 });
  });
});

describe("insulated", () => {
  const fire = (g: Game, e: ReturnType<typeof makeEnemy>) =>
    attackModule(DEFAULT_CONTENT.towers.tesla.attack)!.apply(g, { tower: 0, type: "tesla" }, { enemy: e, at: { x: e.x, y: e.y } }, 100, DEFAULT_CONTENT.towers.tesla.attack);
  it("is never a jump target and the chain continues past it", () => {
    const g = new Game(undefined, duo([], [{ kind: "insulated" }])),
      a = makeEnemy(1, "drone", 0, 3),
      b = makeEnemy(2, "runner", 0.5, 3),
      c = makeEnemy(3, "drone", 1.5, 3);
    g.state.enemies = [a, b, c];
    fire(g, a);
    expect([a.hp, b.hp, c.hp]).toEqual([900, 1000, 925]);
  });
  it("as primary target takes the hit and stops the chain", () => {
    const g = new Game(undefined, duo([], [{ kind: "insulated" }])),
      a = makeEnemy(1, "drone", 0, 3),
      b = makeEnemy(2, "runner", 0.5, 3);
    g.state.enemies = [a, b];
    fire(g, b);
    expect([a.hp, b.hp]).toEqual([1000, 900]);
  });
  it("validates", () => good({ kind: "insulated" }));
});

describe("heatshield", () => {
  it("blocks burn and bleeding but not slow", () => {
    const g = new Game(undefined, withDroneTraits({ kind: "heatshield" })),
      e = makeEnemy(1, "drone", 0, 3),
      who = { tower: 0, type: "pulse" as const };
    applyStatus(g, e, { kind: "burn", dps: 10, next: 0, until: 5, source: who });
    applyStatus(g, e, { kind: "bleeding", perCell: 5, last: 0, next: 0, until: 5, source: who });
    expect(e.status).toEqual([]);
    applyStatus(g, e, { kind: "slow", factor: 0.5, until: 5 });
    expect(e.status).toHaveLength(1);
    good({ kind: "heatshield" });
  });
});

describe("mirror", () => {
  const mirrored = () => new Game(undefined, withDroneTraits({ kind: "mirror", cap: 0.1 }));
  it("caps a single hit at cap x maxHp after other reductions", () => {
    const g = mirrored(),
      e = makeEnemy(1, "drone", 0, 3);
    applyDamage(g, src, e, 500);
    expect(e.hp).toBe(900);
    applyDamage(g, src, e, 50);
    expect(e.hp).toBe(850);
    const h = new Game(undefined, withDroneTraits({ kind: "armor", reduction: 0.5 }, { kind: "mirror", cap: 0.1 })),
      f = makeEnemy(2, "drone", 0, 3);
    applyDamage(h, src, f, 400);
    expect(f.hp).toBe(900);
    applyDamage(h, src, f, 100);
    expect(f.hp).toBe(850);
  });
  it("still dies to a pit and ignores the cap on a Henker execution", () => {
    const g = mirrored(),
      e = makeEnemy(1, "drone", 0, 3),
      f = makeEnemy(2, "drone", 0, 3);
    g.state.enemies = [e, f];
    applyDamage(g, src, e, Infinity, false, hitOf("pit", src));
    expect(e.hp).toBeLessThanOrEqual(0);
    applyDamage(g, src, f, 500, false, hitOf("execute", src, { execution: true }));
    expect(f.hp).toBe(500);
    applyDamage(g, src, f, 500, false, hitOf("execute", src, { execution: false }));
    expect(f.hp).toBe(400);
  });
  it("rejects bad caps", () => {
    bad({ kind: "mirror", cap: 0.01 });
    bad({ kind: "mirror", cap: 0.3 });
    good({ kind: "mirror", cap: 0.06 });
  });
});

describe("link", () => {
  const linked = (radius = 1.6) => new Game(undefined, duo([{ kind: "link", radius }], [])),
    drones = (g: Game) => {
      const list = [makeEnemy(3, "drone", 0, 3), makeEnemy(1, "drone", 0.5, 3), makeEnemy(2, "drone", 1, 3), makeEnemy(4, "drone", 5, 3), makeEnemy(5, "runner", 0.2, 3)];
      g.state.enemies = list;
      return list;
    };
  it("splits among same-type enemies in radius in id order without recursion", () => {
    const g = linked(),
      [a, b, c, far, other] = drones(g);
    applyDamage(g, src, a, 300);
    expect([a.hp, b.hp, c.hp, far.hp, other.hp]).toEqual([900, 900, 900, 1000, 1000]);
    const order = g.state.events.filter((e) => e.type === "damage").map((e) => (e as { enemy: number }).enemy);
    expect(order).toEqual([1, 2, 3]);
  });
  it("splits dots too, and gives the kill reward per dead member", () => {
    const g = linked(),
      [a, b, c] = drones(g);
    applyDamage(g, src, a, 300, true);
    expect([a.hp, b.hp, c.hp]).toEqual([900, 900, 900]);
    a.hp = b.hp = 100;
    c.hp = 5000;
    const kills = g.state.kills;
    applyDamage(g, src, c, 600);
    expect(g.state.kills).toBe(kills + 2);
  });
  it("does not split an infinite hit and stops when disrupted", () => {
    const g = linked(),
      [a, b, c] = drones(g);
    applyDamage(g, src, a, Infinity, false, hitOf("pit", src));
    expect([a.hp <= 0, b.hp, c.hp]).toEqual([true, 1000, 1000]);
    const h = linked(),
      [d, e2] = drones(h);
    d.status = [{ kind: "disrupted", until: 9 }];
    applyDamage(h, src, d, 300);
    expect([d.hp, e2.hp]).toEqual([700, 1000]);
  });
  it("validates", () => {
    bad({ kind: "link", radius: 1 });
    bad({ kind: "link", radius: 2.5 });
    good({ kind: "link", radius: 1.6 });
  });
});

describe("taunt", () => {
  const taunting = (radius = 2) => {
      const g = new Game(undefined, duo([{ kind: "taunt", radius }], [])),
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
    // Out of the taunt radius (2.3 > 2) but still in tower range 2.65.
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
    const g = new Game(undefined, duo([{ kind: "taunt", radius: 2 }], [])),
      runner = makeEnemy(1, "runner", 6, 5, 20),
      t = makeEnemy(2, "drone", 5, 6.5, 5);
    g.state.towers = [towerAt(1, "shrapnel", 5, 5)];
    g.state.enemies = [runner, t];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 5, y: 6.5 }, { x: 6, y: 5 }]);
  });
  it("never forces traps and not support towers", () => {
    const { g } = taunting(),
      runner = makeEnemy(1, "runner", 5, 5.2, 20),
      t = makeEnemy(2, "drone", 5, 5.3, 5);
    g.state.towers = [towerAt(1, "tar", 5, 5)];
    g.state.enemies = [runner, t];
    attackEnemies(g, 1 / 30);
    expect(shotAt(g)).toEqual([{ x: 5, y: 5.2 }]);
  });
  it("validates", () => {
    bad({ kind: "taunt", radius: 1 });
    good({ kind: "taunt", radius: 2.5 });
  });
});

describe("martyr", () => {
  const martyrs = () => new Game(undefined, duo([{ kind: "martyr", radius: 1.8, heal: 0.25 }], []));
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
  it("validates", () => {
    bad({ kind: "martyr", radius: 3, heal: 0.2 });
    bad({ kind: "martyr", radius: 1.8, heal: 0.5 });
    good({ kind: "martyr", radius: 1.8, heal: 0.2 });
  });
});

describe("cloakField", () => {
  const cloaking = () => new Game(undefined, duo([{ kind: "cloakField", radius: 1.6 }], []));
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
    good({ kind: "cloakField", radius: 1.6 });
    bad({ kind: "cloakField", radius: 3 });
  });
});

describe("retaliate", () => {
  const retaliating = () => {
    const g = new Game(undefined, withDroneTraits({ kind: "retaliate", radius: 1.8, cycles: 0.5 })),
      e = makeEnemy(1, "drone", 5, 5);
    g.state.enemies = [e];
    g.state.towers = [towerAt(1, "pulse", 6, 5), towerAt(2, "pulse", 9, 5), towerAt(3, "aura", 5, 6), towerAt(4, "mine", 5, 4)];
    return { g, e };
  };
  const hit = (g: Game, e: ReturnType<typeof makeEnemy>, tower: number, dot = false) => {
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
  it("is off when disrupted and validates", () => {
    const { g, e } = retaliating();
    e.status = [{ kind: "disrupted", until: 9 }];
    hit(g, e, 1);
    expect(g.state.towers[0].cooldown).toBe(0);
    bad({ kind: "retaliate", radius: 1, cycles: 0.5 });
    bad({ kind: "retaliate", radius: 1.8, cycles: 1 });
    good({ kind: "retaliate", radius: 1.8, cycles: 0.5 });
  });
});

describe("pack", () => {
  const packed = () => new Game(undefined, duo([], [{ kind: "pack", radius: 1.5, perAlly: 0.08, max: 0.4 }]));
  it("speeds up per living same-type neighbour, capped, without self or other types", () => {
    const g = packed(),
      a = makeEnemy(1, "runner", 0, 3),
      base = traitSpeedFactor(g, a);
    expect(base).toBe(1);
    g.state.enemies = [a, makeEnemy(2, "runner", 1, 3), makeEnemy(3, "drone", 0.5, 3), makeEnemy(4, "runner", 9, 3)];
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.08);
    for (let i = 0; i < 8; i++) g.state.enemies.push(makeEnemy(10 + i, "runner", 0.2, 3));
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.4);
    g.state.enemies[1].hp = 0;
    expect(traitFlags(g, a).pack).toBeCloseTo(0.4);
  });
  it("is not disruptable and validates", () => {
    const g = packed(),
      a = makeEnemy(1, "runner", 0, 3);
    g.state.enemies = [a, makeEnemy(2, "runner", 1, 3)];
    a.status = [{ kind: "disrupted", until: 9 }];
    expect(traitSpeedFactor(g, a)).toBeCloseTo(1.08);
    bad({ kind: "pack", radius: 1.5, perAlly: 0.2, max: 0.4 });
    bad({ kind: "pack", radius: 1.5, perAlly: 0.08, max: 0.9 });
    good({ kind: "pack", radius: 1.5, perAlly: 0.08, max: 0.4 });
  });
});

describe("blink", () => {
  const blinking = () => new Game(undefined, withDroneTraits({ kind: "blink", every: 4, jump: 2 }));
  const step = (g: Game, e: ReturnType<typeof makeEnemy>, from: number) => {
    e.distance = from;
    g.state.enemies = [e];
    moveEnemies(g, 1 / 30);
    return e.distance;
  };
  it("jumps once when a forward move crosses a multiple of `every`", () => {
    const g = blinking(),
      e = makeEnemy(1, "drone", 0, 3);
    const speed = ENEMIES.drone.speed / 30;
    expect(step(g, e, 3.99)).toBeCloseTo(3.99 + speed + 2);
    expect(step(g, e, 1)).toBeCloseTo(1 + speed);
    // Even a jump over the next boundary happens only once per tick.
    expect(step(g, e, 3.99)).toBeLessThan(3.99 + speed + 2.01);
  });
  it("never jumps on a pull-back and respects the stun", () => {
    const g = blinking(),
      e = makeEnemy(1, "drone", 0, 3);
    e.status = [{ kind: "pull", factor: 1, release: 99, until: 99 }];
    const d = step(g, e, 4.01);
    expect(d).toBeLessThan(4.01);
    e.status = [{ kind: "stun", release: 99, until: 99 }];
    expect(step(g, e, 3.99)).toBe(3.99);
  });
  it("clamps at the reactor so the leak is handled normally", () => {
    const g = blinking(),
      last = g.mission.map.path.length - 1,
      lives = g.state.lives;
    // Walking to the reactor: no jump ever carries a leak past the last cell.
    const f = makeEnemy(2, "drone", 0, 3, 0);
    f.distance = last - 1;
    g.state.enemies = [f];
    for (let i = 0; i < 60 && f.hp > 0; i++) moveEnemies(g, 1 / 30);
    expect(f.hp).toBe(0);
    expect(g.state.lives).toBeLessThan(lives);
  });
  it("is off when disrupted and validates", () => {
    const g = blinking(),
      e = makeEnemy(1, "drone", 0, 3);
    e.status = [{ kind: "disrupted", until: 99 }];
    expect(step(g, e, 3.99)).toBeLessThan(4.1);
    bad({ kind: "blink", every: 2, jump: 2 });
    bad({ kind: "blink", every: 4, jump: 5 });
    good({ kind: "blink", every: 4, jump: 2 });
  });
});

describe("tunnel", () => {
  const tunneling = () => new Game(undefined, withDroneTraits({ kind: "tunnel", every: 5, length: 2, speed: 2 }));
  it("is hidden and faster in the last `length` cells of each cycle, traps still hit", () => {
    const g = tunneling(),
      under = makeEnemy(1, "drone", 0, 3, 3.5),
      up = makeEnemy(2, "drone", 0, 3, 2.9);
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
  it("validates", () => {
    bad({ kind: "tunnel", every: 5, length: 2, speed: 3 });
    bad({ kind: "tunnel", every: 5, length: 5, speed: 2 });
    good({ kind: "tunnel", every: 5, length: 2, speed: 2 });
  });
});

describe("phase", () => {
  const phasing = () => new Game(undefined, withDroneTraits({ kind: "phase", period: 3.5, air: 1.5 }));
  it("is in the air for the first `air` seconds of each period, and canTarget follows", () => {
    const g = phasing(),
      e = makeEnemy(1, "drone", 0, 3);
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
  it("validates", () => {
    bad({ kind: "phase", period: 5, air: 1.5 });
    bad({ kind: "phase", period: 3.5, air: 0.5 });
    good({ kind: "phase", period: 3.5, air: 1.5 });
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
    const range = effectiveTowerStats(g.state.towers[0], g.state.towers, g.content).range;
    expect(stats(g, 0).range).toBeCloseTo(range * 0.7);
    expect(stats(g, 1).range).toBe(range);
    expect(stats(g, 2).range).toBe(effectiveTowerStats(g.state.towers[2], g.state.towers, g.content).range);
    expect(stats(g, 3).range).toBe(effectiveTowerStats(g.state.towers[3], g.state.towers, g.content).range);
    // Previews without the sim and games without carriers are unchanged.
    expect(stats(g, 0, false).range).toBe(range);
    expect(effectiveTowerStats(plain.state.towers[0] ?? towerAt(1, "pulse", 6, 5), [], plain.content, plain).range).toBe(range);
  });
  it("jam slows the interval, strongest wins, interval only", () => {
    const g = field({ kind: "jam", radius: 2, slow: 0.3 }, { kind: "jam", radius: 2, slow: 0.5 }),
      base = effectiveTowerStats(g.state.towers[0], g.state.towers, g.content);
    expect(stats(g, 0).interval).toBeCloseTo(base.interval * 1.5);
    expect(stats(g, 0).range).toBe(base.range);
    expect(stats(g, 1).interval).toBe(base.interval);
    expect(stats(g, 2).interval).toBe(effectiveTowerStats(g.state.towers[2], g.state.towers, g.content).interval);
  });
  it("a jammed tower reloads slower in the real tick", () => {
    const g = field({ kind: "jam", radius: 2, slow: 0.5 }),
      t = g.state.towers[0];
    t.cooldown = 1;
    attackEnemies(g, 0.1);
    const jammed = 1 - t.cooldown;
    t.cooldown = 1;
    g.state.enemies = [];
    attackEnemies(new Game(), 0);
    const plain = new Game();
    plain.state.towers = [towerAt(1, "pulse", 6, 5)];
    plain.state.towers[0].cooldown = 1;
    attackEnemies(plain, 0.1);
    expect(jammed).toBeCloseTo((1 - plain.state.towers[0].cooldown) / 1.5);
  });
  it("are switched off by disruption or death and validate", () => {
    const g = field({ kind: "blind", radius: 2.5, range: 0.3 }, { kind: "jam", radius: 2, slow: 0.5 }),
      base = effectiveTowerStats(g.state.towers[0], g.state.towers, g.content);
    g.state.enemies[0].status = [{ kind: "disrupted", until: 99 }];
    expect(stats(g, 0).range).toBe(base.range);
    g.state.enemies[1].hp = 0;
    expect(stats(g, 0).interval).toBe(base.interval);
    bad({ kind: "blind", radius: 2.5, range: 0.5 });
    bad({ kind: "jam", radius: 2, slow: 0.1 });
    good({ kind: "blind", radius: 2.5, range: 0.3 });
    good({ kind: "jam", radius: 2, slow: 0.4 });
  });
});

describe("defuse", () => {
  const defusing = () => {
    const g = new Game(undefined, duo([{ kind: "defuse", radius: 1.5 }], [])),
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
  it("is lifted by disruption or death and validates", () => {
    const { g, mine } = defusing();
    g.state.enemies[0].status = [{ kind: "disrupted", until: 99 }];
    attackEnemies(g, 1 / 30);
    expect(mine.cooldown).toBe(1);
    mine.cooldown = 0;
    g.state.enemies[0].status = [];
    g.state.enemies[0].hp = 0;
    attackEnemies(g, 1 / 30);
    expect(mine.cooldown).toBe(1);
    bad({ kind: "defuse", radius: 3 });
    good({ kind: "defuse", radius: 1.5 });
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
    return { g, aura, pulse, carrier, stealthy };
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
    const { g, carrier, stealthy } = suppressing();
    const lives = g.state.lives;
    repairReactor(g);
    expect(g.state.lives).toBe(lives + 1);
    carrier.x = 20;
    updateDetection(g);
    expect(stealthy.revealed).toBe(true);
    expect(markFactor(g, makeEnemy(9, "runner", 5, 5))).toBeGreaterThan(1);
    expect(bountyBonus(g, stealthy, 100)).toBeGreaterThan(0);
  });
  it("is off when disrupted or dead and validates", () => {
    const { g, pulse, carrier } = suppressing();
    carrier.status = [{ kind: "disrupted", until: 99 }];
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).bonuses.damage).toBeGreaterThan(0);
    carrier.status = [];
    carrier.hp = 0;
    expect(effectiveTowerStats(pulse, g.state.towers, g.content, g).bonuses.damage).toBeGreaterThan(0);
    bad({ kind: "suppress", radius: 1 });
    good({ kind: "suppress", radius: 2.5 });
  });
});
