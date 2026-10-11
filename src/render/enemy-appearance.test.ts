import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { bodyMotion, HOVER, PULSE, resolveEnemyTint, TINTS } from "./enemy-appearance";
import { enemyContext } from "./enemies";

const sim = new Game();
function unit(type: EnemyId, change: { id?: number; status?: Partial<StatusFlags>; traits?: Partial<TraitFlags> } = {}) {
  const e = makeEnemy(change.id ?? 1, type, 2, 3);
  return enemyContext(100, 120, 56, e, DEFAULT_CONTENT.enemies[type], 0, { ...statusFlags(e, 0), ...change.status }, { ...traitFlags(sim, e), ...change.traits }, 0.5);
}

describe("enemy tint", () => {
  it("keeps the art's colours without a status and tints by a fixed priority", () => {
    expect(resolveEnemyTint(unit("tank"), 0, 1)).toBeUndefined();
    expect(resolveEnemyTint(unit("tank", { status: { slowed: true } }), 0, 1)).toEqual({ color: TINTS.slowed, fill: false });
    const burning = resolveEnemyTint(unit("tank", { status: { burning: true, slowed: true, vulnerable: true } }), 0, 1)!;
    expect(burning.fill).toBe(false);
    // A warm colour between the two burning tints: red channel full, blue channel low.
    expect(burning.color >> 16).toBe(0xff);
    expect(burning.color & 0xff).toBeLessThanOrEqual(TINTS.burning & 0xff);
    const stunned = resolveEnemyTint(unit("tank", { status: { stunned: true, burning: true, disrupted: true } }), 0, 1)!;
    expect([TINTS.stunned, TINTS.stunFlicker]).toContain(stunned.color);
    expect(resolveEnemyTint(unit("tank", { status: { vulnerable: true } }), 0, 1)?.color).toBe(TINTS.vulnerable);
  });

  it("lets a hit flash override every status and never tints hidden or burrowed units", () => {
    const flash = resolveEnemyTint(unit("tank", { status: { stunned: true } }), 1, 1);
    expect(flash).toEqual({ color: 0xffffff, fill: true });
    expect(resolveEnemyTint(unit("tank", { status: { stunned: true } }), 0.01, 1)?.fill).toBe(true);
    expect(resolveEnemyTint(unit("drone", { traits: { stealth: true }, status: { burning: true } }), 1, 1)).toBeUndefined();
    expect(resolveEnemyTint(unit("burrower", { traits: { burrowed: true }, status: { slowed: true } }), 1, 1)).toBeUndefined();
  });

  it("flickers deterministically", () => {
    const c = unit("tank", { status: { disrupted: true } }),
      colours = Array.from({ length: 30 }, (_, i) => resolveEnemyTint(c, 0, i / 30)!.color);
    expect(new Set(colours)).toEqual(new Set([TINTS.disrupted, TINTS.disruptFlicker]));
    expect(Array.from({ length: 30 }, (_, i) => resolveEnemyTint(c, 0, i / 30)!.color)).toEqual(colours);
  });
});

describe("enemy idle motion", () => {
  it("stays within its bounds and repeats for the same time", () => {
    for (const type of ["glider", "drone", "boss", "runner"] as EnemyId[])
      for (let t = 0; t < 6; t += 0.05) {
        const m = bodyMotion(unit(type), t);
        expect(Math.abs(m.dy)).toBeLessThanOrEqual(HOVER);
        expect(Math.abs(m.scale - 1)).toBeLessThanOrEqual(PULSE);
        expect(bodyMotion(unit(type), t)).toEqual(m);
      }
  });

  it("hovers flyers only, keeps heavy units calm and gives each unit its own phase", () => {
    const span = (type: EnemyId, pick: (t: number) => number) => {
      const v = Array.from({ length: 200 }, (_, i) => pick(i * 0.05));
      return Math.max(...v) - Math.min(...v);
    };
    expect(span("glider", (t) => bodyMotion(unit("glider"), t).dy)).toBeGreaterThan(HOVER);
    expect(span("drone", (t) => bodyMotion(unit("drone"), t).dy)).toBe(0);
    // A leaping walker counts as flying, like its shadow and lift.
    expect(span("runner", (t) => bodyMotion(unit("runner", { traits: { leaping: true } }), t).dy)).toBeGreaterThan(0);
    expect(span("boss", (t) => bodyMotion(unit("boss"), t).scale)).toBeLessThan(span("drone", (t) => bodyMotion(unit("drone"), t).scale));
    expect(bodyMotion(unit("glider", { id: 1 }), 2).dy).not.toBeCloseTo(bodyMotion(unit("glider", { id: 2 }), 2).dy, 3);
  });
});
