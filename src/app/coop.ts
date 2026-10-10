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
  /** "Mission wählen" in the lobby: the host picks the room's mission on the mission page. */
  pickMission: () => void;
  /** Every command a frame applied, local or from the partner. */
  applied: (applied: Applied) => void;
  setDriver: (driver: Driver | null) => void;
}
const ERRORS: Record<Extract<ServerMessage, { type: "error" }>["reason"], string> = {
  "room-unknown": "Diesen Raum gibt es nicht.",
  "room-full": "Der Raum ist voll oder die Mission läuft bereits.",
  "not-host": "Das kann nur der Host.",
  "not-in-room": "Du bist in keinem Raum.",
  "players-mode": "Die Spielerzahl passt nicht zu diesem Modus.",
  "bad-message": "Ungültige Nachricht an den Relay-Server.",
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
    "Kreislauf: Die Gegner kreisen, bis sie fallen. Wellen kommen per Timer, wer früh ruft, bekommt Credits. Überschreitet ihr gemeinsam das Limit, ist die Mission verloren. Race und Siege gibt es hier nicht.";
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
    const count = `${players}/${MAX_PLAYERS} Spieler im Raum.`;
    if (players < 2) return `Warte auf Mitspieler. Gib ihnen den Code ${code}.`;
    return seat === 0 ? `${count} Wähle den Modus und starte die Mission.` : `${count} Der Host wählt Modus und Mission.`;
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
        status = `${MODES[m.mode].name} läuft.`;
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
        status = "Ein Mitspieler hat das Spiel verlassen. Der Host kann neu starten, oder du spielst allein weiter.";
        ui.notice("Mitspieler getrennt. Das Spiel ist angehalten.", true);
        break;
      case "desync":
        ui.notice(`Spielstände weichen ab (Frame ${m.frame}). Startet die Mission neu.`, true);
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
    status = "Verbinde …";
    client = new RelayClient(relayUrl(), {
      open: () => client?.send(first),
      message,
      close: () => {
        const wasRunning = !!driver;
        client = null;
        room = null;
        if (wasRunning) {
          stopped = true;
          status = "Verbindung zum Relay verloren.";
          ui.notice("Verbindung zum Relay verloren. Das Spiel ist angehalten.", true);
        } else status = `Kein Relay unter ${relayUrl()} erreichbar. Läuft „npm run server“?`;
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
      status = "Der Raumcode hat vier Buchstaben.";
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
