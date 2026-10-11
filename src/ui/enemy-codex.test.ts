import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { ENEMY_ANIMATIONS } from "../render/enemy-animations";
import { codexEnemies, codexTraits, renderEnemyCodex } from "./enemy-codex";

describe("enemy codex", () => {
  const enemies = codexEnemies(DEFAULT_CONTENT);
  it("lists every enemy once, in the order the campaign introduces them", () => {
    expect(enemies.map((e) => e.definition.id).sort()).toEqual(Object.keys(DEFAULT_CONTENT.enemies).sort());
    expect(enemies[0]).toMatchObject({ definition: { id: "drone" }, firstMission: { number: 1 } });
    const numbers = enemies.map((e) => e.firstMission?.number ?? Infinity);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });
  it("applies swift to HP and speed", () => {
    const skater = enemies.find((e) => e.definition.id === "skater")!;
    expect(skater.hp).toBe(40);
    expect(skater.speed).toBeCloseTo(1.8 * 1.35);
  });
  it("counts split fragments as met in the mission of their parent", () => {
    const glider = enemies.find((e) => e.definition.id === "glider")!,
      moth = enemies.find((e) => e.definition.id === "moth")!;
    expect(glider.firstMission!.number).toBeLessThanOrEqual(moth.firstMission!.number);
  });
  it("explains every trait in use, with its carriers", () => {
    const traits = codexTraits(DEFAULT_CONTENT);
    const used = new Set(Object.values(DEFAULT_CONTENT.enemies).flatMap((d) => (d.traits ?? []).map((t) => t.kind)));
    expect(traits.map((t) => t.kind).filter((k) => k !== "air").sort()).toEqual([...used].sort());
    const shield = traits.find((t) => t.kind === "shield")!;
    expect(shield.disruptable).toBe(true);
    expect(shield.enemies.map((e) => e.definition.id)).toContain("aegis");
    expect(traits.find((t) => t.kind === "armor")!.disruptable).toBe(false);
    expect(traits[0]).toMatchObject({ kind: "air", name: "Flyer" });
  });
  it("renders both tabs", () => {
    const list = renderEnemyCodex(DEFAULT_CONTENT, "enemies");
    expect(list.tabs).toContain('aria-selected="true"');
    expect(list.list).toContain("Shield Bearer");
    expect(list.list).toContain("SHIELD 60%");
    expect(list.list).toContain("from Mission 01");
    const traits = renderEnemyCodex(DEFAULT_CONTENT, "traits").list;
    expect(traits).toContain("Stealth");
    expect(traits).toContain("The Jammer switches the trait off.");
  });
});

describe("codex artwork", () => {
  it("shows the painted art of every enemy, with its procedural SVG kept as the fallback", () => {
    const { list } = renderEnemyCodex(DEFAULT_CONTENT, "enemies"),
      cards = list.split("<article").slice(1);
    expect(cards).toHaveLength(Object.keys(DEFAULT_CONTENT.enemies).length);
    for (const card of cards) {
      expect(card).toMatch(/<span class="enemy-icon painted"[^>]*><img src="[^"]*assets\/enemies\/[a-z]+\.png" alt="" width="64" height="64"/);
      expect(card).toContain('<svg class="enemy-icon"');
    }
  });

  it("offers an animation preview, closed and empty, only on the animated types", () => {
    const { list } = renderEnemyCodex(DEFAULT_CONTENT, "enemies"),
      toggles = [...list.matchAll(/data-codex-anim="([a-z]+)" aria-expanded="false" aria-controls="codex-anim-\1"/g)].map((m) => m[1]);
    // Every registered type gains a preview by itself; the rest keep their static art only.
    expect(toggles.sort()).toEqual(Object.keys(ENEMY_ANIMATIONS).sort());
    expect(toggles).toEqual(expect.arrayContaining(["aegis", "boss", "drone", "glider", "runner", "tank", "wolf", "ember"]));
    expect(list.match(/class="codex-anim" id="codex-anim-[a-z]+" role="region" aria-label="[^"]+ animation" hidden><\/div>/g)).toHaveLength(toggles.length);
    expect(list).not.toContain('data-codex-anim="warpdrone"');
    expect(list).toContain('aria-label="Animation preview of Drone"');
  });
});
