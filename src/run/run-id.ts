import type { MissionDefinition } from "../core/types";
/** Prefix of every generated mission id; such a game is never recorded or remembered as a campaign mission. */
export const RUN_PREFIX = "run:";
export const isRunMission = (m: MissionDefinition) => m.id.startsWith(RUN_PREFIX);
/** The id of the mission a run plays at its current step. */
export const runMissionId = (run: { seed: number; step: number }) => `${RUN_PREFIX}${run.seed}:${run.step}`;
/** The 0-based step a run mission id names, or undefined for any other id. */
export function runStepOf(id: string) {
  const step = Number(id.startsWith(RUN_PREFIX) ? id.split(":")[2] : NaN);
  return Number.isInteger(step) ? step : undefined;
}
