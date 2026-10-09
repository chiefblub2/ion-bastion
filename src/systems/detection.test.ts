import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMIES } from "../content/enemies";
import { Game } from "../core/game";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import type { ContentPack } from "../core/types";
import { attackEnemies } from "./combat";
import { updateDetection } from "./detection";

const stealthDrones: ContentPack = {
  ...DEFAULT_CONTENT,
  enemies: { ...ENEMIES, drone: { ...ENEMIES.drone, traits: [{ kind: "stealth" }] } },
};
/** A tower at (7,5) on the outpost map and one stealthed drone next to it. */
function setup(tower: "pulse" | "blast", detector?: { x: number; y: number }) {
  const g = new Game(undefined, stealthDrones);
  g.state.wallets[0] = 1000;
  expect(g.command({ type: "build", tower, x: 7, y: 5 }).ok).toBe(true);
  if (detector) expect(g.command({ type: "build", tower: "detector", ...detector }).ok).toBe(true);
  const e = makeEnemy(1, "drone", 7, 6);
  g.state.enemies = [e];
  updateDetection(g);
  attackEnemies(g, 0);
  landProjectiles(g);
  return e;
}
describe("stealth and detector", () => {
  it("towers cannot pick a stealthed enemy without a detector", () => {
    const e = setup("pulse");
    expect(e.revealed).toBe(false);
    expect(e.hp).toBe(1000);
  });
  it("a detector in range reveals it for every tower", () => {
    const e = setup("pulse", { x: 9, y: 5 });
    expect(e.revealed).toBe(true);
    expect(e.hp).toBe(1000 - DEFAULT_CONTENT.towers.pulse.damage);
  });
  it("a detector out of range does not help", () => {
    expect(setup("pulse", { x: 0, y: 0 }).revealed).toBe(false);
  });
  it("area damage still hits an unrevealed stealthed enemy", () => {
    const g = new Game(undefined, stealthDrones);
    g.state.wallets[0] = 1000;
    g.command({ type: "build", tower: "blast", x: 7, y: 5 });
    const hidden = makeEnemy(1, "drone", 7, 6, 10),
      visible = makeEnemy(2, "runner", 7, 6.3, 9);
    g.state.enemies = [hidden, visible];
    updateDetection(g);
    attackEnemies(g, 0);
    landProjectiles(g);
    expect(hidden.hp).toBe(1000 - DEFAULT_CONTENT.towers.blast.damage);
  });
  it("the detector never attacks and counts as a support tower", () => {
    const g = new Game();
    g.state.wallets[0] = 1000;
    g.command({ type: "build", tower: "detector", x: 7, y: 5 });
    g.state.enemies = [makeEnemy(1, "drone", 7, 6)];
    attackEnemies(g, 0);
    expect(g.state.enemies[0].hp).toBe(1000);
    expect(g.state.events.some((e) => e.type === "shot")).toBe(false);
  });
});
