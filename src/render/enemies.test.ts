import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyDefinition, EnemyId } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { drawEnemy, drawEnemyBody, drawEnemyOverlay, drawEnemyUnderlay, enemyContext, type EnemyDrawContext } from "./enemies";
import type { Ink } from "./shapes";

type Call = [string, unknown[]];
/** A Graphics stand-in that logs every call; points are copied, as `shapes.ts` reuses one buffer. */
function recorder() {
  const calls: Call[] = [];
  const g: Ink = new Proxy({} as Ink, {
    get: (_, name) =>
      (...args: unknown[]) => {
        calls.push([String(name), args.map((a) => (Array.isArray(a) ? a.map((p) => ({ ...p })) : a))]);
        return g;
      },
  });
  return { g, calls };
}
const SHADOW = 0x030a0c;
const isShadow = ([name, args]: Call) => name === "fillStyle" && args[0] === SHADOW;
const fills = (calls: Call[], color: number) => calls.filter(([name, args]) => name === "fillStyle" && args[0] === color).length;
const idOf = (test: (d: EnemyDefinition) => boolean) => (Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[]).find((id) => test(DEFAULT_CONTENT.enemies[id]))!;
const GROUND = idOf((d) => d.layer === "ground" && d.visual.shape === "polygon" && !d.visual.tentacles),
  FLYER = idOf((d) => d.layer === "air" && d.visual.shape === "glider"),
  WORM = idOf((d) => d.visual.shape === "worm");

/** Draws each stage into its own recorder. */
function stages(type: EnemyId, change: { traits?: Partial<TraitFlags>; status?: Partial<StatusFlags>; hp?: number; hpBar?: boolean } = {}) {
  const sim = new Game(),
    e = { ...makeEnemy(7, type, 2, 3), ...(change.hp === undefined ? {} : { hp: change.hp }) },
    c: EnemyDrawContext = enemyContext(100, 100, 56, e, DEFAULT_CONTENT.enemies[type], 0.5, { ...statusFlags(e, 0), ...change.status }, { ...traitFlags(sim, e), ...change.traits }, 1.3, change.hpBar);
  const under = recorder(),
    body = recorder(),
    over = recorder();
  drawEnemyUnderlay(under.g, c);
  drawEnemyBody(body.g, c);
  drawEnemyOverlay(over.g, c);
  return { c, under: under.calls, body: body.calls, over: over.calls };
}

describe("enemy render stages", () => {
  it("drawEnemy runs underlay, body and overlay in order into one Graphics", () => {
    for (const type of [GROUND, FLYER, WORM]) {
      const { c, under, body, over } = stages(type, { status: { burning: true, slowed: true } }),
        one = recorder();
      drawEnemy(one.g, c.x, c.y, c.cell, c.enemy, c.definition, c.heading, c.status, c.traits, c.clock);
      expect(one.calls).toEqual([...under, ...body, ...over]);
    }
  });

  it("keeps the shadow in the underlay, last, and out of the body", () => {
    const ground = stages(GROUND);
    expect(ground.under.map(isShadow).lastIndexOf(true)).toBe(ground.under.length - 2);
    expect(ground.under.at(-1)).toEqual(["fillEllipse", [100, 106, expect.any(Number), expect.any(Number)]]);
    expect(ground.body.some(isShadow)).toBe(false);
    // A flyer's shadow falls far below it; a worm casts one per segment.
    expect(stages(FLYER).under.at(-1)?.[1][1]).toBe(114);
    const worm = stages(WORM),
      v = worm.c.definition.visual;
    expect(worm.under.filter(([name]) => name === "fillEllipse")).toHaveLength(v.shape === "worm" ? v.segments : -1);
    expect(worm.body.some(isShadow)).toBe(false);
  });

  it("puts status rings below the body and status markers, trait markers and the HP bar above it", () => {
    const { under, body, over } = stages(GROUND, { status: { slowed: true, burning: true }, traits: { shield: 1 } });
    expect(fills(over, 0xff6a3d)).toBe(1);
    expect(under.some(([name, args]) => name === "lineStyle" && args[1] === 0xa5a2ff)).toBe(true);
    expect(over.some(([name, args]) => name === "lineStyle" && args[1] === 0x6fb8ff)).toBe(true);
    expect(body.every(([name]) => name === "fillStyle" || name === "fillPoints")).toBe(true);
    expect(over.at(-1)?.[0]).toBe("fillRect");
    expect(fills(over, 0x93f5b8)).toBe(1);
  });

  it("colours a low HP bar and leaves the bar out on request", () => {
    expect(fills(stages(GROUND, { hp: 200 }).over, 0xff738a)).toBe(1);
    expect(stages(GROUND, { hpBar: false }).over.some(([name]) => name === "fillRect")).toBe(false);
  });

  it("draws an unrevealed stealth unit as a shimmer only, and a revealed one in full", () => {
    const hidden = stages(GROUND, { traits: { stealth: true }, status: { burning: true } });
    expect(hidden.under).toEqual([]);
    expect(hidden.body).toEqual([]);
    expect(new Set(hidden.over.map(([name]) => name))).toEqual(new Set(["lineStyle", "beginPath", "arc", "strokePath"]));
    const revealed = stages(GROUND, { traits: { stealth: true, revealed: true } });
    expect(revealed.body.length).toBeGreaterThan(0);
    expect(revealed.over.some(([name]) => name === "lineBetween")).toBe(true);
  });

  it("draws a burrowed unit as a faint shape on its mound, without a shadow", () => {
    const { under, body } = stages(WORM, { traits: { burrowed: true } });
    expect(under.some(isShadow)).toBe(false);
    expect(fills(under, 0xc9a46a)).toBeGreaterThan(0);
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual(["fillStyle", [DEFAULT_CONTENT.enemies[WORM].color, 0.3]]);
  });
});
