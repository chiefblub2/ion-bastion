import type { Concept } from "./types";
import { concept as flak } from "./flak";
import { concept as shrapnel } from "./shrapnel";
import { concept as executioner } from "./executioner";
import { concept as lance } from "./lance";
import { concept as skyburst } from "./skyburst";
import { concept as mortar } from "./mortar";
import { concept as catalyst } from "./catalyst";
import { concept as orbital } from "./orbital";
import { concept as inferno } from "./inferno";
import { concept as focus } from "./focus";
import { concept as tesla } from "./tesla";
import { concept as decay } from "./decay";
import { concept as quake } from "./quake";
/** Sheet order: batches A (barrel guns), B (launchers), C (nozzles, optics), D (radial). */
export const CONCEPTS: Concept[] = [flak, shrapnel, executioner, lance, skyburst, mortar, catalyst, orbital, inferno, focus, tesla, decay, quake];
