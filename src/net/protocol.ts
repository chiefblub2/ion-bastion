import type { MatchCommand } from "../core/match";
import type { ModeId } from "../core/modes";
/** Up to four players: the host (0) and guests (1–3). */
export const MAX_PLAYERS = 4;
export const DEFAULT_PORT = 4174;
/** Frames per second of the relay clock; matches the fixed simulation step. */
export const FRAME_RATE = 30;
/** Clients report a state hash every this many frames. */
export const HASH_INTERVAL = 30;
/** Owner marks on the board and in the HUD: host blue, then amber, green, magenta. */
export const PLAYER_COLORS = [0x4cc3ff, 0xffb84c, 0x7be07b, 0xe07bd8] as const;
export const SPEEDS = [1, 2] as const;
export type Speed = (typeof SPEEDS)[number];
/** A command in a frame, stamped by the relay with the sending player. */
export interface Stamped {
  player: number;
  command: MatchCommand;
}
/** One simulation step: apply `commands` in order, then tick once. */
export interface Frame {
  frame: number;
  commands: Stamped[];
}
export type ClientMessage =
  | { type: "create" }
  | { type: "join"; code: string }
  | { type: "launch"; missionId: string; mode: ModeId }
  | { type: "cmd"; command: MatchCommand }
  | { type: "speed"; value: Speed }
  | { type: "hash"; frame: number; hash: number };
export type ServerMessage =
  | { type: "room"; code: string; player: number; players: number }
  | { type: "launched"; missionId: string; mode: ModeId; players: number }
  | { type: "frames"; frames: Frame[] }
  | { type: "speed"; value: Speed }
  | { type: "peer-left" }
  | { type: "desync"; frame: number }
  | { type: "error"; reason: "room-unknown" | "room-full" | "not-host" | "not-in-room" | "players-mode" | "bad-message" };
