import type { Game } from "../core/game";
import type { Command, Point } from "../core/types";
import type { ViewState } from "../render/scene";
import { TRAINING_SPOT } from "../content/training";
import { upgradeOptions } from "../core/upgrades";
// The Training coach: which step a new player is on, derived from the game state and the view, plus the few
// steps that only end with a click on "Next". Pure, so it never changes the simulation; `coach-view.ts` shows it.
export type StepId = "reactor" | "credits" | "pick" | "place" | "start" | "watch" | "second" | "select" | "upgrade" | "next-wave" | "speed" | "ready";
/** What the bubble points at: a DOM element (selector) or a board cell. */
export type CoachTarget = { el: string } | { cell: Point } | null;
export interface CoachStep {
  id: StepId;
  title: string;
  text: string;
  target: CoachTarget;
  /** The step ends with the bubble's "Next" button instead of an action in the game. */
  ack?: true;
  /** A board cell to highlight. */
  highlight?: Point;
  /** Why the wave may not start yet; absent when starting is fine. */
  holdStart?: string;
}
export interface CoachMemory {
  acked: Set<StepId>;
  skipped: boolean;
}
export const freshMemory = (): CoachMemory => ({ acked: new Set(), skipped: false });
type CoachGame = Pick<Game, "state" | "mission" | "content">;
type CoachView = Pick<ViewState, "build" | "selected" | "player">;
const HOLD_FIRST = "Place your first tower before you start the wave.";
/**
 * The current step of a Training run, or null when the coach has nothing to say (another mission, skipped, over).
 * `touch`: the player taps (ui/touch.ts), so the texts say "tap" and leave out keys.
 */
export function coachStep(game: CoachGame, view: CoachView, memory: CoachMemory, touch = false): CoachStep | null {
  const { state: s, mission, content } = game;
  if (!mission.manualWaves || memory.skipped || s.status === "won" || s.status === "lost") return null;
  const path = mission.map.path,
    reactor = path[path.length - 1],
    credits = s.wallets[view.player] ?? 0,
    towers = s.towers;
  const click = touch ? "Tap" : "Click";
  const step = (id: StepId, title: string, text: string, target: CoachTarget, extra: Partial<CoachStep> = {}): CoachStep => ({ id, title, text, target, ...extra });
  if (!memory.acked.has("reactor"))
    return step("reactor", "Protect the reactor", "Enemies march along the glowing path to your reactor. Every one that gets through drains its energy. At zero the mission is lost.", { cell: reactor }, { ack: true, highlight: reactor, holdStart: HOLD_FIRST });
  if (!memory.acked.has("credits"))
    return step("credits", "Credits build towers", `You have ◇ ${credits} credits. Towers cost credits, and every enemy you destroy pays more.`, { el: ".credits" }, { ack: true, holdStart: HOLD_FIRST });
  if (!towers.length) {
    if (!view.build)
      return step("pick", "Pick a tower", "Choose the Pulse tower in the build menu. It fires fast, precise shots at ground and air units.", { el: '[data-tower="pulse"]' }, { holdStart: HOLD_FIRST });
    return step("place", "Place it on the bend", `${touch ? "Tap the marked cell, then ✓" : "Click the marked cell (on a touch screen, tap it, then ✓)"}. Inside a bend, a tower covers two stretches of the path at once. Any free cell next to the path works too.`, { cell: TRAINING_SPOT }, { highlight: TRAINING_SPOT, holdStart: HOLD_FIRST });
  }
  if (s.wave === 0) return step("start", "Start the wave", "Your defense is ready. Start the first wave when you are.", { el: "#toolbar-start" });
  if (s.wave === 1 && s.status === "wave")
    return step("watch", "Kills pay credits", "Your tower fires on its own. Watch your credits rise with every enemy it destroys.", { el: ".credits" });
  if (s.wave === 1) {
    const cheapest = Math.min(...(mission.availableTowers ?? []).map((id) => content.towers[id].cost)),
      first = towers[0],
      upgraded = towers.some((t) => t.upgrades.length);
    if (towers.length < 2 && credits >= cheapest) {
      if (!view.build)
        return step("second", "Build a second tower", "The wave is over and you earned a bonus. Pick another tower: Pulse for damage or Cryo to slow enemies down.", { el: "#tower-list" }, { holdStart: "Build a second tower first." });
      return step("place", "Place it", `${click} a free cell next to the path where it covers a long stretch${touch ? ", then ✓" : " (on a touch screen, tap it, then ✓)"}.`, null, { holdStart: "Build a second tower first." });
    }
    // Only coached while affordable, so the step never points at a disabled button.
    if (!upgraded && towers.length >= 2 && credits >= cheapestUpgrade(game)) {
      const hold = "Upgrade a tower first.";
      if (view.selected === null)
        return step("select", "Select a tower", `${click} one of your towers to see its stats and upgrades.`, { cell: first }, { highlight: first, holdStart: hold });
      return step("upgrade", "Upgrade it", "Upgrades raise damage, range and fire rate. Buy the next level.", { el: "#tower-card [data-upgrade]" }, { holdStart: hold });
    }
    return step("next-wave", "Next wave", `Waves only start when you say so.${upgraded ? "" : ` ${click} a tower to upgrade it once you have the credits.`} Start wave 2.`, { el: "#toolbar-start" });
  }
  if (s.status === "wave" && !memory.acked.has("speed"))
    return step("speed", "Speed it up", `Double the game speed here, or pause${touch ? "" : " with Space"} to plan in peace. You know the basics now. Hold the line to the last wave!`, { el: "#speed-btn" }, { ack: true });
  if (s.status === "ready")
    return step("ready", `Wave ${s.wave + 1} of ${mission.waves.length}`, "Spend your credits on towers and upgrades, then start the next wave.", { el: "#toolbar-start" });
  return null;
}
/** The cheapest upgrade on offer for any built tower; Infinity when there is none. */
function cheapestUpgrade(game: CoachGame) {
  const costs = game.state.towers.flatMap((t) =>
    upgradeOptions(t, Infinity, game.content).filter((o) => o.status === "available").map((o) => o.definition!.cost),
  );
  return Math.min(Infinity, ...costs);
}
/** Null when the command may run now, else the reason it has to wait for the coach. */
export function coachRefusal(step: CoachStep | null, command: Pick<Command, "type">): string | null {
  return step?.holdStart && command.type === "start" ? step.holdStart : null;
}
