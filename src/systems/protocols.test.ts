import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { makeEnemy } from "../core/test-helpers";
import { MISSIONS } from "../content/missions";
import type { Enemy, EnemyId, MissionDefinition, Protocols, Tower, TowerId } from "../core/types";
import { applyDamage, hitOf } from "./damage";
import { applyStatus, hasStatus } from "./status";
import { attackEnemies } from "./combat";
import { updateDetection } from "./detection";
import { tickProtocols } from "./protocols";
/** A game whose mission carries `protocols`, with towers and enemies placed straight into the state. */
function game(protocols?: Protocols) {
  const base = MISSIONS[0],
    mission: MissionDefinition = protocols ? { ...base, protocols } : base;
  const g = new Game(mission);
  g.state.status = "wave";
  return g;
}
function place(g: Game, type: TowerId, x: number, y: number): Tower {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
const enemy = (g: Game, type: EnemyId, hp = 500, x = 5, y = 5): Enemy => {
  const e = { ...makeEnemy(g.state.nextId++, type, x, y), hp, maxHp: hp };
  g.state.enemies.push(e);
  return e;
};
const src = (type: TowerId) => ({ tower: 0, type });
/** Damage a hit of `type` deals to a fresh enemy prepared by `prepare`. */
function dealt(protocols: Protocols | undefined, type: TowerId, kind: Parameters<typeof hitOf>[0], prepare: (g: Game, e: Enemy) => void = () => {}, foe: EnemyId = "drone") {
  const g = game(protocols),
    e = enemy(g, foe);
  prepare(g, e);
  applyDamage(g, src(type), e, 100, false, hitOf(kind, src(type)));
  return { amount: 500 - e.hp, g, e };
}
const slow = (factor: number) => (g: Game, e: Enemy) => applyStatus(g, e, { kind: "slow", factor, until: g.state.time + 3 });
describe("Thermal Fracture", () => {
  const p = { fracture: { slowAt: 0.7, bonus: 0.4 } };
  it("adds its bonus to an explosive hit on a slowed enemy, once, and ends the slow", () => {
    const { amount, g, e } = dealt(p, "blast", "splash", slow(0.55));
    expect(amount).toBeCloseTo(140);
    expect(hasStatus(e, "slow", g.state.time)).toBe(false);
    expect(g.state.events.some((x) => x.type === "protocol" && x.protocol === "fracture")).toBe(true);
    applyDamage(g, src("blast"), e, 100, false, hitOf("splash", src("blast")));
    expect(500 - e.hp).toBeCloseTo(240);
  });
  it("ignores weak slows, other attacks and missions without the relic", () => {
    expect(dealt(p, "blast", "splash", slow(0.75)).amount).toBeCloseTo(100);
    expect(dealt(p, "pulse", "direct", slow(0.55)).amount).toBeCloseTo(100);
    expect(dealt(undefined, "blast", "splash", slow(0.55)).amount).toBeCloseTo(100);
  });
});
describe("Kill Box", () => {
  const p = { killbox: { speedAt: 0.8, bonus: 0.5 } };
  it("strengthens trap hits on held enemies only", () => {
    expect(dealt(p, "mine", "splash", slow(0.6)).amount).toBeCloseTo(150);
    expect(dealt(p, "mine", "splash").amount).toBeCloseTo(100);
    expect(dealt(p, "blast", "splash", slow(0.6)).amount).toBeCloseTo(100);
  });
});
describe("Unstable Reactor", () => {
  const p = (lives: number) => (g: Game) => (g.state.lives = lives),
    rules = { unstable: { reactorMax: 20, from: 0.8, to: 0.3, max: 0.3 } };
  it("grows with the lost energy up to its cap", () => {
    expect(dealt(rules, "pulse", "direct", p(20)).amount).toBeCloseTo(100);
    expect(dealt(rules, "pulse", "direct", p(11)).amount).toBeCloseTo(115);
    expect(dealt(rules, "pulse", "direct", p(6)).amount).toBeCloseTo(130);
    expect(dealt(rules, "pulse", "direct", p(1)).amount).toBeCloseTo(130);
  });
});
describe("Singularity Protocol", () => {
  const p = { singularity: { every: 8, duration: 5, bonus: 0.3 } };
  it("marks the toughest visible enemy on the clock, one at a time", () => {
    const g = game(p),
      weak = enemy(g, "drone", 100),
      tough = enemy(g, "drone", 400);
    g.state.time = 8;
    tickProtocols(g, 1 / 30);
    expect(hasStatus(tough, "singularity", g.state.time)).toBe(true);
    expect(hasStatus(weak, "singularity", g.state.time)).toBe(false);
    // No second mark while the first one lasts; once it has run out, the now toughest enemy takes it.
    tough.hp = 50;
    g.state.time = 12;
    tickProtocols(g, 1 / 30);
    expect(hasStatus(weak, "singularity", g.state.time)).toBe(false);
    g.state.time = 16;
    tickProtocols(g, 1 / 30);
    expect(hasStatus(weak, "singularity", g.state.time)).toBe(true);
  });
  it("makes precision towers aim at the mark and hit it harder", () => {
    const g = game(p),
      first = enemy(g, "drone", 400, 6, 5),
      marked = enemy(g, "drone", 400, 6, 6);
    first.distance = 20;
    applyStatus(g, marked, { kind: "singularity", until: 5 });
    place(g, "pulse", 5, 5);
    place(g, "blast", 5, 6);
    attackEnemies(g, 1 / 30);
    const shots = g.state.projectiles.map((x) => [x.type, x.tx, x.ty]);
    expect(shots).toContainEqual(["pulse", marked.x, marked.y]);
    expect(shots).toContainEqual(["blast", first.x, first.y]);
    applyDamage(g, src("pulse"), marked, 100, false, hitOf("direct", src("pulse")));
    expect(400 - marked.hp).toBeCloseTo(130);
  });
});
describe("boss signature protocols", () => {
  it("Armorbreaker: an area hit dissolves an armored enemy's armor", () => {
    const { g, e } = dealt({ armorbreak: { fraction: 0.5, duration: 3 } }, "blast", "splash", () => {}, "bulwark");
    expect(hasStatus(e, "armorDissolved", g.state.time)).toBe(true);
    const plain = dealt({ armorbreak: { fraction: 0.5, duration: 3 } }, "pulse", "direct", () => {}, "bulwark");
    expect(hasStatus(plain.e, "armorDissolved", 0)).toBe(false);
  });
  it("Skyhunter: a hit leaving a flyer under half its HP nets it", () => {
    const p = { skyhunter: { below: 0.5, duration: 2, factor: 0.8 } },
      g = game(p),
      e = enemy(g, "glider", 150);
    applyDamage(g, src("flak"), e, 50, false, hitOf("direct", src("flak")));
    expect(hasStatus(e, "netted", g.state.time)).toBe(false);
    applyDamage(g, src("flak"), e, 50, false, hitOf("direct", src("flak")));
    expect(hasStatus(e, "netted", g.state.time)).toBe(true);
  });
  it("Titan Core: heavy enemies take more, and their death reloads the towers around", () => {
    const p = { titan: { bonus: 0.2, reload: 3 } };
    expect(dealt(p, "pulse", "direct", () => {}, "boss").amount).toBeCloseTo(100);
    const g = game(p),
      heavy = { ...makeEnemy(g.state.nextId++, "boss", 5, 5), hp: 100, maxHp: 1600 },
      near = place(g, "pulse", 6, 5),
      far = place(g, "pulse", 12, 12);
    near.cooldown = far.cooldown = 0.9;
    g.state.enemies.push(heavy);
    applyDamage(g, src("pulse"), heavy, 200, false, hitOf("direct", src("pulse")));
    expect([near.cooldown, far.cooldown]).toEqual([0, 0.9]);
  });
  it("Swarm: towers reload faster the more enemies stand in range, up to the cap", () => {
    const g = game({ swarm: { per: 0.02, max: 0.2 } }),
      t = place(g, "pulse", 5, 5);
    for (let i = 0; i < 20; i++) enemy(g, "drone", 1000, 5.5, 5);
    t.cooldown = 1;
    attackEnemies(g, 0.11);
    // 0.11 s at 1.2× the rate over a 0.55 s interval.
    expect(t.cooldown).toBeCloseTo(1 - (0.11 * 1.2) / 0.55);
  });
  it("Scanner: towers reveal stealth close by, and revealed enemies take more", () => {
    const g = game({ scanner: { radius: 1.2, bonus: 0.15 } }),
      near = enemy(g, "phantom", 500, 5.5, 5),
      far = enemy(g, "phantom", 500, 12, 12);
    place(g, "pulse", 5, 5);
    updateDetection(g);
    expect([near.revealed, far.revealed]).toEqual([true, false]);
    applyDamage(g, src("pulse"), near, 100, false, hitOf("direct", src("pulse")));
    expect(500 - near.hp).toBeCloseTo(115);
  });
});
describe("protocols and determinism", () => {
  it("leave a mission without them exactly as before, and replay alike with them", () => {
    const run = (protocols?: Protocols) => {
      const g = game(protocols);
      g.state.status = "ready";
      g.state.wallets[0] = 2000;
      g.command({ type: "build", tower: "frost", x: 2, y: 2 });
      g.command({ type: "build", tower: "blast", x: 3, y: 2 });
      g.command({ type: "start" });
      for (let i = 0; i < 1500; i++) g.tick();
      return stateHash(g.state);
    };
    const all: Protocols = { fracture: { slowAt: 0.7, bonus: 0.4 }, singularity: { every: 8, duration: 5, bonus: 0.3 }, unstable: { reactorMax: 20, from: 0.8, to: 0.3, max: 0.3 } };
    expect(run(all)).toBe(run(all));
    expect(run({})).toBe(run());
  });
});
