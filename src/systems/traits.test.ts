import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMIES } from "../content/enemies";
import { TOWERS } from "../content/towers";
import { Game } from "../core/game";
import { finishWave, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import type { ContentPack, EnemyDefinition, Trait } from "../core/types";
import { applyDamage } from "./damage";
import { createEnemy } from "./spawn";
import { applyStatus, speedFactor, tickStatus } from "./status";
import { canAcquire, canTarget } from "./attacks";
import { updateDetection } from "./detection";
import { isBurrowed, isHidden, traitFlags, traitSpeedFactor } from "./traits";

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
