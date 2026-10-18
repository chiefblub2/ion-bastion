import type { Enemy, GameState, Tower } from "./types";
const round = (n: number) => Math.round(n * 1e6);
/** One tower's hash part; optional fields add a suffix only when present, so solo hashes stay unchanged. */
const towerPart = (t: Tower) =>
  [
    `${t.id}:${t.owner}:${t.upgrades.join("+")}:${t.kills}`,
    t.priority ? `:${t.priority}` : "",
    t.focus ? `:f${t.focus.target}/${t.focus.stacks}` : "",
    t.specialShots !== undefined ? `:s${t.specialShots}` : "",
    // ── new towers: g1 (Attack+Control A) ──
    // ── end g1 ──
    // ── new towers: g2 (Control B) ──
    // ── end g2 ──
    // ── new towers: g3 (Traps) ──
    t.wall !== undefined ? `:gw${round(t.wall)}` : "",
    // ── end g3 ──
    // ── new towers: g4 (Support A) ──
    t.critCount !== undefined ? `:cr${t.critCount}` : "",
    // ── end g4 ──
    // ── new towers: g5 (Support B) ──
    t.barrier !== undefined ? `:sg${t.barrier}` : "",
    // ── end g5 ──
  ].join("");
/** One enemy's hash part, like `towerPart`. */
const enemyPart = (e: Enemy) =>
  [
    `${e.id}:${round(e.hp)}:${round(e.distance)}`,
    e.brood !== undefined ? `:b${e.brood}` : "",
    // ── new towers: g1 (Attack+Control A) ──
    // ── end g1 ──
    // ── new towers: g2 (Control B) ──
    // ── end g2 ──
    // ── new towers: g3 (Traps) ──
    e.warped !== undefined ? ":gp" : "",
    // ── end g3 ──
    // ── new towers: g4 (Support A) ──
    // ── end g4 ──
    // ── new towers: g5 (Support B) ──
    // ── end g5 ──
  ].join("");
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
    s.towers.map(towerPart).join(";"),
    s.enemies.map(enemyPart).join(";"),
    s.projectiles.length,
    // Circle missions only, so reactor missions keep their hashes.
    ...(s.circle ? [round(s.circle.next), s.queue.length] : []),
    ...(s.nextWave !== undefined ? [`n${round(s.nextWave)}`] : []),
    // Aftershock waves still to come; absent without them, so older hashes stay unchanged.
    ...(s.pending ? [s.pending.map((p) => `${round(p.due)}@${round(p.at.x)},${round(p.at.y)}r${round(p.radius)}d${round(p.damage)}t${p.source.tower}`).join(";")] : []),
    // Plasma pools on the ground; absent without them.
    ...(s.zones ? [s.zones.map((z) => `${z.source.tower}@${round(z.at.x)},${round(z.at.y)}r${round(z.radius)}d${round(z.dps)}u${round(z.until)}n${round(z.next)}`).join(";")] : []),
    // Optional state of new towers: each part is absent (an empty spread) while unused, so older hashes stay unchanged.
    // ── new towers: g1 (Attack+Control A) ──
    // Orbital strikes on their way down; absent without them.
    ...(s.strikes ? [`o${s.strikes.map((k) => `${k.source.tower}@${round(k.at.x)},${round(k.at.y)}r${round(k.radius)}d${round(k.damage)}u${round(k.due)}`).join(";")}`] : []),
    // ── end g1 ──
    // ── new towers: g2 (Control B) ──
    // ── end g2 ──
    // ── new towers: g3 (Traps) ──
    // ── end g3 ──
    // ── new towers: g4 (Support A) ──
    // ── end g4 ──
    // ── new towers: g5 (Support B) ──
    // ── end g5 ──
  ].join("|");
  return fnv(parts);
}
/** 32-bit FNV-1a of a string. */
export function fnv(parts: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) h = Math.imul(h ^ parts.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
