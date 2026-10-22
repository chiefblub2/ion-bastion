import type { GameState } from "./types";
const round = (n: number) => Math.round(n * 1e6);
/**
 * Stable text of any plain value: object keys sorted, `undefined` fields skipped (so an absent field and an unset one
 * hash alike), floats rounded. Fields added to the state later are covered without touching this file.
 */
export function stable(v: unknown): string {
  if (typeof v === "number") return String(round(v));
  if (v === null || typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${k}:${stable(o[k])}`)
    .join(",")}}`;
}
/**
 * FNV-1a over everything co-op clients must agree on: the whole state except `events`, which the renderer drains
 * on its own schedule. Hashed every `HASH_INTERVAL` frames, so the full walk is cheap.
 */
export function stateHash(s: GameState) {
  const { events: _events, towers, ...rest } = s;
  // A tower's `angle` comes from `Math.atan2`, which engines may round differently; only the renderer reads it.
  return fnv(stable({ ...rest, towers: towers.map(({ angle: _angle, ...t }) => t) }));
}
/** 32-bit FNV-1a of a string. */
export function fnv(parts: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) h = Math.imul(h ^ parts.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
