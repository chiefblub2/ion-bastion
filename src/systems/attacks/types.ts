import type { AttackSpec, Enemy, Point, Sim, Tower, TowerId } from "../../core/types";
import type { DamageSource } from "../damage";
/** A numeric attack parameter that content and upgrades may set. */
export interface ParamRule {
  label: string;
  valid: (value: number) => boolean;
  unit?: string;
  /** Display transform, e.g. a speed factor shown as slowdown percent. */
  show?: (value: number) => number;
}
/** Where a hit lands: on an enemy (homing, instant) or on a point (shell). */
export interface Impact {
  enemy?: Enemy;
  at: Point;
  /** Instant attacks only: the firing tower's position and current range. */
  from?: Point;
  reach?: number;
}
export interface AttackModule<S extends AttackSpec = AttackSpec> {
  /** `point`: shells fly to the fire-time position; `none`: support tower. */
  aim: "enemy" | "point" | "none";
  projectile: "optional" | "forbidden";
  /** Every numeric parameter of the spec; all of them are upgradable. */
  params: { [K in Exclude<keyof S, "kind">]?: ParamRule };
  /** Dead zone around the tower in cells; enemies closer than this are never targeted. */
  minRange?: (spec: S) => number;
  /** Only traps may use this kind; validation rejects it elsewhere. */
  trapOnly?: true;
  /** Different enemies hit per salvo, the chosen target first; 1 when absent. */
  volley?: (spec: S) => number;
  /** Extra checks beyond `params`; returns an error message. */
  validate?: (spec: S) => string | undefined;
  /**
   * Picks the target among enemies in range, sorted by the default priority
   * (furthest along the path first). Without it the first one is taken.
   */
  choose?: (sim: Sim, type: TowerId, from: Point, reach: number, candidates: Enemy[], spec: S, tower: Tower) => Enemy;
  apply: (sim: Sim, src: DamageSource, impact: Impact, damage: number, spec: S) => void;
}
