import { DEFAULT_CONTENT } from "../content";
import { describe, expect, it } from "vitest";
import { Game, sellValue } from "../core/game";
import { emptyWave, finishWave, L3, makeEnemy, openWave, place, tiers } from "../core/test-helpers";
import { MISSIONS } from "../content/missions";
import { TOWERS } from "../content/towers";
import type { Enemy, Tower } from "../core/types";
import { effectiveTowerStats } from "./auras";
import { applyDamage } from "./damage";
import { lureFactor, tickEconomy } from "./economy-paths";
import { moveEnemies } from "./movement";
import { interestOn } from "./support";

function coop() {
  const g = new Game();
  g.setPlayers(2);
  g.command({ type: "restart" });
  return g;
}
const src = { tower: 0, type: "pulse" as const };
const kill = (g: Game, e: Enemy) => {
  g.state.enemies.push(e);
  applyDamage(g, src, e, Infinity);
};
const leaker = (g: Game, id: number, distance = g.mission.map.path.length - 1.01) => {
  const end = g.mission.map.path.at(-1)!;
  return { ...makeEnemy(id, "tank", end.x, end.y, distance), hp: 1 };
};
/** Free buildable cells next to `at`, nearest first. */
function freeCells(g: Game, at: { x: number; y: number }) {
  const cells: { x: number; y: number }[] = [];
  for (let x = 0; x < g.map.columns; x++) for (let y = 0; y < g.map.rows; y++) if (g.canBuild(x, y, "pulse")) cells.push({ x, y });
  return cells.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
}
/** Pulse at level 5 plus its Sharpshooter tiers: its max level. */
const maxedPulse = TOWERS.pulse.upgrades.filter((u) => !u.path || u.path === "sharpshooter").map((u) => u.id);

describe("Bounty Beacon paths", () => {
  it("Big Game pays its owner for heavy kills in its radius, up to the cap per wave (co-op)", () => {
    const run = (upgrades: string[]) => {
      const g = coop();
      place(g, "beacon", 5, 5, upgrades, { owner: 1 });
      g.state.wallets = [0, 0];
      kill(g, { ...makeEnemy(1, "drone", 5, 6), hp: 10, maxHp: 500 });
      const light = [...g.state.wallets];
      kill(g, makeEnemy(2, "drone", 5, 6));
      const once = [...g.state.wallets];
      for (const id of [3, 4]) kill(g, makeEnemy(id, "drone", 5, 6));
      kill(g, makeEnemy(5, "drone", 14, 9));
      return { light, once, end: [...g.state.wallets], g };
    };
    const plain = run(L3),
      hunter = run(tiers("big-game", 1, L3));
    expect(hunter.light).toEqual(plain.light);
    expect(hunter.once).toEqual([plain.once[0], plain.once[1] + 10]);
    // Three heavy kills in the radius, but the cap is 20 per wave; the kill outside the radius pays nothing extra.
    expect(hunter.end).toEqual([plain.end[0], plain.end[1] + 20]);
    expect(hunter.g.state.towers[0].economy).toEqual({ bounty: 20 });
    emptyWave(hunter.g);
    expect(hunter.g.state.towers[0].economy).toBeUndefined();
  });
  it("Lure slows enemies in its radius, never slow-immune ones", () => {
    const g = new Game();
    place(g, "beacon", 5, 5, tiers("lure", 3, L3));
    expect(lureFactor(g, makeEnemy(1, "drone", 5, 6))).toBeCloseTo(0.8);
    expect(lureFactor(g, makeEnemy(2, "drone", 14, 9))).toBe(1);
    const immune = (Object.keys(g.content.enemies) as Enemy["type"][]).find((id) => g.content.enemies[id].traits?.some((t) => t.kind === "slowImmune"));
    if (immune) expect(lureFactor(g, makeEnemy(3, immune, 5, 6))).toBe(1);
  });
  it("Field Rations restores one energy per wave from its kill count, never on a ring", () => {
    const g = new Game();
    place(g, "beacon", 5, 5, tiers("field-rations", 3, L3));
    g.state.lives = g.mission.reactorEnergy - 2;
    for (let i = 0; i < 30; i++) kill(g, { ...makeEnemy(100 + i, "drone", 5, 6), hp: 10, maxHp: 10 });
    // 30 kills, but only one energy this wave; the full counter waits for the next wave.
    expect(g.state.lives).toBe(g.mission.reactorEnergy - 1);
    expect(g.state.towers[0].economy).toEqual({ count: 15 });
    emptyWave(g);
    kill(g, { ...makeEnemy(200, "drone", 5, 6), hp: 10, maxHp: 10 });
    expect(g.state.lives).toBe(g.mission.reactorEnergy);
    const ring = new Game(MISSIONS.find((m) => m.circle)!);
    place(ring, "beacon", 5, 5, tiers("field-rations", 3, L3));
    for (let i = 0; i < 20; i++) kill(ring, { ...makeEnemy(100 + i, "drone", 5, 6), hp: 10, maxHp: 10 });
    expect(ring.state.towers[0].economy).toBeUndefined();
  });
});

describe("Refinery paths", () => {
  it("Advance pays part of the income at the wave's start and the same total over the wave", () => {
    const run = (upgrades: string[]) => {
      const g = new Game();
      place(g, "refinery", 0, 0, upgrades);
      g.state.wallets = [0];
      openWave(g);
      const start = g.state.wallets[0];
      finishWave(g);
      return { start, end: g.state.wallets[0] };
    };
    const plain = run(L3),
      advance = run(tiers("advance", 2, L3));
    expect(advance.start).toBe(plain.start + 30);
    expect(advance.end).toBe(plain.end);
  });
  it("Compounding adds a bonus per wave with the path, up to the cap, from the strongest Refinery only", () => {
    const g = new Game();
    const r = place(g, "refinery", 0, 0, tiers("compounding", 1, L3));
    place(g, "refinery", 0, 1, tiers("compounding", 1, L3));
    const gains: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = g.state.wallets[0];
      emptyWave(g);
      gains.push(g.state.wallets[0] - before - g.mission.waves[i].bonus - 120);
    }
    expect(gains).toEqual([3, 6, 9, 12, 12, 12]);
    expect(r.economy).toEqual({ waves: 6 });
  });
  it("Fuel Line speeds up attack towers within its radius, only in the running simulation", () => {
    const g = new Game();
    place(g, "refinery", 5, 5, tiers("fuel-line", 3, L3));
    const near = place(g, "pulse", 6, 5),
      far = place(g, "pulse", 9, 5),
      base = TOWERS.pulse.interval;
    expect(effectiveTowerStats(near, g.state.towers, g.content, g).interval).toBeCloseTo(base / 1.1);
    expect(effectiveTowerStats(near, g.state.towers, g.content).interval).toBeCloseTo(base);
    expect(effectiveTowerStats(far, g.state.towers, g.content, g).interval).toBeCloseTo(base);
  });
});

describe("Vault paths", () => {
  it("Investment Account counts its owner's spending during the wave as unspent for the interest (co-op)", () => {
    const run = (upgrades: string[]) => {
      const g = coop();
      place(g, "vault", 0, 0, upgrades, { owner: 1 });
      openWave(g);
      g.state.wallets = [1000, 500];
      const [a, b] = freeCells(g, { x: 5, y: 5 });
      expect(g.command({ type: "build", tower: "pulse", ...a, player: 1 }).ok).toBe(true);
      expect(g.command({ type: "build", tower: "pulse", ...b, player: 0 }).ok).toBe(true);
      finishWave(g);
      return g;
    };
    const plain = run(L3),
      invested = run(tiers("investment", 3, L3)),
      cost = TOWERS.pulse.cost;
    expect(invested.state.wallets[0]).toBe(plain.state.wallets[0]);
    expect(invested.state.wallets[1] - plain.state.wallets[1]).toBe(interestOn(500, 0.1, 90) - interestOn(500 - cost, 0.1, 90));
    expect(invested.state.economy).toBeUndefined();
    // Between waves nothing is counted.
    invested.state.wallets[1] = 1000;
    expect(invested.command({ type: "build", tower: "pulse", ...freeCells(invested, { x: 5, y: 5 })[0], player: 1 }).ok).toBe(true);
    expect(invested.state.economy).toBeUndefined();
  });
  it("Clean Sheet pays after a wave without reactor damage", () => {
    const run = (upgrades: string[], leak: boolean) => {
      const g = new Game();
      place(g, "vault", 0, 0, upgrades);
      g.state.wallets = [0];
      openWave(g);
      if (leak) {
        g.state.enemies = [leaker(g, 900)];
        moveEnemies(g, 1);
      }
      finishWave(g);
      return g.state.wallets[0];
    };
    expect(run(tiers("clean-sheet", 2, L3), false) - run(L3, false)).toBe(15);
    expect(run(tiers("clean-sheet", 2, L3), true)).toBe(run(L3, true));
  });
  it("Reserve Cells turns interest into at most one energy per wave", () => {
    const g = new Game();
    place(g, "vault", 0, 0, tiers("reserve-cells", 3, L3));
    g.state.lives = g.mission.reactorEnergy - 3;
    g.state.wallets = [2000];
    emptyWave(g);
    // 90 interest is four and a half points, but one per wave; the rest waits.
    expect(g.state.lives).toBe(g.mission.reactorEnergy - 2);
    expect(g.state.towers[0].economy).toEqual({ count: 20 });
    emptyWave(g);
    expect(g.state.lives).toBe(g.mission.reactorEnergy - 1);
  });
});

describe("Workshop paths", () => {
  it("Prefab discounts builds in its radius, never another Workshop", () => {
    const g = new Game();
    const [w, near] = freeCells(g, { x: 5, y: 5 });
    place(g, "workshop", w.x, w.y, tiers("prefab", 3, L3));
    g.state.wallets = [1000];
    const id = g.command({ type: "build", tower: "pulse", ...near }).id!;
    const price = Math.round(TOWERS.pulse.cost * 0.8);
    expect(g.state.wallets[0]).toBe(1000 - price);
    expect(g.state.towers.find((t) => t.id === id)!.spent).toBe(price);
    expect(g.drainEvents().some((e) => e.type === "discount" && e.amount === TOWERS.pulse.cost - price)).toBe(true);
    const next = freeCells(g, w)[0];
    g.command({ type: "build", tower: "workshop", ...next });
    expect(g.state.wallets[0]).toBe(1000 - price - TOWERS.workshop.cost);
  });
  it("Refit raises the sale share in its radius; without the path the board changes nothing", () => {
    const g = new Game();
    const shop = place(g, "workshop", 5, 5, tiers("refit", 3, L3)),
      near = { ...place(g, "pulse", 6, 5), spent: 100 },
      far = { ...place(g, "pulse", 14, 9), spent: 100 };
    expect(sellValue(near, g.state.towers, g.content)).toBe(90);
    expect(sellValue(near, undefined, DEFAULT_CONTENT)).toBe(70);
    expect(sellValue(far, g.state.towers, g.content)).toBe(70);
    expect(sellValue({ ...shop, spent: 100 }, g.state.towers, g.content)).toBe(70);
    shop.upgrades = L3;
    expect(sellValue(near, g.state.towers, g.content)).toBe(70);
  });
  it("Calibration strengthens towers at their max level in its radius", () => {
    const g = new Game();
    place(g, "workshop", 5, 5, tiers("calibration", 3, L3));
    const maxed = place(g, "pulse", 6, 5, maxedPulse),
      lower = place(g, "pulse", 5, 6, maxedPulse.slice(0, -1)),
      stats = (t: Tower) => effectiveTowerStats(t, g.state.towers, g.content, g);
    expect(stats(maxed).damage).toBeCloseTo(effectiveTowerStats(maxed, g.state.towers, g.content).damage * 1.08);
    expect(stats(lower).damage).toBeCloseTo(effectiveTowerStats(lower, g.state.towers, g.content).damage);
  });
});

describe("Repair Dock paths", () => {
  it("Triage refunds the wave's first reactor damage up to its amount", () => {
    const g = new Game();
    const dock = place(g, "dock", 0, 0, tiers("triage", 2, L3));
    openWave(g);
    const lives = g.state.lives,
      leak = g.content.enemies.tank.leak;
    g.state.enemies = [leaker(g, 900), leaker(g, 901), leaker(g, 902)];
    moveEnemies(g, 1);
    expect(g.state.lives).toBe(lives - 3 * leak + Math.min(2, 3 * leak));
    expect(g.state.economy?.triage).toBe(Math.min(2, 3 * leak));
    finishWave(g);
    expect(g.state.economy).toBeUndefined();
    expect(dock.economy).toBeUndefined();
  });
  it("Salvage pays for unused repair points; Damage Control speeds up towers below half energy", () => {
    const run = (upgrades: string[]) => {
      const g = new Game();
      place(g, "dock", 0, 0, upgrades);
      place(g, "dock", 0, 1, upgrades);
      g.state.wallets = [0];
      emptyWave(g);
      return g.state.wallets[0];
    };
    // Two salvaging Docks at full energy: only the strongest pays, 3 points × 10.
    expect(run(tiers("salvage", 3, L3)) - run(L3)).toBe(30);
    const g = new Game();
    place(g, "dock", 5, 5, tiers("damage-control", 3, L3));
    const pulse = place(g, "pulse", 6, 5),
      interval = () => effectiveTowerStats(pulse, g.state.towers, g.content, g).interval;
    expect(interval()).toBeCloseTo(TOWERS.pulse.interval);
    g.state.lives = Math.floor(g.mission.reactorEnergy / 2) - 1;
    expect(interval()).toBeCloseTo(TOWERS.pulse.interval / 1.2);
  });
});

describe("Shield Generator paths", () => {
  it("Recharge refills absorbed points on the wave-time grid", () => {
    const g = new Game();
    const shield = place(g, "shieldgen", 0, 0, tiers("recharge", 3, L3));
    openWave(g);
    g.state.enemies = [{ ...makeEnemy(1, "drone", 0, 0, 0), hp: 1e9, maxHp: 1e9 }];
    shield.barrier = 6;
    g.state.waveTime = 19.99;
    tickEconomy(g, 1 / 30);
    expect(shield.barrier).toBe(6);
    g.state.waveTime = 20.01;
    tickEconomy(g, 1 / 30);
    expect(shield.barrier).toBe(2);
    g.state.waveTime = 40.01;
    tickEconomy(g, 1 / 30);
    expect(shield.barrier).toBeUndefined();
  });
  it("Shockwave stuns ground enemies near the reactor when it absorbs a hit", () => {
    const g = new Game();
    place(g, "shieldgen", 0, 0, tiers("shockwave", 3, L3));
    openWave(g);
    const end = g.mission.map.path.at(-1)!,
      near = makeEnemy(2, "tank", end.x, end.y, g.mission.map.path.length - 1.5),
      far = makeEnemy(3, "tank", 0, 0, 1);
    g.state.enemies = [leaker(g, 1), near, far];
    moveEnemies(g, 1 / 30);
    expect(near.status.some((s) => s.kind === "stun")).toBe(true);
    expect(far.status).toEqual([]);
  });
  it("Overflow pays for unused absorb points of the strongest generator", () => {
    const run = (upgrades: string[]) => {
      const g = new Game();
      place(g, "shieldgen", 0, 0, upgrades);
      g.state.wallets = [0];
      emptyWave(g);
      return g.state.wallets[0];
    };
    expect(run(tiers("overflow", 3, L3)) - run(L3)).toBe(40);
  });
});

describe("boards without economy paths", () => {
  it("never create economy state", () => {
    const g = new Game();
    for (const [i, type] of (["beacon", "refinery", "vault", "workshop", "dock", "shieldgen"] as const).entries()) place(g, type, i, 0, L3);
    openWave(g);
    g.state.enemies = [leaker(g, 900), leaker(g, 901), leaker(g, 902), leaker(g, 903)];
    moveEnemies(g, 1);
    kill(g, makeEnemy(904, "drone", 2, 1));
    finishWave(g);
    expect(g.state.economy).toBeUndefined();
    expect(g.state.towers.every((t) => t.economy === undefined)).toBe(true);
  });
});
