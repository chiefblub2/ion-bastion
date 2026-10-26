import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { finishWave } from "../core/test-helpers";
import { TRAINING, TRAINING_SPOT } from "../content/training";
import { coachRefusal, coachStep, freshMemory } from "./coach";
const view = (build: "pulse" | null = null, selected: number | null = null) => ({ build, selected, player: 0 });
describe("Training coach", () => {
  it("walks from the reactor to the first wave, holding the start back until a tower stands", () => {
    const game = new Game(TRAINING),
      memory = freshMemory();
    expect(coachStep(game, view(), memory)?.id).toBe("reactor");
    expect(coachRefusal(coachStep(game, view(), memory), { type: "start" })).toBeTruthy();
    memory.acked.add("reactor").add("credits");
    expect(coachStep(game, view(), memory)?.id).toBe("pick");
    expect(coachStep(game, view("pulse"), memory)).toMatchObject({ id: "place", highlight: TRAINING_SPOT });
    game.command({ type: "build", tower: "pulse", ...TRAINING_SPOT });
    const start = coachStep(game, view(), memory);
    expect(start?.id).toBe("start");
    expect(coachRefusal(start, { type: "start" })).toBeNull();
    expect(coachRefusal(coachStep(game, view(), memory), { type: "build" })).toBeNull();
  });
  it("says tap and ✓ on a touch screen, click with a mouse", () => {
    const game = new Game(TRAINING),
      memory = freshMemory();
    memory.acked.add("reactor").add("credits");
    expect(coachStep(game, view("pulse"), memory, true)?.text).toMatch(/^Tap the marked cell, then ✓/);
    expect(coachStep(game, view("pulse"), memory)?.text).toMatch(/^Click the marked cell/);
  });
  it("asks for a second tower and an upgrade after wave 1, then lets wave 2 start", () => {
    const game = new Game(TRAINING),
      memory = freshMemory();
    memory.acked.add("reactor").add("credits");
    game.command({ type: "build", tower: "pulse", ...TRAINING_SPOT });
    game.command({ type: "start" });
    expect(coachStep(game, view(), memory)?.id).toBe("watch");
    finishWave(game);
    expect(coachStep(game, view(), memory)?.id).toBe("second");
    expect(coachRefusal(coachStep(game, view(), memory), { type: "start" })).toBeTruthy();
    game.command({ type: "build", tower: "pulse", x: 8, y: 4 });
    const first = game.state.towers[0];
    expect(coachStep(game, view(), memory)).toMatchObject({ id: "select", highlight: { x: first.x, y: first.y } });
    expect(coachStep(game, view(null, first.id), memory)?.id).toBe("upgrade");
    expect(coachStep(game, view(null, first.id), memory)?.target).toEqual({ el: "#tower-card [data-upgrade]" });
    game.command({ type: "upgrade", id: first.id, upgrade: "level-2" });
    const next = coachStep(game, view(null, first.id), memory);
    expect(next?.id).toBe("next-wave");
    expect(coachRefusal(next, { type: "start" })).toBeNull();
  });
  it("never holds the start when the player cannot afford the next step", () => {
    const game = new Game({ ...TRAINING, startingCredits: 80, waves: [{ groups: [{ type: "drone", count: 1, interval: 1, delay: 0 }], bonus: 0 }, ...TRAINING.waves] }),
      memory = freshMemory();
    memory.acked.add("reactor").add("credits");
    game.command({ type: "build", tower: "pulse", ...TRAINING_SPOT });
    game.command({ type: "start" });
    finishWave(game);
    expect(coachRefusal(coachStep(game, view(), memory), { type: "start" })).toBeNull();
  });
  it("stays silent outside Training and once skipped", () => {
    expect(coachStep(new Game(), view(), freshMemory())).toBeNull();
    expect(coachStep(new Game(TRAINING), view(), { ...freshMemory(), skipped: true })).toBeNull();
  });
});
