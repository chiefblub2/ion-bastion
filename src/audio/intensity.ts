import type { ContentPack, GameEvent, GameState } from "../core/types";
import { isSupport } from "../systems/attacks";
import { effectiveTowerStats } from "../systems/auras";
import type { Color } from "./harmony";
// The two parts of the music: the enemies' threat (rhythm), the defense's strength (harmony), and the clear time
// between them (mood). Reads state only.

/** Base HP from which an enemy stomps on the beat, and from which it is a boss with its own motif. */
export const HEAVY_HP = 300,
  BOSS_HP = 1000;
/** Weighted enemies and tower levels at which threat and defense are full. */
const FULL_THREAT = 30,
  FULL_DEFENSE = 40;
export interface Intensity {
  threat: number;
  defense: number;
  /** Seconds the towers need to clear the field at their combined damage per second. */
  clear: number;
  heavies: number;
  bosses: number;
}
export function intensityOf(state: GameState, content: ContentPack, pathLength: number): Intensity {
  let threat = 0,
    hp = 0,
    heavies = 0,
    bosses = 0,
    defense = 0,
    dps = 0;
  for (const e of state.enemies) {
    const base = content.enemies[e.type].hp,
      progress = pathLength > 0 ? Math.min(1, e.distance / pathLength) : 0;
    threat += Math.min(4, Math.max(0.5, base / 100)) * (0.5 + 0.5 * progress);
    hp += e.hp;
    if (base >= HEAVY_HP) heavies++;
    if (base >= BOSS_HP) bosses++;
  }
  for (const t of state.towers) {
    defense += 1 + t.upgrades.length;
    if (isSupport(content.towers[t.type].attack)) continue;
    const s = effectiveTowerStats(t, state.towers, content);
    if (s.interval > 0) dps += s.damage / s.interval;
  }
  return { threat: Math.min(1, threat / FULL_THREAT), defense: Math.min(1, defense / FULL_DEFENSE), clear: hp / Math.max(1, dps), heavies, bosses };
}
/** Bright under 3 s, dark over 10 s; each colour holds a little past its threshold so it does not flicker. */
export function colorOf(clear: number, previous: Color): Color {
  if (clear < (previous === "bright" ? 4 : 3)) return "bright";
  if (clear > (previous === "dark" ? 8 : 10)) return "dark";
  return "drive";
}
/** Pad filter factor: brighter with a comfortable lead and with a stronger defense; losing stays open (tense, not muffled). */
export const toneFor = (color: Color, defense: number) => (color === "bright" ? 1.5 : 1) * (1 + 0.5 * defense);
export function bossSpawned(events: readonly GameEvent[], state: GameState, content: ContentPack) {
  return events.some((e) => {
    if (e.type !== "spawn") return false;
    const enemy = state.enemies.find((x) => x.id === e.enemy);
    return !!enemy && content.enemies[enemy.type].hp >= BOSS_HP;
  });
}
