import { describe, it, expect } from "vitest";
import { Game } from "../core/game";
import { attackEnemies } from "./combat";
import { landProjectiles, makeEnemy } from "../core/test-helpers";
import { validateContent } from "../core/validation";
import { specializationError } from "../core/specialization-types";
import { DEFAULT_CONTENT } from "../content";
import { TOWERS } from "../content/towers";
import type { AirburstAttack, EnemyId } from "../core/types";
import { hitOf } from "./damage";
import { isNetted } from "./status";
import { canAcquire } from "./attacks";

const { radius } = TOWERS.skyburst.attack as AirburstAttack;
const LEVELS = ["level-2", "level-3", "level-4", "level-5"];
/** Skyburst at (7,5) on the outpost map, optionally upgraded; one salvo is fired and landed. */
function fire(enemies: [EnemyId, number, number][], upgrades: string[] = []) {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower: "skyburst", x: 7, y: 5 });
  g.state.towers[0].upgrades = upgrades;
  g.state.enemies = enemies.map(([type, x, y], i) => makeEnemy(100 + i, type, x, y, 10 - i));
  attackEnemies(g, 0);
  landProjectiles(g);
  return g;
}
const damage = (g: Game) => g.state.enemies.map((e) => 1000 - e.hp);

describe("Skyburst airburst", () => {
  it("bursts on its target and hits every flyer in the radius, but no ground unit under it", () => {
    const g = fire([["glider", 7, 6], ["glider", 7 + radius - 0.1, 6], ["drone", 7, 6], ["glider", 7 + radius + 0.3, 6]]);
    expect(damage(g)).toEqual([TOWERS.skyburst.damage, TOWERS.skyburst.damage, 0, 0]);
  });
  it("counts as an area hit, so blastproof reduces it", () => {
    expect(hitOf("airburst", { tower: 1, type: "skyburst" }).area).toBe(true);
  });
  it("Downdraft nets the flyers it reaches, which ground-only towers can then acquire", () => {
    const g = fire([["glider", 7, 6], ["glider", 7.4, 6]], [...LEVELS, "downdraft-1"]);
    for (const e of g.state.enemies) {
      expect(isNetted(e, g.state.time)).toBe(true);
      expect(canAcquire(g, "blast", e)).toBe(true);
    }
  });
  it("rejects a non-positive radius and a malformed downdraft", () => {
    expect(() =>
      validateContent({ ...DEFAULT_CONTENT, towers: { ...TOWERS, skyburst: { ...TOWERS.skyburst, attack: { kind: "airburst", radius: 0 } } } }),
    ).toThrow();
    expect(specializationError({ kind: "downdraft", factor: 1.5, duration: 1 })).toBeDefined();
  });
});
