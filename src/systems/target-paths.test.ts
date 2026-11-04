import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { foe, L3, place, emptyWave } from "../core/test-helpers";
import type { Enemy, EnemyId, Tower } from "../core/types";
import { resetScrapYards, tickTargetPaths } from "./target-paths";
import { applyDamage, hitOf } from "./damage";
import { updateDetection } from "./detection";
import { armorDissolved, hasStatus } from "./status";
import { markFactor } from "./support";

const enemy = (g: Game, type: EnemyId, x: number, y: number, hp?: number) => foe(g.state.nextId++, type, x, y, { hp, into: g });
/** A plain hit of `amount` from the Pulse tower `t`; returns the HP the enemy lost. */
function hit(g: Game, t: Tower, e: Enemy, amount = 100) {
  const before = e.hp,
    src = { tower: t.id, type: t.type };
  applyDamage(g, src, e, amount, false, hitOf("direct", src));
  return before - e.hp;
}

describe("Tracker paths", () => {
  it("Weak Point strips part of a marked enemy's armor", () => {
    const g = new Game(),
      gun = place(g, "pulse", 12, 12);
    const tracker = place(g, "tracker", 5, 5, L3);
    const scarab = enemy(g, "scarab", 5, 6);
    expect(hit(g, gun, scarab)).toBeCloseTo(100 * 1.25 * 0.7);
    tracker.upgrades = [...L3, "weak-point-1"];
    expect(hit(g, gun, scarab)).toBeCloseTo(100 * 1.25 * (1 - 0.3 * 0.8));
  });
  it("Hunter's Mark adds to the strongest enemy in radius only (max HP, then progress)", () => {
    const g = new Game();
    place(g, "tracker", 5, 5, [...L3, "hunters-mark-1"]);
    const big = enemy(g, "drone", 5, 6),
      small = enemy(g, "drone", 6, 5);
    big.maxHp = 2000;
    expect(markFactor(g, big)).toBeCloseTo(1.35);
    expect(markFactor(g, small)).toBeCloseTo(1.25);
    big.maxHp = 1000;
    small.distance = 20;
    expect(markFactor(g, small)).toBeCloseTo(1.35);
  });
  it("Lingering Tag keeps the mark after the enemy leaves the radius, then drops it", () => {
    const g = new Game();
    place(g, "tracker", 5, 5, [...L3, "lingering-tag-1"]);
    const e = enemy(g, "drone", 5, 6);
    g.state.time = 10;
    tickTargetPaths(g, 1 / 30);
    e.y = 12;
    g.state.time = 10.9;
    expect(markFactor(g, e)).toBeCloseTo(1.25);
    g.state.time = 11;
    expect(markFactor(g, e)).toBe(1);
    tickTargetPaths(g, 1 / 30);
    expect(e.tag).toBeUndefined();
  });
});

describe("Detector paths", () => {
  it("Exposure Scan amplifies damage on revealed stealth units only", () => {
    const g = new Game(),
      gun = place(g, "pulse", 12, 12);
    place(g, "detector", 5, 5, [...L3, "exposure-scan-1"]);
    const phantom = enemy(g, "phantom", 5, 7),
      drone = enemy(g, "drone", 5, 6);
    updateDetection(g);
    expect(phantom.revealed).toBe(true);
    expect(hit(g, gun, phantom)).toBeCloseTo(110);
    expect(hit(g, gun, drone)).toBe(100);
  });
  it("Static Pulse disrupts the strongest enemy in radius on its clock grid", () => {
    const g = new Game();
    place(g, "detector", 5, 5, [...L3, "static-pulse-1"]);
    const weak = enemy(g, "drone", 5, 6),
      strong = enemy(g, "drone", 6, 5);
    strong.maxHp = 3000;
    g.state.time = 3;
    tickTargetPaths(g, 1 / 30);
    expect(hasStatus(strong, "disrupted", 3)).toBe(false);
    g.state.time = 6.01;
    tickTargetPaths(g, 1 / 30);
    expect(hasStatus(strong, "disrupted", 7)).toBe(true);
    expect(hasStatus(strong, "disrupted", 7.6)).toBe(false);
    expect(hasStatus(weak, "disrupted", 7)).toBe(false);
  });
  it("Afterimage keeps a stealth unit revealed after it leaves the radius", () => {
    const g = new Game();
    place(g, "detector", 5, 5, [...L3, "afterimage-1"]);
    const phantom = enemy(g, "phantom", 5, 7);
    g.state.time = 4;
    updateDetection(g);
    tickTargetPaths(g, 1 / 30);
    phantom.y = 14;
    g.state.time = 4.5;
    updateDetection(g);
    expect(phantom.revealed).toBe(true);
    g.state.time = 5;
    updateDetection(g);
    expect(phantom.revealed).toBe(false);
  });
});

describe("Recycler paths", () => {
  const RECYCLER = ["level-2", "level-3"];
  it("Cascade passes a killing jump's own overkill on once more", () => {
    const g = new Game(),
      gun = place(g, "pulse", 12, 12),
      recycler = place(g, "recycler", 5, 5, RECYCLER);
    const victim = enemy(g, "drone", 5, 6, 10),
      second = enemy(g, "drone", 5, 6.5, 10),
      third = enemy(g, "drone", 5, 7.5);
    hit(g, gun, victim);
    expect(second.hp).toBeLessThanOrEqual(0);
    expect(third.hp).toBe(1000);
    recycler.upgrades = [...RECYCLER, "cascade-1"];
    const v2 = enemy(g, "drone", 5, 6, 10),
      s2 = enemy(g, "drone", 5, 6.5, 10);
    hit(g, gun, v2);
    expect(s2.hp).toBeLessThanOrEqual(0);
    // 90 overkill × 150% = 135 on a 10 HP enemy: 125 overkill, 30% of it jumps on.
    expect(third.hp).toBeCloseTo(1000 - 125 * 0.3);
  });
  it("Meltdown sets a surviving jump target alight", () => {
    const g = new Game(),
      gun = place(g, "pulse", 12, 12);
    place(g, "recycler", 5, 5, [...RECYCLER, "meltdown-1"]);
    const victim = enemy(g, "drone", 5, 6, 10),
      target = enemy(g, "drone", 5, 6.5);
    hit(g, gun, victim);
    const burn = target.status.find((s) => s.kind === "burn");
    expect(burn).toMatchObject({ kind: "burn", dps: (135 * 0.3) / 3, source: { tower: gun.id, type: "pulse" } });
  });
  it("Scrap Yard pays 1 credit per 60 overkill up to 8 per wave, then starts over", () => {
    const g = new Game(),
      gun = place(g, "pulse", 12, 12),
      yard = place(g, "recycler", 5, 5, [...RECYCLER, "scrap-yard-1"]);
    const wallet = () => g.state.wallets[0];
    let before = wallet();
    const victim = enemy(g, "drone", 5, 6, 10);
    hit(g, gun, victim, 130); // 120 overkill: 2 credits
    const reward = g.state.events.filter((e) => e.type === "kill").reduce((sum, e) => sum + (e.type === "kill" ? e.reward : 0), 0);
    expect(wallet() - before - reward).toBe(2);
    expect(yard.scrapYard).toEqual({ overkill: 0, paid: 2 });
    before = wallet();
    g.state.events = [];
    hit(g, gun, enemy(g, "drone", 5, 6, 10), 10000);
    const income = g.state.events.filter((e) => e.type === "income");
    expect(income).toEqual([expect.objectContaining({ amount: 6 })]);
    expect(yard.scrapYard?.paid).toBe(8);
    resetScrapYards(g);
    expect(yard.scrapYard).toBeUndefined();
  });
});

describe("Armory paths", () => {
  it("Shred strips armor of armored targets for every tower; unarmored ones get no status", () => {
    const g = new Game(),
      gun = place(g, "pulse", 5, 6);
    place(g, "armory", 5, 5, [...L3, "shred-1"]);
    const scarab = enemy(g, "scarab", 9, 9),
      drone = enemy(g, "drone", 9, 9);
    hit(g, gun, scarab);
    hit(g, gun, drone);
    expect(armorDissolved(scarab, g.state.time + 1)).toBeCloseTo(0.1);
    expect(armorDissolved(scarab, g.state.time + 2)).toBe(0);
    expect(drone.status).toEqual([]);
  });
  it("Hollow Points adds damage on unarmored targets of covered towers", () => {
    const g = new Game(),
      gun = place(g, "pulse", 5, 6),
      far = place(g, "pulse", 12, 12);
    place(g, "armory", 5, 5, [...L3, "hollow-points-1"]);
    const drone = enemy(g, "drone", 9, 9);
    expect(hit(g, gun, drone)).toBeCloseTo(106);
    expect(hit(g, far, drone)).toBe(100);
    const scarab = enemy(g, "scarab", 9, 9);
    expect(hit(g, gun, scarab)).toBeCloseTo(100 * (1 - 0.3 * 0.2));
  });
  it("Shieldbreaker makes hits count more against shields", () => {
    const g = new Game(),
      gun = place(g, "pulse", 5, 6);
    place(g, "armory", 5, 5, [...L3, "shieldbreaker-1"]);
    const aegis = enemy(g, "aegis", 9, 9);
    aegis.shield = 600;
    expect(hit(g, gun, aegis)).toBe(0);
    expect(aegis.shield).toBeCloseTo(480);
    expect(hit(g, gun, aegis, 500)).toBeCloseTo(100);
    expect(aegis.shield).toBe(0);
  });
});

describe("boards without these paths", () => {
  it("keep the level-3 effects and never set the new fields", () => {
    const g = new Game();
    for (const [tower, x, y] of [["tracker", 3, 2], ["detector", 6, 2], ["recycler", 9, 2], ["armory", 12, 2]] as const) place(g, tower, x, y, L3);
    place(g, "pulse", 4, 4);
    place(g, "blast", 8, 4);
    const e = enemy(g, "drone", 3, 3);
    expect(markFactor(g, e)).toBe(1.25);
    emptyWave(g);
    for (const t of g.state.towers) expect(t.scrapYard).toBeUndefined();
    expect(JSON.stringify(g.state)).not.toMatch(/"tag"|revealUntil|scrapYard/);
  });
});
