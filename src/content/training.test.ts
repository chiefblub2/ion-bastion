import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { play } from "../core/play";
import { finishWave } from "../core/test-helpers";
import { validateMission } from "../core/validation";
import { DEFAULT_CONTENT } from "./index";
import { findMission, MISSIONS } from "./missions";
import { TOWERS } from "./towers";
import { TRAINING, TRAINING_SPOT } from "./training";
describe("Training mission", () => {
  it("is valid, loadable by id and outside the campaign", () => {
    expect(() => validateMission(TRAINING)).not.toThrow();
    expect(MISSIONS).not.toContain(TRAINING);
    expect(findMission("training", DEFAULT_CONTENT)).toBe(TRAINING);
    const game = new Game();
    expect(game.command({ type: "mission", id: "training" }).ok).toBe(true);
    expect(game.mission).toBe(TRAINING);
  });
  it("loses without a defense and wins with the coached builds", () => {
    expect(play(TRAINING).game.state.status).toBe("lost");
    let afterFirst = 0;
    const coached = play(TRAINING, { builds: [{ tower: "pulse", ...TRAINING_SPOT }, { tower: "pulse", x: 8, y: 4 }] }, (g) => {
      if (g.state.wave === 1) afterFirst = g.state.wallets[0];
    });
    expect(coached.game.state.status).toBe("won");
    // After wave 1 the player can afford the second tower and the first upgrade the coach asks for.
    const upgrade = TOWERS.pulse.upgrades.find((u) => u.id === "level-2")!;
    expect(afterFirst).toBeGreaterThanOrEqual(Math.max(TOWERS.pulse.cost, TOWERS.frost.cost) + upgrade.cost);
  });
  it("never starts the next wave by itself", () => {
    const game = new Game(TRAINING);
    game.command({ type: "build", tower: "pulse", ...TRAINING_SPOT });
    game.command({ type: "start" });
    finishWave(game);
    expect(game.state.status).toBe("ready");
    expect(game.state.nextWave).toBeUndefined();
  });
});
