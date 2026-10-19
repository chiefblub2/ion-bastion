import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { parseMap } from "../content/maps";
import { MISSIONS, playableMissions } from "../content/missions";
import { blankDraft, compileDraft, draftFromMission, editWaves, paint, resize, sketchOf } from "./draft";

const ok = (c: ReturnType<typeof compileDraft>) => {
  if (!c.ok) throw new Error(c.errors.join("; "));
  return c;
};

describe("editor draft", () => {
  it("blankDraft compiles", () => {
    const c = ok(compileDraft(blankDraft()));
    expect(c.mission.map.columns).toBe(18);
    expect(c.mission.map.rows).toBe(12);
    expect(c.mission.map.loop).toBeUndefined();
  });

  it("sketchOf round-trips every mission", () => {
    for (const m of playableMissions(DEFAULT_CONTENT))
      expect(parseMap(m.map.id, m.map.name, sketchOf(m.map), m.map.theme)).toEqual(m.map);
  });

  it("draftFromMission compiles back", () => {
    const circle = MISSIONS.find((m) => m.circle)!;
    for (const m of [MISSIONS[0], circle]) {
      const got = ok(compileDraft(draftFromMission(m))).mission;
      expect(got).toEqual({ ...m, map: { ...m.map, id: m.id, name: m.name } });
    }
  });

  it("paint moves S and R", () => {
    const d = blankDraft();
    const row = Math.floor(d.sketch.length / 2);
    const s = paint(d, 3, 1, "S");
    expect(s.sketch[1][3]).toBe("S");
    expect(s.sketch[row][0]).toBe("=");
    const r = paint(d, 3, 1, "R");
    expect(r.sketch[1][3]).toBe("R");
    expect(r.sketch[row][17]).toBe("=");
    expect(paint(d, -1, 0, "#")).toBe(d);
    expect(paint(d, 0, 99, "#")).toBe(d);
  });

  it("resize clamps", () => {
    const r = resize(blankDraft(), 99, 1);
    expect(r.sketch[0].length).toBe(24);
    expect(r.sketch.length).toBe(5);
  });

  it("two reactors rejected", () => {
    const d = blankDraft();
    const c = compileDraft({ ...d, sketch: d.sketch.map((r, y) => (y === 0 ? "R" + r.slice(1) : r)) });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors.join()).toContain("More than one reactor");
  });

  it("ring gets circle rules", () => {
    const d = draftFromMission(MISSIONS.find((m) => m.circle)!);
    const c = ok(compileDraft(d));
    expect(c.mission.circle).toEqual(d.circle);
    expect(c.mission.map.loop).toBe(true);
    expect("circle" in ok(compileDraft(blankDraft())).mission).toBe(false);
  });

  it("errors are collected, not thrown", () => {
    const c = compileDraft({ ...blankDraft(), waves: [] });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.errors.join()).toContain("No waves defined");
  });

  it("warns about stealth without a detector", () => {
    const d = blankDraft();
    const stealthy = { ...d, availableTowers: ["pulse" as const], waves: [{ bonus: 10, groups: [{ type: "phantom", count: 1, interval: 1, delay: 0 }] }] };
    const c = ok(compileDraft(stealthy as never));
    expect(c.warnings.some((w) => /detect/i.test(w))).toBe(true);
  });

  it("editWaves copies, moves and clears without touching the input", () => {
    const waves = blankDraft().waves.slice(0, 2);
    const before = JSON.stringify(waves);
    const dup = editWaves(waves, { kind: "duplicate-wave", wave: 0 });
    expect(dup).toHaveLength(3);
    expect(dup[1]).toEqual(waves[0]);
    expect(dup[1].groups[0]).not.toBe(waves[0].groups[0]);
    expect(editWaves(waves, { kind: "move-wave", wave: 1, by: -1 })[0]).toEqual(waves[1]);
    expect(editWaves(waves, { kind: "move-wave", wave: 1, by: 1 })).toEqual(waves);
    const hp = editWaves(waves, { kind: "set-wave", wave: 0, field: "hpMultiplier", value: 2 });
    expect(editWaves(hp, { kind: "set-wave", wave: 0, field: "hpMultiplier", value: undefined })[0]).not.toHaveProperty("hpMultiplier");
    const grown = editWaves(waves, { kind: "add-group", wave: 1 });
    expect(grown[1].groups.at(-1)).toEqual(waves[1].groups.at(-1));
    expect(editWaves(grown, { kind: "set-group", wave: 1, group: 0, patch: { count: 3 } })[1].groups[0].count).toBe(3);
    expect(editWaves([], { kind: "add-wave" })[0].groups).toHaveLength(1);
    expect(JSON.stringify(waves)).toBe(before);
  });
});
