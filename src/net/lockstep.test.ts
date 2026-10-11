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
    for (let wave = 0; wave < 3; wave++) {
      room.queue(wave % 2, { type: "start" });
      let guard = 0;
      do {
        step();
        expect(clients[0].sim.hash()).toBe(clients[1].sim.hash());
        expect(guard++).toBeLessThan(20000);
      } while (clients[0].game.state.status === "wave");
    }
    expect(clients[0].game.state.wave).toBe(3);
    expect(clients[0].hashes).toEqual(clients[1].hashes);
    expect(clients[0].hashes.every(([f]) => f % HASH_INTERVAL === 0)).toBe(true);
    expect(room.reportHash(0, 30, clients[0].hashes[0][1])).toBe("pending");
    expect(room.reportHash(1, 30, clients[1].hashes[0][1])).toBe("ok");
  });
  it("keeps co-op clients identical on a ring mission with timed waves", () => {
    const { room, clients, step } = session(3);
    room.launch("umlaufbahn");
    step();
    expect(clients[0].game.mission.circle).toBeDefined();
    room.queue(0, { type: "build", tower: "pulse", x: 3, y: 2 });
    room.queue(1, { type: "build", tower: "blast", x: 12, y: 5 });
    room.queue(2, { type: "start" });
    let guard = 0;
    do {
      step();
      // Calling waves early is shared too.
      if (guard === 300) room.queue(1, { type: "start" });
      expect(new Set(clients.map((c) => c.sim.hash())).size).toBe(1);
      expect(guard++).toBeLessThan(40000);
    } while (clients[0].game.state.status === "wave");
    expect(clients[0].game.state.wave).toBeGreaterThan(2);
    expect(clients[0].hashes).toEqual(clients[2].hashes);
  });
  it("keeps co-op clients identical with specialized towers", () => {
    const { room, clients, step } = session();
    room.launch("outpost-07");
    step();
    // The same grant on every client keeps them identical, like a starting bonus.
    for (const c of clients) c.game.state.wallets = [20000, 20000];
    const levels = ["level-2", "level-3", "level-4", "level-5"];
    room.queue(0, { type: "build", tower: "pulse", x: 4, y: 4 });
    room.queue(1, { type: "build", tower: "quake", x: 6, y: 5 });
    step();
    const [pulse, quake] = clients[0].game.state.towers.map((t) => t.id);
    for (const upgrade of [...levels, "ricochet-1", "ricochet-2", "ricochet-3"]) room.queue(0, { type: "upgrade", id: pulse, upgrade });
    for (const upgrade of [...levels, "aftershock-1"]) room.queue(1, { type: "upgrade", id: quake, upgrade });
    // A foreign purchase is rejected on every client alike.
    room.queue(0, { type: "upgrade", id: quake, upgrade: "fracture-1" });
    room.queue(0, { type: "start" });
    let guard = 0;
    do {
      step();
      expect(clients[0].sim.hash()).toBe(clients[1].sim.hash());
      expect(guard++).toBeLessThan(20000);
    } while (clients[0].game.state.status === "wave");
    expect(clients[1].game.state.towers.map((t) => t.upgrades.at(-1))).toEqual(["ricochet-3", "aftershock-1"]);
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
    const wallets = clients[0].game.state.wallets;
    expect(Math.max(...wallets) - Math.min(...wallets)).toBeLessThanOrEqual(1);
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
      while (!clients[0].match!.result && frames++ < 6000) {
        if (mode === "siege" && frames % 200 === 50) room.queue(frames % 3, { type: "send", enemy: clients[0].game.waves[0].groups[0].type });
        if (frames % 400 === 0) for (const p of [0, 1, 2]) room.queue(p, { type: "ready" });
        step();
        expect(new Set(clients.map((c) => c.sim.hash())).size).toBe(1);
      }
      expect(clients[1].match!.fields[0].state.towers).toHaveLength(1);
      expect(clients[2].match!.fields[1].state.towers[0]).toMatchObject({ type: "blast", priority: "strong" });
      if (mode === "siege") expect(clients[0].applied.some((a) => a.command.type === "send" && a.result.ok)).toBe(true);
      expect(clients[0].hashes).toEqual(clients[2].hashes);
    });
});
