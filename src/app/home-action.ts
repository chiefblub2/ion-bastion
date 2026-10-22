import { missionById } from "../content/missions";
import type { MissionDefinition } from "../core/types";
import { isPlaytest } from "../editor/playtest-id";
import type { CampaignRecord } from "./progress";
/**
 * What the home page's primary button does: begin, return to the game in memory, move on to the next unwon mission,
 * or replay the remembered one.
 */
export type HomeAction = {
  kind: "start" | "resume" | "continue" | "restart";
  title: string;
  subtitle: string;
  /** The mission the button shows on the preview map and, for "continue" and "restart", loads. */
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
/** The first unwon mission after `from` in its own mode (campaign or Circuit), wrapping round; undefined when all are won. */
export function nextUnwon(missions: readonly MissionDefinition[], from: MissionDefinition, record: CampaignRecord) {
  const mode = missions.filter((m) => !!m.circle === !!from.circle),
    at = mode.findIndex((m) => m.id === from.id);
  return [...mode.slice(at + 1), ...mode.slice(0, at + 1)].find((m) => !record[m.id]);
}
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
      title: "Resume Game",
      subtitle: `${session.mission.name} · Wave ${pad(Math.max(1, session.wave))}`,
      mission: session.mission,
    };
  const remembered = session.inProgress ? session.mission : missionById(last ?? "", missions);
  if (remembered && isPlaytest(remembered))
    return { kind: "restart", title: "Restart Playtest", subtitle: `${remembered.name} · Starts from wave 1`, mission: remembered };
  if (remembered) {
    const next = record[remembered.id] ? nextUnwon(missions, remembered, record) : undefined;
    if (next) return proceed(next);
    return {
      kind: "restart",
      title: record[remembered.id] || (session.inProgress && session.status === "won") ? "Play Again" : "Retry Mission",
      subtitle: `${remembered.name} · From wave 1`,
      mission: remembered,
    };
  }
  const first = missions.find((m) => !m.circle && !record[m.id]);
  if (first && Object.keys(record).length) return proceed(first);
  return { kind: "start", title: "Start Playing", subtitle: "Begin your defense campaign", mission: missions[0] };
}
