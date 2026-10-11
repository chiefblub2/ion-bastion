/// <reference types="vite/client" />
import type { EnemyId } from "../core/types";
/** Painted body art for an enemy type; types without an entry keep their procedural body. */
export interface EnemyArt {
  /** Phaser texture key, unique per artwork. */
  texture: string;
  /** File under `public/`, without the base path. */
  path: string;
  /**
   * Displayed square edge as a multiple of the body diameter (`2 × r`); default `ART_SCALE`. The art fills about
   * 88% of its transparent canvas, so 1.3 shows it about as wide as the procedural body's shadow (2.3 r).
   */
  scale?: number;
  /** Radians added to the heading if the art does not face right. */
  angleOffset?: number;
}
export const ART_SCALE = 1.3;
/** All art faces right (heading 0). Adding art for another type is one entry here plus its PNG in `public/assets/enemies/`. */
export const ENEMY_ART = {
  drone: { texture: "enemy:drone", path: "assets/enemies/drone.png" },
  // A slim side view: shown a little larger so the tiny runner stays readable.
  runner: { texture: "enemy:runner", path: "assets/enemies/runner.png", scale: 1.5 },
  tank: { texture: "enemy:tank", path: "assets/enemies/tank.png", scale: 1.4 },
  boss: { texture: "enemy:boss", path: "assets/enemies/boss.png" },
  glider: { texture: "enemy:glider", path: "assets/enemies/glider.png", scale: 1.4 },
  aegis: { texture: "enemy:aegis", path: "assets/enemies/aegis.png" },
} satisfies Partial<Record<EnemyId, EnemyArt>>;
const ART: Partial<Record<EnemyId, EnemyArt>> = ENEMY_ART;
/** The art of an enemy type, or undefined for a procedural one. */
export const artFor = (type: EnemyId): EnemyArt | undefined => ART[type];
/** URL of an art file below the configured Vite base path (`/` in dev, `base` of the build). */
export const artUrl = (art: EnemyArt, base: string = import.meta.env.BASE_URL) => `${base.endsWith("/") ? base : `${base}/`}${art.path}`;
