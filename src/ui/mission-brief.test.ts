import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { mapPreviewSvg, missionEnemies } from "./mission-brief";
const { missions } = DEFAULT_CONTENT;
describe("mission briefing", () => {
  it("lists each enemy type once, in order of first appearance", () => {
    for (const m of missions) {
      const ids = missionEnemies(m, DEFAULT_CONTENT).map((e) => e.id),
        firsts = [...new Set(m.waves.flatMap((w) => w.groups.map((g) => g.type)))];
      expect(ids).toEqual(firsts);
    }
  });
  it("marks types no earlier mission sends as new", () => {
    expect(missionEnemies(missions[0], DEFAULT_CONTENT).every((e) => e.isNew)).toBe(true);
    const seen = new Set<string>();
    for (const m of missions) {
      for (const e of missionEnemies(m, DEFAULT_CONTENT)) expect(e.isNew).toBe(!seen.has(e.id));
      for (const e of missionEnemies(m, DEFAULT_CONTENT)) seen.add(e.id);
    }
  });
  it("draws one cell per grid square, the entry and the reactor only with a reactor", () => {
    const reactor = missions.find((m) => !m.map.loop)!.map,
      ring = missions.find((m) => m.map.loop)!.map;
    const svg = mapPreviewSvg(reactor);
    expect(svg.match(/<rect /g)).toHaveLength(reactor.columns * reactor.rows);
    expect(svg).toContain('class="map-entry"');
    expect(svg).toContain('class="map-reactor"');
    expect(mapPreviewSvg(ring)).not.toContain('class="map-reactor"');
  });
});
