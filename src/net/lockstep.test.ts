import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { Match } from "../core/match";
import { MODES, type ModeId } from "../core/modes";
import { Room } from "../../server/room";
import { coopSim, LockstepDriver, type Applied } from "./lockstep";
import { HASH_INTERVAL } from "./protocol";
/** `players` clients on one in-memory room; the driver of each sees exactly the relay's frames. */
function session(players = 2, mode: ModeId = "coop") {
  const room = new Room("TEST");
  for (let i = 0; i < players; i++) room.join();
  const clients = Array.from({ length: players }, (_, seat) => {
    const game = new Game(),
      applied: Applied[] = [],
      hashes: [number, number][] = [];
    const match = MODES[mode].versus ? new Match(mode, players, seat, game) : null;
    if (!match) game.setPlayers(players);
    const sim = match ?? coopSim(game);
    const driver = new LockstepDriver(sim, { applied: (a) => applied.push(a), hash: (f, h) => hashes.push([f, h]) });
    return { game, match, sim, driver, applied, hashes };
  });
  const step = () => {
    const frame = room.step();
    for (const c of clients) {
      c.driver.receive([frame]);
      c.driver.advance();
    }
  };
  return { room, clients, step };
}
describe("lockstep", () => {
  it("keeps both clients identical frame by frame", () => {
    const { room, clients, step } = session();
    room.launch("outpost-07");
    step();
    expect(clients[0].game.state.wallets).toEqual([120, 120]);
    room.queue(0, { type: "build", tower: "pulse", x: 4, y: 4 });
    room.queue(1, { type: "build", tower: "pulse", x: 6, y: 5 });
    step();
    expect(clients[1].game.state.towers.map((t) => t.owner)).toEqual([0, 1]);
    room.queue(1, { type: "start" });
    let guard = 0;
    do {
      step();
      expect(clients[0].sim.hash()).toBe(clients[1].sim.hash());
      expect(guard++).toBeLessThan(20000);
    } while (clients[0].game.state.status === "wave");
    expect(clients[0].game.state.wave).toBe(1);
    expect(clients[0].hashes).toEqual(clients[1].hashes);
    expect(clients[0].hashes.every(([f]) => f % HASH_INTERVAL === 0)).toBe(true);
    const [frame, hash] = clients[0].hashes.at(-1)!;
    expect(room.reportHash(0, frame, hash)).toBe("pending");
    expect(room.reportHash(1, frame, clients[1].hashes.at(-1)![1])).toBe("ok");
  });
  it("keeps co-op clients identical on a ring mission with timed waves", () => {
    const { room, clients, step } = session(3);
    room.launch("umlaufbahn");
    step();
    expect(clients[0].game.mission.circle).toBeDefined();
    room.queue(0, { type: "build", tower: "pulse", x: 3, y: 2 });
    room.queue(1, { type: "build", tower: "blast", x: 12, y: 5 });
    room.queue(2, { type: "start" });
    for (let frame = 0; frame < 400; frame++) {
      step();
      // Calling waves early is shared too (the timer alone would start wave 2 only after 660 frames).
      if (frame === 300) room.queue(1, { type: "start" });
      expect(new Set(clients.map((c) => c.sim.hash())).size).toBe(1);
    }
    expect(clients[0].game.state.wave).toBe(2);
    expect(clients[0].hashes).toEqual(clients[2].hashes);
  });
  it("keeps co-op clients identical with specialized towers, traps and support towers", () => {
    const { room, clients, step } = session();
    room.launch("outpost-07");
    step();
    // The same grant on every client keeps them identical, like a starting bonus.
    for (const c of clients) c.game.state.wallets = [20000, 20000];
    const levels = ["level-2", "level-3", "level-4", "level-5"];
    const g = clients[0].game,
      free = [...Array(g.mission.map.columns * g.mission.map.rows).keys()]
        .map((i) => ({ x: i % g.mission.map.columns, y: Math.floor(i / g.mission.map.columns) }))
        .filter((p) => g.canBuild(p.x, p.y, "pulse")),
      trap = g.mission.map.path.slice(3).find((p) => g.canBuild(p.x, p.y, "mine"))!;
    const plan: [number, "pulse" | "quake" | "beacon" | "vault" | "tracker" | "mine", { x: number; y: number }, string[]][] = [
      [0, "pulse", { x: 4, y: 4 }, [...levels, "ricochet-1", "ricochet-2", "ricochet-3"]],
      [1, "quake", { x: 6, y: 5 }, [...levels, "aftershock-1"]],
      [0, "beacon", free[0], ["level-2", "level-3", "big-game-1", "big-game-2"]],
      [1, "vault", free[1], ["level-2", "level-3", "investment-1"]],
      [1, "tracker", free[2], ["level-2", "level-3", "hunters-mark-1"]],
      [1, "mine", trap, [...levels, "chain-reaction-1"]],
    ];
    for (const [seat, tower, at] of plan) room.queue(seat, { type: "build", tower, ...at });
    step();
    const ids = clients[0].game.state.towers.map((t) => t.id);
    expect(ids).toHaveLength(plan.length);
    plan.forEach(([seat, , , upgrades], i) => upgrades.forEach((upgrade) => room.queue(seat, { type: "upgrade", id: ids[i], upgrade })));
    // A foreign purchase is rejected on every client alike.
    room.queue(0, { type: "upgrade", id: ids[1], upgrade: "fracture-1" });
    room.queue(0, { type: "start" });
    let guard = 0;
    do {
      step();
      expect(clients[0].sim.hash()).toBe(clients[1].sim.hash());
      expect(guard++).toBeLessThan(20000);
    } while (clients[0].game.state.status === "wave");
    expect(clients[1].game.state.towers.map((t) => t.upgrades.at(-1))).toEqual(plan.map(([, , , u]) => u.at(-1)));
    expect(clients[0].hashes).toEqual(clients[1].hashes);
  });
  it("reports every applied command with its player", () => {
    const { room, clients, step } = session();
    room.launch("outpost-07");
    room.queue(1, { type: "restart" });
    step();
    expect(clients[0].applied.map((a) => [a.command.type, a.player, a.result.code])).toEqual([
      ["mission", 0, "mission-loaded"],
      ["restart", 1, "host-only"],
    ]);
  });
  it("keeps four co-op clients in step", () => {
    const { room, clients, step } = session(4);
    room.launch("outpost-07");
    step();
    expect(clients[3].game.state.wallets).toEqual([60, 60, 60, 60]);
    room.queue(3, { type: "build", tower: "pulse", x: 4, y: 4 });
    room.queue(2, { type: "start" });
    let guard = 0;
    do {
      step();
      const hashes = new Set(clients.map((c) => c.sim.hash()));
      expect(hashes.size).toBe(1);
      expect(guard++).toBeLessThan(20000);
    } while (clients[0].game.state.status === "wave");
    expect(clients[1].applied.find((a) => a.command.type === "build")).toMatchObject({ player: 3, result: { code: "credits-missing" } });
  });
  for (const mode of ["race", "siege"] as const)
    it(`keeps every field identical on all clients in ${mode}`, () => {
      const { room, clients, step } = session(3, mode);
      room.launch("outpost-07", mode);
      step();
      // Each client renders its own seat's field.
      expect(clients.map((c) => c.match!.fields.indexOf(c.game))).toEqual([0, 1, 2]);
      room.queue(0, { type: "build", tower: "pulse", x: 4, y: 4 });
      room.queue(1, { type: "build", tower: "blast", x: 6, y: 5 });
      // Priorities live in the state hash; a missing entry would let clients drift unnoticed.
      room.queue(1, { type: "target", id: 1, priority: "strong" });
      for (const p of [0, 1, 2]) room.queue(p, { type: "ready" });
      let frames = 0;
      // 500 frames cover the first wave, a send and a ready round; the match result needs no lockstep of its own.
      while (frames++ < 500) {
        if (mode === "siege" && frames === 50) room.queue(2, { type: "send", enemy: clients[0].game.waves[0].groups[0].type });
        if (frames === 300) for (const p of [0, 1, 2]) room.queue(p, { type: "ready" });
        step();
        expect(new Set(clients.map((c) => c.sim.hash())).size).toBe(1);
      }
      expect(clients[1].match!.fields[0].state.towers).toHaveLength(1);
      expect(clients[2].match!.fields[1].state.towers[0]).toMatchObject({ type: "blast", priority: "strong" });
      if (mode === "siege") expect(clients[0].applied.some((a) => a.command.type === "send" && a.result.ok)).toBe(true);
      expect(clients[0].hashes).toEqual(clients[2].hashes);
    });
});
describe("untrusted commands", () => {
  const junk = [{ type: "nope" }, { type: "toString" }, {}, { type: "build", tower: "toString", x: 1, y: 1 }, { type: "upgrade", id: 999, upgrade: null }] as never[];
  // Versus routes field commands through Match into each Game's handlers, so it covers both layers.
  it("rejects malformed commands on every client alike", () => {
    const { room, clients, step } = session(2, "race");
    room.launch("outpost-07", "race");
    step();
    for (const c of junk) room.queue(1, c);
    expect(step).not.toThrow();
    const results = clients.map((c) => c.applied.slice(-junk.length).map((a) => a.result.ok));
    expect(results[0]).toEqual(results[1]);
    expect(results[0].every((ok) => !ok)).toBe(true);
    expect(clients[0].sim.hash()).toBe(clients[1].sim.hash());
  });
});
