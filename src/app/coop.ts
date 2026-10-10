import type { Game } from "../core/game";
import { Match, type MatchCommand } from "../core/match";
import { fitsMode, isModeId, MODES, type ModeId } from "../core/modes";
import { coopSim, LockstepDriver, type Applied } from "../net/lockstep";
import { RelayClient, relayUrl } from "../net/client";
import { MAX_PLAYERS, type ServerMessage, type Speed } from "../net/protocol";
import type { Driver, ViewState } from "../render/scene";
import type { Interface, MultiplayerSession } from "../ui/interface";
interface CoopDeps {
  game: Game;
  view: ViewState;
  ui: Interface;
  /** "Choose mission" in the lobby: the host picks the room's mission on the mission page. */
  pickMission: () => void;
  /** Every command a frame applied, local or from the partner. */
  applied: (applied: Applied) => void;
  setDriver: (driver: Driver | null) => void;
}
const ERRORS: Record<Extract<ServerMessage, { type: "error" }>["reason"], string> = {
  "room-unknown": "That room does not exist.",
  "room-full": "The room is full or the mission is already running.",
  "not-host": "Only the host can do that.",
  "not-in-room": "You are not in a room.",
  "players-mode": "The player count does not fit this mode.",
  "bad-message": "Invalid message to the relay server.",
};
/** Multiplayer: lobby page, mode choice, relay connection and the switch to lockstep frames. */
export function createCoop({ game, view, ui, pickMission, applied, setDriver }: CoopDeps) {
  let client: RelayClient | null = null,
    driver: LockstepDriver | null = null,
    session: MultiplayerSession | null = null,
    /** Frames stopped after a player left; the host may relaunch. */
    stopped = false,
    room: { code: string; players: number } | null = null,
    /** Own seat in the room; moves down when an earlier player leaves. */
    seat = 0,
    mode: ModeId = "coop",
    status = "";
  const CIRCLE_RULES =
    "Circuit: enemies circle until they fall. Waves come on a timer; calling one early earns credits. If you exceed the limit together, the mission is lost. Race and Siege are not available here.";
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  ui.session = () => session;
  function render() {
    el("coop-lobby").hidden = !!client;
    el("coop-room").hidden = !client;
    el("coop-room-code").textContent = room?.code ?? "…";
    el("coop-status").textContent = status;
    const host = !!room && seat === 0,
      idle = !session || stopped,
      // Ring missions run their own wave timer on one shared map: co-op only.
      circle = !!game.mission.circle;
    if (circle && MODES[mode].versus) mode = "coop";
    el("coop-modes").hidden = !!client && !host;
    for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=coop-mode]")) {
      radio.checked = radio.value === mode;
      radio.disabled = !idle || (circle && MODES[radio.value as ModeId].versus);
    }
    const rules = MODES[session && !stopped ? session.mode : mode].rules;
    el("coop-rules").textContent = circle ? `${rules} ${CIRCLE_RULES}` : rules;
    el("coop-launch").hidden = !host || !idle;
    el("coop-pick").hidden = (!!client && !host) || !idle;
    (el("coop-launch") as HTMLButtonElement).disabled = !room || !fitsMode(mode, room.players);
    el("coop-mission").textContent = game.mission.name;
  }
  function roomStatus(players: number, code: string) {
    const count = `${players}/${MAX_PLAYERS} players in the room.`;
    if (players < 2) return `Waiting for teammates. Give them the code ${code}.`;
    return seat === 0 ? `${count} Pick the mode and start the mission.` : `${count} The host picks the mode and mission.`;
  }
  function message(m: ServerMessage) {
    switch (m.type) {
      case "room":
        room = { code: m.code, players: m.players };
        seat = m.player;
        // Seats only change mid-session after a player left; the new seat applies at the next launch.
        if (!session) view.player = seat;
        status = roomStatus(m.players, m.code);
        break;
      case "launched": {
        view.player = seat;
        view.selected = null;
        view.enemy = null;
        const versus = MODES[m.mode].versus,
          match = versus ? new Match(m.mode, m.players, seat, game) : null;
        if (!versus) game.setPlayers(m.players);
        session = { mode: m.mode, players: m.players, match };
        stopped = false;
        driver = new LockstepDriver(match ?? coopSim(game), {
          applied,
          hash: (frame, hash) => client?.send({ type: "hash", frame, hash }),
        });
        setDriver({ advance: () => driver?.advance() });
        status = `${MODES[m.mode].name} is running.`;
        break;
      }
      case "frames":
        driver?.receive(m.frames);
        return;
      case "speed":
        view.speed = m.value;
        ui.refresh();
        return;
      case "peer-left":
        stopped = true;
        status = "A teammate left the game. The host can restart, or you can play on alone.";
        ui.notice("Teammate disconnected. The game is stopped.", true);
        break;
      case "desync":
        ui.notice(`Game states diverged (frame ${m.frame}). Restart the mission.`, true);
        return;
      case "error":
        status = ERRORS[m.reason];
        ui.notice(status, true);
        break;
    }
    render();
    ui.refresh();
  }
  function connect(first: { type: "create" } | { type: "join"; code: string }) {
    if (client) return;
    status = "Connecting …";
    client = new RelayClient(relayUrl(), {
      open: () => client?.send(first),
      message,
      close: () => {
        const wasRunning = !!driver;
        client = null;
        room = null;
        if (wasRunning) {
          stopped = true;
          status = "Connection to the relay lost.";
          ui.notice("Connection to the relay lost. The game is stopped.", true);
        } else status = `No relay reachable at ${relayUrl()}. Is "npm run server" running?`;
        render();
      },
    });
    render();
  }
  /** Back to single-player with the current mission. */
  function leave() {
    const wasRunning = !!driver;
    client?.close();
    client = null;
    driver = null;
    session = null;
    stopped = false;
    room = null;
    seat = 0;
    status = "";
    view.player = 0;
    view.speed = 1;
    game.setPlayers(1);
    setDriver(null);
    if (wasRunning) applied({ command: { type: "restart" }, result: game.command({ type: "restart" }), player: 0 });
    render();
  }
  el("coop-page").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b?.id === "coop-create") connect({ type: "create" });
    if (b?.id === "coop-launch") client?.send({ type: "launch", missionId: game.mission.id, mode });
    if (b?.id === "coop-leave") leave();
    if (b?.id === "coop-pick") pickMission();
  });
  el("coop-modes").addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (isModeId(value)) mode = value;
    render();
  });
  el("coop-join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = (el("coop-code") as HTMLInputElement).value.trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(code)) connect({ type: "join", code });
    else {
      status = "The room code has four letters.";
      render();
    }
  });
  return {
    /** True while relay frames drive the simulation. */
    active: () => !!driver,
    /** The running versus match, if any. */
    match: () => session?.match ?? null,
    send(command: MatchCommand) {
      client?.send({ type: "cmd", command });
    },
    setSpeed(value: Speed) {
      client?.send({ type: "speed", value });
    },
    /** In a room that has not launched yet: a mission pick is the room's mission and stays in the lobby. */
    inLobby: () => !!client && !session,
    render,
  };
}
export type Coop = ReturnType<typeof createCoop>;
