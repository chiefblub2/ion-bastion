import type { TiltedConcept } from "../tilted";
import { concept as frost } from "./frost";
import { concept as stasis } from "./stasis";
import { concept as acid } from "./acid";
import { concept as gravity } from "./gravity";
import { concept as jammer } from "./jammer";
import { concept as net } from "./net";
import { concept as plasma } from "./plasma";
import { concept as mesmer } from "./mesmer";
import { concept as amber } from "./amber";
import { concept as magnetar } from "./magnetar";
import { concept as cyclone } from "./cyclone";
import { concept as tether } from "./tether";
import { concept as shrink } from "./shrink";
import { concept as hex } from "./hex";
import { concept as siphon } from "./siphon";
import { concept as mine } from "./mine";
import { concept as spikes } from "./spikes";
import { concept as tar } from "./tar";
import { concept as snare } from "./snare";
import { concept as grill } from "./grill";
import { concept as spring } from "./spring";
import { concept as limpet } from "./limpet";
import { concept as pit } from "./pit";
import { concept as tripwire } from "./tripwire";
import { concept as barricade } from "./barricade";
import { concept as warp } from "./warp";
import { concept as arc } from "./arc";
import { concept as oil } from "./oil";
import { concept as grinder } from "./grinder";
import { concept as harpoon } from "./harpoon";
import { concept as aura } from "./aura";
import { concept as refinery } from "./refinery";
import { concept as detector } from "./detector";
import { concept as beacon } from "./beacon";
import { concept as dock } from "./dock";
import { concept as tracker } from "./tracker";
import { concept as overclock } from "./overclock";
import { concept as firectl } from "./firectl";
import { concept as armory } from "./armory";
import { concept as skylink } from "./skylink";
import { concept as nexus } from "./nexus";
import { concept as workshop } from "./workshop";
import { concept as vault } from "./vault";
import { concept as shieldgen } from "./shieldgen";
import { concept as recycler } from "./recycler";
/** The Control, Traps and Support towers drawn in the 3/4 tilt, by `visual.turret` (the Attack towers are registered in `tilted.ts`). */
export const MODELS = {
  crystal: frost,
  emitter: stasis,
  vat: acid,
  gravity: gravity,
  antenna: jammer,
  launcher: net,
  caster: plasma,
  spiral: mesmer,
  resin: amber,
  magnet: magnetar,
  fan: cyclone,
  tether: tether,
  shrinker: shrink,
  sigil: hex,
  siphon: siphon,
  mine: mine,
  spikes: spikes,
  tar: tar,
  snare: snare,
  grill: grill,
  spring: spring,
  limpet: limpet,
  pit: pit,
  tripwire: tripwire,
  barricade: barricade,
  warp: warp,
  plate: arc,
  slick: oil,
  grinder: grinder,
  harpoon: harpoon,
  aura: aura,
  refinery: refinery,
  radar: detector,
  beacon: beacon,
  dock: dock,
  tracker: tracker,
  clock: overclock,
  director: firectl,
  armory: armory,
  skylink: skylink,
  nexus: nexus,
  workshop: workshop,
  vault: vault,
  shieldgen: shieldgen,
  recycler: recycler,
} satisfies Record<string, TiltedConcept>;
