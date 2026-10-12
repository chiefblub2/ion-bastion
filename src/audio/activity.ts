import { FAMILIES, type Family } from "./families";
// How busy each tower family is: every shot adds a little, and the level halves without shots.

export const HALF_LIFE = 1.5,
  PER_SHOT = 0.06;
export type Levels = Record<Family, number>;
export const silent = (): Levels => Object.fromEntries(FAMILIES.map((f) => [f, 0])) as Levels;
export class Activity {
  readonly levels: Levels = silent();
  private at: number | null = null;
  update(shots: Partial<Record<Family, number>>, now: number) {
    const keep = this.at === null ? 1 : 0.5 ** (Math.max(0, now - this.at) / HALF_LIFE);
    for (const f of FAMILIES) this.levels[f] = Math.min(1, this.levels[f] * keep + (shots[f] ?? 0) * PER_SHOT);
    this.at = now;
  }
}
