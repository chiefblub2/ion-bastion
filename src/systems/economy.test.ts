import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { stateHash } from "../core/hash";
import { finishWave, makeEnemy } from "../core/test-helpers";
import { MISSIONS } from "../content/missions";
import { TOWERS } from "../content/towers";
import type { Tower, TowerDefinition, TowerId } from "../core/types";
import { validateTower } from "../core/validation";
import { applyDamage } from "./damage";
import { moveEnemies } from "./movement";
import { interestOn } from "./support";
import { discountedCost, upgradeDiscount } from "./workshop";
/** Places a tower straight into the state; the economy towers are pure queries over the towers. */
function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = [], owner = 0) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner };
  g.state.towers.push(t);
  return t;
}
/** Runs one empty wave to its end, so the after-wave payouts happen. */
function emptyWave(g: Game) {
  g.command({ type: "start" });
  g.state.queue = [];
  g.state.enemies = [];
  finishWave(g);
}
const src = { tower: 0, type: "pulse" as const };
describe("Workshop", () => {
  it("charges the discounted price for towers in range, takes the strongest Workshop and never discounts itself", () => {
    const g = new Game();
    g.state.wallets[0] = 1000;
    const pulse = place(g, "pulse", 5, 5),
      far = place(g, "pulse", 14, 9),
      shop = place(g, "workshop", 6, 5);
    place(g, "workshop", 5, 6, ["level-2"]);
    expect(upgradeDiscount(pulse, g.state.towers)).toBe(0.25);
    expect(upgradeDiscount(far, g.state.towers)).toBe(0);
    expect(upgradeDiscount(shop, g.state.towers)).toBe(0);
    const cost = TOWERS.pulse.upgrades[0].cost;
    expect(g.command({ type: "upgrade", id: pulse.id, upgrade: "level-2" }).ok).toBe(true);
    expect(g.state.wallets[0]).toBe(1000 - discountedCost(cost, 0.25));
    expect(pulse.spent).toBe(discountedCost(cost, 0.25));
    expect(g.drainEvents().some((e) => e.type === "discount" && e.amount === cost - discountedCost(cost, 0.25))).toBe(true);
  });
  it("lets a tower upgrade on credits that only cover the discounted price", () => {
    const g = new Game(),
      pulse = place(g, "pulse", 5, 5),
      cost = TOWERS.pulse.upgrades[0].cost;
    g.state.wallets[0] = discountedCost(cost, 0.2);
    expect(g.command({ type: "upgrade", id: pulse.id, upgrade: "level-2" }).ok).toBe(false);
    place(g, "workshop", 6, 5);
    expect(g.command({ type: "upgrade", id: pulse.id, upgrade: "level-2" }).ok).toBe(true);
    expect(g.state.wallets[0]).toBe(0);
  });
});
describe("Vault", () => {
  it("rounds interest down and caps it", () => {
    expect(interestOn(399, 0.05, 40)).toBe(19);
    expect(interestOn(5000, 0.05, 40)).toBe(40);
    expect(interestOn(-5, 0.05, 40)).toBe(0);
  });
  it("pays each owner once after a wave from their best Vault, on their own wallet", () => {
    const g = new Game();
    g.setPlayers(2);
    place(g, "vault", 0, 0, [], 0);
    place(g, "vault", 0, 1, ["level-2"], 0);
    g.state.wallets = [400, 1000];
    const bonus = g.mission.waves[0].bonus;
    emptyWave(g);
    // Interest is on what each player held at the wave's end, before the wave bonus is split.
    expect(g.state.wallets[0]).toBe(400 + interestOn(400, 0.07, 60) + Math.floor(bonus / 2) + (bonus % 2));
    expect(g.state.wallets[1]).toBe(1000 + Math.floor(bonus / 2));
  });
});
describe("Shield Generator", () => {
  it("absorbs the first reactor damage of a wave, lets the rest through and recharges after the wave", () => {
    const g = new Game(),
      shield = place(g, "shieldgen", 0, 0),
      lives = g.state.lives,
      path = g.mission.map.path;
    g.command({ type: "start" });
    g.state.queue = [];
    const leaker = (id: number) => ({ ...makeEnemy(id, "tank", path.at(-1)!.x, path.at(-1)!.y, path.length - 1.01), hp: 1 });
    const leak = g.content.enemies.tank.leak;
    g.state.enemies = [leaker(900), leaker(901)];
    moveEnemies(g, 1);
    const absorbed = Math.min(3, 2 * leak);
    expect(g.state.lives).toBe(lives - (2 * leak - absorbed));
    expect(shield.barrier).toBe(absorbed);
    expect(stateHash(g.state)).not.toBe(stateHash({ ...g.state, towers: g.state.towers.map((t) => ({ ...t, barrier: undefined })) }));
    g.state.enemies = [];
    finishWave(g);
    expect(shield.barrier).toBeUndefined();
  });
  it("is not offered on a ring without a reactor", () => {
    expect(new Game().availableTowers()).toContain("shieldgen");
    expect(new Game(MISSIONS.find((m) => m.circle)!).availableTowers()).not.toContain("shieldgen");
  });
});
describe("Recycler", () => {
  it("passes the overkill of a kill in range to the nearest enemy within reach, once", () => {
    const g = new Game();
    place(g, "recycler", 5, 5);
    const victim = { ...makeEnemy(1, "drone", 5, 6), hp: 100 },
      near = makeEnemy(2, "drone", 6, 6),
      farther = makeEnemy(3, "drone", 6.5, 6),
      outside = makeEnemy(4, "drone", 9, 6);
    g.state.enemies = [victim, farther, near, outside];
    applyDamage(g, src, victim, 400);
    expect(near.hp).toBe(1000 - 300);
    expect(farther.hp).toBe(1000);
    // The jump kills nothing here; a jump that kills never jumps again.
    const chain = { ...makeEnemy(5, "drone", 5, 4), hp: 10 },
      after = makeEnemy(6, "drone", 5, 3.2);
    g.state.enemies = [{ ...makeEnemy(7, "drone", 5, 4.5), hp: 10 }, chain, after];
    applyDamage(g, src, g.state.enemies[0], 1000);
    expect(chain.hp).toBeLessThanOrEqual(0);
    expect(after.hp).toBe(1000);
    // Outside every Recycler's range the overkill is lost.
    const lone = { ...makeEnemy(8, "drone", 14, 9), hp: 10 },
      by = makeEnemy(9, "drone", 14, 9.5);
    g.state.enemies = [lone, by];
    applyDamage(g, src, lone, 500);
    expect(by.hp).toBe(1000);
  });
  it("rejects invalid values", () => {
    const bad = (attack: object) => () => validateTower({ ...TOWERS.recycler, attack } as TowerDefinition, "recycler");
    expect(bad({ kind: "overkill", share: 0, reach: 2 })).toThrow();
    expect(bad({ kind: "overkill", share: 1, reach: 0 })).toThrow();
    expect(() => validateTower({ ...TOWERS.vault, attack: { kind: "interest", rate: 1.5, cap: 40 } } as TowerDefinition, "vault")).toThrow();
  });
});
