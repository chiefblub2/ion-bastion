import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId, GameEvent, GameState, Tower, TowerId } from "../core/types";
import { isSupport } from "../systems/attacks";
import { effectiveTowerStats } from "../systems/auras";
import { bossSpawned, colorOf, intensityOf, toneFor } from "./intensity";

const direct = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "direct" && !d.placement)!.id as TowerId;
const light = Object.values(DEFAULT_CONTENT.enemies).find((e) => e.hp < 100)!.id as EnemyId;
const support = Object.values(DEFAULT_CONTENT.towers).find((d) => isSupport(d.attack))!.id as TowerId;
const tower = (type: TowerId, upgrades: string[] = []) => ({ id: 1, type, x: 0, y: 0, upgrades, cooldown: 0 }) as unknown as Tower;
const state = (enemies: GameState["enemies"], towers: Tower[] = []) => ({ enemies, towers }) as unknown as GameState;

describe("intensityOf", () => {
  it("is silent on an empty field", () => {
    expect(intensityOf(state([]), DEFAULT_CONTENT, 40)).toEqual({ threat: 0, defense: 0, clear: 0, heavies: 0 });
  });
  it("weighs enemies by strength and by how close they are", () => {
    const far = intensityOf(state([makeEnemy(1, light, 0, 0, 0)]), DEFAULT_CONTENT, 40).threat,
      near = intensityOf(state([makeEnemy(1, light, 0, 0, 40)]), DEFAULT_CONTENT, 40).threat,
      boss = intensityOf(state([makeEnemy(1, "boss" as EnemyId, 0, 0, 0)]), DEFAULT_CONTENT, 40);
    expect(near).toBeCloseTo(far * 2);
    expect(boss.threat).toBeGreaterThan(far);
    expect(boss.heavies).toBe(1);
  });
  it("counts towers and their upgrades as defense and divides HP by their damage per second", () => {
    // A support tower adds to the defense (upgrades count) but not to the damage per second.
    const t = tower(direct),
      towers = [t, tower(support, ["x", "y"])],
      s = effectiveTowerStats(t, towers, DEFAULT_CONTENT),
      i = intensityOf(state([makeEnemy(1, light, 0, 0, 0)], towers), DEFAULT_CONTENT, 40);
    expect(i.defense).toBeCloseTo(4 / 40);
    expect(i.clear).toBeCloseTo(1000 / (s.damage / s.interval));
  });
});
describe("colorOf", () => {
  it("does not flicker around a threshold", () => {
    expect(colorOf(2, "drive")).toBe("bright");
    expect(colorOf(3.5, "bright")).toBe("bright");
    expect(colorOf(3.5, "drive")).toBe("drive");
    expect(colorOf(11, "drive")).toBe("dark");
    expect(colorOf(9, "dark")).toBe("dark");
    expect(colorOf(7, "dark")).toBe("drive");
  });
  it("opens the pad when bright and with defense", () => {
    expect(toneFor("bright", 0)).toBe(1.5);
    expect(toneFor("dark", 1)).toBeCloseTo(0.9);
  });
});
describe("bossSpawned", () => {
  it("notices a boss entering the field", () => {
    const spawn: GameEvent = { type: "spawn", at: { x: 0, y: 0 }, enemy: 7 };
    expect(bossSpawned([spawn], state([makeEnemy(7, "boss" as EnemyId, 0, 0)]), DEFAULT_CONTENT)).toBe(true);
    expect(bossSpawned([spawn], state([makeEnemy(7, light, 0, 0)]), DEFAULT_CONTENT)).toBe(false);
  });
});
