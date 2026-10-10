import { DEFAULT_CONTENT } from "../content";
import { missionById, missionNumber } from "../content/missions";
import { moveEnemies } from "../systems/movement";
import { attackEnemies, moveProjectiles, TARGET_PRIORITIES } from "../systems/combat";
import { isSupport } from "../systems/attacks";
import { tickStatus } from "../systems/status";
import { updateDetection } from "../systems/detection";
import { spawnEnemies, settleWave } from "../systems/waves";
import { beginWave, earlyBonus, settleCircle, wavesLeft } from "../systems/circle";
import { balance, credit, earn, startingWallets } from "./economy";
import { purchaseUpgrade } from "./upgrades";
import { validateMission } from "./validation";
import type {
  Command,
  CommandResult,
  ContentPack,
  GameState,
  GameStatus,
  MessageCode,
  MissionDefinition,
  Sim,
  Tower,
  TowerId,
} from "./types";
export const FIXED_STEP = 1 / 30;
/** Share of the total investment (build plus upgrades) returned on sale. */
export const SELL_REFUND = 0.7;
export const sellValue = (tower: Tower) => Math.floor(tower.spent * SELL_REFUND);
export function initialState(mission: MissionDefinition, players = 1): GameState {
  return {
    status: "ready",
    paused: false,
    time: 0,
    waveTime: 0,
    wave: 0,
    wallets: startingWallets(mission.startingCredits, players),
    splitCursor: 0,
    lives: mission.reactorEnergy,
    kills: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    queue: [],
    events: [],
    nextId: 1,
  };
}
/** Buildable towers of a mission, in content order. A ring has no reactor, so nothing repairs it. */
export function availableTowers(mission: MissionDefinition, content: ContentPack = DEFAULT_CONTENT): TowerId[] {
  const all = (Object.keys(content.towers) as TowerId[]).filter((id) => !(mission.circle && content.towers[id].attack.kind === "repair"));
  return mission.availableTowers ? all.filter((id) => mission.availableTowers!.includes(id)) : all;
}

const ok = (code: MessageCode, params?: CommandResult["params"], id?: number): CommandResult => ({ ok: true, code, params, id });
const fail = (code: MessageCode, params?: CommandResult["params"]): CommandResult => ({ ok: false, code, params });
interface Handler<C extends Command> {
  /** States in which the command is accepted; any state when absent. */
  allowedIn?: readonly GameStatus[];
  /** Result outside `allowedIn` while the mission is still running. */
  rejected?: MessageCode;
  run: (game: Game, command: C) => CommandResult;
}
const PLAYING: readonly GameStatus[] = ["ready", "wave"];
/** Whether the clock runs: during a wave or while the countdown to the next one runs. */
export const isRunning = (s: GameState) => s.status === "wave" || (s.status === "ready" && s.nextWave !== undefined);
/** In co-op only the host (player 0) changes or restarts the mission. */
const hostOnly = (g: Game, c: Command) => g.players > 1 && (c.player ?? 0) !== 0;
/** The tower if it exists and belongs to the issuing player. */
function ownTower(g: Game, id: number, player = 0): Tower | CommandResult {
  const t = g.state.towers.find((t) => t.id === id);
  if (!t) return fail("tower-missing");
  return t.owner === player ? t : fail("tower-foreign");
}
const HANDLERS: { [K in Command["type"]]: Handler<Extract<Command, { type: K }>> } = {
  restart: {
    run: (g, c) => {
      if (hostOnly(g, c)) return fail("host-only");
      g.state = initialState(g.mission, g.players);
      return ok("restarted");
    },
  },
  mission: {
    run: (g, c) => {
      if (hostOnly(g, c)) return fail("host-only");
      const m = missionById(c.id, g.content.missions);
      if (!m) return fail("mission-unknown");
      g.loadMission(m);
      return ok("mission-loaded", { number: missionNumber(m, g.content.missions), name: m.name });
    },
  },
  pause: {
    // Between waves only while the countdown to the next one runs.
    allowedIn: PLAYING,
    run: (g) => {
      if (!isRunning(g.state)) return fail("pause-unavailable");
      g.state.paused = !g.state.paused;
      return ok(g.state.paused ? "paused" : "resumed");
    },
  },
  start: {
    // On a ring the next wave may be called early while others still run.
    allowedIn: PLAYING,
    run: (g) => {
      const s = g.state;
      if (s.status === "wave") {
        if (!g.mission.circle) return fail("wave-running");
        if (!wavesLeft(g)) return fail("no-waves-left");
        const bonus = earlyBonus(g);
        earn(s, bonus);
        beginWave(g);
        return ok("wave-called", { wave: s.wave, bonus });
      }
      beginWave(g);
      return ok("wave-started", { wave: s.wave });
    },
  },
  build: {
    allowedIn: PLAYING,
    run: (g, c) => {
      const s = g.state,
        player = c.player ?? 0;
      if (!Object.hasOwn(g.content.towers, c.tower)) return fail("tower-unknown");
      const d = g.content.towers[c.tower];
      if (!g.availableTowers().includes(c.tower)) return fail("tower-unavailable", { tower: d.name });
      if (!g.canBuild(c.x, c.y, c.tower)) return fail(d.placement === "path" ? "trap-off-path" : "cell-blocked");
      if (balance(s, player) < d.cost) return fail("credits-missing");
      const id = s.nextId++;
      s.wallets[player] -= d.cost;
      s.towers.push({ id, type: c.tower, x: c.x, y: c.y, upgrades: [], cooldown: 0, spent: d.cost, angle: -Math.PI / 2, kills: 0, owner: player });
      s.events.push({ type: "build", at: { x: c.x, y: c.y }, tower: c.tower, color: d.color });
      return ok("tower-built", { tower: d.name }, id);
    },
  },
  sell: {
    allowedIn: PLAYING,
    run: (g, c) => {
      const s = g.state,
        t = ownTower(g, c.id, c.player);
      if (!("owner" in t)) return t;
      const refund = sellValue(t);
      credit(s, t.owner, refund);
      s.towers = s.towers.filter((v) => v.id !== t.id);
      s.events.push({ type: "sell", at: { x: t.x, y: t.y }, tower: t.type, color: g.content.towers[t.type].color });
      return ok("tower-sold", { refund });
    },
  },
  upgrade: {
    allowedIn: PLAYING,
    run: (g, c) => {
      const t = ownTower(g, c.id, c.player);
      if (!("owner" in t)) return t;
      return purchaseUpgrade(g.state, t, c.upgrade, g.content);
    },
  },
  target: {
    allowedIn: PLAYING,
    run: (g, c) => {
      const t = ownTower(g, c.id, c.player);
      if (!("owner" in t)) return t;
      if (!TARGET_PRIORITIES.includes(c.priority) || isSupport(g.content.towers[t.type].attack)) return fail("priority-unknown");
      // The default stays absent so solo states and replays are unchanged.
      if (c.priority === "first") delete t.priority;
      else t.priority = c.priority;
      return ok("target-set", { priority: c.priority });
    },
  },
};

export class Game implements Sim {
  state!: GameState;
  mission!: MissionDefinition;
  readonly content: ContentPack;
  /** 1 in single-player, 2 in co-op. */
  players = 1;
  private path = new Set<string>();
  private blocked = new Set<string>();
  constructor(mission?: MissionDefinition, content: ContentPack = DEFAULT_CONTENT) {
    this.content = content;
    this.loadMission(mission ?? content.missions[0]);
  }
  get map() {
    return this.mission.map;
  }
  get waves() {
    return this.mission.waves;
  }
  /** Validates and switches to a mission with a fresh state. */
  loadMission(mission: MissionDefinition) {
    validateMission(mission, this.content);
    this.mission = mission;
    this.state = initialState(mission, this.players);
    this.path = new Set(mission.map.path.map((p) => `${p.x},${p.y}`));
    this.blocked = new Set(mission.map.blocked.map((p) => `${p.x},${p.y}`));
  }
  /** Switches between single-player and co-op; takes effect with the next mission load or restart. */
  setPlayers(players: number) {
    this.players = players;
  }
  availableTowers() {
    return availableTowers(this.mission, this.content);
  }
  isPath(x: number, y: number) {
    return this.path.has(`${x},${y}`);
  }
  isBlocked(x: number, y: number) {
    return this.blocked.has(`${x},${y}`);
  }
  /** Whether `tower` (any regular tower if absent) fits on the cell; traps need a free path cell. */
  canBuild(x: number, y: number, tower?: TowerId) {
    const trap = tower !== undefined && this.content.towers[tower]?.placement === "path";
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x < this.map.columns &&
      y < this.map.rows &&
      (trap ? this.isTrapCell(x, y) : !this.isPath(x, y)) &&
      !this.isBlocked(x, y) &&
      !this.state.towers.some((t) => t.x === x && t.y === y)
    );
  }
  /** Path cells that take a trap: not the entry and, on a reactor map, not the reactor. */
  isTrapCell(x: number, y: number) {
    const path = this.map.path,
      end = path[path.length - 1];
    if (!this.isPath(x, y) || (x === path[0].x && y === path[0].y)) return false;
    return !!this.map.loop || x !== end.x || y !== end.y;
  }
  command(c: Command): CommandResult {
    const handler = HANDLERS[c.type] as Handler<Command>,
      status = this.state.status;
    if (handler.allowedIn && !handler.allowedIn.includes(status))
      return fail(status === "won" || status === "lost" ? "mission-over" : handler.rejected ?? "mission-over");
    return handler.run(this, c);
  }
  tick(dt = FIXED_STEP) {
    const s = this.state;
    if (s.paused) return;
    if (s.status === "ready" && s.nextWave !== undefined) {
      s.nextWave -= dt;
      // Tolerates float drift, so the wave starts exactly after WAVE_BREAK / dt ticks.
      if (s.nextWave <= 1e-9) beginWave(this);
      return;
    }
    if (s.status !== "wave") return;
    s.time += dt;
    s.waveTime += dt;
    spawnEnemies(this);
    tickStatus(this, dt);
    moveEnemies(this, dt);
    updateDetection(this);
    moveProjectiles(this, dt);
    attackEnemies(this, dt);
    s.enemies = s.enemies.filter((e) => e.hp > 0);
    if (this.mission.circle) settleCircle(this, dt);
    else settleWave(this);
  }
  drainEvents() {
    return this.state.events.splice(0);
  }
}
