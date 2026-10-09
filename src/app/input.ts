import type { Game } from "../core/game";
import type { CommandResult, EnemyId, TowerId } from "../core/types";
import type { MatchCommand } from "../core/match";
import { type Interface, nextMission, renderMission, renderMissionList, TOWER_KEYS } from "../ui/interface";
import { describeResult } from "../ui/messages";
import { playerName } from "../ui/players";
import type { Driver, ViewState } from "../render/scene";
import type { Applied } from "../net/lockstep";
import type { Audio } from "./audio";
import { createCoop } from "./coop";
import { createDialogs } from "./dialogs";
interface InputDeps {
  game: Game;
  view: ViewState;
  ui: Interface;
  audio: Audio;
  /** Redraws the battlefield for a new mission map. */
  reloadBattlefield: () => void;
  /** Co-op swaps in the lockstep driver; null restores the local one. */
  setDriver: (driver: Driver | null) => void;
  toggleFullscreen: () => Promise<void>;
  /** True while the app is in full screen. */
  isFullscreen: () => boolean;
}
/** Turns clicks, keys and tab changes into commands and view changes. */
export function createInput({ game, view, ui, audio, reloadBattlefield, setDriver, toggleFullscreen, isFullscreen }: InputDeps) {
  /** In multiplayer the command goes to the relay and takes effect when its frame arrives. */
  function execute(c: MatchCommand): CommandResult {
    if (coop.active()) {
      coop.send(c);
      return { ok: true, code: "command-sent" };
    }
    // Versus-only commands; without a match there is nobody to send to.
    if (c.type === "ready" || c.type === "send") return { ok: false, code: "send-unavailable" };
    const result = game.command(c);
    applied({ command: c, result, player: view.player });
    return result;
  }
  /** Follow-up of an applied command: notice, view reset and redraw. */
  function applied({ command: c, result, player }: Applied) {
    const own = player === view.player,
      versus = !!coop.match(),
      shared = c.type === "mission" || c.type === "restart" || (!versus && (c.type === "start" || c.type === "pause"));
    // In versus, the others' commands act on their own fields; only a send aimed at us is news.
    if (versus && !own && !shared) {
      if (c.type === "send" && result.ok && result.params?.target === view.player + 1)
        ui.notice(`${playerName(player)} schickt dir ${result.params.enemy}!`, true);
      ui.refresh();
      return;
    }
    if (own || (shared && result.ok)) ui.notice(`${own ? "" : `${playerName(player)}: `}${describeResult(result)}`, own && !result.ok);
    if ((c.type === "restart" || c.type === "mission") && result.ok) {
      view.selected = null;
      view.build = game.availableTowers()[0];
      if (!coop.active()) view.speed = 1;
    }
    if (c.type === "mission" && result.ok) {
      renderMission(game);
      reloadBattlefield();
    }
    if (c.type === "sell" && result.ok && view.selected === c.id) view.selected = null;
    ui.refresh();
  }
  const dialogs = createDialogs(game, execute, () => !coop.active());
  const coop = createCoop({ game, view, ui, dialogs, applied, setDriver });
  function choose(type: TowerId) {
    view.build = type;
    view.selected = null;
    ui.notice(`${game.content.towers[type].name} ausgewählt. Klicke auf ein freies Feld neben dem Pfad.`);
    ui.refresh();
  }
  /** Leaves build mode and drops the selection (Esc, right click). */
  function cancel() {
    if (view.build === null && view.selected === null) return;
    view.build = null;
    view.selected = null;
    ui.notice("Auswahl aufgehoben.");
    ui.refresh();
  }
  function chooseCell(x: number, y: number, keepBuilding = false) {
    if (game.state.status === "lost" || game.state.status === "won") return;
    const tower = game.state.towers.find((t) => t.x === x && t.y === y);
    if (tower) {
      view.selected = tower.id;
      view.build = null;
      ui.notice("Turm ausgewählt. Verbessern oder verkaufen.");
      ui.refresh();
      return;
    }
    if (view.build) {
      // Placing ends build mode; Shift+click keeps it for several towers of one type.
      if (execute({ type: "build", tower: view.build, x, y }).ok && !keepBuilding) {
        view.build = null;
        ui.refresh();
      }
    } else {
      view.selected = null;
      ui.refresh();
    }
  }
  function selectMission(id: string) {
    dialogs.dismiss("missions");
    execute({ type: "mission", id });
  }
  /** Switches the mission dialog to another sector tab and keeps the focus on the tab bar. */
  function showSector(index: number) {
    renderMissionList(game, index);
    document.getElementById(`sector-tab-${index}`)?.focus();
  }
  // Arrow keys, Home and End move between the sector tabs.
  document.getElementById("sector-tabs")!.addEventListener("keydown", (e) => {
    const count = game.content.sectors?.length ?? 0,
      current = Number((e.target as HTMLElement).closest<HTMLElement>("[data-sector]")?.dataset.sector);
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: count - 1 }[e.key];
    if (next === undefined || !count) return;
    e.preventDefault();
    showSector((next + count) % count);
  });
  const fullscreen = () =>
    toggleFullscreen().catch(() => ui.notice("Vollbild ist in diesem Browser nicht verfügbar.", true));
  const pauseIfRunning = () => {
    if (game.state.status === "wave") execute({ type: "pause" });
  };
  document.addEventListener("click", async (event) => {
    const b = (event.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.tower) return choose(b.dataset.tower as TowerId);
    if (b.dataset.mission) return selectMission(b.dataset.mission);
    if (b.dataset.send) return execute({ type: "send", enemy: b.dataset.send as EnemyId });
    if (b.dataset.sector) return showSector(Number(b.dataset.sector));
    if (b.dataset.upgrade && view.selected !== null) {
      execute({ type: "upgrade", id: view.selected, upgrade: b.dataset.upgrade });
      return;
    }
    switch (b.id) {
      case "toolbar-start":
        execute({ type: "start" });
        break;
      case "pause-btn":
        pauseIfRunning();
        break;
      case "cancel-selection":
        cancel();
        break;
      case "fullscreen-btn":
        fullscreen();
        break;
      case "speed-btn":
        if (!coop.active()) {
          view.speed = view.speed === 1 ? 2 : 1;
          ui.refresh();
        } else if (view.player === 0) coop.setSpeed(view.speed === 1 ? 2 : 1);
        else ui.notice(describeResult({ ok: false, code: "host-only" }), true);
        break;
      case "sound-btn": {
        try {
          const on = await audio.toggle();
          b.textContent = on ? "Ton an" : "Ton aus";
          b.setAttribute("aria-pressed", String(on));
        } catch {
          ui.notice("Audio ist in diesem Browser nicht verfügbar.", true);
        }
        break;
      }
      case "sell-btn":
        if (view.selected !== null) execute({ type: "sell", id: view.selected });
        break;
      case "coop-btn":
        coop.open();
        break;
      case "help-btn":
        dialogs.open("help");
        break;
      case "close-help":
      case "help-done":
        dialogs.close("help");
        break;
      case "missions-btn":
      case "overlay-missions":
        renderMissionList(game);
        dialogs.open("missions");
        break;
      case "close-missions":
        dialogs.close("missions");
        break;
      case "overlay-next": {
        const next = nextMission(game);
        if (next) selectMission(next.id);
        break;
      }
      case "restart-btn":
        dialogs.open("restart");
        break;
      case "cancel-restart":
        dialogs.close("restart");
        break;
      case "confirm-restart":
        dialogs.dismiss("restart");
        execute({ type: "restart" });
        break;
      case "overlay-restart":
        execute({ type: "restart" });
        break;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (dialogs.anyOpen() || e.altKey || e.metaKey || e.ctrlKey || e.repeat) return;
    const towerKeys = game.availableTowers();
    const towerIndex = e.key.length === 1 ? TOWER_KEYS.indexOf(e.key.toLowerCase()) : -1;
    if (towerIndex >= 0 && towerKeys[towerIndex]) {
      choose(towerKeys[towerIndex]);
      return;
    }
    if (e.key === "Escape") {
      // Cancel first; only an Esc with nothing to cancel leaves full screen.
      if (view.build !== null || view.selected !== null) cancel();
      else if (isFullscreen()) fullscreen();
      return;
    }
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      pauseIfRunning();
      return;
    }
    if (e.key.toLowerCase() === "f") {
      fullscreen();
      return;
    }
    if (e.key.toLowerCase() === "n") {
      execute({ type: "start" });
      return;
    }
    if (e.target === document.getElementById("board")) {
      const p = view.hover ?? { x: 2, y: 2 };
      if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const dx = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0,
          dy = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        view.hover = {
          x: Math.max(0, Math.min(game.map.columns - 1, p.x + dx)),
          y: Math.max(0, Math.min(game.map.rows - 1, p.y + dy)),
        };
        ui.notice(
          `Feld ${String.fromCharCode(65 + view.hover.x)}${view.hover.y + 1}. ${game.canBuild(view.hover.x, view.hover.y) ? "Bebaubar." : "Belegt."}`,
        );
      }
      if (e.key === "Enter") {
        e.preventDefault();
        chooseCell(p.x, p.y);
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    // In multiplayer the others keep playing; pausing stays an explicit choice.
    if (document.hidden && !coop.active() && game.state.status === "wave" && !game.state.paused) execute({ type: "pause" });
  });
  return { execute, chooseCell, cancel };
}
