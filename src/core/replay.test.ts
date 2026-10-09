import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { Game } from "./game";
import { finishWave, play } from "./test-helpers";
import { STRATEGIES } from "./strategies";
/**
 * Golden replays: every mission and strategy must produce exactly the same
 * course of the game. A snapshot change means the simulation changed; update
 * it only on purpose (`npx vitest run -u`) and review the diff.
 */
function trace(game: Game) {
  const s = game.state;
  return `w${s.wave} ${s.status} lives=${s.lives} gold=${s.wallets[0]} kills=${s.kills} towerKills=${s.towers.map((t) => t.kills).join("/")}`;
}
describe("golden replays", () => {
  for (const m of MISSIONS)
    for (const key of ["A", "B"] as const)
      it(`${m.id} defense ${key}`, () => {
        const waves: string[] = [];
        const { game } = play(m, STRATEGIES[m.id][key], (g) => waves.push(trace(g)));
        expect(waves.join("\n")).toMatchSnapshot();
        expect(trace(game)).toMatchSnapshot();
      });
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
