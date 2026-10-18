import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { makeEnemy } from "../core/test-helpers";
import type { AttackSpec, Tower, TowerId } from "../core/types";
import { attackError, canTarget } from "./attacks";
import { attackEnemies } from "./combat";
import { applyDamage, hitOf } from "./damage";
import { critFactor, overclockRate, skylinkFactor, synergyFactor } from "./support";
/** Places a tower straight into the state; support effects are pure queries over the towers. */
function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = []) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
describe("Overclock", () => {
  it("doubles the cooling rate of towers in reach during the first 3 s of every 10 s", () => {
    const g = new Game(),
      near = place(g, "pulse", 5, 6),
      far = place(g, "pulse", 12, 12);
    place(g, "overclock", 5, 5);
    g.state.time = 1;
    expect(overclockRate(g, near)).toBe(2);
    expect(overclockRate(g, far)).toBe(1);
    g.state.time = 5;
    expect(overclockRate(g, near)).toBe(1);
    g.state.time = 21.5;
    expect(overclockRate(g, near)).toBe(2);
  });
  it("rejects a burst as long as its cycle", () => {
    expect(attackError({ kind: "overclock", boost: 1, window: 10, period: 10 } as AttackSpec)).toBeDefined();
    expect(attackError({ kind: "overclock", boost: 1, window: 3, period: 10 } as AttackSpec)).toBeUndefined();
  });
});
describe("Fire Control", () => {
  it("crits every 4th shot of a covered tower and never counts without one", () => {
    const g = new Game(),
      near = place(g, "pulse", 5, 6),
      far = place(g, "pulse", 12, 12);
    place(g, "firectl", 5, 5);
    const target = { x: 6, y: 6 },
      factors = [1, 2, 3, 4, 5].map(() => critFactor(g, near, target));
    expect(factors).toEqual([1, 1, 1, 2.5, 1]);
    expect(near.critCount).toBe(1);
    expect(g.state.events.filter((e) => e.type === "crit")).toHaveLength(1);
    expect(critFactor(g, far, target)).toBe(1);
    expect(far.critCount).toBeUndefined();
  });
  it("multiplies the salvo of a real shot and hashes the counter only once present", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6),
      before = stateHash(g.state);
    t.critCount = 3;
    expect(stateHash(g.state)).not.toBe(before);
    place(g, "firectl", 5, 5);
    const e = makeEnemy(100, "tank", 5.5, 6.5);
    g.state.enemies = [e];
    g.state.status = "wave";
    attackEnemies(g, 1 / 30);
    expect(t.critCount).toBe(0);
    expect(g.state.projectiles[0].damage).toBeCloseTo(g.content.towers.pulse.damage * 2.5);
  });
});
describe("Armory", () => {
  it("lets hits of towers in reach ignore half the armor, but not dots or towers outside", () => {
    const g = new Game(),
      near = place(g, "pulse", 5, 6),
      far = place(g, "pulse", 12, 12);
    place(g, "armory", 5, 5);
    const hit = (tower: Tower, dot = false) => {
      const e = makeEnemy(g.state.nextId++, "scarab", 6, 6);
      g.state.enemies = [e];
      applyDamage(g, { tower: tower.id, type: tower.type }, e, 100, dot, dot ? undefined : hitOf("direct", { tower: tower.id, type: tower.type }));
      return 1000 - e.hp;
    };
    expect(hit(near)).toBeCloseTo(100 * (1 - 0.3 * 0.5));
    expect(hit(far)).toBeCloseTo(70);
    expect(hit(near, true)).toBeCloseTo(70);
  });
});
describe("Skylink", () => {
  it("makes flyers in reach ground targets, at 60 % damage from ground-only towers", () => {
    const g = new Game(),
      held = makeEnemy(1, "glider", 5, 6),
      free = makeEnemy(2, "glider", 12, 12);
    g.state.enemies = [held, free];
    expect(canTarget(g, "mortar", held)).toBe(false);
    place(g, "skylink", 5, 5);
    expect(canTarget(g, "mortar", held)).toBe(true);
    expect(canTarget(g, "mortar", free)).toBe(false);
    expect(skylinkFactor(g, { tower: 0, type: "mortar" }, held, false)).toBe(0.6);
    // Towers that hit flyers anyway keep their full damage.
    expect(skylinkFactor(g, { tower: 0, type: "pulse" }, held, false)).toBe(1);
    // Only direct hits are scaled: burns, Recycler jumps and trap hits deal full damage.
    expect(skylinkFactor(g, { tower: 0, type: "mortar" }, held, true)).toBe(1);
    expect(skylinkFactor(g, { tower: 0, type: "mortar" }, held, false, hitOf("overkill", { tower: 0, type: "mortar" }))).toBe(1);
    expect(skylinkFactor(g, { tower: 0, type: "arc" }, held, false)).toBe(1);
    applyDamage(g, { tower: 0, type: "blast" }, held, 100);
    expect(held.hp).toBeCloseTo(940);
  });
});
describe("Nexus", () => {
  it("adds 4 % per distinct attack tower type in reach, capped, support towers not counted", () => {
    const g = new Game(),
      t = place(g, "pulse", 5, 6);
    place(g, "nexus", 5, 5);
    place(g, "pulse", 4, 5);
    place(g, "tracker", 6, 5);
    expect(synergyFactor(g, t)).toBeCloseTo(1.04);
    const types: TowerId[] = ["blast", "flak", "tesla", "lance", "frost", "mortar", "inferno"];
    types.forEach((type, i) => place(g, type, 3 + (i % 4), i < 4 ? 4 : 6));
    expect(synergyFactor(g, t)).toBeCloseTo(1.24);
    expect(synergyFactor(g, place(g, "pulse", 13, 13))).toBe(1);
  });
});
