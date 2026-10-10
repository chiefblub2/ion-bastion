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
import { stateHash } from "../core/hash";
import { parseMap } from "../content/maps";
import { g as group, wave } from "../content/waves";
import type { Tower } from "../core/types";
import { isBurrowed, isHidden, layerOf, tickTraits, traitFlags, traitSpeedFactor } from "./traits";

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
