import type { MissionDefinition } from "../core/types";
import { PLAYTEST_PREFIX } from "../editor/playtest-id";
import { RUN_PREFIX } from "../run/run-id";

/**
 * The campaign mission behind `id` when it is briefed before it starts (`/#briefing`): solo play, the Arsenal in force
 * (no `?unlock=all`), a campaign mission of `missions` (not the Circuit, Training, a playtest or a Run mission).
 */
export function briefable(id: string, missions: readonly MissionDefinition[], { solo, unlockAll }: { solo: boolean; unlockAll: boolean }): MissionDefinition | undefined {
  if (!solo || unlockAll || id.startsWith(PLAYTEST_PREFIX) || id.startsWith(RUN_PREFIX)) return undefined;
  const m = missions.find((x) => x.id === id);
  return m && !m.circle ? m : undefined;
}
