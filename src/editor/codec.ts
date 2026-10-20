import type { EnemyId, MapTheme, TowerId, WaveDefinition } from "../core/types";
import { type EditorDraft, LIMITS } from "./draft";

// A Record over the union makes tsc fail when a theme is added here or in `MapTheme` only (importing THEMES would pull in Phaser).
const THEME_SET: Record<MapTheme, true> = {
  outpost: true, lock: true, shard: true, ember: true, core: true, frost: true, toxic: true, orbit: true, ruin: true,
  rift: true, dune: true, abyss: true, storm: true, jungle: true, volcano: true, geode: true, gear: true, tide: true,
};
const THEMES = Object.keys(THEME_SET) as readonly MapTheme[];

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const inRange = (n: number, [lo, hi]: readonly number[]) => n >= lo && n <= hi;

function parseWave(w: unknown): WaveDefinition | undefined {
  if (!isObject(w) || !isNum(w.bonus) || !Array.isArray(w.groups)) return undefined;
  if (w.hpMultiplier !== undefined && !isNum(w.hpMultiplier)) return undefined;
  const groups = [];
  for (const g of w.groups) {
    if (!isObject(g) || typeof g.type !== "string") return undefined;
    if (!isNum(g.count) || !isNum(g.interval) || !isNum(g.delay)) return undefined;
    groups.push({ type: g.type as EnemyId, count: g.count, interval: g.interval, delay: g.delay });
  }
  return { groups, bonus: w.bonus, ...(w.hpMultiplier !== undefined && { hpMultiplier: w.hpMultiplier }) };
}

/** Shape check only (ids are not looked up; `compileDraft` reports those). Returns a fresh object with the known fields. */
export function parseDraft(data: unknown): EditorDraft | undefined {
  if (!isObject(data) || data.version !== 1) return undefined;
  const { id, name, focus, theme, sketch, waves, circle } = data;
  if (typeof id !== "string" || typeof name !== "string" || typeof focus !== "string") return undefined;
  if (typeof theme !== "string" || !THEMES.includes(theme as MapTheme)) return undefined;
  if (!Array.isArray(sketch) || !inRange(sketch.length, LIMITS.rows)) return undefined;
  if (!sketch.every((r) => typeof r === "string" && /^[SR=#.]*$/.test(r) && r.length === sketch[0].length)) return undefined;
  if (!inRange(sketch[0].length, LIMITS.columns)) return undefined;
  if (!Array.isArray(waves)) return undefined;
  const parsedWaves = waves.map(parseWave);
  if (parsedWaves.some((w) => !w)) return undefined;
  if (!isNum(data.startingCredits) || !isNum(data.reactorEnergy)) return undefined;
  if (data.hpGrowth !== undefined && !isNum(data.hpGrowth)) return undefined;
  const towers = data.availableTowers;
  if (towers !== undefined && !(Array.isArray(towers) && towers.every((t) => typeof t === "string"))) return undefined;
  if (!isObject(circle) || !isNum(circle.interval) || !isNum(circle.limit) || !isNum(circle.earlyBonus)) return undefined;
  return {
    version: 1,
    id,
    name,
    focus,
    theme: theme as MapTheme,
    sketch: [...(sketch as string[])],
    waves: parsedWaves as WaveDefinition[],
    startingCredits: data.startingCredits,
    reactorEnergy: data.reactorEnergy,
    ...(data.hpGrowth !== undefined && { hpGrowth: data.hpGrowth }),
    ...(towers !== undefined && { availableTowers: [...(towers as TowerId[])] }),
    circle: { interval: circle.interval, limit: circle.limit, earlyBonus: circle.earlyBonus },
  };
}

/** Base64url of the UTF-8 JSON, without padding. */
export function encodeDraft(d: EditorDraft): string {
  let binary = "";
  for (const b of new TextEncoder().encode(JSON.stringify(d))) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeDraft(code: string): EditorDraft | undefined {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return undefined;
    const binary = atob(code.replaceAll("-", "+").replaceAll("_", "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return parseDraft(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    return undefined;
  }
}

export const shareUrl = (d: EditorDraft, base: string) => `${base}?draft=${encodeDraft(d)}#editor`;
