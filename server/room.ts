import type { MatchCommand } from "../src/core/match";
import { fitsMode, type ModeId } from "../src/core/modes";
import { HASH_INTERVAL, MAX_PLAYERS, type Frame, type Speed, type Stamped } from "../src/net/protocol";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Four letters without I and O; `taken` avoids collisions with open rooms. */
export function roomCode(taken: (code: string) => boolean, random = Math.random) {
  for (;;) {
    const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(random() * LETTERS.length)]).join("");
    if (!taken(code)) return code;
  }
}
/**
 * Hash reports older than this many frames (a minute) are dropped: the window bounds the relay's memory per room
 * and still gives a lagging tab time to catch up.
 */
export const HASH_WINDOW = 60 * HASH_INTERVAL;
/**
 * The relay's only check on a command: a plain object with a short string `type`. Whether the type exists is the
 * simulation's call (`isCommand`), so the relay stays free of game logic.
 */
export const isCommandShape = (c: unknown): c is MatchCommand =>
  typeof c === "object" && c !== null && !Array.isArray(c) && typeof (c as { type?: unknown }).type === "string" && (c as { type: string }).type.length <= 32;
/** Token bucket per socket: `rate` messages a second, bursts up to `burst`; `now` in milliseconds. */
export function rateLimiter(rate: number, burst: number, now: () => number = Date.now) {
  let tokens = burst,
    last = now();
  return () => {
    const t = now();
    tokens = Math.min(burst, tokens + ((t - last) / 1000) * rate);
    last = t;
    if (tokens < 1) return false;
    tokens--;
    return true;
  };
}
/**
 * Lockstep room without sockets: collects commands and hands them out as numbered frames.
 * The relay holds no game logic; every client runs the full simulation on the same frames.
 */
export class Room {
  /** Seats are always 0..players-1, so they double as wallet and field indices. */
  players = 0;
  mode: ModeId = "coop";
  frame = 0;
  speed: Speed = 1;
  running = false;
  private inbox: Stamped[] = [];
  private hashes = new Map<number, Map<number, number>>();
  constructor(readonly code: string) {}
  /** Seat of the new player, or null when the room is full or already running. */
  join(): number | null {
    if (this.players >= MAX_PLAYERS || this.running) return null;
    return this.players++;
  }
  /**
   * Stops the clock; no late join in this version. Later seats move down by one,
   * so a leaving host hands the room to the next player.
   */
  leave(player: number) {
    if (player >= this.players) return;
    this.players--;
    this.running = false;
    this.inbox = [];
  }
  canLaunch(mode: ModeId) {
    return fitsMode(mode, this.players);
  }
  /** Starts the clock; frame 1 loads the mission for everyone. */
  launch(missionId: string, mode: ModeId = "coop") {
    this.mode = mode;
    this.running = true;
    this.frame = 0;
    this.hashes.clear();
    this.inbox = [{ player: 0, command: { type: "mission", id: missionId } }];
  }
  queue(player: number, command: MatchCommand) {
    if (this.running) this.inbox.push({ player, command: { ...command, player } });
  }
  /** The next frame with every command received since the last one. */
  step(): Frame {
    const commands = this.inbox;
    this.inbox = [];
    return { frame: ++this.frame, commands };
  }
  /** "desync" once every player reported and the hashes of a frame differ. */
  reportHash(player: number, frame: number, hash: number): "ok" | "pending" | "desync" {
    // Only real hash frames inside the window count, so a client cannot grow the map with made-up frame numbers.
    if (!Number.isInteger(frame) || frame % HASH_INTERVAL !== 0 || frame > this.frame || frame < this.frame - HASH_WINDOW) return "pending";
    for (const old of this.hashes.keys()) if (old < this.frame - HASH_WINDOW) this.hashes.delete(old);
    const reports = this.hashes.get(frame) ?? new Map<number, number>();
    reports.set(player, hash);
    this.hashes.set(frame, reports);
    if (reports.size < this.players) return "pending";
    this.hashes.delete(frame);
    return new Set(reports.values()).size === 1 ? "ok" : "desync";
  }
}
