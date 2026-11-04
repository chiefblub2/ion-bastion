import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { play } from "./play";
import { isSpecialization } from "./upgrades";
import { STRATEGIES } from "../strategies";
import type { Strategy } from "./play";

/** A mission whose strategy A names a Detector path, played rich enough to buy everything (one wave is enough). */
const rich = (strategy: Strategy) => {
  const m = MISSIONS.find((m) => m.id === "prismenschacht")!;
  return play({ ...m, startingCredits: 100000, waves: m.waves.slice(0, 1) }, strategy).game;
};
const tiers = (game: ReturnType<typeof rich>) =>
  game.state.towers.map((t) => [t.type, t.upgrades.filter((id) => isSpecialization(game.content.towers[t.type].upgrades.find((u) => u.id === id)!))] as const);

describe("test strategies and specialization paths", () => {
  it("buys the named path's tiers and none for builds without a path", () => {
    const game = rich(STRATEGIES.prismenschacht.A);
    for (const [type, owned] of tiers(game)) {
      const build = STRATEGIES.prismenschacht.A.builds.find((b) => b.tower === type)!;
      expect(owned, type).toEqual(build.path ? [1, 2, 3].map((n) => `${build.path}-${n}`) : []);
    }
  });
  it("buys no tier while a build is missing or a tower is below level 4", () => {
    const m = MISSIONS.find((m) => m.id === "prismenschacht")!,
      builds = STRATEGIES.prismenschacht.A.builds;
    // Just enough for the builds and a few levels: the defense is never complete, so no tier is bought.
    const { game } = play({ ...m, startingCredits: 600, waves: m.waves.slice(0, 1) }, { builds });
    expect(tiers(game).every(([, owned]) => owned.length === 0)).toBe(true);
  });
});
