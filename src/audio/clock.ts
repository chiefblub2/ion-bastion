// The music's beat grid on the audio clock (seconds of AudioContext.currentTime). 4/4 time.

/** Note value of a grid step: 32 = 1/32, 16 = 1/16, 8 = 1/8, 4 = a beat, 1 = a bar; 0 plays at once. */
export type Grid = 32 | 16 | 8 | 4 | 1 | 0;
export interface Clock {
  /** Audio time of bar 0. */
  origin: number;
  bpm: number;
}
/** Small tolerance, so a time exactly on a slot stays on it despite float error. */
const EPS = 1e-9;
export const stepLength = (c: Clock, grid: Exclude<Grid, 0>) => ((60 / c.bpm) * 4) / grid;

/** The first slot of `grid` at or after `now`; instant cues play at `now`. */
export function nextSlot(c: Clock, now: number, grid: Grid) {
  if (grid === 0) return now;
  const len = stepLength(c, grid);
  return c.origin + Math.ceil((now - c.origin) / len - EPS) * len;
}
export const barAt = (c: Clock, time: number) => Math.floor((time - c.origin) / stepLength(c, 1) + EPS);
export const stepAt = (c: Clock, time: number) => Math.floor((time - c.origin) / stepLength(c, 16) + EPS);
/** A new tempo that starts at the next bar line of the old one, so the music never stumbles mid-bar. */
export const rebase = (c: Clock, now: number, bpm: number): Clock => ({ origin: nextSlot(c, now, 1), bpm });
