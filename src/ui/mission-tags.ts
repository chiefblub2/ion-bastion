import type { ContentPack, MissionDefinition } from "../core/types";
/** Tags a mission card shows; each is derived from the mission's content, nothing is rated or invented. */
export function missionTags(m: MissionDefinition, content: ContentPack): string[] {
  const types = new Set(m.waves.flatMap((w) => w.groups.map((g) => g.type))),
    tags: string[] = [];
  if (m.circle) tags.push("Circuit");
  if ([...types].some((id) => content.enemies[id].layer === "air")) tags.push("Air threats");
  if (types.has("boss")) tags.push("Boss");
  if (m.availableTowers) tags.push("Restricted towers");
  return tags;
}
