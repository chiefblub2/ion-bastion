import { DEFAULT_CONTENT } from "../content";
import { parseMap } from "../content/maps";
import { MISSIONS } from "../content/missions";
import { WAVES } from "../content/waves";
import { hasAir, hasStealth } from "../core/mission-checks";
import type {
  CircleRules,
  ContentPack,
  MapDefinition,
  MapTheme,
  MissionDefinition,
  TowerId,
  WaveDefinition,
} from "../core/types";
import { validateMission } from "../core/validation";

export type Tile = "S" | "R" | "=" | "#" | ".";

/** The editable form of a mission; `compileDraft` turns it into a `MissionDefinition`. */
export interface EditorDraft {
  version: 1;
  id: string;
  name: string;
  focus: string;
  theme: MapTheme;
  /** Rows of Tile characters, all the same length. */
  sketch: string[];
  waves: WaveDefinition[];
  startingCredits: number;
  reactorEnergy: number;
  hpGrowth?: number;
  /** Absent = all towers. */
  availableTowers?: TowerId[];
  /** Kept always, used only when the sketch has no R (a ring). */
  circle: CircleRules;
}

export const LIMITS = { columns: [6, 24], rows: [5, 16] } as const;
export const PLAYTEST_PREFIX = "playtest:";
export const isPlaytest = (m: MissionDefinition) => m.id.startsWith(PLAYTEST_PREFIX);
export const asPlaytest = (m: MissionDefinition): MissionDefinition => ({ ...m, id: PLAYTEST_PREFIX + m.id });

const DEFAULT_RING: CircleRules = { interval: 20, limit: 30, earlyBonus: 3 };
const clamp = (v: number, [lo, hi]: readonly [number, number] | readonly number[]) => Math.min(hi, Math.max(lo, v));
const copyWaves = (waves: readonly WaveDefinition[]): WaveDefinition[] =>
  waves.map((w) => ({ ...w, groups: w.groups.map((g) => ({ ...g })) }));

export function blankDraft(columns = 18, rows = 12): EditorDraft {
  const c = clamp(columns, LIMITS.columns),
    r = clamp(rows, LIMITS.rows),
    mid = Math.floor(r / 2);
  const sketch = Array.from({ length: r }, (_, y) => (y === mid ? "S" + "=".repeat(c - 2) + "R" : ".".repeat(c)));
  const base = MISSIONS[0];
  return {
    version: 1,
    id: "my-mission",
    name: "My Mission",
    focus: "",
    theme: "outpost",
    sketch,
    waves: copyWaves(WAVES),
    startingCredits: base.startingCredits,
    reactorEnergy: base.reactorEnergy,
    circle: { ...DEFAULT_RING },
  };
}

/** Paints one cell; S and R are unique, so the previous one becomes path. Out of bounds returns `d` itself. */
export function paint(d: EditorDraft, x: number, y: number, tile: Tile): EditorDraft {
  if (y < 0 || y >= d.sketch.length || x < 0 || x >= d.sketch[0].length) return d;
  const sketch = d.sketch.map((row) => (tile === "S" || tile === "R" ? row.replaceAll(tile, "=") : row));
  sketch[y] = sketch[y].slice(0, x) + tile + sketch[y].slice(x + 1);
  return { ...d, sketch };
}

export function resize(d: EditorDraft, columns: number, rows: number): EditorDraft {
  const c = clamp(columns, LIMITS.columns),
    r = clamp(rows, LIMITS.rows);
  const sketch = Array.from({ length: r }, (_, y) => (d.sketch[y] ?? "").slice(0, c).padEnd(c, "."));
  return { ...d, sketch };
}

export function sketchOf(map: MapDefinition): string[] {
  const grid = Array.from({ length: map.rows }, () => Array<string>(map.columns).fill("."));
  for (const b of map.blocked) grid[b.y][b.x] = "#";
  map.path.forEach((p, i) => {
    grid[p.y][p.x] = i === 0 ? "S" : i === map.path.length - 1 && !map.loop ? "R" : "=";
  });
  return grid.map((row) => row.join(""));
}

export function draftFromMission(m: MissionDefinition): EditorDraft {
  return {
    version: 1,
    id: m.id,
    name: m.name,
    focus: m.focus,
    theme: m.map.theme ?? "outpost",
    sketch: sketchOf(m.map),
    waves: copyWaves(m.waves),
    startingCredits: m.startingCredits,
    reactorEnergy: m.reactorEnergy,
    ...(m.hpGrowth !== undefined && { hpGrowth: m.hpGrowth }),
    ...(m.availableTowers && { availableTowers: [...m.availableTowers] }),
    circle: { ...(m.circle ?? DEFAULT_RING) },
  };
}

export type Compiled = { ok: true; mission: MissionDefinition; warnings: string[] } | { ok: false; errors: string[] };

export function compileDraft(d: EditorDraft, content: ContentPack = DEFAULT_CONTENT): Compiled {
  try {
    if (d.sketch.join("").split("R").length > 2) return { ok: false, errors: ["More than one reactor R."] };
    const map = parseMap(d.id, d.name, d.sketch, d.theme);
    const mission: MissionDefinition = {
      id: d.id,
      name: d.name,
      focus: d.focus,
      map,
      waves: copyWaves(d.waves),
      startingCredits: d.startingCredits,
      reactorEnergy: d.reactorEnergy,
      ...(map.loop && { circle: { ...d.circle } }),
      ...(d.hpGrowth !== undefined && { hpGrowth: d.hpGrowth }),
      ...(d.availableTowers && { availableTowers: [...d.availableTowers] }),
    };
    validateMission(mission, content);
    const offered = (mission.availableTowers ?? (Object.keys(content.towers) as TowerId[])).map((t) => content.towers[t]);
    const warnings: string[] = [];
    if (hasStealth(mission, content) && !offered.some((t) => t.attack.kind === "detect"))
      warnings.push("Stealth enemies need a Detector, but no Detector tower is available.");
    if (hasAir(mission, content) && !offered.some((t) => t.targets.includes("air")))
      warnings.push("Flying enemies appear, but no available tower can hit air.");
    return { ok: true, mission, warnings };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}
