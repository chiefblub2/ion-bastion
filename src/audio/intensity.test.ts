import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId, GameEvent, GameState, Tower, TowerId } from "../core/types";
import { MISSIONS } from "../content/missions";
import { bossSpawned, colorOf, intensityOf, toneFor } from "./intensity";

const direct = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "direct" && !d.placement)!.id as TowerId;
const light = Object.values(DEFAULT_CONTENT.enemies).find((e) => e.hp < 100)!.id as EnemyId;
const reactor = MISSIONS.find((m) => !m.circle)!,
  ring = MISSIONS.find((m) => m.circle)!;
const tower = (type: TowerId) => ({ id: 1, type, x: 0, y: 0, upgrades: ["a", "b"], cooldown: 0 }) as unknown as Tower;
const state = (enemies: GameState["enemies"], s: Partial<GameState> = {}) => ({ enemies, towers: [], lives: reactor.reactorEnergy, wave: 0, ...s }) as unknown as GameState;
const length = reactor.map.path.length;

describe("intensityOf", () => {
  it("is silent on an empty field", () => {
    expect(intensityOf(state([]), DEFAULT_CONTENT, reactor)).toEqual({ threat: 0, danger: 0, arc: 0, heavies: 0, bosses: 0 });
  });
  it("weighs enemies by strength and by how close they are", () => {
    const far = intensityOf(state([makeEnemy(1, light, 0, 0, 0)]), DEFAULT_CONTENT, reactor).threat,
      near = intensityOf(state([makeEnemy(1, light, 0, 0, length)]), DEFAULT_CONTENT, reactor).threat,
      boss = intensityOf(state([makeEnemy(1, "boss" as EnemyId, 0, 0, 0)]), DEFAULT_CONTENT, reactor);
    expect(near).toBeCloseTo(far * 2);
    expect(boss.threat).toBeGreaterThan(far);
    expect(boss.heavies).toBe(1);
    expect(boss.bosses).toBe(1);
  });
  it("measures danger from the front line and the reactor's damage, and the ring's crowd against its limit", () => {
    expect(intensityOf(state([makeEnemy(1, light, 0, 0, length)]), DEFAULT_CONTENT, reactor).danger).toBeCloseTo(0.6);
    expect(intensityOf(state([], { lives: reactor.reactorEnergy / 2 }), DEFAULT_CONTENT, reactor).danger).toBeCloseTo(0.4);
    const crowd = Array.from({ length: Math.ceil(ring.circle!.limit / 2) }, (_, i) => makeEnemy(i + 1, light, 0, 0, 0));
    expect(intensityOf(state(crowd, { lives: ring.reactorEnergy }), DEFAULT_CONTENT, ring).danger).toBeCloseTo(crowd.length / ring.circle!.limit);
  });
  it("follows the mission's progress", () => {
    expect(intensityOf(state([], { wave: reactor.waves.length / 2 }), DEFAULT_CONTENT, reactor).arc).toBeCloseTo(0.5);
  });
  it("ignores the towers entirely", () => {
    const enemies = [makeEnemy(1, light, 0, 0, 5)];
    expect(intensityOf(state(enemies, { towers: [tower(direct), tower(direct)] }), DEFAULT_CONTENT, reactor)).toEqual(intensityOf(state(enemies), DEFAULT_CONTENT, reactor));
  });
});
describe("colorOf", () => {
  it("does not flicker around a threshold", () => {
    expect(colorOf(0.1, "drive")).toBe("bright");
    expect(colorOf(0.22, "bright")).toBe("bright");
    expect(colorOf(0.22, "drive")).toBe("drive");
    expect(colorOf(0.65, "drive")).toBe("dark");
    expect(colorOf(0.55, "dark")).toBe("dark");
    expect(colorOf(0.45, "dark")).toBe("drive");
  });
  it("opens the pad when safe and as the mission goes on", () => {
    expect(toneFor("bright", 0)).toBe(1.2);
    // Danger stays tense (tension note) but not muffled.
    expect(toneFor("dark", 1)).toBeCloseTo(1.3);
  });
});
describe("bossSpawned", () => {
  it("notices a boss entering the field", () => {
    const spawn: GameEvent = { type: "spawn", at: { x: 0, y: 0 }, enemy: 7 };
    expect(bossSpawned([spawn], state([makeEnemy(7, "boss" as EnemyId, 0, 0)]), DEFAULT_CONTENT)).toBe(true);
    expect(bossSpawned([spawn], state([makeEnemy(7, light, 0, 0)]), DEFAULT_CONTENT)).toBe(false);
  });
});
