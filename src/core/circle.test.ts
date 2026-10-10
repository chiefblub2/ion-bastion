import { describe, expect, it } from "vitest";
import { Game, FIXED_STEP } from "./game";
import { missionById } from "../content/missions";
import { parseMap } from "../content/maps";
import { g, wave } from "../content/waves";
import { stateHash } from "./hash";
import { positionOnPath } from "../systems/path";
import { waveHpScale } from "../systems/spawn";
import type { MissionDefinition } from "./types";
const RING = parseMap("ring", "Ring", [
  "........",
  ".S====..",
  ".=...=..",
  ".=...=..",
  ".=====..",
  "........",
]);
/** A small ring mission: three waves 10 s apart, at most 5 enemies alive. */
function ring(overrides: Partial<MissionDefinition> = {}): MissionDefinition {
  return {
    id: "ring",
    name: "Ring",
    focus: "",
    map: RING,
    waves: [wave(10, g("drone", 2, 1)), wave(20, g("drone", 2, 1)), wave(30, g("tank", 1, 1))],
    startingCredits: 100,
    reactorEnergy: 20,
    circle: { interval: 10, limit: 5, earlyBonus: 2 },
    ...overrides,
  };
}
const seconds = (game: Game, s: number) => {
  for (let i = 0; i < Math.round(s / FIXED_STEP); i++) game.tick();
};
describe("ring maps", () => {
  it("parse a sketch without R as a closed loop leaving S to the right", () => {
    expect(RING.loop).toBe(true);
    expect(RING.path).toHaveLength(14);
    expect(RING.path.slice(0, 2)).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(RING.path.at(-1)).toEqual({ x: 1, y: 2 });
  });
  it("reject open rings and branches", () => {
    expect(() => parseMap("t", "T", ["S==", "=..", "=.."])).toThrow("without returning to S");
    expect(() => parseMap("t", "T", ["S==", "=.=", "===", "=.."])).toThrow("branches");
    expect(() => parseMap("t", "T", ["S=.", "...", "..."])).toThrow("not closed");
  });
  it("wrap positions from the last cell back to the first", () => {
    const n = RING.path.length;
    expect(positionOnPath(RING.path, n - 0.5, true)).toEqual({ x: 1, y: 1.5 });
    expect(positionOnPath(RING.path, n + 1, true)).toEqual(RING.path[1]);
  });
  it("need circle rules, and circle rules need a ring", () => {
    expect(() => new Game(ring({ circle: undefined }))).toThrow("ring map");
    expect(() => new Game(ring({ map: missionById("outpost-07")!.map }))).toThrow("ring map");
    expect(() => new Game(ring({ circle: { interval: 0, limit: 5, earlyBonus: 0 } }))).toThrow("circuit rules");
  });
});
describe("circle missions", () => {
  it("start the following waves on a timer while earlier ones still run", () => {
    const game = new Game(ring());
    expect(game.state.circle).toBeUndefined();
    game.command({ type: "start" });
    expect(game.state.circle).toEqual({ next: 10 });
    seconds(game, 5);
    expect(game.state.enemies).toHaveLength(2);
    seconds(game, 5.1);
    expect(game.state.wave).toBe(2);
    expect(game.state.wallets[0]).toBe(100 + 10 + 2 * 0); // bonus of wave 1, no kills
    seconds(game, 3);
    expect(game.state.enemies).toHaveLength(4);
    expect(game.state.status).toBe("wave");
  });
  it("let enemies circle without touching the reactor", () => {
    const game = new Game(ring({ waves: [wave(0, g("drone", 1, 1))] }));
    game.command({ type: "start" });
    seconds(game, 30);
    const [e] = game.state.enemies;
    expect(e.distance).toBeGreaterThan(RING.path.length * 2);
    expect(game.state.lives).toBe(20);
    expect(game.state.status).toBe("wave");
  });
  it("pay for calling the next wave early and refuse once all waves run", () => {
    const game = new Game(ring());
    game.command({ type: "start" });
    seconds(game, 4);
    const before = game.state.wallets[0],
      result = game.command({ type: "start" });
    expect(result).toMatchObject({ ok: true, code: "wave-called", params: { wave: 2, bonus: 12 } });
    expect(game.state.wallets[0]).toBe(before + 12 + 10);
    expect(game.command({ type: "start" }).ok).toBe(true);
    expect(game.command({ type: "start" })).toMatchObject({ ok: false, code: "no-waves-left" });
  });
  it("is lost as soon as more enemies than the limit are alive", () => {
    const game = new Game(ring({ waves: [wave(0, g("tank", 6, 0.5))] }));
    game.command({ type: "start" });
    seconds(game, 2.4);
    expect(game.state.status).toBe("wave");
    seconds(game, 0.2);
    expect(game.state.status).toBe("lost");
    expect(game.state.enemies).toHaveLength(6);
  });
  it("is won once every wave started and the ring is empty", () => {
    const game = new Game(ring({ waves: [wave(15, g("drone", 1, 1))] }));
    game.command({ type: "start" });
    seconds(game, 0.1);
    game.state.enemies[0].hp = 0;
    const events: string[] = [];
    game.tick();
    events.push(...game.drainEvents().map((e) => e.type));
    expect(game.state.status).toBe("won");
    expect(game.state.wallets[0]).toBe(115);
    expect(events).toContain("end");
  });
  it("scale enemy HP by their own wave, not the newest one", () => {
    const m = ring({ waves: [wave(0, g("tank", 1, 1, 5)), wave(0, g("drone", 1, 1))] }),
      game = new Game(m);
    game.command({ type: "start" });
    game.command({ type: "start" });
    seconds(game, 5.1);
    const tank = game.state.enemies.find((e) => e.type === "tank")!;
    expect(tank.maxHp).toBe(Math.round(game.content.enemies.tank.hp * waveHpScale(m, 1)));
  });
  it("hash the wave timer", () => {
    const a = new Game(ring()),
      b = new Game(ring());
    a.command({ type: "start" });
    b.command({ type: "start" });
    b.state.circle!.next = 3;
    expect(stateHash(a.state)).not.toBe(stateHash(b.state));
  });
});
