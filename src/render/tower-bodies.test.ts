import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { Tower, TowerId } from "../core/types";
import { drawTower, isTilted, stillBody, stillTurret, type TowerBadges } from "./towers";
import { towerColor, towerLevel, towerPath, upgradeOptions } from "../core/upgrades";
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

  it("bakes the tilted foundations (Pulse, Nova) like any flat body, whatever was drawn before", () => {
    for (const id of ["pulse", "blast"] as const)
      for (const level of [1, 5]) {
        // A turret drawn first leaves its corners in the shared scratch buffers; the base must not pick them up.
        const ink = counter().ink;
        drawTower({ g: ink, glow: ink }, 0, 0, { ...tower(id), angle: 2.2 }, DEFAULT_CONTENT.towers[id], 0.7, badges(id, level));
        expect(stillBody({ ...tower(id), id: 40 + level }, DEFAULT_CONTENT.towers[id], badges(id, level))).toBe(true);
      }
  });

  it("skips only the body ink of a baked tower and keeps all of its light", () => {
    const d = DEFAULT_CONTENT.towers.blast,
      draw = (baked: boolean) => {
        const g = counter(),
          glow = counter();
        drawTower({ g: g.ink, glow: glow.ink }, 0, 0, tower("blast"), d, 1.5, badges("blast", 5), { baked });
        return { g: g.counts.calls, glow: glow.counts.calls };
      },
      live = draw(false),
      baked = draw(true);
    expect(baked.glow).toBe(live.glow);
    expect(baked.g).toBeLessThan(live.g / 2);
  });
});

/** A tower bought as far as it goes along `path` (or the plain levels), with its badges. */
function maxed(type: TowerId, path?: string) {
  const t = tower(type);
  for (;;) {
    const next = upgradeOptions(t, Infinity, DEFAULT_CONTENT).find((o) => o.status === "available" && (!o.definition!.path || o.definition!.path === path));
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  const look: TowerBadges = { markers: towerLevel(t, DEFAULT_CONTENT), maxed: false, color: towerColor(t, DEFAULT_CONTENT), path: towerPath(t, DEFAULT_CONTENT), boosted: false };
  return { t, look };
}

describe("cached tilted turrets", () => {
  const tilted = (Object.keys(DEFAULT_CONTENT.towers) as TowerId[]).filter((id) => isTilted(DEFAULT_CONTENT.towers[id]));

  it("draw their turret ink from the look, angle and recoil alone, without glow, at every level and path", () => {
    expect(tilted).toEqual(expect.arrayContaining(["pulse", "blast"]));
    for (const id of tilted) {
      const d = DEFAULT_CONTENT.towers[id];
      expect(stillTurret(tower(id), d, badges(id, 1)), `${id} L1`).toBe(true);
      for (const path of [undefined, ...Object.keys(d.visual.paths ?? {})]) {
        const { t, look } = maxed(id, path);
        expect(stillTurret(t, d, look), `${id} ${path ?? "plain"}`).toBe(true);
      }
    }
  });

  it("leave the turret ink out when it is cached, and put the parts over it on the top layer", () => {
    const d = DEFAULT_CONTENT.towers.blast,
      draw = (cached: boolean) => {
        const g = counter(),
          top = counter(),
          glow = counter();
        drawTower({ g: g.ink, glow: glow.ink }, 0, 0, { ...tower("blast"), cooldown: 0.4 }, d, 1.5, badges("blast", 5), { baked: true, top: cached ? top.ink : undefined });
        return { g: g.counts.calls, top: top.counts.calls, glow: glow.counts.calls };
      },
      live = draw(false),
      cached = draw(true);
    expect(cached.glow).toBe(live.glow);
    expect(cached.top).toBeGreaterThan(0);
    expect(cached.g + cached.top).toBeLessThan(live.g / 2);
  });
});
