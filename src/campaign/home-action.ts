import { missionById } from "../content/missions";
import type { MissionDefinition } from "../core/types";
import { isPlaytest } from "../editor/playtest-id";
import { isRunMission } from "../run/run-id";
import type { CampaignRecord } from "./record";
import type { Lock } from "./campaign-unlock";
import { nextMission } from "./next-mission";
/**
 * What the home page's primary button does: return to the game in memory, move on to the next unwon mission, replay
 * the remembered one, or, with nothing to continue, open the Play page ("play").
 */
export type HomeAction = {
  kind: "play" | "resume" | "continue" | "restart" | "run";
  title: string;
  subtitle: string;
  /** The mission the button shows on the preview map and, for "continue" and "restart", loads; "run" opens the Run page.
   * For "play" it is only a placeholder: the home page shows no preview then. */
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
 * Picks the primary action from what is really available. Only the mission id survives a reload, so after one the
 * button never calls itself a saved game: a won remembered mission moves on to the next unwon one of its mode
 * ("continue"), any other is replayed from wave 1 ("restart"). A finished (won or lost) game in memory is not
 * resumable either.
 */
export function homeAction(
  missions: readonly MissionDefinition[],
  last: string | undefined,
  session: HomeSession,
  record: CampaignRecord = {},
  /** Locked campaign missions (`campaignLocks`), never offered by "continue". */
  locks?: ReadonlyMap<string, Lock>,
): HomeAction {
  const number = (m: MissionDefinition) => pad(missions.findIndex((n) => n.id === m.id) + 1);
  const proceed = (m: MissionDefinition): HomeAction => ({
    kind: "continue",
    title: m.circle ? "Continue Circuit" : "Continue Campaign",
    subtitle: `Mission ${number(m)} · ${m.name}`,
    mission: m,
  });
  if (session.inProgress && (session.multiplayer || session.status === "ready" || session.status === "wave"))
    return {
      kind: "resume",
      title: isRunMission(session.mission) ? "Resume Run" : "Resume Mission",
      subtitle: `${session.mission.name} · Wave ${pad(Math.max(1, session.wave))}`,
      mission: session.mission,
    };
  const remembered = session.inProgress ? session.mission : missionById(last ?? "", missions);
  // A finished run mission is never replayed: the run goes on (or is summed up) on its own page.
  if (remembered && isRunMission(remembered))
    return { kind: "run", title: "Continue Run", subtitle: `${remembered.name} · Back to the run`, mission: remembered };
  if (remembered && isPlaytest(remembered))
    return { kind: "restart", title: "Restart Playtest", subtitle: `${remembered.name} · Starts from wave 1`, mission: remembered };
  if (remembered) {
    const next = record[remembered.id] ? nextMission(missions, record, { after: remembered, locks }) : undefined;
    if (next) return proceed(next);
    return {
      kind: "restart",
      title: record[remembered.id] || (session.inProgress && session.status === "won") ? "Play Again" : "Retry Mission",
      subtitle: `${remembered.name} · From wave 1`,
      mission: remembered,
    };
  }
  const first = nextMission(missions, record, { circle: false, locks });
  if (first && Object.keys(record).length) return proceed(first);
  return { kind: "play", title: "Play", subtitle: "Campaign · Run · Circuit · Multiplayer", mission: missions[0] };
}
