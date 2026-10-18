import type { ContentPack, GameEvent, GameState, MissionDefinition } from "../core/types";
import type { Color } from "./harmony";
// What the soundtrack follows: the enemies' threat (rhythm), the danger to the reactor (mood) and the mission's
// progress (harmony). Reads state only, and never the towers: building and firing leave the music alone.

/** Base HP from which an enemy stomps on the beat, and from which it is a boss with its own motif. */
export const HEAVY_HP = 300,
  BOSS_HP = 1000;
/** Weighted enemies at which the threat is full. */
const FULL_THREAT = 30;
export interface Intensity {
  threat: number;
  /** 0–1: how close the enemies are to winning (front line and reactor damage, or the ring's crowd). */
  danger: number;
  /** 0–1: share of the mission's waves started. */
  arc: number;
  heavies: number;
  bosses: number;
}
export function intensityOf(state: GameState, content: ContentPack, mission: MissionDefinition): Intensity {
  const length = mission.map.path.length,
    ring = !!mission.circle;
  let threat = 0,
    front = 0,
    heavies = 0,
    bosses = 0;
  for (const e of state.enemies) {
    const base = content.enemies[e.type].hp,
      progress = length > 0 && !ring ? Math.min(1, e.distance / length) : 0;
    threat += Math.min(4, Math.max(0.5, base / 100)) * (0.5 + 0.5 * progress);
    front = Math.max(front, progress);
    if (base >= HEAVY_HP) heavies++;
    if (base >= BOSS_HP) bosses++;
  }
  const lost = mission.reactorEnergy > 0 ? 1 - Math.max(0, state.lives) / mission.reactorEnergy : 0,
    danger = ring ? state.enemies.length / Math.max(1, mission.circle!.limit) : 0.6 * front ** 2 + 0.8 * lost;
  return {
    threat: Math.min(1, threat / FULL_THREAT),
    danger: Math.min(1, Math.max(0, danger)),
    arc: mission.waves.length > 0 ? Math.min(1, state.wave / mission.waves.length) : 0,
    heavies,
    bosses,
  };
}
/** Bright while the field is safe, dark in danger; each colour holds a little past its threshold so it does not flicker. */
export function colorOf(danger: number, previous: Color): Color {
  if (danger < (previous === "bright" ? 0.25 : 0.2)) return "bright";
  if (danger > (previous === "dark" ? 0.5 : 0.6)) return "dark";
  return "drive";
}
/** Pad filter factor: brighter when safe and as the mission goes on; danger stays open (tense, not muffled). */
export const toneFor = (color: Color, arc: number) => (color === "bright" ? 1.2 : 1) * (1 + 0.3 * arc);
export function bossSpawned(events: readonly GameEvent[], state: GameState, content: ContentPack) {
  return events.some((e) => {
    if (e.type !== "spawn") return false;
    const enemy = state.enemies.find((x) => x.id === e.enemy);
    return !!enemy && content.enemies[enemy.type].hp >= BOSS_HP;
  });
}
