import { describe, expect, it } from "vitest";
import { missionById } from "../content/missions";
import { Game } from "../core/game";
import { liveUnits, renderLiveUnits } from "./live-units";

const game = () => new Game(missionById("schleusenring")!);
describe("live units", () => {
  it("is empty between waves", () => {
    expect(liveUnits(game())).toBeNull();
  });
  it("counts living and queued enemies of the running wave by type", () => {
    const g = game();
    g.command({ type: "start" });
    for (let i = 0; i < 60; i++) g.tick();
    const live = liveUnits(g)!,
      s = g.state;
    expect(live.alive).toBe(s.enemies.length);
    expect(live.queued).toBe(s.queue.length);
    expect(live.alive).toBeGreaterThan(0);
    const drone = live.units.find((u) => u.type === "drone")!;
    expect(drone.alive + drone.queued).toBe(8);
    const html = renderLiveUnits(live, s.wave);
    expect(html).toContain("ON FIELD · WAVE 01");
    expect(html).toContain(`<b class="live-count">${drone.alive}</b>`);
    expect(html).toContain(`+${drone.queued}`);
    expect(html).not.toMatch(/live-hp|live-slowed|title=/);
  });
});
