import { isRunning, type Game } from "../core/game";
import type { MatchCommand } from "../core/match";
import type { CommandResult } from "../core/types";
import type { Applied } from "../net/lockstep";
import type { Driver, ViewState } from "../render/scene";
import type { Coach } from "../ui/coach-view";
import { type Interface, renderMission } from "../ui/interface";
import { describeResult } from "../ui/messages";
import { playerName } from "../ui/players";
import { pageOf, towerOrder } from "../ui/tower-pages";
import type { Audio } from "./audio";
import { createCoop } from "./coop";
import { createDialogs } from "./dialogs";
import { createGameInput } from "./game-input";
import { createMenuNav } from "./menu-nav";
import { rememberMission } from "./progress";
import { journalCommand, persist } from "./run-journal";
import { GAME, HOME } from "./screens";
interface InputDeps {
  game: Game;
  view: ViewState;
  ui: Interface;
  audio: Audio;
  /** Redraws the battlefield for a new mission map. */
  reloadBattlefield: () => void;
  /** Refits the canvas once the game view is visible again. */
  fitBattlefield: () => void;
  /** Co-op swaps in the lockstep driver; null restores the local one. */
  setDriver: (driver: Driver | null) => void;
  toggleFullscreen: () => Promise<void>;
  /** True while the app is in full screen. */
  isFullscreen: () => boolean;
  /** The Training coach: holds the wave start back until its step and starts over with the mission. */
  coach: Coach;
}
/**
 * Turns clicks, keys and tab changes into commands and view changes. The concerns live apart: `game-input.ts` (build
 * mode, selection, toolbar and hotkeys), `menu-nav.ts` (menu pages, atlas, the way between menu and game) and
 * `menu-keys.ts` (the codices' and the atlas's keyboard); this file routes commands and the shared document listeners.
 */
export function createInput({ game, view, ui, audio, reloadBattlefield, fitBattlefield, setDriver, toggleFullscreen, isFullscreen, coach }: InputDeps) {
  /** In multiplayer the command goes to the relay and takes effect when its frame arrives. */
  function execute(c: MatchCommand): CommandResult {
    if (coop.active()) {
      coop.send(c);
      return { ok: true, code: "command-sent" };
    }
    // Versus-only commands; without a match there is nobody to send to.
    if (c.type === "ready" || c.type === "send") return { ok: false, code: "send-unavailable" };
    const held = coach.refusal(c);
    if (held) {
      ui.notice(held, true);
      audio.cue("reject");
      return { ok: false, code: "training-step" };
    }
    const result = game.command(c);
    if (result.ok) journalCommand(game, c);
    applied({ command: c, result, player: view.player });
    return result;
  }
  /** Follow-up of an applied command: notice, view reset and redraw. */
  function applied({ command: c, result, player }: Applied) {
    const own = player === view.player,
      versus = !!coop.match(),
      shared = c.type === "mission" || c.type === "restart" || c.type === "playtest" || c.type === "run" || (!versus && (c.type === "start" || c.type === "pause"));
    // In versus, the others' commands act on their own fields; only a send aimed at us is news.
    if (versus && !own && !shared) {
      if (c.type === "send" && result.ok && result.params?.target === view.player + 1) {
        ui.notice(`${playerName(player)} sends you ${result.params.enemy}!`, true);
        audio.cue("incoming");
      }
      ui.refresh();
      return;
    }
    if (own || (shared && result.ok)) ui.notice(`${own ? "" : `${playerName(player)}: `}${describeResult(result)}`, own && !result.ok);
    if (own && !result.ok) audio.cue("reject");
    if ((c.type === "restart" || c.type === "mission" || c.type === "playtest" || c.type === "run") && result.ok) {
      view.selected = null;
      view.enemy = null;
      view.pending = undefined;
      view.build = towerOrder(game)[0];
      view.page = pageOf(game.content.towers[view.build]);
      if (!coop.active()) view.speed = 1;
      // Training lets the player pick the first tower from the menu themselves.
      if (game.mission.manualWaves) view.build = null;
      coach.reset();
    }
    if ((c.type === "mission" || c.type === "playtest" || c.type === "run") && result.ok) {
      // "Restart Last Mission" stays about the campaign; Training has its own button.
      // Playtests and run missions are never remembered.
      if (c.type === "mission" && !game.mission.manualWaves) rememberMission(c.id);
      nav.missionLoaded();
      renderMission(game);
      reloadBattlefield();
      // A launch or a host's mission change takes every player from the menu into the game.
      if (coop.active()) screens.show(GAME);
      screens.syncUrl();
    }
    if (c.type === "sell" && result.ok && view.selected === c.id) view.selected = null;
    ui.refresh();
  }
  const dialogs = createDialogs(game, execute, () => !coop.active());
  const coop = createCoop({ game, view, ui, pickMission: () => nav.pickForRoom(), applied, setDriver });
  const nav = createMenuNav({ game, ui, coop, coach, execute, fitBattlefield });
  const screens = nav.screens;
  const play = createGameInput({ game, view, ui, audio, dialogs, execute, multiplayer: coop.active, setSpeed: coop.setSpeed, toggleFullscreen, isFullscreen });
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    // The brand links home; a plain click stays in the app instead of reloading it.
    const link = target.closest("a.brand");
    if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      screens.show(HOME);
      return;
    }
    if (nav.clickArea(target)) return;
    // The compact layout's side rail shows the next wave as icons; a tap opens the full forecast over the board.
    const forecast = target.closest("#wave-forecast");
    if (forecast && document.documentElement.classList.contains("is-compact")) {
      forecast.classList.toggle("open");
      return;
    }
    const b = target.closest("button");
    if (!b) return;
    // Every entry of the ⚙ menu closes it; Resume also resumes.
    if (b.closest("#game-menu")) play.closeGameMenu(b.id === "menu-resume");
    if (!nav.click(b)) play.click(b);
  });
  document.addEventListener("keydown", (e) => {
    if (dialogs.anyOpen() || e.altKey || e.metaKey || e.ctrlKey || e.repeat) return;
    // The game's hotkeys belong to the game view; on the start screen Esc leads back from a page.
    const current = screens.current();
    if (current.view === "menu") {
      if (e.key === "Escape" && current.page !== "home") screens.back();
      return;
    }
    play.key(e);
  });
  // The long codex pages offer a way back to their tabs once scrolled well down.
  addEventListener("scroll", () => document.documentElement.classList.toggle("scrolled-far", scrollY > 1200), { passive: true });
  document.addEventListener("visibilitychange", () => {
    // In multiplayer the others keep playing; pausing stays an explicit choice.
    if (document.hidden && !coop.active() && isRunning(game.state) && !game.state.paused) execute({ type: "pause" });
    if (document.hidden) persist(game);
  });
  window.addEventListener("pagehide", () => persist(game));
  const { chooseCell, chooseEnemy, cancel, confirmBuild, dropPending } = play;
  return { execute, chooseCell, chooseEnemy, cancel, confirmBuild, dropPending, screens, match: coop.match };
}
