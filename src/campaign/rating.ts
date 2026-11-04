import type { GameState, MissionDefinition } from "../core/types";

export type Stars = 1 | 2 | 3;

/**
 * Stars for a won mission. Reactor missions rate the energy left; circle missions the fullest the ring got
 * (`peak`, the highest share of `circle.limit` alive at once). App-side only: never part of the simulation.
 */
export function missionStars(mission: MissionDefinition, state: Pick<GameState, "lives">, peak?: number): Stars {
  if (mission.circle) {
    if (peak === undefined) return 1;
    return peak <= 0.5 ? 3 : peak <= 0.8 ? 2 : 1;
  }
  const ratio = Math.min(1, state.lives / mission.reactorEnergy);
  return ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
}

/** Follows the fullest the ring got during one run; reads the state only. Reset it when the state is swapped. */
export class PeakTracker {
  private state: object | null = null;
  peak = 0;
  observe(mission: MissionDefinition, state: GameState) {
    if (state !== this.state) {
      this.state = state;
      this.peak = 0;
    }
    if (mission.circle && state.status === "wave")
      this.peak = Math.max(this.peak, state.enemies.length / mission.circle.limit);
  }
}

/** The star row as text, e.g. "★★☆". */
export const starText = (stars: number) => "★".repeat(stars) + "☆".repeat(3 - stars);
