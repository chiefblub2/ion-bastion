import { FIXED_STEP, type Game } from "../core/game";
import type { Match } from "../core/match";
import { MODES, type ModeId } from "../core/modes";
import { PLAYER_COLORS } from "../net/protocol";
/** What the HUD needs to know about a running multiplayer session. */
export interface MultiplayerSession {
  mode: ModeId;
  players: number;
  /** Versus only; co-op shares one `Game`. */
  match: Match | null;
}
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
export const playerColor = (player: number) => hex(PLAYER_COLORS[player] ?? 0xffffff);
export const playerName = (player: number, me?: number) => (player === me ? "Du" : `Spieler ${player + 1}`);
const dot = (player: number) => `<i class="player-dot" style="--player:${playerColor(player)}"></i>`;
const pad = (n: number) => String(n).padStart(2, "0");
/** Strip under the toolbar: partners' credits in co-op, opponents' reactors in versus. */
export function renderPlayers(game: Game, session: MultiplayerSession, me: number) {
  const others = Array.from({ length: session.players }, (_, i) => i).filter((p) => p !== me),
    m = session.match;
  if (!m)
    return others
      .map((p) => `<span class="player-chip">${dot(p)}<b>${playerName(p)}</b><span>◇ ${game.state.wallets[p] ?? 0}</span></span>`)
      .join("");
  const target = MODES[m.mode].sends ? m.target(me) : null;
  const chips = others.map((p) => {
    const s = m.fields[p].state,
      tag = !m.isAlive(p)
        ? "Ausgeschieden"
        : s.status === "won"
          ? "Fertig"
          : m.waiting() && m.ready[p]
            ? "Bereit"
            : "";
    return `<span class="player-chip${m.isAlive(p) ? "" : " out"}${p === target ? " target" : ""}">${dot(p)}<b>${playerName(p)}</b><span>♡ ${s.lives}</span><span>W ${pad(s.wave)}</span>${tag ? `<em>${tag}</em>` : ""}${p === target ? '<em class="target-tag">◎ Ziel</em>' : ""}</span>`;
  });
  if (m.waiting()) {
    const waiting = m.alive().filter((p) => m.fields[p].state.status === "ready"),
      ready = waiting.filter((p) => m.ready[p]).length;
    chips.push(
      `<span class="players-countdown">Nächste Welle in <b>${Math.ceil(m.countdown * FIXED_STEP)} s</b> · ${ready}/${waiting.length} bereit</span>`,
    );
  }
  return chips.join("");
}
/** Siege: one button per sendable enemy type of the mission. */
export function renderSends(m: Match, me: number, terminal: boolean) {
  const field = m.fields[me],
    target = m.target(me),
    credits = field.state.wallets[0] ?? 0;
  const buttons = m
    .sendOptions(me)
    .map(({ enemy, cost, unlocked }) => {
      const d = field.content.enemies[enemy],
        disabled = terminal || target === null || !unlocked || credits < cost;
      return `<button class="send-card" data-send="${enemy}" style="--accent:${hex(d.color)}" ${disabled ? "disabled" : ""} title="${unlocked ? `${d.name} zu ${target === null ? "niemandem" : playerName(target)} schicken` : "Erst nach seiner ersten Welle verfügbar"}"><strong>${d.name}</strong><b>${unlocked ? `◇ ${cost}` : "🔒"}</b></button>`;
    })
    .join("");
  return `<div class="section-title"><h2>Schicken</h2><span>${target === null ? "Kein Ziel" : `${dot(target)}${playerName(target)}`}</span></div><div class="send-list">${buttons}</div>`;
}
export interface Outcome {
  icon: string;
  kicker: string;
  title: string;
  copy: string;
  /** The match is over; the host may restart or pick the next mission. */
  over: boolean;
}
/** Overlay text in versus, or null while the local player still fights. */
export function versusOutcome(m: Match, me: number): Outcome | null {
  const r = m.result;
  if (r) {
    const ranking = r.ranking
      .map((p, i) => `${i + 1}. ${playerName(p, me)} (♡ ${m.fields[p].state.lives}${m.isAlive(p) ? "" : ", ausgeschieden"})`)
      .join(" · ");
    const [icon, title] =
      r.winner === me ? ["✦", "Sieg."] : r.top.includes(me) ? ["◇", "Unentschieden."] : ["◇", "Niederlage."];
    return { icon, kicker: `${MODES[m.mode].name.toUpperCase()} BEENDET`, title, copy: ranking, over: true };
  }
  if (!m.isAlive(me))
    return {
      icon: "◇",
      kicker: "AUSGESCHIEDEN",
      title: "Reaktor verloren.",
      copy: `Du hast Welle ${m.fields[me].state.wave} erreicht. Die anderen spielen weiter.`,
      over: false,
    };
  if (m.fields[me].state.status === "won")
    return {
      icon: "✦",
      kicker: "ALLE WELLEN ABGEWEHRT",
      title: "Die Linie hält.",
      copy: "Warte, bis die anderen ihre letzte Welle beendet haben.",
      over: false,
    };
  return null;
}
