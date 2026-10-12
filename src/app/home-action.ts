import { missionById } from "../content/missions";
import type { MissionDefinition } from "../core/types";
/** What the home page's primary button does: begin, return to the game in memory, or replay the remembered mission. */
export type HomeAction = {
  kind: "start" | "resume" | "restart";
  title: string;
  subtitle: string;
  /** The mission the button shows on the preview map and, for "restart", loads. */
  mission: MissionDefinition;
};
export interface HomeSession {
  /** The game in memory (this page load): its mission, wave and whether it can still be continued. */
  mission: MissionDefinition;
  wave: number;
  status: "ready" | "wave" | "won" | "lost";
  /** A multiplayer session or a mission with towers or waves; false for a pristine game. */
  inProgress: boolean;
  /** Multiplayer cannot be restarted from the menu, only returned to. */
  multiplayer: boolean;
}
const pad = (n: number) => String(n).padStart(2, "0");
/**
 * Picks the primary action from what is really available. Only the mission id survives a reload, so after one
 * the button restarts that mission from wave 1 and never calls itself a saved game. A finished (won or lost)
 * game in memory is not resumable either: it offers a restart of that mission.
 */
export function homeAction(missions: readonly MissionDefinition[], last: string | undefined, session: HomeSession): HomeAction {
  const label = (m: MissionDefinition) => `${m.name}`;
  if (session.inProgress && (session.multiplayer || session.status === "ready" || session.status === "wave"))
    return {
      kind: "resume",
      title: "Resume Game",
      subtitle: `${label(session.mission)} · Wave ${pad(Math.max(1, session.wave))}`,
      mission: session.mission,
    };
  const remembered = session.inProgress ? session.mission : missionById(last ?? "", missions);
  if (remembered)
    return {
      kind: "restart",
      title: "Restart Last Mission",
      subtitle: `${label(remembered)} · Starts from wave 1`,
      mission: remembered,
    };
  return { kind: "start", title: "Start Playing", subtitle: "Begin your defense campaign", mission: missions[0] };
}
