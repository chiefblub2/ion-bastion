import type { GameState } from "./types";
const round = (n: number) => Math.round(n * 1e6);
/** FNV-1a over the parts of the state that must match between co-op clients; floats are rounded. */
export function stateHash(s: GameState) {
  const parts = [
    s.status,
    s.paused,
    s.wave,
    s.lives,
    s.kills,
    s.nextId,
    round(s.time),
    s.wallets.map(round).join(","),
    s.towers.map((t) => `${t.id}:${t.owner}:${t.upgrades.join("+")}:${t.kills}`).join(";"),
    s.enemies.map((e) => `${e.id}:${round(e.hp)}:${round(e.distance)}`).join(";"),
    s.projectiles.length,
  ].join("|");
  return fnv(parts);
}
/** 32-bit FNV-1a of a string. */
export function fnv(parts: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) h = Math.imul(h ^ parts.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
