import type { GameEvent, Point } from "../core/types";
import { clipDuration, clipFrame, type AnimationClip, type EnemyAnimationSet } from "./enemy-animations";
/**
 * Which clip and frame an animated enemy body shows (pure, render only). Times are on the scene's effect clock
 * (`fxClock`: real time, stopped while paused), so a paused game freezes every clip, a resumed one continues where
 * it stopped, and a clip plays at the same pace at every game speed (readable at 2×, never doubled).
 * Priority: hurt (a one-shot after a fresh hit), then move or idle. Death is not chosen here: a dying body has left
 * the state (`killedEnemies`, `EnemySprites.retire`).
 */
export const ANIMATION_TIMING = {
  /** A unit counts as standing only after this long without moving, so frames between ticks never flip to idle. */
  still: 0.25,
  /** Path distance (cells) a unit must cover between two frames to count as moving. */
  moved: 1e-4,
  /** After a hurt clip ends, the next one starts only after this gap: sustained fire or burning never loops it. */
  hurtGap: 0.45,
  /** A hit older than this when the unit becomes visible again (stealth, burrow) starts no hurt clip. */
  hurtLate: 0.1,
} as const;
/** Render-only memory of one animated body. */
export interface AnimationTrack {
  /** Path distance and effect time of the last observation. */
  distance: number;
  at: number;
  moving: boolean;
  movedAt: number;
  /** Start of the current or last hurt clip. */
  hurtAt: number;
  /** The latest hit already looked at, so one hit starts at most one clip. */
  seenHit: number;
  /** Loop phase (seconds), so neighbouring units do not move in step. */
  phase: number;
}
export const freshTrack = (distance: number, now: number, phase = 0): AnimationTrack => ({
  distance,
  at: now,
  moving: false,
  movedAt: -Infinity,
  hurtAt: -Infinity,
  seenHit: -Infinity,
  phase,
});
export interface AnimationInput {
  distance: number;
  now: number;
  /** Time of the unit's latest positive hit (`EnemyFeedback.struckAt`), or -Infinity. */
  struck: number;
  /** Hidden and burrowed units consume their hits without a hurt clip. */
  visible: boolean;
}
export interface AnimationPick {
  clip: AnimationClip;
  frame: number;
  hurt: boolean;
}
/**
 * Advances a track by one render frame and picks the clip and frame. `usable` tells whether a clip's texture
 * loaded. A missing move clip falls back to idle and the other way round; a missing hurt clip keeps the loop.
 * Undefined when neither loop is usable: the body falls back to its static art.
 */
export function animate(track: AnimationTrack, set: EnemyAnimationSet, usable: (clip: AnimationClip) => boolean, input: AnimationInput): AnimationPick | undefined {
  const { now } = input;
  // Only a frame that advanced the clock can change the motion state: a paused game keeps its clip and frame.
  if (now > track.at) {
    if (Math.abs(input.distance - track.distance) > ANIMATION_TIMING.moved) {
      track.moving = true;
      track.movedAt = now;
    } else if (now - track.movedAt >= ANIMATION_TIMING.still) track.moving = false;
    track.distance = input.distance;
    track.at = now;
  }
  const hurt = set.hurt && usable(set.hurt) ? set.hurt : undefined;
  if (input.struck > track.seenHit) {
    track.seenHit = input.struck;
    const ready = now - track.hurtAt >= (hurt ? clipDuration(hurt) : 0) + ANIMATION_TIMING.hurtGap;
    if (hurt && input.visible && ready && now - input.struck <= ANIMATION_TIMING.hurtLate) track.hurtAt = now;
  }
  if (hurt && now >= track.hurtAt && now - track.hurtAt < clipDuration(hurt)) return { clip: hurt, frame: clipFrame(hurt, now - track.hurtAt), hurt: true };
  const order = track.moving ? [set.move, set.idle] : [set.idle, set.move],
    loop = order.find((c): c is AnimationClip => c !== undefined && usable(c));
  // Loops run on the global clock plus the unit's phase, so leaving a hurt clip resumes them without a restart.
  return loop && { clip: loop, frame: clipFrame(loop, now + track.phase), hurt: false };
}
/** A confirmed kill: the victim's id, where it died and the colour of its type (`kill` event). */
export interface Kill {
  at: Point;
  color: number;
}
/**
 * Enemies killed in a drained event batch, by id. A `kill` event carries no id, but `applyDamage` pushes the lethal
 * `damage` event (with the id) and then, with no event in between, the `kill` event at the same coordinates. Only
 * that exact pair counts; a kill without it (a future code path, a pit or link edge case) is left out, so no death
 * animation is ever attached to a guessed unit. Leaks push no kill and never appear.
 */
export function killedEnemies(events: readonly GameEvent[]): Map<number, Kill> {
  const killed = new Map<number, Kill>();
  for (let i = 1; i < events.length; i++) {
    const e = events[i],
      d = events[i - 1];
    if (e.type !== "kill" || d.type !== "damage") continue;
    if (d.at.x !== e.at.x || d.at.y !== e.at.y || !(d.amount > 0) || killed.has(d.enemy)) continue;
    killed.set(d.enemy, { at: e.at, color: e.color });
  }
  return killed;
}
