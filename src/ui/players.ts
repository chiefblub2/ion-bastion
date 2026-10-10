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
export const playerName = (player: number, me?: number) => (player === me ? "You" : `Player ${player + 1}`);
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
        ? "Eliminated"
        : s.status === "won"
          ? "Done"
          : m.waiting() && m.ready[p]
            ? "Ready"
            : "";
    return `<span class="player-chip${m.isAlive(p) ? "" : " out"}${p === target ? " target" : ""}">${dot(p)}<b>${playerName(p)}</b><span>♡ ${s.lives}</span><span>W ${pad(s.wave)}</span>${tag ? `<em>${tag}</em>` : ""}${p === target ? '<em class="target-tag">◎ Target</em>' : ""}</span>`;
  });
  if (m.waiting()) {
    const waiting = m.alive().filter((p) => m.fields[p].state.status === "ready"),
      ready = waiting.filter((p) => m.ready[p]).length;
    chips.push(
      `<span class="players-countdown">Next wave in <b>${Math.ceil(m.countdown * FIXED_STEP)} s</b> · ${ready}/${waiting.length} ready</span>`,
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
      return `<button class="send-card" data-send="${enemy}" style="--accent:${hex(d.color)}" ${disabled ? "disabled" : ""} title="${unlocked ? `Send ${d.name} to ${target === null ? "nobody" : playerName(target)}` : "Available after its first wave"}"><strong>${d.name}</strong><b>${unlocked ? `◇ ${cost}` : "🔒"}</b></button>`;
    })
    .join("");
  return `<div class="section-title"><h2>Send</h2><span>${target === null ? "No target" : `${dot(target)}${playerName(target)}`}</span></div><div class="send-list">${buttons}</div>`;
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
      .map((p, i) => `${i + 1}. ${playerName(p, me)} (♡ ${m.fields[p].state.lives}${m.isAlive(p) ? "" : ", eliminated"})`)
      .join(" · ");
    const [icon, title] =
      r.winner === me ? ["✦", "Victory."] : r.top.includes(me) ? ["◇", "Draw."] : ["◇", "Defeat."];
    return { icon, kicker: `${MODES[m.mode].name.toUpperCase()} OVER`, title, copy: ranking, over: true };
  }
  if (!m.isAlive(me))
    return {
      icon: "◇",
      kicker: "ELIMINATED",
      title: "Reactor lost.",
      copy: `You reached wave ${m.fields[me].state.wave}. The others play on.`,
      over: false,
    };
  if (m.fields[me].state.status === "won")
    return {
      icon: "✦",
      kicker: "ALL WAVES REPELLED",
      title: "The line holds.",
      copy: "Wait until the others finish their last wave.",
      over: false,
    };
  return null;
}
