import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { Tower, TowerId } from "../core/types";
import { drawTower, stillBody, type TowerBadges } from "./towers";
import type { Ink } from "./shapes";

const tower = (type: string): Tower => ({ id: 3, type: type as TowerId, x: 0, y: 0, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 });
const badges = (type: string, markers: number): TowerBadges => ({ markers, maxed: false, color: DEFAULT_CONTENT.towers[type as TowerId].color, boosted: false });
/** Counts the calls a drawing makes on one ink. */
function counter() {
  const counts = { calls: 0 },
    ink: Ink = new Proxy({} as Ink, { get: () => () => (counts.calls++, ink) });
  return { ink, counts };
}

describe("baked tower bodies", () => {
  it("finds most bodies still, so they can be baked once per key", () => {
    const ids = Object.keys(DEFAULT_CONTENT.towers),
      still = ids.filter((id) => stillBody(tower(id), DEFAULT_CONTENT.towers[id as TowerId], badges(id, 5)));
    expect(still.length / ids.length).toBeGreaterThan(0.8);
  });

  it("keeps a base whose metal moves with time live", () => {
    // Inferno's vents flicker on its plate, not only in its light.
    expect(stillBody(tower("inferno"), DEFAULT_CONTENT.towers.inferno, badges("inferno", 1))).toBe(false);
  });

  it("skips only the body ink of a baked tower and keeps all of its light", () => {
    const d = DEFAULT_CONTENT.towers.pulse,
      draw = (baked: boolean) => {
        const g = counter(),
          glow = counter();
        drawTower({ g: g.ink, glow: glow.ink }, 0, 0, tower("pulse"), d, 1.5, badges("pulse", 5), baked);
        return { g: g.counts.calls, glow: glow.counts.calls };
      },
      live = draw(false),
      baked = draw(true);
    expect(baked.glow).toBe(live.glow);
    expect(baked.g).toBeLessThan(live.g / 2);
  });
});
