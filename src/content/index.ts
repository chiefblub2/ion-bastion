import type { ContentPack } from "../core/types";
import { ENEMIES } from "./enemies";
import { MISSIONS, SECTORS } from "./missions";
import { TOWERS } from "./towers";
/** The shipped game content. `Game` accepts any other pack, e.g. for tests or mods. */
export const DEFAULT_CONTENT: ContentPack = { towers: TOWERS, enemies: ENEMIES, missions: MISSIONS, sectors: SECTORS };
