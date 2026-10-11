import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId, GameEvent } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { drawEnemyAccents, EnemyFeedback, FLASH, SHIELD_RIPPLE } from "./enemy-feedback";
import { enemyContext } from "./enemies";
import type { Ink } from "./shapes";

const sim = new Game();
const MAX_HP = 1000;
function unit(id: number, type: EnemyId, change: { status?: Partial<StatusFlags>; traits?: Partial<TraitFlags> } = {}) {
  const e = makeEnemy(id, type, 2, 3);
  return enemyContext(100, 120, 56, e, DEFAULT_CONTENT.enemies[type], 0, { ...statusFlags(e, 0), ...change.status }, { ...traitFlags(sim, e), ...change.traits }, 0.5);
}
const damage = (enemy: number, amount: number): GameEvent => ({ type: "damage", at: { x: 0, y: 0 }, amount, enemy });
function recorder() {
  const calls: string[] = [];
  const g: Ink = new Proxy({} as Ink, {
    get: (_, name) => () => {
      calls.push(String(name));
      return g;
    },
  });
  return { g, calls };
}

describe("hit flashes", () => {
  it("starts on positive damage only", () => {
    const fb = new EnemyFeedback();
    fb.consume([damage(1, 0), damage(2, -5), damage(3, NaN), damage(4, Infinity), { type: "kill", at: { x: 0, y: 0 }, color: 0, reward: 1 }], 1);
    for (const id of [1, 2, 3, 4]) expect(fb.flash(id, 1, MAX_HP)).toBe(0);
    expect(fb.size).toBe(0);
    fb.consume([damage(5, 30)], 1);
    expect(fb.flash(5, 1, MAX_HP)).toBeGreaterThan(0);
  });

  it("stays short and bounded however often or hard a unit is hit", () => {
    const fb = new EnemyFeedback();
    // A hail of hits in one frame: one flash, strength capped at 1, gone after `FLASH.max`.
    fb.consume(Array.from({ length: 50 }, () => damage(1, 900)), 1);
    expect(fb.flash(1, 1, MAX_HP)).toBe(1);
    expect(fb.flash(1, 1 + FLASH.max, MAX_HP)).toBe(0);
    // A small hit flashes `FLASH.min` and weaker.
    fb.consume([damage(2, 5)], 1);
    expect(fb.flash(2, 1, MAX_HP)).toBeLessThan(0.1);
    expect(fb.flash(2, 1 + FLASH.min * 1.1, MAX_HP)).toBe(0);
  });

  it("never keeps a unit white under constant damage over time", () => {
    const fb = new EnemyFeedback();
    let white = 0,
      strongest = 0;
    const frames = 600;
    for (let i = 0; i < frames; i++) {
      const now = i / 60;
      fb.consume([damage(1, 40)], now);
      if (fb.flash(1, now, MAX_HP) > 0) white++;
      if (now > 0.5) strongest = Math.max(strongest, fb.flash(1, now, MAX_HP));
    }
    expect(white / frames).toBeLessThan(0.3);
    expect(white).toBeGreaterThan(0);
    // After the first flash every flash is a repeat: short and at most half strength.
    expect(strongest).toBeGreaterThan(0);
    expect(strongest).toBeLessThanOrEqual(0.5);
  });

  it("forgets enemies that left, a reused id of another type and everything on reset", () => {
    const fb = new EnemyFeedback();
    // A lethal hit: the enemy is gone before it is drawn.
    fb.consume([damage(1, 50), damage(2, 50)], 1);
    fb.observe([unit(2, "tank")], 1);
    expect(fb.size).toBe(1);
    expect(fb.flash(1, 1, MAX_HP)).toBe(0);
    // Id 2 now belongs to another type: no inherited flash.
    fb.observe([unit(2, "drone")], 1.01);
    expect(fb.flash(2, 1.01, MAX_HP)).toBe(0);
    fb.consume([damage(2, 50)], 1.5);
    fb.reset();
    expect(fb.size).toBe(0);
    expect(fb.flash(2, 1.5, MAX_HP)).toBe(0);
  });
});

describe("shield ripples", () => {
  it("ripples when the shield falls, not when it holds, refills or is disrupted", () => {
    const fb = new EnemyFeedback();
    fb.observe([unit(1, "aegis", { traits: { shield: 1 } })], 0);
    expect(fb.shieldRipple(1, 0)).toBeUndefined();
    fb.observe([unit(1, "aegis", { traits: { shield: 1 } })], 0.5);
    expect(fb.shieldRipple(1, 0.5)).toBeUndefined();
    fb.observe([unit(1, "aegis", { traits: { shield: 0.7 } })], 1);
    expect(fb.shieldRipple(1, 1)).toBe(0);
    expect(fb.shieldRipple(1, 1 + SHIELD_RIPPLE.life)).toBeUndefined();
    // A Jammer hides the shield (it reads 0) without breaking it; the refill afterwards is no hit either.
    fb.observe([unit(1, "aegis", { traits: { shield: 0 }, status: { disrupted: true } })], 2);
    fb.observe([unit(1, "aegis", { traits: { shield: 0.7 } })], 3);
    expect(fb.shieldRipple(1, 3)).toBeUndefined();
    // Zero HP damage alone (armor, dodge, a full absorb) is no shield signal.
    fb.consume([damage(1, 0)], 3.1);
    expect(fb.shieldRipple(1, 3.1)).toBeUndefined();
  });

  it("merges rapid shield hits into one bounded ripple and drops it with its enemy", () => {
    const fb = new EnemyFeedback();
    fb.observe([unit(1, "aegis", { traits: { shield: 1 } })], 0);
    for (let i = 1; i <= 5; i++) fb.observe([unit(1, "aegis", { traits: { shield: 1 - i * 0.1 } })], 1 + i / 60);
    expect(fb.shieldRipple(1, 1 + 5 / 60)).toBeCloseTo(4 / 60 / SHIELD_RIPPLE.life);
    fb.observe([], 1.2);
    expect(fb.shieldRipple(1, 1.2)).toBeUndefined();
    expect(fb.size).toBe(0);
  });
});

describe("feedback accents", () => {
  it("highlights a procedural body on a hit, but not a painted one (its tint flashes)", () => {
    const fb = new EnemyFeedback(),
      c = unit(1, "tank");
    fb.consume([damage(1, 300)], 1);
    fb.observe([c], 1);
    const procedural = recorder(),
      painted = recorder();
    drawEnemyAccents(procedural.g, c, fb, 1, false);
    drawEnemyAccents(painted.g, c, fb, 1, true);
    expect(procedural.calls).toContain("fillPoints");
    expect(painted.calls).toEqual([]);
  });

  it("reveals nothing of hidden or burrowed units", () => {
    const fb = new EnemyFeedback(),
      all: Partial<StatusFlags> = { burning: true, stunned: true, slowed: true, disrupted: true };
    for (const c of [unit(1, "aegis", { traits: { stealth: true, shield: 0.5 }, status: all }), unit(1, "burrower", { traits: { burrowed: true }, status: all })]) {
      fb.observe([{ ...c, traits: { ...c.traits, shield: 1 } }], 0);
      fb.consume([damage(1, 300)], 1);
      fb.observe([c], 1);
      const r = recorder();
      drawEnemyAccents(r.g, c, fb, 1, false);
      expect(r.calls).toEqual([]);
    }
  });

  it("draws at most two status accents and stops when the status ends", () => {
    const fb = new EnemyFeedback(),
      count = (status: Partial<StatusFlags>) => {
        const r = recorder();
        drawEnemyAccents(r.g, unit(1, "tank", { status }), fb, 0.3, true);
        return r.calls.length;
      };
    const two = count({ stunned: true, burning: true }),
      four = count({ stunned: true, burning: true, disrupted: true, slowed: true });
    expect(two).toBeGreaterThan(0);
    expect(four).toBe(two);
    expect(count({})).toBe(0);
  });
});
