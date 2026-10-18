import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { TowerDefinition } from "../core/types";
import { isSupport } from "../systems/attacks";
import { familyOf } from "./families";

const tower = (pick: (d: TowerDefinition) => boolean) => Object.values(DEFAULT_CONTENT.towers).find(pick)!;
describe("families", () => {
  it("gives every attacking tower a family and support towers none", () => {
    expect(familyOf(tower((d) => d.attack.kind === "direct" && !d.placement))).toBe("rapid");
    expect(familyOf(tower((d) => d.attack.kind === "splash" && !d.placement))).toBe("heavy");
    expect(familyOf(tower((d) => d.placement === "path"))).toBe("traps");
    expect(familyOf(tower((d) => isSupport(d.attack)))).toBeNull();
  });
});
