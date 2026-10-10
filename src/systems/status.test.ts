import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import { applyStatus, damageTaken, speedFactor, statusFlags } from "./status";

const src = { tower: 0, type: "inferno" as const };
const burn = (dps: number, until: number) => ({ kind: "burn" as const, dps, next: 0.5, until, source: src });

describe("status merge rules", () => {
  it("a running stun, including its recovery, blocks every further stun", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "stun", release: 1, until: 2 });
    applyStatus(g, e, { kind: "stun", release: 3, until: 4 });
    expect(e.status).toEqual([{ kind: "stun", release: 1, until: 2 }]);
    g.state.time = 2;
    applyStatus(g, e, { kind: "stun", release: 3, until: 4 });
    expect(e.status).toEqual([{ kind: "stun", release: 3, until: 4 }]);
  });
  it("a stronger burn replaces a weaker one with its source, an equal one extends it", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, burn(10, 3));
    applyStatus(g, e, burn(5, 6));
    expect(e.status).toEqual([burn(10, 3)]);
    applyStatus(g, e, burn(10, 4));
    expect(e.status[0].until).toBe(4);
    applyStatus(g, e, { ...burn(20, 3), source: { tower: 7, type: "inferno" } });
    expect(e.status[0]).toMatchObject({ dps: 20, until: 3, source: { tower: 7 } });
  });
  it("the strongest weakening counts", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "vulnerable", amount: 0.4, until: 2 });
    applyStatus(g, e, { kind: "vulnerable", amount: 0.25, until: 5 });
    expect(damageTaken(e, 1)).toBe(1.4);
    expect(damageTaken(e, 2)).toBe(1);
  });
  it("speed takes the strongest effect: a stun beats a slow", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "slow", factor: 0.5, until: 3 });
    applyStatus(g, e, { kind: "stun", release: 1, until: 2 });
    expect(speedFactor(e, 0.5)).toBe(0);
    expect(speedFactor(e, 1.5)).toBe(0.5);
    expect(statusFlags(e, 0.5)).toEqual({ slowed: true, stunned: true, burning: false, vulnerable: false, pulled: false, disrupted: false, netted: false, bleeding: false, charged: false });
    expect(statusFlags(e, 1.5).stunned).toBe(false);
  });
  it("a disruption extends, and the stronger net replaces a weaker one", () => {
    const g = new Game(),
      e = makeEnemy(1, "glider", 0, 3);
    applyStatus(g, e, { kind: "disrupted", until: 2 });
    applyStatus(g, e, { kind: "disrupted", until: 4 });
    expect(e.status[0].until).toBe(4);
    applyStatus(g, e, { kind: "netted", factor: 0.7, until: 3 });
    applyStatus(g, e, { kind: "netted", factor: 0.8, until: 9 });
    expect(speedFactor(e, 1)).toBe(0.7);
    applyStatus(g, e, { kind: "netted", factor: 0.6, until: 2 });
    expect(speedFactor(e, 1)).toBe(0.6);
    expect(statusFlags(e, 1)).toMatchObject({ disrupted: true, netted: true });
  });
  it("a pull walks backwards, beats a stun, and blocks further pulls until its recovery ends", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 0, 3);
    applyStatus(g, e, { kind: "stun", release: 1, until: 2 });
    applyStatus(g, e, { kind: "pull", factor: 1.5, release: 0.6, until: 3 });
    expect(speedFactor(e, 0.5)).toBe(-1.5);
    expect(statusFlags(e, 0.5).pulled).toBe(true);
    expect(speedFactor(e, 0.8)).toBe(0);
    applyStatus(g, e, { kind: "pull", factor: 3, release: 2, until: 4 });
    expect(e.status.find((s) => s.kind === "pull")).toMatchObject({ factor: 1.5, until: 3 });
  });
});
