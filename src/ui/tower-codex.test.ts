import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { TowerId } from "../core/types";
import { maxTowerLevel } from "../core/upgrades";
import { isSupport } from "../systems/attacks";
import { codexTowers, renderTowerCodex } from "./tower-codex";
import { TOWER_PAGES } from "./tower-pages";
const towers = codexTowers(DEFAULT_CONTENT);
describe("tower codex", () => {
  it("lists every tower once, grouped by build-menu category", () => {
    expect(towers.map((t) => t.definition.id).sort()).toEqual(Object.keys(DEFAULT_CONTENT.towers).sort());
    expect(towers.map((t) => t.page)).toEqual([...towers.map((t) => t.page)].sort((a, b) => a - b));
  });
  it("gives attack towers levels 1 to 5 with growing damage and support towers none", () => {
    for (const t of towers) {
      if (isSupport(t.definition.attack)) expect(t.levels).toEqual([]);
      else {
        expect(t.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
        expect(t.levels[4].damage).toBeGreaterThan(t.levels[0].damage);
        if (maxTowerLevel(t.definition.id as TowerId, DEFAULT_CONTENT) > 5) expect(t.paths).toHaveLength(3);
      }
    }
  });
  it("renders one card per tower of the open category", () => {
    for (let page = 0; page < TOWER_PAGES.length; page++) {
      const { list } = renderTowerCodex(DEFAULT_CONTENT, page);
      expect(list.match(/<article /g)?.length ?? 0).toBe(towers.filter((t) => t.page === page).length);
    }
  });
});
