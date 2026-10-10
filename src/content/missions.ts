import type { MissionDefinition, MissionSector } from "../core/types";
import { GLUTPASS, KERNFESTUNG, OUTPOST, SCHLEUSENRING, SPLITTERFELD } from "./maps";
import {
  GLUTPASS_WAVES,
  KERNFESTUNG_WAVES,
  SCHLEUSENRING_WAVES,
  SPLITTERFELD_WAVES,
  WAVES,
} from "./waves";
import { TIEFSEE } from "./sectors/abyss";
import { KREISLAUF } from "./sectors/circle";
import { ZAHNWERK } from "./sectors/gear";
import { MONDSEE } from "./sectors/tide";
import { DUENENMEER } from "./sectors/dune";
import { DSCHUNGEL } from "./sectors/jungle";
import { FROSTGUERTEL } from "./sectors/frost";
import { ORBITALDECK } from "./sectors/orbit";
import { SINGULARITAET } from "./sectors/rift";
import { KRISTALLHOEHLE } from "./sectors/geode";
import { GEWITTERFRONT } from "./sectors/storm";
import { VULKANKETTE } from "./sectors/volcano";
import { RUINENSTADT } from "./sectors/ruin";
import { SAEUREMOOR } from "./sectors/toxic";
const GRENZZONE: readonly MissionDefinition[] = [
  {
    id: "outpost-07",
    name: "Outpost 07",
    focus: "Build on bends to keep enemies in range for a long time",
    map: OUTPOST,
    waves: WAVES,
    startingCredits: 240,
    reactorEnergy: 20,
  },
  {
    id: "schleusenring",
    name: "Lock Ring",
    focus: "Use the inner bends so towers fire multiple times",
    map: SCHLEUSENRING,
    waves: SCHLEUSENRING_WAVES,
    startingCredits: 280,
    reactorEnergy: 20,
    hpGrowth: 0.45,
  },
  {
    id: "splitterfeld",
    name: "Shard Field",
    focus: "Overlap ranges carefully",
    map: SPLITTERFELD,
    waves: SPLITTERFELD_WAVES,
    startingCredits: 320,
    reactorEnergy: 20,
    hpGrowth: 0.6,
  },
  {
    id: "glutpass",
    name: "Ember Pass",
    focus: "Slow fast enemies and hold up groups",
    map: GLUTPASS,
    waves: GLUTPASS_WAVES,
    startingCredits: 340,
    reactorEnergy: 20,
    hpGrowth: 0.45,
  },
  {
    id: "kernfestung",
    name: "Core Fortress",
    focus: "Several defense zones and aura support",
    map: KERNFESTUNG,
    waves: KERNFESTUNG_WAVES,
    startingCredits: 400,
    reactorEnergy: 20,
    hpGrowth: 0.65,
  },
];
/** The campaign in play order; each sector is one tab in the mission dialog. */
export const SECTORS: readonly MissionSector[] = [
  { id: "grenzzone", name: "Border Zone", missions: GRENZZONE },
  FROSTGUERTEL,
  SAEUREMOOR,
  ORBITALDECK,
  RUINENSTADT,
  SINGULARITAET,
  DUENENMEER,
  TIEFSEE,
  GEWITTERFRONT,
  DSCHUNGEL,
  VULKANKETTE,
  KRISTALLHOEHLE,
  KREISLAUF,
  ZAHNWERK,
  MONDSEE,
];
export const MISSIONS: readonly MissionDefinition[] = SECTORS.flatMap((s) => s.missions);
export function missionById(id: string, missions: readonly MissionDefinition[] = MISSIONS) {
  return missions.find((m) => m.id === id);
}
/** 1-based position in the campaign; the list order is the mission order. */
export function missionNumber(mission: MissionDefinition, missions: readonly MissionDefinition[] = MISSIONS) {
  return missions.findIndex((m) => m.id === mission.id) + 1;
}
/** The sector that contains the mission, if the pack groups its missions. */
export function sectorOf(mission: MissionDefinition, sectors: readonly MissionSector[] = SECTORS) {
  return sectors.find((s) => s.missions.some((m) => m.id === mission.id));
}
/** A Kreislauf sector: every mission plays on a closed ring, so the mission dialog lists it as its own mode. */
export function isCircleSector(sector: MissionSector) {
  return sector.missions.every((m) => m.circle);
}
