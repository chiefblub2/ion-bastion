import type { TowerId, TurretStyle } from "../../core/types";
import type { Tilt } from "../muzzles";
import { MODELS } from "./models";
import type { Drawing } from "./kit";
import { sentinelAbove, sentinelBase, sentinelBelow, sentinelTurret } from "./sentinel";
import { siegeAbove, siegeBase, siegeBelow, siegeTurret } from "./siege";
import { coilSpire } from "./coil-spire";
import { furnaceTorch } from "./furnace-torch";
import { headsman } from "./headsman";
import { hydraulicPress } from "./hydraulic-press";
import { lensFork } from "./lens-fork";
import { pitMortar } from "./pit-mortar";
import { prismCradle } from "./prism-cradle";
import { railspear } from "./railspear";
import { reagentFlask } from "./reagent-flask";
import { rocketRack } from "./rocket-rack";
import { scattergun } from "./scattergun";
import { skyguard } from "./skyguard";
import { uplinkArray } from "./uplink-array";
/**
 * A tower drawn in the 3/4 tilt (projection in `TILTS`), in four parts drawn bottom to top:
 * - `base`: still, depends only on level and trim colour; baked like every tower body (`TowerBodies`).
 * - `below`: live parts under the turret (lights on the foundation, rings in a groove).
 * - `turret`: ink only, depending on level, colours, path, `tower.angle` and `kick` and nothing else (no clock, charge,
 *   id or glow), so `TurretCache` keeps it as a picture per aim angle and recoil step; `stillTurret` checks it.
 * - `above`: live parts over the turret (charge indicators, lamp light, heat, smoke) and all of the turret's glow.
 * Drawn live, the same three layers run in the same order, so a cached and a live turret look alike.
 */
export interface TiltedArt {
  base: Drawing;
  below: Drawing;
  turret: Drawing;
  above: Drawing;
}
/**
 * A tilted tower as drawn on the concept sheet (`models/`, the Control, Traps and Support towers): its four parts plus
 * the projection and barrel it was drawn for, which `TILTS` and `MUZZLES` repeat (`tilted.test.ts` keeps them equal).
 */
export interface TiltedConcept extends TiltedArt {
  tower: TowerId;
  /** Name of the look, e.g. "Chrono Glass". */
  name: string;
  /** One line on the idea. */
  idea: string;
  tilt: Tilt;
  reach?: (level: number) => number;
  recoil?: number;
  sides?: readonly number[];
  fan?: (level: number) => { count: number; step: number };
}
/** Every look by `visual.turret`; this type fails to compile while a style has no model. */
export const TILTED: Record<TurretStyle, TiltedArt> = {
  ...MODELS,
  // Pulse: the Hex Sentinel.
  barrel: { base: sentinelBase, below: sentinelBelow, turret: sentinelTurret, above: sentinelAbove },
  // Nova: the Siege Cannon.
  heavy: { base: siegeBase, below: siegeBelow, turret: siegeTurret, above: siegeAbove },
  twin: skyguard,
  scatter: scattergun,
  blade: headsman,
  rail: railspear,
  battery: rocketRack,
  mortar: pitMortar,
  flask: reagentFlask,
  uplink: uplinkArray,
  flame: furnaceTorch,
  lens: lensFork,
  coil: coilSpire,
  prism: prismCradle,
  hammer: hydraulicPress,
};
/** The whole live turret of a tilted tower: its three layers in order. */
export const liveTurret =
  (art: TiltedArt): Drawing =>
  (ctx) => {
    art.below(ctx);
    art.turret(ctx);
    art.above(ctx);
  };
