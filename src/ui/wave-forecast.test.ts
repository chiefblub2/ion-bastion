import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMIES } from "../content/enemies";
import { missionById } from "../content/missions";
import { Game } from "../core/game";
import { finishWave } from "../core/test-helpers";
import { waveHpScale } from "../systems/spawn";
import { renderWaveForecast, waveForecast } from "./wave-forecast";

const game = (id: string) => new Game(missionById(id)!);
describe("wave forecast", () => {
  it("shows only the next wave before the first one starts", () => {
    const next = waveForecast(game("schleusenring"))!;
    expect(next.number).toBe(1);
    expect(next.enemies).toMatchObject([{ type: "drone", count: 8, layer: "ground", isNew: true }]);
  });
  it("shows unit badges with count, HP and air tag", () => {
    const g = game("schleusenring");
    g.state.wave = 3;
    const next = waveForecast(g)!;
    expect(next.number).toBe(4);
    expect(next.hasAir).toBe(true);
    const glider = next.enemies.find((e) => e.type === "glider")!;
    expect(glider).toMatchObject({ isNew: true, layer: "air", count: 6 });
    expect(glider.tags.map((t) => t.label)).toEqual(["AIR"]);
    expect(glider.hp).toBe(Math.round(45 * waveHpScale(g.mission, 4)));
    expect(next.total).toBe(24);
    expect(next.totalHp).toBe(next.enemies.reduce((sum, e) => sum + e.count * e.hp, 0));
    const html = renderWaveForecast(next);
    expect(html).toContain("NEXT WAVE 04");
    expect(html).toMatch(/<b>6×<\/b><span class="unit-name">Glider<\/span><span class="unit-hp">♡ \d+<\/span><em class="unit-tag air">AIR/);
    expect(html).not.toMatch(/Pulse|Cryo|Flak|Tesla/);
    expect(html).toContain("24 enemies");
  });
  it("shows armor, regeneration, splitting and immunity next to the unit", () => {
    const content = {
      ...DEFAULT_CONTENT,
      enemies: {
        ...ENEMIES,
        drone: {
          ...ENEMIES.drone,
          traits: [
            { kind: "armor", reduction: 0.3 },
            { kind: "regen", perSecond: 4 },
            { kind: "splitOnDeath", type: "runner", count: 2 },
            { kind: "slowImmune" },
          ] as const,
        },
      },
    };
    const next = waveForecast(new Game(missionById("schleusenring")!, content))!;
    expect(next.enemies[0].tags.map((t) => t.label)).toEqual(["ARMOR 30%", "REGEN 4/s", "SPLITS ×2", "IMMUNE: SLOW"]);
    const html = renderWaveForecast(next);
    expect(html).toContain('<em class="unit-tag trait armor">ARMOR 30%</em>');
    expect(html).toContain("Splits into 2× Sprinter");
  });
  it("shows the new traits next to the unit", () => {
    const content = {
      ...DEFAULT_CONTENT,
      enemies: {
        ...ENEMIES,
        drone: {
          ...ENEMIES.drone,
          traits: [
            { kind: "shield", capacity: 0.3, delay: 3 },
            { kind: "sprint", threshold: 0.5, factor: 1.6, duration: 2 },
            { kind: "evade", every: 4 },
            { kind: "healer", radius: 2, percent: 0.03 },
            { kind: "leader", radius: 2, speed: 0.2, resist: 0.15 },
            { kind: "stealth" },
            { kind: "unstoppable" },
            { kind: "swift", speed: 0.5, hp: 0.2 },
            { kind: "regen", percent: 0.02 },
          ] as const,
        },
      },
    };
    const next = waveForecast(new Game(missionById("schleusenring")!, content))!;
    expect(next.enemies[0].tags.map((t) => t.label)).toEqual([
      "SHIELD 30%",
      "SPRINT",
      "EVADE 1/4",
      "HEALER",
      "LEADER",
      "STEALTH",
      "UNSTOPPABLE",
      "SWIFT",
      "REGEN 2%/s",
    ]);
    expect(renderWaveForecast(next)).toContain("+20% speed, 15% damage resistance");
  });
  it("merges groups of the same type and marks the last wave", () => {
    const g = game("splitterfeld");
    g.state.wave = 11;
    const last = waveForecast(g)!;
    expect(last.last).toBe(true);
    expect(last.enemies.find((e) => e.type === "runner")!.count).toBe(28);
    expect(renderWaveForecast(last)).toContain("FINAL WAVE 12");
  });
  it("shows the following wave while one is running", () => {
    const g = game("outpost-07");
    g.command({ type: "start" });
    for (let i = 0; i < 40; i++) g.tick();
    expect(waveForecast(g)!.number).toBe(2);
  });
  it("is empty during the last wave and once the mission is over", () => {
    const g = game("splitterfeld");
    g.state.wave = 12;
    expect(waveForecast(g)).toBeNull();
    const h = game("outpost-07");
    h.command({ type: "start" });
    finishWave(h);
    h.state.status = "lost";
    expect(waveForecast(h)).toBeNull();
  });
  it("shows the swift HP penalty in the forecast HP", () => {
    const base = waveForecast(new Game(missionById("schleusenring")!))!;
    const content = {
      ...DEFAULT_CONTENT,
      enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits: [{ kind: "swift", speed: 0.5, hp: 0.2 }] as const } },
    };
    const next = waveForecast(new Game(missionById("schleusenring")!, content))!;
    expect(next.enemies[0].hp).toBe(Math.round(base.enemies[0].hp * 0.8));
  });
});

describe("enemy icons and shape validation", () => {
  it("draws every body shape", async () => {
    const { enemyIcon } = await import("./wave-forecast");
    expect(enemyIcon({ shape: "star", points: 8, inner: 0.45 }, 0xff0000).match(/\d,-?\d/g)!.length).toBeGreaterThanOrEqual(16);
    expect(enemyIcon({ shape: "orb", moons: 3 }, 0x00ff00).match(/<circle/g)).toHaveLength(5);
    expect(enemyIcon({ shape: "worm", segments: 5 }, 0x0000ff).match(/<circle/g)).toHaveLength(5);
  });
  it("rejects invalid shape fields", async () => {
    const { validateEnemy } = await import("../core/validation");
    const base = DEFAULT_CONTENT.enemies.drone;
    const bad = (visual: unknown) => () => validateEnemy({ ...base, visual } as typeof base, "Enemy x", DEFAULT_CONTENT);
    expect(bad({ shape: "star", points: 2, inner: 0.5 })).toThrow("points");
    expect(bad({ shape: "star", points: 5, inner: 1 })).toThrow("inner");
    expect(bad({ shape: "orb", moons: -1 })).toThrow("moons");
    expect(bad({ shape: "worm", segments: 1 })).toThrow("segments");
    expect(bad({ shape: "worm", segments: 2 })).not.toThrow();
  });
});
