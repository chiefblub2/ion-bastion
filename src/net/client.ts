import { DEFAULT_PORT, type ClientMessage, type ServerMessage } from "./protocol";
/** Relay address: `?server=ws://…` or port 4174 on the host that served the page. */
export function relayUrl(location: Location = window.location) {
  const custom = new URLSearchParams(location.search).get("server");
  if (custom) return custom;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:${DEFAULT_PORT}`;
}
/** Typed WebSocket to the co-op relay. */
export class RelayClient {
  private socket: WebSocket;
  constructor(
    url: string,
    hooks: { open: () => void; message: (m: ServerMessage) => void; close: () => void },
  ) {
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", hooks.open);
    this.socket.addEventListener("message", (e) => hooks.message(JSON.parse(String(e.data)) as ServerMessage));
    this.socket.addEventListener("close", hooks.close);
  }
  send(message: ClientMessage) {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
  close() {
    this.socket.close();
  }
}
