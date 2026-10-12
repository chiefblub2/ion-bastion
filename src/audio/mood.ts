import type { GameStatus, MapTheme } from "../core/types";
import type { View } from "./cues";

export type DroneId = MapTheme | "menu";
export interface Mood {
  drone: DroneId;
  /** Ambience gain, 0–1. */
  level: number;
}
/** Menu bed, a quiet bed while paused, and a swell with the enemies on the field during a wave. */
export function moodOf(m: { view: View; theme: MapTheme; status: GameStatus; paused: boolean; enemies: number }): Mood {
  if (m.view === "menu") return { drone: "menu", level: 0.6 };
  if (m.paused) return { drone: m.theme, level: 0.25 };
  if (m.status === "wave") return { drone: m.theme, level: 0.7 + 0.3 * Math.min(1, m.enemies / 30) };
  return { drone: m.theme, level: 0.5 };
}
