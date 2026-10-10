import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { finishWave, makeEnemy } from "../core/test-helpers";
import { MISSIONS } from "../content/missions";
import { ENEMIES } from "../content/enemies";
import type { Tower, TowerId } from "../core/types";
import { applyDamage } from "./damage";
import { applyStatus } from "./status";
import { bountyBonus, markFactor } from "./support";
/** Places a tower straight into the state; support effects are pure queries over the towers. */
function place(g: Game, type: TowerId, x: number, y: number, upgrades: string[] = []) {
  const t: Tower = { id: g.state.nextId++, type, x, y, upgrades, cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  g.state.towers.push(t);
  return t;
}
const src = { tower: 0, type: "pulse" as const };
describe("Prämienbake", () => {
  it("adds half the reward for kills in range, nothing outside, and never stacks", () => {
    const g = new Game(),
      reward = ENEMIES.tank.reward;
    place(g, "beacon", 5, 5);
    place(g, "beacon", 5, 6);
    const near = makeEnemy(1, "tank", 5, 6.5),
      far = makeEnemy(2, "tank", 12, 12);
    g.state.enemies = [near, far];
    const before = g.state.wallets[0];
    applyDamage(g, src, near, 5000);
    expect(g.state.wallets[0] - before).toBe(reward + Math.round(reward * 0.5));
    applyDamage(g, src, far, 5000);
    expect(g.state.wallets[0] - before).toBe(2 * reward + Math.round(reward * 0.5));
  });
  it("pays nothing for enemies sent by an opponent, and more after upgrades", () => {
    const g = new Game();
    place(g, "beacon", 5, 5, ["level-2", "level-3"]);
    const sent = { ...makeEnemy(1, "tank", 5, 5), sentBy: 1 };
    g.state.enemies = [sent];
    const before = g.state.wallets[0];
    applyDamage(g, src, sent, 5000);
    expect(g.state.wallets[0]).toBe(before);
    expect(bountyBonus(g, makeEnemy(2, "tank", 5, 7.9), 20)).toBe(20);
  });
});
describe("Reparaturdock", () => {
  it("restores reactor energy after a wave, never above the start value", () => {
    const g = new Game();
    g.state.wallets[0] = 1000;
    place(g, "dock", 0, 0);
    g.state.lives = g.mission.reactorEnergy - 3;
    g.command({ type: "start" });
    g.state.queue = [];
    g.state.enemies = [];
    finishWave(g);
    expect(g.state.lives).toBe(g.mission.reactorEnergy - 2);
    place(g, "dock", 0, 1, ["level-2", "level-3"]);
    g.command({ type: "start" });
    g.state.queue = [];
    g.state.enemies = [];
    finishWave(g);
    expect(g.state.lives).toBe(g.mission.reactorEnergy);
  });
  it("is not offered on a ring without a reactor", () => {
    expect(new Game().availableTowers()).toContain("dock");
    const ring = MISSIONS.find((m) => m.circle)!;
    expect(new Game(ring).availableTowers()).not.toContain("dock");
  });
});
describe("Peilsender", () => {
  it("raises damage in range, multiplies with Korrosion, and overlapping trackers take the strongest", () => {
    const g = new Game();
    const inside = makeEnemy(1, "drone", 5, 6),
      outside = makeEnemy(2, "drone", 12, 12);
    g.state.enemies = [inside, outside];
    place(g, "tracker", 5, 5);
    place(g, "tracker", 5, 7, ["level-2"]);
    expect(markFactor(g, inside)).toBeCloseTo(1.2);
    expect(markFactor(g, outside)).toBe(1);
    applyStatus(g, inside, { kind: "vulnerable", amount: 0.25, until: 5 });
    applyDamage(g, src, inside, 100);
    applyDamage(g, src, outside, 100);
    expect(1000 - inside.hp).toBeCloseTo(100 * 1.25 * 1.2);
    expect(1000 - outside.hp).toBe(100);
  });
});
