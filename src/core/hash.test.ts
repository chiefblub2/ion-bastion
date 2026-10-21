import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { stateHash } from "./hash";
import { makeEnemy } from "./test-helpers";
import type { GameState } from "./types";
/** A game with a tower, an enemy and a projectile, so every kind of entity is in the state. */
function busy() {
  const game = new Game();
  game.command({ type: "build", tower: "pulse", x: 4, y: 4 });
  game.state.enemies.push(makeEnemy(900, "drone", 3, 3));
  game.state.projectiles.push({ id: 901, tower: game.state.towers[0].id, type: "pulse", target: 900, x: 4, y: 4, tx: 3, ty: 3, damage: 5, attack: { kind: "direct" } as never });
  game.state.queue.push({ at: 2, type: "drone" });
  return game;
}
describe("state hash", () => {
  // The desync check is only as good as its coverage: state that diverges must change the hash.
  const changes: [string, (s: GameState) => void][] = [
    ["an enemy status effect", (s) => s.enemies[0].status.push({ kind: "slow", factor: 0.5, until: 3 })],
    ["an enemy shield", (s) => (s.enemies[0].shield = 4)],
    ["an enemy position", (s) => (s.enemies[0].x += 0.01)],
    ["a tower cooldown", (s) => (s.towers[0].cooldown = 0.5)],
    ["a projectile in flight", (s) => (s.projectiles[0].x += 0.01)],
    ["the wave clock", (s) => (s.waveTime += 1)],
    ["the split cursor", (s) => (s.splitCursor = 1)],
    ["a queued spawn", (s) => (s.queue[0].type = "runner")],
  ];
  for (const [what, change] of changes)
    it(`changes with ${what}`, () => {
      const game = busy(),
        before = stateHash(game.state);
      change(game.state);
      expect(stateHash(game.state)).not.toBe(before);
    });
  it("ignores render events and unset optional fields", () => {
    const game = busy(),
      before = stateHash(game.state);
    game.state.events.push({ type: "evade", at: { x: 1, y: 1 } });
    game.state.enemies[0].brood = undefined;
    expect(stateHash(game.state)).toBe(before);
  });
});
