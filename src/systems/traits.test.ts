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
import { traitFlags, traitSpeedFactor } from "./traits";

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
