/// <reference types="vite/client" />
import { DEFAULT_PORT, type ClientMessage, type ServerMessage } from "./protocol";
/** `?server=` as the page was loaded; menu navigation rewrites the URL without it. */
const LOADED_SERVER = typeof location === "undefined" ? null : new URLSearchParams(location.search).get("server");
/** Relay address: `?server=ws://…` (now or at page load), else the build's `VITE_RELAY_URL`, else port 4174 on the host that served the page. */
export function relayUrl(location: Location = window.location) {
  const custom = new URLSearchParams(location.search).get("server") ?? LOADED_SERVER;
  if (custom) return custom;
  const built: string | undefined = import.meta.env.VITE_RELAY_URL;
  if (built) return built;
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:${DEFAULT_PORT}`;
}
/** A static-host build (`VITE_STATIC_HOST`, e.g. GitHub Pages) has no relay of its own unless one is configured. */
export function relayMissing(location: Location = window.location) {
  const configured = new URLSearchParams(location.search).get("server") ?? LOADED_SERVER ?? import.meta.env.VITE_RELAY_URL;
  return !!import.meta.env.VITE_STATIC_HOST && !configured;
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
