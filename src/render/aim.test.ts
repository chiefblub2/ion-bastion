import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import { TURN_RATE, TurretAim, turnToward } from "./aim";
/** Pulse tower at (7,5) on the outpost map, its cooldown just short of firing. */
function setup() {
  const g = new Game();
  g.state.wallets[0] = 1000;
  g.command({ type: "build", tower: "pulse", x: 7, y: 5 });
  const t = g.state.towers[0];
  t.angle = 0;
  t.cooldown = 0.2;
  return { g, t, aim: new TurretAim() };
}
describe("turret aim", () => {
  it("turns the short way round and stops on target", () => {
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnToward(0, 0.05, 0.1)).toBe(0.05);
  });
  it("turns toward the next target before the tower fires", () => {
    const { g, t, aim } = setup();
    aim.sync(g, 0.016);
    g.state.enemies = [makeEnemy(1, "drone", 7, 6)];
    for (let i = 0; i < 3; i++) aim.sync(g, 0.02);
    expect(aim.angle(t)).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) aim.sync(g, 0.02);
    expect(aim.angle(t)).toBeCloseTo(Math.PI / 2);
  });
  it("snaps onto the angle the tower fired at and freezes without time", () => {
    const { g, t, aim } = setup();
    aim.sync(g, 0.016);
    t.angle = 2;
    aim.sync(g, 0);
    expect(aim.angle(t)).toBe(2);
    t.angle = -2;
    aim.sync(g, 0.001);
    expect(aim.angle(t)).toBe(-2);
    expect(TURN_RATE).toBeGreaterThan(0);
  });
  it("holds the angle after a shot until late in the cooldown", () => {
    const { g, t, aim } = setup();
    aim.sync(g, 0.016);
    g.state.enemies = [makeEnemy(1, "drone", 7, 6)];
    t.cooldown = 1;
    t.angle = 1;
    aim.sync(g, 0.02);
    for (let i = 0; i < 5; i++) aim.sync(g, 0.05);
    expect(aim.angle(t)).toBe(1);
    t.cooldown = 0.2;
    for (let i = 0; i < 10; i++) aim.sync(g, 0.05);
    expect(aim.angle(t)).toBeCloseTo(Math.PI / 2);
  });
});
