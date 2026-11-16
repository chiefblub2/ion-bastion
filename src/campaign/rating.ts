import type { GameState, MissionDefinition } from "../core/types";

export type Stars = 1 | 2 | 3;

/**
 * Star thresholds. Reactor missions: the share of reactor energy left for 3 and 2 stars (at least). Circle missions:
 * the fullest the ring may get for 3 and 2 stars (at most).
 */
export const STAR_SHARE = { reactor: [0.9, 0.5], circle: [0.5, 0.8] } as const;
/** A mission's thresholds for 3 and 2 stars, and whether they are a floor (energy left) or a ceiling (ring fill). */
export const starThresholds = (mission: Pick<MissionDefinition, "circle">) =>
  mission.circle ? { kind: "ring" as const, three: STAR_SHARE.circle[0], two: STAR_SHARE.circle[1] } : { kind: "energy" as const, three: STAR_SHARE.reactor[0], two: STAR_SHARE.reactor[1] };

/**
 * Stars for a won mission. Reactor missions rate the energy left; circle missions the fullest the ring got
 * (`peak`, the highest share of `circle.limit` alive at once). App-side only: never part of the simulation.
 */
export function missionStars(mission: MissionDefinition, state: Pick<GameState, "lives">, peak?: number): Stars {
  const { three, two } = starThresholds(mission);
  if (mission.circle) {
    if (peak === undefined) return 1;
    return peak <= three ? 3 : peak <= two ? 2 : 1;
  }
  const ratio = Math.min(1, state.lives / mission.reactorEnergy);
  return ratio >= three ? 3 : ratio >= two ? 2 : 1;
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
