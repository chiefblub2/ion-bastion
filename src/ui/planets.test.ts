import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { isCircleSector } from "../content/missions";
import { WORLDS, worldOf, worldsOf } from "./planets";
const sectors = DEFAULT_CONTENT.sectors ?? [];
describe("atlas worlds", () => {
  const entries = worldsOf(sectors);
  it("puts every sector on exactly one world, the campaign in play order on planets, the Circuit on the moon", () => {
    expect(entries.flatMap((e) => e.sectors)).toHaveLength(sectors.length);
    expect(entries.filter((e) => !e.world.moon).flatMap((e) => e.sectors)).toEqual(sectors.filter((s) => !isCircleSector(s)));
    expect(entries.find((e) => e.world.moon)?.sectors).toEqual(sectors.filter(isCircleSector));
    for (const s of sectors) expect(worldOf(entries, s)?.sectors).toContain(s);
  });
  it("places every sector by hand: a new sector needs a centre on its world", () => {
    for (const { world, sectors: list } of entries) expect(world.centres.length, world.name).toBeGreaterThanOrEqual(list.length);
    for (const w of WORLDS) if (w.station !== undefined) expect(w.station).toBeLessThan(w.centres.length);
  });
});
