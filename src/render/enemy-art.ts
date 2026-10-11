/// <reference types="vite/client" />
import type { EnemyId } from "../core/types";
/** Painted body art for an enemy type; types without an entry keep their procedural body. */
export interface EnemyArt {
  /** Phaser texture key, unique per artwork. */
  texture: string;
  /** File under `public/`, without the base path. */
  path: string;
  /**
   * Displayed square edge as a multiple of the body diameter (`2 × r`); default `ART_SCALE`. Every artwork spans about
   * 85% of its transparent canvas, so 1.3 shows it about as wide as the procedural body's shadow (2.3 r).
   */
  scale?: number;
  /** Radians added to the heading if the art does not face right. */
  angleOffset?: number;
  /**
   * Body radii the art sits behind the enemy's position, along its heading. Worms: the art shows the whole chain,
   * while the procedural head leads at the position and its segments (and their shadows) trail behind.
   */
  shift?: number;
}
type Tuning = Pick<EnemyArt, "scale" | "angleOffset" | "shift">;
export const ART_SCALE = 1.3;
/** Slender art (less than half its canvas high) is shown a little larger, so it keeps some body. */
const SLENDER = { scale: 1.4 };
/**
 * Every enemy with art in `public/assets/enemies/<id>.png`; all art faces right (heading 0). Adding art for another
 * type is one entry here plus its PNG. Scales were tuned against the battlefield screenshots.
 */
const PAINTED = {
  aegis: {},
  airship: SLENDER,
  ant: SLENDER,
  ashwing: SLENDER,
  berserker: {},
  blinker: SLENDER,
  boss: {},
  broodmother: {},
  bulwark: {},
  bunker: {},
  buoy: {},
  burrower: SLENDER,
  chainling: {},
  cinderwing: {},
  cog: {},
  colossus: {},
  crab: {},
  decoy: {},
  drafter: {},
  drone: {},
  ember: SLENDER,
  flare: {},
  gale: {},
  gapper: {},
  glider: { scale: 1.4 },
  golem: {},
  hauler: SLENDER,
  hopper: {},
  hydra: {},
  hydraling: {},
  insulator: {},
  jelly: {},
  leaper: {},
  martyr: {},
  mender: {},
  mirrorwing: {},
  // Worms: art length matches the procedural chain (head at the position, segments trailing).
  mole: { scale: 2.45, shift: 1.2 },
  molter: {},
  // An obelisk standing upright in its art: turned so its tip leads.
  monolith: { angleOffset: Math.PI / 2 },
  moth: {},
  nautilus: {},
  nullbearer: {},
  pebble: {},
  phantom: {},
  phasewing: {},
  piston: {},
  prism: {},
  raptor: {},
  // A slim side view: shown a little larger so the tiny runner stays readable.
  runner: { scale: 1.5 },
  salamander: { scale: 1.95, shift: 0.75 },
  sapper: {},
  scarab: {},
  shade: {},
  skater: SLENDER,
  skimmer: {},
  slime: SLENDER,
  soulspark: {},
  sparkworm: { scale: 2.9, shift: 1.6 },
  splitter: {},
  staticloud: {},
  stormbird: {},
  stormcell: {},
  tank: { scale: 1.4 },
  thornback: {},
  tidewing: {},
  twin: {},
  veiler: {},
  warden: {},
  warlord: {},
  warpdrone: {},
  wisp: {},
  wolf: SLENDER,
} satisfies Partial<Record<EnemyId, Tuning>>;
export const ENEMY_ART: Readonly<Partial<Record<EnemyId, EnemyArt>>> = Object.fromEntries(
  Object.entries(PAINTED).map(([id, tuning]) => [id, { texture: `enemy:${id}`, path: `assets/enemies/${id}.png`, ...tuning }]),
);
/** The art of an enemy type, or undefined for a procedural one. */
export const artFor = (type: EnemyId): EnemyArt | undefined => ENEMY_ART[type];
/** URL of an art file below the configured Vite base path (`/` in dev, `base` of the build). */
export const artUrl = (art: EnemyArt, base: string = import.meta.env.BASE_URL) => `${base.endsWith("/") ? base : `${base}/`}${art.path}`;
