import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { earn, startingWallets } from "./economy";
import { finishWave } from "./test-helpers";
import { MISSIONS } from "../content/missions";
const coop = (players = 2) => {
  const g = new Game();
  g.setPlayers(players);
  g.command({ type: "restart" });
  return g;
};
describe("co-op economy", () => {
  it("splits the starting credits, the host gets an odd remainder", () => {
    expect(coop().state.wallets).toEqual([120, 120]);
    expect(startingWallets(241, 2)).toEqual([121, 120]);
    expect(startingWallets(241, 1)).toEqual([241]);
  });
  it("splits shared income evenly and rotates the remainder", () => {
    const g = coop();
    g.state.wallets = [0, 0];
    earn(g.state, 5);
    expect(g.state.wallets).toEqual([3, 2]);
    earn(g.state, 5);
    expect(g.state.wallets).toEqual([5, 5]);
    earn(g.state, 1);
    expect(g.state.wallets).toEqual([6, 5]);
  });
  it("charges the builder and refunds sales to the owner only", () => {
    const g = coop();
    const built = g.command({ type: "build", tower: "pulse", x: 4, y: 4, player: 1 });
    expect(built.ok).toBe(true);
    expect(g.state.wallets).toEqual([120, 40]);
    expect(g.state.towers[0].owner).toBe(1);
    expect(g.command({ type: "build", tower: "pulse", x: 6, y: 5, player: 1 }).code).toBe("credits-missing");
    expect(g.command({ type: "sell", id: built.id!, player: 0 }).code).toBe("tower-foreign");
    expect(g.command({ type: "upgrade", id: built.id!, upgrade: "level-2", player: 0 }).code).toBe("tower-foreign");
    expect(g.command({ type: "sell", id: built.id!, player: 1 }).ok).toBe(true);
    expect(g.state.wallets).toEqual([120, 96]);
  });
  it("leaves mission changes and restarts to the host", () => {
    const g = coop();
    expect(g.command({ type: "restart", player: 1 }).code).toBe("host-only");
    expect(g.command({ type: "mission", id: MISSIONS[1].id, player: 1 }).code).toBe("host-only");
    expect(g.command({ type: "mission", id: MISSIONS[1].id, player: 0 }).ok).toBe(true);
    expect(g.state.wallets).toHaveLength(2);
    expect(g.command({ type: "start", player: 1 }).ok).toBe(true);
  });
  it("pays refinery income to its owner", () => {
    const g = coop();
    g.state.wallets = [500, 500];
    expect(g.command({ type: "build", tower: "refinery", x: 4, y: 4, player: 1 }).ok).toBe(true);
    const [w0, w1] = g.state.wallets,
      bonus = g.waves[0].bonus;
    g.command({ type: "start" });
    finishWave(g);
    expect(g.state.wallets[0] - w0 + (g.state.wallets[1] - w1)).toBe(bonus + 25);
    expect(g.state.wallets[1] - w1 - (g.state.wallets[0] - w0)).toBe(25 - (bonus % 2));
  });
  it("earns the same total as single-player for the same defense", () => {
    const solo = new Game(),
      duo = coop();
    solo.state.wallets = [2000];
    duo.state.wallets = [1000, 1000];
    const builds = [
      { tower: "pulse", x: 4, y: 4 },
      { tower: "pulse", x: 6, y: 5 },
      { tower: "blast", x: 9, y: 7 },
      { tower: "frost", x: 9, y: 4 },
    ] as const;
    builds.forEach((b, i) => {
      expect(solo.command({ type: "build", ...b }).ok).toBe(true);
      expect(duo.command({ type: "build", ...b, player: i % 2 }).ok).toBe(true);
    });
    for (let wave = 0; wave < 4; wave++)
      for (const g of [solo, duo]) {
        g.command({ type: "start" });
        finishWave(g);
      }
    expect(duo.state.kills).toBe(solo.state.kills);
    expect(duo.state.lives).toBe(solo.state.lives);
    expect(duo.state.wallets[0] + duo.state.wallets[1]).toBe(solo.state.wallets[0]);
  });
  it("splits credits and income between three and four players", () => {
    expect(coop(3).state.wallets).toEqual([80, 80, 80]);
    expect(coop(4).state.wallets).toEqual([60, 60, 60, 60]);
    const g = coop(3);
    g.state.wallets = [0, 0, 0];
    earn(g.state, 7);
    expect(g.state.wallets).toEqual([3, 2, 2]);
    earn(g.state, 2);
    expect(g.state.wallets).toEqual([3, 3, 3]);
  });
  it("keeps towers with their owner among four players", () => {
    const g = coop(4);
    g.state.wallets = [200, 200, 200, 200];
    const built = g.command({ type: "build", tower: "pulse", x: 4, y: 4, player: 3 });
    expect(g.state.towers[0].owner).toBe(3);
    expect(g.command({ type: "sell", id: built.id!, player: 2 }).code).toBe("tower-foreign");
    expect(g.command({ type: "restart", player: 3 }).code).toBe("host-only");
    expect(g.command({ type: "sell", id: built.id!, player: 3 }).ok).toBe(true);
  });
});
