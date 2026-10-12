import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerDefinition, TowerId } from "../core/types";
import { isSupport } from "../systems/attacks";
import { familyOf, shotsByFamily } from "./families";

const tower = (pick: (d: TowerDefinition) => boolean) => Object.values(DEFAULT_CONTENT.towers).find(pick)!;
const at = { x: 0, y: 0 };
describe("families", () => {
  it("gives every attacking tower a family and support towers none", () => {
    expect(familyOf(tower((d) => d.attack.kind === "direct" && !d.placement))).toBe("rapid");
    expect(familyOf(tower((d) => d.attack.kind === "splash" && !d.placement))).toBe("heavy");
    expect(familyOf(tower((d) => d.placement === "path"))).toBe("traps");
    expect(familyOf(tower((d) => isSupport(d.attack)))).toBeNull();
  });
  it("counts shots per family and ignores other events", () => {
    const direct = tower((d) => d.attack.kind === "direct" && !d.placement).id as TowerId,
      splash = tower((d) => d.attack.kind === "splash" && !d.placement).id as TowerId,
      shot = (t: TowerId): GameEvent => ({ type: "shot", tower: t, from: at, to: at, color: 0 });
    expect(shotsByFamily([shot(direct), shot(direct), shot(splash), { type: "kill", at, color: 0, reward: 1 }], DEFAULT_CONTENT)).toEqual({ rapid: 2, heavy: 1 });
  });
});
