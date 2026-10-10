import { missionById } from "../content/missions";
import { Game } from "./game";
import { stateHash, fnv } from "./hash";
import { balance } from "./economy";
import { MODES, READY_COUNTDOWN, SEND_DELAY, SEND_SPACING, sendCost, type ModeId } from "./modes";
import type { Command, CommandResult, EnemyId, MessageCode, Spawn } from "./types";
/** Commands of a multiplayer session: game commands plus the versus-only ones. */
export type MatchCommand =
  | Command
  | (({ type: "ready" } | { type: "send"; enemy: EnemyId }) & { player?: number });
export interface MatchResult {
  /** Players from first to last place. */
  ranking: number[];
  /** Null on a draw at the top. */
  winner: number | null;
  /** Everyone tied for first place. */
  top: number[];
}
export interface SendOption {
  enemy: EnemyId;
  cost: number;
  unlocked: boolean;
}
const ok = (code: MessageCode, params?: CommandResult["params"]): CommandResult => ({ ok: true, code, params });
const fail = (code: MessageCode, params?: CommandResult["params"]): CommandResult => ({ ok: false, code, params });
/**
 * Versus session: one solo `Game` per player, all simulated on every client.
 * Waves start for every field at once; `fields[local]` is the game the app renders.
 */
export class Match {
  readonly fields: Game[];
  /** Players who want the next wave now. */
  ready: boolean[];
  /** Ticks until the next wave starts on its own. */
  countdown = READY_COUNTDOWN;
  /** Enemies sent between waves, per target; they join the target's next wave. */
  pending: Spawn[][];
  /** Wave time of the last sent enemy per target, to space them out. */
  private lastSend: number[];
  /** Tick in which a player's reactor fell; null while alive. */
  eliminatedAt: (number | null)[];
  frame = 0;
  result: MatchResult | null = null;
  constructor(
    readonly mode: ModeId,
    players: number,
    private readonly local: number,
    game: Game,
  ) {
    game.setPlayers(1);
    this.fields = Array.from({ length: players }, (_, i) => (i === local ? game : new Game(game.mission, game.content)));
    this.ready = this.fields.map(() => false);
    this.pending = this.fields.map(() => []);
    this.lastSend = this.fields.map(() => 0);
    this.eliminatedAt = this.fields.map(() => null);
  }
  get players() {
    return this.fields.length;
  }
  isAlive(player: number) {
    return this.eliminatedAt[player] === null;
  }
  alive() {
    return this.fields.map((_, i) => i).filter((i) => this.isAlive(i));
  }
  /** True between waves, while the countdown runs. */
  waiting() {
    return !this.result && this.alive().some((i) => this.fields[i].state.status === "ready");
  }
  /** Next alive opponent in seat order that still fights waves; null if none. */
  target(player: number): number | null {
    for (let k = 1; k < this.players; k++) {
      const i = (player + k) % this.players;
      if (this.isAlive(i) && this.fields[i].state.status !== "won") return i;
    }
    return null;
  }
  /** Enemies a player can send: every type of the waves started so far, at least of the first wave. */
  sendOptions(player: number): SendOption[] {
    const field = this.fields[player],
      seen = new Set(field.waves.slice(0, Math.max(1, field.state.wave)).flatMap((w) => w.groups.map((g) => g.type))),
      all = new Set(field.waves.flatMap((w) => w.groups.map((g) => g.type)));
    return [...all].map((enemy) => ({ enemy, cost: sendCost(field.content.enemies[enemy]), unlocked: seen.has(enemy) }));
  }
  command(c: MatchCommand): CommandResult {
    const player = c.player ?? 0;
    switch (c.type) {
      case "mission":
      case "restart": {
        if (player !== 0) return fail("host-only");
        // Ring missions have their own wave timer and are played solo or in co-op only.
        if (c.type === "mission" && missionById(c.id, this.fields[0].content.missions)?.circle) return fail("circle-versus");
        const results = this.fields.map((f) => f.command({ ...c, player: 0 }));
        if (results[0].ok) this.reset();
        return results[0];
      }
      case "pause":
        return fail("pause-versus");
      case "start":
      case "ready":
        return this.markReady(player);
      case "send":
        return this.send(player, c.enemy);
      default:
        if (!this.isAlive(player)) return fail("mission-over");
        return this.fields[player].command({ ...c, player: 0 });
    }
  }
  tick() {
    if (this.result) return;
    this.frame++;
    for (const i of this.alive()) {
      const field = this.fields[i];
      field.tick();
      // The shared ready countdown starts versus waves, not the solo break timer.
      delete field.state.nextWave;
      if (field.state.status === "lost") {
        this.eliminatedAt[i] = this.frame;
        this.pending[i] = [];
      }
    }
    // Only the local field's events reach the screen; the others would pile up.
    this.fields.forEach((f, i) => i !== this.local && f.drainEvents());
    this.settle();
    if (!this.waiting()) return;
    const waiting = this.alive().filter((i) => this.fields[i].state.status === "ready");
    if (waiting.every((i) => this.ready[i]) || --this.countdown <= 0) this.startWave();
  }
  hash() {
    return fnv(
      [
        this.fields.map((f) => stateHash(f.state)).join(","),
        this.fields.map((f) => f.state.queue.length).join(","),
        this.ready.join(","),
        this.countdown,
        this.eliminatedAt.join(","),
        this.pending.map((p) => p.length).join(","),
        this.frame,
      ].join("|"),
    );
  }
  private reset() {
    this.ready = this.fields.map(() => false);
    this.pending = this.fields.map(() => []);
    this.lastSend = this.fields.map(() => 0);
    this.eliminatedAt = this.fields.map(() => null);
    this.countdown = READY_COUNTDOWN;
    this.result = null;
  }
  private markReady(player: number): CommandResult {
    if (this.result || !this.isAlive(player)) return fail("mission-over");
    if (this.fields[player].state.status !== "ready") return fail("wave-running");
    this.ready[player] = true;
    return ok("ready-set");
  }
  private send(player: number, enemy: EnemyId): CommandResult {
    if (!MODES[this.mode].sends) return fail("send-unavailable");
    if (this.result || !this.isAlive(player)) return fail("mission-over");
    const option = this.sendOptions(player).find((o) => o.enemy === enemy),
      target = this.target(player);
    if (!option || target === null) return fail("send-unavailable");
    if (!option.unlocked) return fail("send-locked");
    const sender = this.fields[player].state;
    if (balance(sender, 0) < option.cost) return fail("credits-missing");
    sender.wallets[0] -= option.cost;
    const t = this.fields[target].state;
    if (t.status === "wave") {
      const at = Math.max(t.waveTime + SEND_DELAY, this.lastSend[target] + SEND_SPACING);
      this.lastSend[target] = at;
      t.queue.push({ at, type: enemy, sentBy: player });
      t.queue.sort((a, b) => a.at - b.at);
    } else this.pending[target].push({ at: 0, type: enemy, sentBy: player });
    return ok("enemy-sent", { enemy: this.fields[player].content.enemies[enemy].name, target: target + 1 });
  }
  /** Starts the next wave on every waiting field and adds the enemies sent in the meantime. */
  private startWave() {
    for (const i of this.alive()) {
      const field = this.fields[i];
      if (field.state.status !== "ready") continue;
      field.command({ type: "start" });
      const s = field.state;
      this.pending[i].forEach((spawn, k) => s.queue.push({ ...spawn, at: SEND_DELAY + k * SEND_SPACING }));
      s.queue.sort((a, b) => a.at - b.at);
      this.lastSend[i] = this.pending[i].length ? SEND_DELAY + (this.pending[i].length - 1) * SEND_SPACING : 0;
      this.pending[i] = [];
    }
    this.ready = this.fields.map(() => false);
    this.countdown = READY_COUNTDOWN;
  }
  /** Ends the match when at most one reactor stands or every survivor cleared all waves. Ranking: alive, lives, elimination tick, kills. */
  private settle() {
    const alive = this.alive();
    if (alive.length > 1 && !alive.every((i) => this.fields[i].state.status === "won")) return;
    const key = (i: number) => {
      const s = this.fields[i].state;
      // Survivors first; of the fallen, whoever held out longest.
      return [this.isAlive(i) ? 1 : 0, s.lives, this.eliminatedAt[i] ?? Infinity, s.kills];
    };
    const compare = (a: number, b: number) => {
      const ka = key(a),
        kb = key(b);
      for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return kb[k] - ka[k];
      return 0;
    };
    const ranking = this.fields.map((_, i) => i).sort((a, b) => compare(a, b) || a - b),
      top = ranking.filter((i) => compare(i, ranking[0]) === 0);
    this.result = { ranking, top, winner: top.length > 1 ? null : ranking[0] };
  }
}
