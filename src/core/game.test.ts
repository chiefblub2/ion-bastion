import { describe, it, expect } from "vitest";
import { Game } from "./game";
import { towerLevel } from "./upgrades";
import { TOWERS } from "../content/towers";
import { OUTPOST } from "../content/maps";
import { MISSIONS } from "../content/missions";
import { validateMission } from "./validation";
import { finishWave } from "./test-helpers";
import { effectiveTowerStats, isInAura } from "../systems/auras";
describe("validated player commands", () => {
  it("rejects road, obstacles and duplicate placement without spending credits", () => {
    const g = new Game();
    expect(g.command({ type: "build", tower: "pulse", x: 0, y: 3 }).ok).toBe(
      false,
    );
    expect(g.command({ type: "build", tower: "pulse", x: 1, y: 9 }).ok).toBe(
      false,
    );
    expect(g.state.wallets[0]).toBe(240);
    expect(g.command({ type: "build", tower: "pulse", x: 4, y: 4 }).ok).toBe(
      true,
    );
    expect(g.command({ type: "build", tower: "pulse", x: 4, y: 4 }).ok).toBe(
      false,
    );
    expect(g.state.wallets[0]).toBe(160);
    expect(g.command({ type: "build", tower: "pulse", x: NaN, y: 0 }).ok).toBe(
      false,
    );
  });
  it("upgrades instances without changing definitions and refunds total investment", () => {
    const g = new Game(),
      d = TOWERS.pulse.damage;
    const r = g.command({ type: "build", tower: "pulse", x: 4, y: 4 });
    expect(g.command({ type: "upgrade", id: r.id!, upgrade: "level-2" }).ok).toBe(true);
    expect(towerLevel(g.state.towers[0])).toBe(2);
    expect(TOWERS.pulse.damage).toBe(d);
    expect(g.command({ type: "upgrade", id: r.id!, upgrade: "level-3" }).ok).toBe(false);
    expect(g.state.wallets[0]).toBe(88);
    g.command({ type: "sell", id: r.id! });
    expect(g.state.wallets[0]).toBe(194);
    expect(g.state.towers).toHaveLength(0);
  });
  it("freezes simulation while paused and resets the complete mission", () => {
    const g = new Game();
    g.command({ type: "start" });
    g.tick();
    g.command({ type: "pause" });
    const before = JSON.stringify(g.state);
    for (let i = 0; i < 100; i++) g.tick();
    expect(JSON.stringify(g.state)).toBe(before);
    g.command({ type: "restart" });
    expect(g.state.wave).toBe(0);
    expect(g.state.wallets[0]).toBe(240);
    expect(g.state.paused).toBe(false);
  });
});
describe("command guards", () => {
  it("pauses only during a wave and reports why otherwise", () => {
    const g = new Game();
    expect(g.command({ type: "pause" })).toMatchObject({ ok: false, code: "pause-unavailable" });
    expect(g.state.paused).toBe(false);
    g.command({ type: "start" });
    expect(g.command({ type: "pause" })).toMatchObject({ ok: true, code: "paused" });
    expect(g.command({ type: "start" })).toMatchObject({ ok: false, code: "wave-running" });
  });
  it("emits events for building, upgrading, selling and waves", () => {
    const g = new Game();
    const id = g.command({ type: "build", tower: "pulse", x: 4, y: 4 }).id!;
    g.command({ type: "upgrade", id, upgrade: "level-2" });
    g.command({ type: "sell", id });
    g.command({ type: "start" });
    expect(g.drainEvents().map((e) => e.type)).toEqual(["build", "upgrade", "sell", "waveStart"]);
  });
});
describe("mission outcomes", () => {
  it("reaches defeat without defense and prevents additional gameplay commands", () => {
    const g = new Game();
    for (let i = 0; i < 10 && g.state.status !== "lost"; i++) {
      g.command({ type: "start" });
      finishWave(g);
    }
    expect(g.state.status).toBe("lost");
    expect(g.state.lives).toBe(0);
    expect(g.command({ type: "build", tower: "pulse", x: 2, y: 2 }).ok).toBe(
      false,
    );
  });
  it("can complete the first wave with a starter defense", () => {
    const g = new Game();
    for (const [x, y] of [
      [4, 4],
      [6, 5],
      [6, 7],
    ])
      g.command({ type: "build", tower: "pulse", x, y });
    g.command({ type: "start" });
    finishWave(g);
    expect(g.state.lives).toBe(20);
    expect(g.state.kills).toBe(8);
    expect(g.state.status).toBe("ready");
    expect(g.state.wallets[0]).toBe(8 * 9 + 35);
  });
  it("finishes a whole campaign with upgrades and a mixed defense", () => {
    const g = new Game();
    for (const [x, y] of [
      [4, 4],
      [6, 5],
      [6, 7],
    ])
      g.command({ type: "build", tower: "pulse", x, y });
    const additions = [
      { tower: "blast" as const, x: 9, y: 7 },
      { tower: "frost" as const, x: 9, y: 4 },
      { tower: "pulse" as const, x: 11, y: 4 },
      { tower: "blast" as const, x: 13, y: 4 },
      { tower: "pulse" as const, x: 13, y: 7 },
      { tower: "frost" as const, x: 11, y: 7 },
    ];
    for (let w = 0; w < 10; w++) {
      if (w > 0) {
        for (const t of [...g.state.towers])
          if (towerLevel(t) < 3) g.command({ type: "upgrade", id: t.id, upgrade: `level-${towerLevel(t) + 1}` });
        for (const a of additions)
          if (!g.state.towers.some((t) => t.x === a.x && t.y === a.y))
            g.command({ type: "build", ...a });
      }
      expect(g.command({ type: "start" }).ok).toBe(true);
      finishWave(g);
    }
    expect(g.state.status).toBe("won");
    expect(g.state.lives).toBeGreaterThan(0);
  });
  it("replays identical commands deterministically", () => {
    const a = new Game(),
      b = new Game();
    for (const g of [a, b]) {
      g.command({ type: "build", tower: "blast", x: 4, y: 4 });
      g.command({ type: "build", tower: "frost", x: 6, y: 6 });
      g.command({ type: "start" });
      finishWave(g);
    }
    expect(a.state).toEqual(b.state);
  });
});
describe("content boundaries", () => {
  it("rejects disconnected map paths", () => {
    expect(() =>
      validateMission({
        ...MISSIONS[0],
        map: {
          ...OUTPOST,
          path: [
            { x: 0, y: 0 },
            { x: 3, y: 0 },
          ],
        },
      }),
    ).toThrow("zusammenhängend");
  });
  it("names mission, wave and group of invalid content", () => {
    const m = MISSIONS[4];
    const waves = m.waves.map((w, i) =>
      i === 6 ? { ...w, groups: w.groups.map((g, j) => (j === 1 ? { ...g, count: 0 } : g)) } : w,
    );
    expect(() => validateMission({ ...m, waves })).toThrow("Mission kernfestung › Welle 7 › Gruppe 2: count");
  });
  it("a wave can override the linear HP growth", () => {
    const m = MISSIONS[0];
    const g = new Game({ ...m, waves: [{ ...m.waves[0], hpMultiplier: 3 }, ...m.waves.slice(1)] });
    g.command({ type: "start" });
    g.tick();
    expect(g.state.enemies[0].maxHp).toBe(55 * 3);
  });
  it("a second mission needs no simulation changes", () => {
    const g = new Game({
      id: "test",
      name: "Test",
      focus: "Test",
      startingCredits: 240,
      reactorEnergy: 20,
      map: {
        id: "test",
        name: "Test",
        columns: 5,
        rows: 3,
        path: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
        blocked: [],
      },
      waves: [
        {
          groups: [{ type: "drone", count: 1, interval: 1, delay: 0 }],
          bonus: 10,
        },
      ],
    });
    g.command({ type: "build", tower: "pulse", x: 1, y: 0 });
    g.command({ type: "start" });
    finishWave(g);
    expect(g.state.status).toBe("won");
    expect(g.state.lives).toBe(20);
  });
});

describe("Raffinerie", () => {
  const setup = () => {
    const g = new Game();
    // No defense: enemies leak, but the reactor survives two waves.
    g.state.wallets[0] = 1000;
    g.state.lives = 1000;
    const id = g.command({ type: "build", tower: "refinery", x: 4, y: 4 }).id!;
    return { g, id };
  };
  it("pays its credits after every completed wave, more with each level, and never attacks", () => {
    const { g, id } = setup();
    let gold = g.state.wallets[0];
    g.command({ type: "start" });
    finishWave(g);
    expect(g.state.wallets[0]).toBe(gold + MISSIONS[0].waves[0].bonus + 25);
    expect(g.state.towers[0].cooldown).toBe(0);
    g.command({ type: "upgrade", id, upgrade: "level-2" });
    gold = g.state.wallets[0];
    g.command({ type: "start" });
    const events: string[] = [];
    while (g.state.status === "wave") {
      g.tick();
      events.push(...g.drainEvents().map((e) => e.type));
    }
    expect(events).not.toContain("shot");
    expect(events).toContain("income");
    expect(g.state.wallets[0]).toBe(gold + MISSIONS[0].waves[1].bonus + 40);
  });
  it("pays nothing once sold or when the mission is lost", () => {
    const sold = setup();
    sold.g.command({ type: "sell", id: sold.id });
    const gold = sold.g.state.wallets[0];
    sold.g.command({ type: "start" });
    finishWave(sold.g);
    expect(sold.g.state.wallets[0]).toBe(gold + MISSIONS[0].waves[0].bonus);
    const lost = setup();
    lost.g.state.lives = 1;
    const before = lost.g.state.wallets[0];
    lost.g.command({ type: "start" });
    finishWave(lost.g);
    expect(lost.g.state.status).toBe("lost");
    expect(lost.g.state.wallets[0]).toBe(before);
  });
  it("is never boosted or counted by an aura", () => {
    const { g } = setup();
    g.command({ type: "build", tower: "aura", x: 4, y: 5 });
    const [refinery, aura] = g.state.towers;
    g.command({ type: "upgrade", id: aura.id, upgrade: "damage" });
    expect(isInAura(aura, refinery)).toBe(false);
    expect(Object.values(effectiveTowerStats(refinery, g.state.towers).bonuses).every((v) => v === 0)).toBe(true);
  });
});
