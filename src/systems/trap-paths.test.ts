import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import { arena, fire, foe, LEVELS, lost, tiers, withTraits, towerAt, spec, buildTrap, walker } from "../core/test-helpers";
import { resolveUpgrades } from "../core/upgrades";
import type { Enemy, Tower } from "../core/types";
import { attackEnemies } from "./combat";
import { applyDamage } from "./damage";
import { updateDetection } from "./detection";
import { moveEnemies } from "./movement";
import { damageTaken, hasStatus, speedFactor, tickStatus } from "./status";
import { settleWave } from "./waves";

const statusOf = (e: Enemy, kind: string) => e.status.find((s) => s.kind === kind) as Record<string, number> | undefined;

describe("ported abilities fire through their traps", () => {
  it("Mine Chain Reaction: a kill explodes again beyond the mine's own blast", () => {
    // The blast centres on the enemy on the mine; the victim's own explosion reaches one beyond it.
    const trigger = foe(1, "drone", 7, 5, { hp: 100000, maxHp: 100000, distance: 11 }),
      victim = foe(2, "drone", 8.4, 5, { hp: 1 }),
      outside = foe(3, "drone", 9.4, 5);
    const { g, tower, damage } = arena("mine", tiers("chain-reaction", 3), [trigger, victim, outside]);
    fire(g, tower);
    expect(victim.hp).toBeLessThanOrEqual(0);
    expect(lost(outside)).toBeCloseTo(damage * spec("mine", "chain-reaction", 3).factor);
  });
  it("Sticky Mine Chain Reaction: kills of the bomb explode again", () => {
    const carrier = foe(1, "drone", 7, 5, { hp: 100000, maxHp: 100000, distance: 11 }),
      victim = foe(2, "drone", 8.5, 5, { hp: 1 }),
      outside = foe(3, "drone", 9.4, 5);
    const { g, tower, damage } = arena("limpet", tiers("chain-reaction", 3), [carrier, victim, outside]);
    fire(g, tower);
    g.state.time += 5;
    tickStatus(g, 0);
    expect(victim.hp).toBeLessThanOrEqual(0);
    expect(lost(outside)).toBeCloseTo(damage * spec("limpet", "chain-reaction", 3).factor);
  });
  it("Pitfall Spike Bed: an enemy too big to fall in takes a share of its max HP while wounded", () => {
    const content = withTraits({ boss: [] });
    const wounded = foe(1, "boss", 7, 5, { hp: 700 }),
      healthy = foe(2, "boss", 7, 5, { hp: 800 });
    const a = arena("pit", tiers("spike-bed", 1), [wounded], content);
    fire(a.g, a.tower);
    expect(700 - wounded.hp).toBeCloseTo(a.damage + 50);
    const b = arena("pit", tiers("spike-bed", 1), [healthy], content);
    fire(b.g, b.tower);
    expect(800 - healthy.hp).toBeCloseTo(b.damage);
  });
  it("Grinder Bonesaw: a wounded enemy loses a share of its max HP per turn", () => {
    const target = foe(1, "drone", 7, 5, { hp: 30000, maxHp: 100000 });
    const { g, tower, damage } = arena("grinder", tiers("bonesaw", 1), [target]);
    fire(g, tower);
    expect(30000 - target.hp).toBeCloseTo(damage + 200);
  });
  it("Oil Slick Slick: slows everyone around the slick, the coated ones included", () => {
    const coated = foe(1, "drone", 7, 5),
      near = foe(2, "drone", 7.7, 5),
      far = foe(3, "drone", 8, 5);
    const { g, tower } = arena("oil", tiers("slick", 1), [coated, near, far]);
    fire(g, tower);
    expect(hasStatus(coated, "oiled", g.state.time)).toBe(true);
    const { factor } = spec("oil", "slick", 1);
    expect(speedFactor(coated, g.state.time)).toBeCloseTo(factor);
    expect(speedFactor(near, g.state.time)).toBeCloseTo(factor);
    expect(speedFactor(far, g.state.time)).toBe(1);
  });
  it("Harpoon Exposed Target and Net Cloud", () => {
    const struck = foe(1, "glider", 7, 5),
      other = foe(2, "glider", 7.8, 5);
    const exposed = arena("harpoon", tiers("exposed-target", 3), [struck]);
    fire(exposed.g, exposed.tower);
    expect(damageTaken(struck, exposed.g.state.time)).toBeCloseTo(1.2);
    const cloud = arena("harpoon", tiers("net-cloud", 1), [foe(1, "glider", 7, 5), other]);
    fire(cloud.g, cloud.tower);
    expect(hasStatus(other, "netted", cloud.g.state.time)).toBe(true);
    expect(lost(other)).toBe(0);
  });
});

describe("reused abilities fire through their traps", () => {
  it("Tar Pit Brittle Tar weakens and Spreading Bog slows the neighbours", () => {
    const tarred = foe(1, "drone", 7, 5);
    const a = arena("tar", tiers("brittle-tar", 1), [tarred]);
    fire(a.g, a.tower);
    expect(damageTaken(tarred, a.g.state.time)).toBeCloseTo(1.08);
    const near = foe(2, "drone", 7.6, 5);
    const b = arena("tar", tiers("spreading-bog", 1), [foe(1, "drone", 7, 5), near]);
    fire(b.g, b.tower);
    expect(speedFactor(near, b.g.state.time)).toBeCloseTo(spec("tar", "spreading-bog", 1).factor);
  });
  it("Bear Trap Exposure weakens the enemy once the trap lets go", () => {
    const held = foe(1, "drone", 7, 5);
    const { g, tower } = arena("snare", tiers("exposure", 1), [held]);
    fire(g, tower);
    g.state.time += 3;
    tickStatus(g, 0);
    expect(damageTaken(held, g.state.time)).toBeCloseTo(1.1);
  });
  it("Spring Compression and Flame Grate Wildfire", () => {
    const thrown = foe(1, "drone", 7, 5);
    const a = arena("spring", tiers("compression", 1), [thrown]);
    fire(a.g, a.tower);
    expect(damageTaken(thrown, a.g.state.time)).toBeCloseTo(1.1);
    const burning = foe(1, "drone", 7, 5),
      near = foe(2, "drone", 7.8, 5);
    const b = arena("grill", tiers("wildfire", 1), [burning, near]);
    fire(b.g, b.tower);
    applyDamage(b.g, { tower: 1, type: "grill" }, burning, 5000);
    expect(hasStatus(near, "burn", b.g.state.time)).toBe(true);
  });
  it("Sticky Mine Breaching Charge and Grinder Shredder hit armor harder", () => {
    const content = withTraits({ drone: [{ kind: "armor", reduction: 0.5 }] });
    const carrier = foe(1, "drone", 7, 5);
    const a = arena("limpet", tiers("breaching-charge", 1), [carrier], content);
    fire(a.g, a.tower);
    a.g.state.time += 5;
    tickStatus(a.g, 0);
    expect(lost(carrier)).toBeCloseTo(a.damage * (1 + spec("limpet", "breaching-charge", 1).bonus) * (1 - 0.5));
    const minced = foe(1, "drone", 7, 5);
    const b = arena("grinder", tiers("shredder", 3), [minced], content);
    fire(b.g, b.tower);
    // The pierce removes its share of the 50% armor reduction.
    expect(lost(minced)).toBeCloseTo(b.damage * (1 - 0.5 * (1 - spec("grinder", "shredder", 3).fraction)));
  });
  it("Arc Plate Twin Arc starts a second chain at an enemy the first one missed", () => {
    const content = withTraits({ runner: [{ kind: "insulated" }] });
    const insulated = foe(1, "runner", 7, 5, { hp: 100000, maxHp: 100000, distance: 11 }),
      second = foe(2, "drone", 7.2, 5);
    const { g, tower, damage } = arena("arc", tiers("twin-arc", 3), [insulated, second], content);
    const { every, factor } = spec("arc", "twin-arc", 3);
    for (let i = 1; i < every; i++) fire(g, tower);
    expect(lost(second)).toBe(0);
    fire(g, tower);
    expect(lost(second)).toBeCloseTo(damage * factor);
  });
});

describe("new trap abilities", () => {
  it("Caltrops Hamstring slows and Open Wounds weakens while the bleed runs", () => {
    const a = arena("spikes", tiers("hamstring", 3), [foe(1, "drone", 7, 5)]);
    fire(a.g, a.tower);
    const slowed = a.g.state.enemies[0];
    expect(speedFactor(slowed, a.g.state.time)).toBeCloseTo(1 - spec("spikes", "hamstring", 3).slow);
    expect(statusOf(slowed, "slow")!.until).toBe(statusOf(slowed, "bleeding")!.until);
    const b = arena("spikes", tiers("open-wounds", 2), [foe(1, "drone", 7, 5)]);
    fire(b.g, b.tower);
    expect(damageTaken(b.g.state.enemies[0], b.g.state.time)).toBeCloseTo(1.12);
  });
  it("Tar Pit Flammable Tar oils the tarred enemy, so burns on it deal more", () => {
    const tarred = foe(1, "drone", 7, 5);
    const { g, tower } = arena("tar", tiers("flammable-tar", 3), [tarred]);
    fire(g, tower);
    expect(statusOf(tarred, "oiled")).toMatchObject({ boost: 2, until: g.state.time + 3.5 });
  });
  it("Spring Concussion weakens the thrown enemy until a while after it lands", () => {
    const thrown = foe(1, "drone", 7, 5);
    const { g, tower } = arena("spring", tiers("concussion", 2), [thrown]);
    fire(g, tower);
    const release = g.state.time + (resolveUpgrades(tower, DEFAULT_CONTENT).attack as { duration: number }).duration;
    expect(statusOf(thrown, "vulnerable")).toMatchObject({ amount: 0.15, until: release + 2 });
  });
  it("Tripwire Volley Signal strengthens only the alerted towers' next shot", () => {
    const target = foe(1, "drone", 7, 5, { hp: 100000, maxHp: 100000 });
    const { g, tower, damage } = arena("tripwire", tiers("volley-signal", 1), [target]);
    const pulse: Tower = { ...towerAt(2, "pulse", 8, 5), cooldown: 1 };
    g.state.towers.push(pulse);
    const shot = resolveUpgrades(pulse, DEFAULT_CONTENT).stats.damage;
    fire(g, tower);
    expect(lost(target)).toBeCloseTo(damage + shot * 1.5);
    expect(pulse.alerted).toBeUndefined();
    fire(g, pulse);
    expect(lost(target)).toBeCloseTo(damage + shot * 2.5);
  });
  it("Tripwire Flare reveals stealthed enemies in the alarm radius for a while", () => {
    const content = withTraits({ drone: [{ kind: "stealth" }] });
    const near = foe(2, "drone", 9, 5),
      far = foe(3, "drone", 12, 5);
    const { g, tower } = arena("tripwire", tiers("flare", 1), [foe(1, "drone", 7, 5), near, far], content);
    fire(g, tower);
    updateDetection(g);
    expect(near.revealed).toBe(true);
    expect(far.revealed).toBe(false);
    g.state.time += 1.6;
    updateDetection(g);
    expect(near.revealed).toBe(false);
  });
  it("Barricade Choke Point weakens enemies held at the wall", () => {
    const { g, cell, tower: wall } = buildTrap("barricade", 4);
    wall.upgrades = tiers("choke-point", 3);
    g.state.enemies = [walker(g, 1, "drone", cell - 1)];
    moveEnemies(g, 1);
    attackEnemies(g, 0);
    const held = g.state.enemies[0],
      exposure = 1 + spec("barricade", "choke-point", 3).bonus;
    expect(damageTaken(held, g.state.time)).toBeCloseTo(exposure);
    expect(lost(held)).toBeCloseTo(resolveUpgrades(wall, DEFAULT_CONTENT).stats.damage * exposure);
  });
  it("Warp Pad Disorient confuses the warped enemy", () => {
    const warped = foe(1, "drone", 7, 5);
    const { g, tower } = arena("warp", tiers("disorient", 1), [warped]);
    fire(g, tower);
    expect(warped.warped).toBe(true);
    expect(speedFactor(warped, g.state.time)).toBe(-1);
    g.state.time += 1.1;
    expect(speedFactor(warped, g.state.time)).toBe(1);
  });
  it("leaves plain traps' towers untouched and clears path state after a wave", () => {
    const plain = arena("tripwire", LEVELS, [foe(1, "drone", 7, 5)]);
    fire(plain.g, plain.tower);
    expect("flare" in plain.tower).toBe(false);
    const { g, tower } = arena("tripwire", tiers("flare", 1), [foe(1, "drone", 7, 5)]);
    const pulse: Tower = { ...towerAt(2, "pulse", 20, 20), cooldown: 1, alerted: 0.5 };
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
