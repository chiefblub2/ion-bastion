import type { EnemyId, GameEvent, GameState } from "../core/types";
// What the debrief tells about a play beyond the final state: which enemy types reached the reactor. Render-side and
// read-only (like `PeakTracker`): it reads the drained events and never changes the state.

/** Counts leaks per enemy type over one play; reset when the state object is swapped (restart, new mission). */
export class MissionTally {
  private state: object | null = null;
  /** Enemies of each type that reached the reactor. */
  leaks: Partial<Record<EnemyId, number>> = {};
  /** Reactor energy each type took. */
  energy: Partial<Record<EnemyId, number>> = {};
  /** The wave of the last leak; 0 without one. */
  lastLeakWave = 0;
  observe(state: GameState, events: readonly GameEvent[]) {
    if (state !== this.state) {
      this.state = state;
      this.leaks = {};
      this.energy = {};
      this.lastLeakWave = 0;
    }
    for (const e of events) {
      if (e.type !== "leak") continue;
      this.leaks[e.enemy] = (this.leaks[e.enemy] ?? 0) + 1;
      this.energy[e.enemy] = (this.energy[e.enemy] ?? 0) + e.amount;
      this.lastLeakWave = state.wave;
    }
  }
}
