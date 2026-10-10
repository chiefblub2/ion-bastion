import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { finishWave } from "./test-helpers";
import { trace } from "./campaign-tests";
/** Golden replay of a hand-played game; the campaign replays live in `campaign-tests.ts` (`replay-N.test.ts`). */
describe("golden replays", () => {
  it("mixed fire on the outpost, including a sale mid-wave", () => {
    const g = new Game();
    g.state.wallets[0] = 2000;
    const ids = [
      g.command({ type: "build", tower: "frost", x: 4, y: 4 }).id!,
      g.command({ type: "build", tower: "tesla", x: 6, y: 5 }).id!,
      g.command({ type: "build", tower: "blast", x: 6, y: 7 }).id!,
      g.command({ type: "build", tower: "aura", x: 4, y: 5 }).id!,
      g.command({ type: "build", tower: "pulse", x: 9, y: 6 }).id!,
    ];
    for (const id of ids.slice(0, 3)) for (let l = 2; l <= 5; l++) g.command({ type: "upgrade", id, upgrade: `level-${l}` });
    g.command({ type: "upgrade", id: ids[3], upgrade: "speed" });
    const log: string[] = [];
    for (let w = 0; w < 4; w++) {
      g.command({ type: "start" });
      for (let i = 0; i < 200; i++) g.tick();
      if (w === 1) g.command({ type: "sell", id: ids[4] });
      log.push(`${trace(g)} enemies=${g.state.enemies.map((e) => `${e.hp}@${e.distance.toFixed(3)}`).join(",")}`);
      finishWave(g);
      log.push(trace(g));
    }
    expect(log.join("\n")).toMatchSnapshot();
  });
});
