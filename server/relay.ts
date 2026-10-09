import { WebSocketServer, type WebSocket } from "ws";
import { DEFAULT_PORT, FRAME_RATE, SPEEDS, type ClientMessage, type ServerMessage } from "../src/net/protocol";
import { isModeId } from "../src/core/modes";
import { Room, roomCode } from "./room";
/** Multiplayer relay: orders commands into frames and broadcasts them; `npm run server`. */
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const rooms = new Map<string, { room: Room; sockets: WebSocket[]; timer?: ReturnType<typeof setInterval> }>();
const send = (socket: WebSocket | undefined, message: ServerMessage) => socket?.send(JSON.stringify(message));
type Entry = NonNullable<ReturnType<typeof rooms.get>>;
const broadcast = (entry: Entry, message: ServerMessage) => entry.sockets.forEach((s) => send(s, message));
function stop(entry: Entry) {
  clearInterval(entry.timer);
  entry.timer = undefined;
}
function start(entry: Entry) {
  stop(entry);
  entry.timer = setInterval(() => {
    const { room } = entry;
    if (!room.running) return stop(entry);
    broadcast(entry, { type: "frames", frames: Array.from({ length: room.speed }, () => room.step()) });
  }, 1000 / FRAME_RATE);
}
const server = new WebSocketServer({ port });
/** Tells every player in the room its (possibly moved) seat. */
const announce = (entry: Entry) =>
  entry.sockets.forEach((s, i) => send(s, { type: "room", code: entry.room.code, player: i, players: entry.room.players }));
server.on("connection", (socket) => {
  let entry: Entry | null = null;
  const enter = (target: Entry) => {
    const player = target.room.join();
    if (player === null) return send(socket, { type: "error", reason: "room-full" });
    target.sockets[player] = socket;
    entry = target;
    announce(target);
  };
  socket.on("message", (data) => {
    let m: ClientMessage;
    try {
      m = JSON.parse(String(data));
    } catch {
      return send(socket, { type: "error", reason: "bad-message" });
    }
    if (m.type === "create" || m.type === "join") {
      if (entry) return;
      if (m.type === "join") {
        const target = rooms.get(String(m.code).toUpperCase());
        return target ? enter(target) : send(socket, { type: "error", reason: "room-unknown" });
      }
      const room = new Room(roomCode((c) => rooms.has(c)));
      const created: Entry = { room, sockets: [] };
      rooms.set(room.code, created);
      return enter(created);
    }
    if (!entry) return send(socket, { type: "error", reason: "not-in-room" });
    // Seats move when someone leaves, so the socket's position is the player.
    const player = entry.sockets.indexOf(socket);
    switch (m.type) {
      case "launch":
        if (player !== 0) return send(socket, { type: "error", reason: "not-host" });
        if (!isModeId(m.mode)) return send(socket, { type: "error", reason: "bad-message" });
        if (!entry.room.canLaunch(m.mode)) return send(socket, { type: "error", reason: "players-mode" });
        entry.room.launch(m.missionId, m.mode);
        broadcast(entry, { type: "launched", missionId: m.missionId, mode: m.mode, players: entry.room.players });
        return start(entry);
      case "cmd":
        return entry.room.queue(player, m.command);
      case "speed":
        if (player !== 0) return send(socket, { type: "error", reason: "not-host" });
        if (!SPEEDS.includes(m.value)) return send(socket, { type: "error", reason: "bad-message" });
        entry.room.speed = m.value;
        return broadcast(entry, { type: "speed", value: m.value });
      case "hash":
        if (entry.room.reportHash(player, m.frame, m.hash) === "desync") broadcast(entry, { type: "desync", frame: m.frame });
        return;
      default:
        return send(socket, { type: "error", reason: "bad-message" });
    }
  });
  socket.on("close", () => {
    if (!entry) return;
    const player = entry.sockets.indexOf(socket),
      wasRunning = entry.room.running;
    entry.room.leave(player);
    entry.sockets.splice(player, 1);
    stop(entry);
    if (!entry.room.players) return rooms.delete(entry.room.code);
    if (wasRunning) broadcast(entry, { type: "peer-left" });
    announce(entry);
  });
});
console.log(`ION BASTION Mehrspieler-Relay auf ws://0.0.0.0:${port}`);
