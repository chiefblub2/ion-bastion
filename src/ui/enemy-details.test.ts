import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import { enemyAt } from "../render/pick";
import { enemyDetails, enemyKey } from "./enemy-details";

const CELL = 56;
describe("enemy details", () => {
  it("shows name, live HP, base values and the layer", () => {
    const g = new Game(),
      e = { ...makeEnemy(1, "glider", 3, 3), hp: 412.3, maxHp: 900 };
    const html = enemyDetails(g, e);
    expect(html).toContain("ENEMY SELECTED");
    expect(html).toContain(g.content.enemies.glider.name);
    expect(html).toContain("<b>413</b> / 900 HP");
    expect(html).toContain(">AIR<");
    expect(html).toContain("Air");
    expect(html).toContain(`◇ ${g.content.enemies.glider.reward}`);
    expect(html).not.toContain("sent by");
  });
  it("lists traits, shield and active status effects", () => {
    const g = new Game(),
      e = { ...makeEnemy(1, "aegis", 3, 3), shield: 120 };
    e.status.push({ kind: "slow", factor: 0.5, until: g.state.time + 2 });
    const html = enemyDetails(g, e);
    expect(html).toContain("SHIELD 60%");
    expect(html).toContain("Shield <b>120</b>");
    expect(html).toContain("SLOWED");
    expect(html).not.toContain("BURNING");
    expect(enemyDetails(g, makeEnemy(2, "bulwark", 3, 3))).toContain("ARMOR 35%");
  });
  it("names the sender of a versus enemy, which pays no reward", () => {
    const html = enemyDetails(new Game(), { ...makeEnemy(1, "drone", 3, 3), sentBy: 1 });
    expect(html).toContain("sent by <b>Player 2</b>");
    expect(html).toContain("◇ 0");
  });
  it("changes its key with HP so the panel stays live", () => {
    const g = new Game(),
      e = makeEnemy(1, "drone", 3, 3);
    const before = enemyKey(g, e);
    e.hp -= 10;
    expect(enemyKey(g, e)).not.toBe(before);
  });
});
describe("enemyAt", () => {
  const center = (v: number) => (v + 0.5) * CELL;
  it("picks the nearest enemy under the pointer and misses empty space", () => {
    const g = new Game();
    g.state.enemies = [makeEnemy(1, "drone", 3, 3), makeEnemy(2, "drone", 3.3, 3)];
    expect(enemyAt(g, center(3.25), center(3), CELL)?.id).toBe(2);
    expect(enemyAt(g, center(3), center(3), CELL)?.id).toBe(1);
    expect(enemyAt(g, center(6), center(6), CELL)).toBeUndefined();
  });
  it("skips hidden stealth enemies until a detector reveals them", () => {
    const g = new Game(),
      e = makeEnemy(1, "phantom", 3, 3);
    g.state.enemies = [e];
    expect(enemyAt(g, center(3), center(3), CELL)).toBeUndefined();
    e.revealed = true;
    expect(enemyAt(g, center(3), center(3), CELL)?.id).toBe(1);
  });
});
