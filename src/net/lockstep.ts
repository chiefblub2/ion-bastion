import { stateHash } from "../core/hash";
import type { Game } from "../core/game";
import type { MatchCommand } from "../core/match";
import type { CommandResult } from "../core/types";
import { HASH_INTERVAL, type Frame } from "./protocol";
export interface Applied {
  command: MatchCommand;
  result: CommandResult;
  player: number;
}
/** What lockstep frames drive: a shared co-op game or a versus `Match`. */
export interface Lockstepped {
  command(c: MatchCommand): CommandResult;
  tick(): void;
  hash(): number;
}
/** Co-op on one shared map; the versus-only commands do not apply. */
export function coopSim(game: Game): Lockstepped {
  return {
    command: (c) => (c.type === "ready" || c.type === "send" ? { ok: false, code: "send-unavailable" } : game.command(c)),
    tick: () => game.tick(),
    hash: () => stateHash(game.state),
  };
}
/**
 * Runs the simulation on relay frames only: each frame applies its commands in order, then ticks once.
 * `Game.tick` is a no-op outside a wave, so idle frames keep every client in step.
 */
export class LockstepDriver {
  private pending: Frame[] = [];
  /** Last applied frame. */
  frame = 0;
  constructor(
    private sim: Lockstepped,
    private hooks: {
      applied: (applied: Applied) => void;
      hash: (frame: number, hash: number) => void;
    },
  ) {}
  receive(frames: Frame[]) {
    this.pending.push(...frames);
  }
  /** Applies every received frame; the relay clock sets the pace. */
  advance() {
    for (const f of this.pending.splice(0)) {
      for (const { player, command } of f.commands) {
        const c = { ...command, player };
        this.hooks.applied({ command: c, result: this.sim.command(c), player });
      }
      this.sim.tick();
      this.frame = f.frame;
      if (f.frame % HASH_INTERVAL === 0) this.hooks.hash(f.frame, this.sim.hash());
    }
  }
}
