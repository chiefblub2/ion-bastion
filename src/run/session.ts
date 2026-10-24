import type { ContentPack } from "../core/types";
import { runMissionId } from "./run-id";
import { finishMission, type MissionResult } from "./run";
import { loadRun, recordRun, saveJournal, saveRun } from "./storage";
/**
 * Settles the stored run when its mission ends (called from the app's events hook): a win opens the reward or
 * completes the run, a loss ends it; a finished run goes into the record. Another mission id changes nothing, so a
 * stale game (an older run's mission) never moves the current run.
 */
export function settleRun(missionId: string, result: MissionResult, content: ContentPack) {
  const run = loadRun(content);
  if (!run || run.phase !== "mission" || runMissionId(run) !== missionId) return run;
  const next = finishMission(run, result, content);
  saveRun(next);
  saveJournal(undefined);
  if (next.phase === "won" || next.phase === "lost") recordRun(next);
  return next;
}
