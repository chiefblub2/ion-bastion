import type { Game } from "../core/game";
import { Match, type MatchCommand } from "../core/match";
import { fitsMode, isModeId, MODES, type ModeId } from "../core/modes";
import { coopSim, LockstepDriver, type Applied } from "../net/lockstep";
import { RelayClient, relayMissing, relayUrl } from "../net/client";
import { MAX_PLAYERS, type ServerMessage, type Speed } from "../net/protocol";
import { copyText, isRoomCode, normalizeRoomCode } from "./room-code";
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
  "room-unknown": "No room with that code. Check it with your host.",
  "room-full": "That room is full or its mission is already running.",
  "not-host": "Only the host can do that.",
  "not-in-room": "You are not in a room.",
  "players-mode": "The player count does not fit this mode.",
  "bad-message": "Invalid message to the relay server.",
  "rate-limited": "Too many messages to the relay server. Slow down.",
  "server-full": "The relay server is full. Try again later.",
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
    /** Plain progress ("Connecting …") and the last failure, each in its own live region. */
    status = "",
    error = "",
    /** Which entry panel shows while there is no room: the two choices or the join form. */
    panel: "choose" | "join" = "choose",
    shown = "";
  const CIRCLE_RULES =
    "Circuit: enemies circle until they fall. Waves come on a timer; calling one early earns credits. If you exceed the limit together, the mission is lost. Race and Siege are not available here.";
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  ui.session = () => session;
  el("coop-hosting").hidden = !relayMissing();
  function render() {
    const connecting = !!client && !room,
      view = room ? "room" : panel,
      host = !!room && seat === 0,
      idle = !session || stopped,
      // Ring missions run their own wave timer on one shared map: co-op only.
      circle = !!game.mission.circle;
    if (circle && MODES[mode].versus) mode = "coop";
    el("coop-choose").hidden = view !== "choose";
    el("coop-join-panel").hidden = view !== "join";
    el("coop-room").hidden = view !== "room";
    for (const id of ["coop-create", "coop-show-join", "coop-join", "coop-join-back"]) (el(id) as HTMLButtonElement).disabled = connecting;
    (el("coop-code") as HTMLInputElement).readOnly = connecting;
    el("coop-status").textContent = status;
    el("coop-error").textContent = error;
    el("coop-error").hidden = !error;
    el("coop-room-code").setAttribute("value", room?.code ?? "…");
    (el("coop-room-code") as HTMLInputElement).value = room?.code ?? "…";
    const players = room?.players ?? 0;
    el("coop-count").textContent = `${players}/${MAX_PLAYERS}`;
    el("coop-role").textContent = host ? "You are the host" : `You are player ${seat + 1}`;
    el("coop-seats").innerHTML = Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const label = i < players ? `Player ${i + 1}${i === 0 ? " · Host" : ""}${i === seat ? " · You" : ""}` : "Open seat";
      return `<li${i < players ? ' class="taken"' : ""}><i aria-hidden="true"></i>${label}</li>`;
    }).join("");
    // The host's controls: mode, mission, start. Everyone else waits for them, so those controls are not shown.
    el("coop-host").hidden = !host;
    for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=coop-mode]")) {
      radio.checked = radio.value === mode;
      radio.disabled = !idle || (circle && MODES[radio.value as ModeId].versus);
    }
    const rules = MODES[session && !stopped ? session.mode : mode].rules;
    el("coop-rules").textContent = circle ? `${rules} ${CIRCLE_RULES}` : rules;
    el("coop-launch").hidden = !host || !idle;
    el("coop-pick").hidden = !host || !idle;
    const fits = !!room && fitsMode(mode, room.players);
    (el("coop-launch") as HTMLButtonElement).disabled = !fits;
    el("coop-mission").textContent = game.mission.name;
    const wait = el("coop-wait");
    wait.hidden = !room;
    wait.textContent = !room
      ? ""
      : !idle
        ? `${MODES[session!.mode].name} is running.`
        : !host
          ? "Waiting for the host to choose the mission and start it."
          : fits
            ? "Ready to start."
            : `${MODES[mode].name} needs ${MODES[mode].minPlayers}–${MODES[mode].maxPlayers} players. Waiting for more players to join.`;
    // A panel the player was on disappears (e.g. a room appears): keep the focus inside the page.
    if (view !== shown) {
      const was = shown;
      shown = view;
      if (was && document.activeElement && (!document.activeElement.isConnected || (document.activeElement as HTMLElement).offsetParent === null || document.activeElement === document.body))
        el(view === "room" ? "coop-copy" : view === "join" ? "coop-code" : "coop-create").focus({ preventScroll: true });
    }
  }
  function roomStatus(players: number) {
    return players < 2 ? "Waiting for players. Share the code with them." : "";
  }
  function message(m: ServerMessage) {
    switch (m.type) {
      case "room":
        room = { code: m.code, players: m.players };
        seat = m.player;
        // Seats only change mid-session after a player left; the new seat applies at the next launch.
        if (!session) view.player = seat;
        status = roomStatus(m.players);
        error = "";
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
        status = "";
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
        status = "";
        error = "A teammate left the game. The host can restart, or you can play on alone.";
        ui.notice("Teammate disconnected. The game is stopped.", true);
        break;
      case "desync":
        ui.notice(`Game states diverged (frame ${m.frame}). Restart the mission.`, true);
        return;
      case "error":
        error = ERRORS[m.reason];
        status = "";
        ui.notice(error, true);
        // Before a room exists the connection is of no use: drop it so the entry panel is usable again.
        if (!room) closeClient();
        break;
    }
    render();
    ui.refresh();
  }
  /** Closes the socket without its close hook touching the next connection. */
  function closeClient() {
    const old = client;
    client = null;
    old?.close();
  }
  function connect(first: { type: "create" } | { type: "join"; code: string }) {
    if (client) return;
    status = "Connecting to the relay …";
    error = "";
    const mine: RelayClient = new RelayClient(relayUrl(), {
      open: () => mine.send(first),
      message: (m) => client === mine && message(m),
      close: () => {
        if (client !== mine) return;
        const wasRunning = !!driver;
        client = null;
        room = null;
        status = "";
        if (wasRunning) {
          stopped = true;
          error = "Connection to the relay lost. The game is stopped.";
          ui.notice(error, true);
        } else error = `No relay reachable at ${relayUrl()}. Is "npm run server" running?`;
        render();
      },
    });
    client = mine;
    render();
  }
  /** Back to single-player with the current mission. */
  function leave() {
    const wasRunning = !!driver;
    closeClient();
    driver = null;
    session = null;
    stopped = false;
    room = null;
    seat = 0;
    status = "";
    error = "";
    panel = "choose";
    view.player = 0;
    view.speed = 1;
    game.setPlayers(1);
    setDriver(null);
    if (wasRunning) applied({ command: { type: "restart" }, result: game.command({ type: "restart" }), player: 0 });
    render();
  }
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  /** Says what the copy did; only a copy the browser confirmed is called one. Otherwise the code is selected for Ctrl+C. */
  async function copyCode() {
    const code = room?.code,
      out = el("coop-copy-status");
    if (!code) return;
    const done = await copyText(code);
    if (done) out.textContent = "Code copied.";
    else {
      const input = el<HTMLInputElement>("coop-room-code");
      input.focus();
      input.select();
      out.textContent = "Copying is not available here. The code is selected: press Ctrl+C (⌘C on Mac).";
    }
    clearTimeout(copyTimer);
    if (done) copyTimer = setTimeout(() => (out.textContent = ""), 3000);
  }
  el("coop-page").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b?.id === "coop-create") connect({ type: "create" });
    if (b?.id === "coop-show-join") {
      panel = "join";
      error = status = "";
      render();
    }
    if (b?.id === "coop-join-back") {
      panel = "choose";
      error = status = "";
      render();
      el("coop-show-join").focus({ preventScroll: true });
    }
    if (b?.id === "coop-launch") client?.send({ type: "launch", missionId: game.mission.id, mode });
    if (b?.id === "coop-leave") leave();
    if (b?.id === "coop-pick") pickMission();
    if (b?.id === "coop-copy") void copyCode();
  });
  el("coop-modes").addEventListener("change", (e) => {
    const value = (e.target as HTMLInputElement).value;
    if (isModeId(value)) mode = value;
    render();
  });
  el("coop-join-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el<HTMLInputElement>("coop-code"),
      code = normalizeRoomCode(input.value);
    input.value = code;
    if (isRoomCode(code)) connect({ type: "join", code });
    else {
      error = "The room code has four letters.";
      status = "";
      render();
      input.focus();
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
