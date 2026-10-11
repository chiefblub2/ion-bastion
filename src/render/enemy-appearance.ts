import type { EnemyDrawContext } from "./enemies";
import { hash01 } from "./shapes";
/**
 * Pure looks of a painted enemy body: its tint (from status flags and a hit flash) and its idle motion. Both are
 * functions of the draw context and the effect clock only, so frames repeat and a paused game stands still.
 */
export interface BodyTint {
  color: number;
  /** A fill replaces the art's colours (hit flash); otherwise the colour multiplies them. */
  fill: boolean;
}
/** Multiplied over the art, so they only ever cool or warm it slightly. */
export const TINTS = {
  stunned: 0xa8e6ff,
  stunFlicker: 0xe4f8ff,
  burning: 0xffb38a,
  burningHot: 0xff8f5c,
  disrupted: 0xd6b0ff,
  disruptFlicker: 0xb4f2ff,
  slowed: 0xbcd4ff,
  vulnerable: 0xffd8a8,
  faceted: 0xd4fff8,
} as const;
/** A weak hit flashes a light grey, a strong one pure white. */
const FLASH_WEAK = 0xc4d0d8;
/** Linear mix of two colours, `k` from 0 (a) to 1 (b). */
export function mix(a: number, b: number, k: number) {
  const t = Math.min(1, Math.max(0, k)),
    channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}
/**
 * The body tint, by priority: a hit flash, then stunned, burning, disrupted, slowed, vulnerable, faceted (the
 * hardened window of a facet), else none (the art's own colours). `flash` is the current hit flash strength, 0..1.
 * Hidden and burrowed units have no painted body, so they get none.
 */
export function resolveEnemyTint(c: EnemyDrawContext, flash: number, now: number): BodyTint | undefined {
  if (c.hidden || c.traits.burrowed) return undefined;
  if (flash > 0) return { color: mix(FLASH_WEAK, 0xffffff, flash), fill: true };
  const s = c.status,
    id = c.enemy.id;
  // A short deterministic flicker: one frame step in five (stun) or three (disruption) shows the second colour.
  if (s.stunned) return { color: Math.floor(now * 14 + id) % 5 === 0 ? TINTS.stunFlicker : TINTS.stunned, fill: false };
  if (s.burning) return { color: mix(TINTS.burning, TINTS.burningHot, 0.5 + 0.5 * Math.sin(now * 9 + id)), fill: false };
  if (s.disrupted) return { color: Math.floor(now * 10 + id * 3) % 3 === 0 ? TINTS.disruptFlicker : TINTS.disrupted, fill: false };
  if (s.slowed) return { color: TINTS.slowed, fill: false };
  if (s.vulnerable) return { color: TINTS.vulnerable, fill: false };
  if (c.traits.faceted) return { color: TINTS.faceted, fill: false };
  return undefined;
}
/** Idle motion limits: flyers hover by up to `HOVER` px, every body breathes by up to `PULSE` of its size. */
export const HOVER = 1.2;
export const PULSE = 0.02;
export interface BodyMotion {
  /** Pixels added to the lifted body position (screen y). */
  dy: number;
  /** Factor on the base display size. */
  scale: number;
}
/**
 * Idle motion of a painted body: flyers hover slowly; walkers breathe a little, faster while sprinting or surging;
 * heavy units (size ≥ 0.3) only pulse slowly and slightly. The phase comes from the enemy id, so units differ.
 */
export function bodyMotion(c: EnemyDrawContext, now: number): BodyMotion {
  const phase = hash01(c.enemy.id, 17) * Math.PI * 2;
  if (c.air) return { dy: Math.sin(now * 2.4 + phase) * HOVER, scale: 1 + 0.6 * PULSE * Math.sin(now * 2.4 + phase + 1.3) };
  if (c.definition.size >= 0.3) return { dy: 0, scale: 1 + 0.3 * PULSE * Math.sin(now * 1.7 + phase) };
  const rush = c.traits.sprinting || c.traits.surging;
  return { dy: 0, scale: 1 + (rush ? PULSE : 0.6 * PULSE) * Math.sin(now * (rush ? 12 : 6.5) + phase) };
}
