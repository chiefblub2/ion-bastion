import { describe, expect, it } from "vitest";
import { HASH_WINDOW, isCommandShape, rateLimiter, Room, roomCode } from "./room";
describe("relay room", () => {
  it("seats four players and refuses a fifth", () => {
    const room = new Room("ABCD");
    expect([room.join(), room.join(), room.join(), room.join()]).toEqual([0, 1, 2, 3]);
    expect(room.join()).toBeNull();
    room.leave(1);
    expect(room.players).toBe(3);
    // Seats stay contiguous: the newcomer takes the last one.
    expect(room.join()).toBe(3);
  });
  it("checks the player count of a mode", () => {
    const room = new Room("ABCD");
    room.join();
    expect(room.canLaunch("coop")).toBe(false);
    room.join();
    expect(room.canLaunch("race")).toBe(true);
    room.launch("outpost-07", "siege");
    expect(room.mode).toBe("siege");
  });
  it("stops the clock when a player leaves a running mission", () => {
    const room = new Room("ABCD");
    room.join();
    room.join();
    room.join();
    room.launch("outpost-07", "race");
    room.leave(0);
    expect(room.running).toBe(false);
    expect(room.players).toBe(2);
    expect(room.canLaunch("race")).toBe(true);
  });
  it("refuses joins while a mission runs", () => {
    const room = new Room("ABCD");
    room.join();
    room.launch("outpost-07");
    expect(room.join()).toBeNull();
  });
  it("loads the mission in frame 1 and stamps commands in arrival order", () => {
    const room = new Room("ABCD");
    room.join();
    room.join();
    room.queue(0, { type: "start" });
    room.launch("outpost-07");
    expect(room.step()).toEqual({ frame: 1, commands: [{ player: 0, command: { type: "mission", id: "outpost-07" } }] });
    room.queue(1, { type: "start", player: 0 });
    room.queue(0, { type: "pause" });
    expect(room.step()).toEqual({
      frame: 2,
      commands: [
        { player: 1, command: { type: "start", player: 1 } },
        { player: 0, command: { type: "pause", player: 0 } },
      ],
    });
    expect(room.step()).toEqual({ frame: 3, commands: [] });
  });
  it("detects different state hashes", () => {
    const room = new Room("ABCD");
    room.join();
    room.join();
    room.launch("outpost-07");
    for (let i = 0; i < 30; i++) room.step();
    expect(room.reportHash(0, 30, 1)).toBe("pending");
    expect(room.reportHash(1, 30, 2)).toBe("desync");
  });
  it("generates four-letter codes that avoid open rooms", () => {
    const values = [0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    const code = roomCode((c) => c === "AAAA", () => values.shift()!);
    expect(code).toBe("ZZZZ");
  });
});
describe("relay limits", () => {
  it("ignores hash reports outside the window and prunes old ones", () => {
    const room = new Room("ABCD");
    room.join();
    room.join();
    room.launch("outpost-07");
    for (let i = 0; i < 60; i++) room.step();
    expect(room.reportHash(0, 30, 1)).toBe("pending");
    expect(room.reportHash(0, 9000, 1)).toBe("pending");
    expect(room.reportHash(0, 31, 1)).toBe("pending");
    expect(room.reportHash(1, 9000, 2)).toBe("pending");
    for (let i = 0; i < HASH_WINDOW + 30; i++) room.step();
    // The stale frame-30 report is gone: a late second report cannot complete it.
    expect(room.reportHash(1, 30, 2)).toBe("pending");
    expect(room.reportHash(0, room.frame - (room.frame % 30), 5)).toBe("pending");
    expect(room.reportHash(1, room.frame - (room.frame % 30), 5)).toBe("ok");
  });
  it("checks only the shape of a command", () => {
    expect(isCommandShape({ type: "build" })).toBe(true);
    expect([null, "build", [], { type: 3 }, { type: "x".repeat(40) }].some(isCommandShape)).toBe(false);
  });
  it("limits the message rate per socket", () => {
    let t = 0;
    const allow = rateLimiter(10, 3, () => t);
    expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]);
    t += 100;
    expect(allow()).toBe(true);
  });
});
