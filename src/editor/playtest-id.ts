import type { MissionDefinition } from "../core/types";

/** Playtest missions carry this id prefix, so they never collide with a real mission id. */
export const PLAYTEST_PREFIX = "playtest:";
export const isPlaytest = (m: MissionDefinition) => m.id.startsWith(PLAYTEST_PREFIX);
export const asPlaytest = (m: MissionDefinition): MissionDefinition => ({ ...m, id: PLAYTEST_PREFIX + m.id });
