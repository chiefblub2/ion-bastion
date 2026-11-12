import { isRunning, type Game } from "../core/game";
import type { MatchCommand } from "../core/match";
import type { CommandResult, EnemyId, TargetPriority, TowerId } from "../core/types";
import { openUpgrades } from "../core/upgrades";
import type { Speed } from "../net/protocol";
import type { ViewState } from "../render/scene";
import { isSupport } from "../systems/attacks";
import { TARGET_PRIORITIES } from "../systems/combat";
import { type Interface, TOWER_KEYS } from "../ui/interface";
import { describeResult } from "../ui/messages";
import { hasPage, hotkeyTowers, isPaged, pageOf } from "../ui/tower-pages";
import { isTouch } from "../ui/touch";
import type { Audio } from "./audio";
import type { Dialogs } from "./dialogs";
import { rovingKeys } from "./roving-keys";

interface GameInputDeps {
  game: Game;
  view: ViewState;
  ui: Interface;
  audio: Audio;
  dialogs: Dialogs;
  execute: (c: MatchCommand) => CommandResult;
  /** True in a multiplayer session. */
  multiplayer: () => boolean;
  /** Asks the relay for another speed (multiplayer host only). */
  setSpeed: (speed: Speed) => void;
  toggleFullscreen: () => Promise<void>;
  isFullscreen: () => boolean;
  /** Restarts the mission (a campaign game through its loadout, see `campaign-flow.ts`). */
  restart: () => void;
}
/**
 * The game view's input: build mode, selection, the tower card's buttons, the toolbar and its ⚙ menu, and the game's
 * hotkeys. `click` and `key` take what the shared document listeners in `input.ts` hand on.
 */
export function createGameInput({ game, view, ui, audio, dialogs, execute, multiplayer, setSpeed, toggleFullscreen, isFullscreen, restart }: GameInputDeps) {
  function choose(type: TowerId) {
    view.build = type;
    view.pending = undefined;
    view.page = pageOf(game.content.towers[type]);
    view.selected = null;
    view.enemy = null;
    const d = game.content.towers[type];
    const where = d.placement === "path" ? "on the path" : "next to the path";
    ui.notice(isTouch() ? `${d.name} selected. Tap a free cell ${where}, then ✓.` : `${d.name} selected. Click a free cell ${where}.`);
    ui.refresh();
  }
  /** Leaves build mode and drops the selection (Esc, right click). */
  function cancel() {
    if (view.build === null && view.selected === null && view.enemy === null) return;
    view.build = null;
    view.pending = undefined;
    view.selected = null;
    view.enemy = null;
    ui.notice("Selection cleared.");
    ui.refresh();
  }
  /** `touch`: a tap only picks the cell for the armed tower; the ✓ button builds it (`confirmBuild`). */
  function chooseCell(x: number, y: number, keepBuilding = false, touch = false) {
    if (game.state.status === "lost" || game.state.status === "won") return;
    view.enemy = null;
    const tower = game.state.towers.find((t) => t.x === x && t.y === y);
    if (tower) {
      view.selected = tower.id;
      view.build = null;
      view.pending = undefined;
      ui.notice("Tower selected. Upgrade or sell it.");
      ui.refresh();
      return;
    }
    if (view.build && touch) {
      if (game.canBuild(x, y, view.build)) view.pending = { x, y };
      else {
        view.pending = undefined;
        ui.notice(describeResult({ ok: false, code: game.content.towers[view.build].placement === "path" ? "trap-off-path" : "cell-blocked" }), true);
        audio.cue("reject");
      }
      ui.refresh();
    } else if (view.build) {
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
  /** ✓ on a tapped cell: builds the armed tower there; a failure keeps the cell for another try. */
  function confirmBuild() {
    const at = view.pending;
    if (!at || !view.build) return;
    if (execute({ type: "build", tower: view.build, x: at.x, y: at.y }).ok) {
      view.pending = undefined;
      view.build = null;
      ui.refresh();
    }
  }
  /** ✕ on a tapped cell: forgets the cell, the tower stays armed. */
  function dropPending() {
    view.pending = undefined;
    ui.refresh();
  }
  /** Shows HP and traits of an enemy in the sidebar; drops the tower selection. */
  function chooseEnemy(id: number) {
    view.enemy = id;
    view.selected = null;
    view.build = null;
    ui.refresh();
  }
  /** Opens another page of the build menu and keeps the focus on its tab. */
  function showTowerPage(page: number) {
    view.page = page;
    ui.refresh();
    document.getElementById(`tower-tab-${page}`)?.focus();
  }
  // Arrow keys, Home and End move between the visible tower tabs, counting from the page on show.
  rovingKeys(document.getElementById("tower-tabs")!, "[data-tower-page]", (tab) => showTowerPage(Number(tab.dataset.towerPage)), {
    scope: document,
    current: (tabs) => tabs.findIndex((t) => Number(t.dataset.towerPage) === view.page),
  });
  // A finger held on a build card arms the tower and brings its details (below the list in the sidebar) into view:
  // touch screens have no hover tooltip.
  const towerList = document.getElementById("tower-list")!;
  let hold: number | undefined;
  towerList.addEventListener("pointerdown", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-tower]");
    if (!card || e.pointerType === "mouse") return;
    clearTimeout(hold);
    hold = window.setTimeout(() => {
      choose(card.dataset.tower as TowerId);
      document.getElementById("selection")!.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 500);
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) towerList.addEventListener(type, () => clearTimeout(hold));
  towerList.addEventListener("contextmenu", (e) => e.preventDefault());
  /** The coverage overlay: every tower's range and how well each path cell is covered. */
  function toggleCoverage() {
    view.coverage = !view.coverage;
    document.getElementById("coverage-btn")!.setAttribute("aria-pressed", String(view.coverage));
    ui.notice(view.coverage ? "Ranges shown. Red path: no tower reaches ground units there." : "Ranges hidden.");
  }
  /** Moves the selected attack tower to its next target priority (key T, the card's target button). */
  function cycleTarget() {
    const t = game.state.towers.find((t) => t.id === view.selected);
    if (!t || isSupport(game.content.towers[t.type].attack)) return;
    const next = TARGET_PRIORITIES[(TARGET_PRIORITIES.indexOf(t.priority ?? "first") + 1) % TARGET_PRIORITIES.length];
    execute({ type: "target", id: t.id, priority: next });
  }
  /**
   * The ⚙ menu of the compact rail: opening it pauses a solo wave like a dialog; Resume, Esc or a tap beside it
   * resume what it paused. Its other entries close it and leave the game paused (the overlay offers Resume).
   */
  const gameMenu = document.getElementById("game-menu")!,
    menuButton = document.getElementById("rail-settings")!;
  let pausedByMenu = false;
  function openGameMenu() {
    pausedByMenu = !multiplayer() && isRunning(game.state) && !game.state.paused;
    if (pausedByMenu) execute({ type: "pause" });
    gameMenu.hidden = false;
    menuButton.setAttribute("aria-expanded", "true");
    // Beside the rail's button, or below it where the toolbar runs across the top (full screen on a tall screen).
    const r = menuButton.getBoundingClientRect(),
      beside = r.right + 8 + gameMenu.offsetWidth <= innerWidth;
    gameMenu.style.left = `${Math.round(beside ? r.right + 8 : Math.max(8, r.right - gameMenu.offsetWidth))}px`;
    gameMenu.style.top = `${Math.round(Math.max(8, Math.min(beside ? r.top : r.bottom + 8, innerHeight - gameMenu.offsetHeight - 8)))}px`;
    document.getElementById("menu-resume")!.focus();
  }
  function closeGameMenu(resume: boolean) {
    if (gameMenu.hidden) return;
    gameMenu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    if (resume && pausedByMenu && game.state.paused && isRunning(game.state)) execute({ type: "pause" });
    pausedByMenu = false;
  }
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Element;
    if (!gameMenu.hidden && !target.closest("#game-menu, #rail-settings, #sound-panel")) closeGameMenu(true);
  });
  gameMenu.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    closeGameMenu(true);
    menuButton.focus();
  });
  const fullscreen = () => toggleFullscreen().catch(() => ui.notice("Fullscreen is not available in this browser.", true));
  const pauseIfRunning = () => {
    if (isRunning(game.state)) execute({ type: "pause" });
  };
  /** The game's buttons; false when `b` is none of them. */
  function click(b: HTMLButtonElement): boolean {
    if (b.dataset.tower) return choose(b.dataset.tower as TowerId), true;
    if (b.dataset.send) return execute({ type: "send", enemy: b.dataset.send as EnemyId }), true;
    if (b.dataset.towerPage) return showTowerPage(Number(b.dataset.towerPage)), true;
    // The tower card's buttons (ui/tower-card.ts).
    if (b.dataset.priority && view.selected !== null) return execute({ type: "target", id: view.selected, priority: b.dataset.priority as TargetPriority }), true;
    if (b.dataset.upgrade && view.selected !== null) return execute({ type: "upgrade", id: view.selected, upgrade: b.dataset.upgrade }), true;
    if (b.dataset.sell !== undefined && view.selected !== null) return execute({ type: "sell", id: view.selected }), true;
    if (b.dataset.priorityCycle !== undefined) return cycleTarget(), true;
    if (b.dataset.deselect !== undefined) return cancel(), true;
    switch (b.id) {
      case "toolbar-start":
        execute({ type: "start" });
        break;
      case "pause-btn":
      case "overlay-resume":
        pauseIfRunning();
        break;
      case "cancel-selection":
        cancel();
        break;
      case "fullscreen-btn":
      case "menu-fullscreen":
        fullscreen();
        break;
      case "rail-settings":
        if (gameMenu.hidden) openGameMenu();
        else closeGameMenu(true);
        break;
      case "coverage-btn":
        toggleCoverage();
        break;
      case "speed-btn":
        if (!multiplayer()) {
          view.speed = view.speed === 1 ? 2 : 1;
          ui.refresh();
        } else if (view.player === 0) setSpeed(view.speed === 1 ? 2 : 1);
        else ui.notice(describeResult({ ok: false, code: "host-only" }), true);
        break;
      case "restart-btn":
      case "rail-restart":
        dialogs.open("restart");
        break;
      case "cancel-restart":
        dialogs.close("restart");
        break;
      case "confirm-restart":
        dialogs.dismiss("restart");
        restart();
        break;
      case "overlay-restart":
        restart();
        break;
      default:
        return false;
    }
    return true;
  }
  /** The game's hotkeys and the board's keyboard cursor. */
  function key(e: KeyboardEvent) {
    // Shift+1–4 opens a tab; the number keys then pick from that tab, starting at 1.
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (e.shiftKey && digit) {
      const page = Number(digit[1]) - 1;
      if (isPaged(game) && hasPage(game, page)) {
        e.preventDefault();
        view.page = page;
        ui.refresh();
      }
      return;
    }
    const towerKeys = hotkeyTowers(game, view.page);
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
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault();
      pauseIfRunning();
      return;
    }
    switch (e.key.toLowerCase()) {
      case "f":
        return void fullscreen();
      case "n":
        return void execute({ type: "start" });
      case "c":
        return toggleCoverage();
      case "m":
        return void audio.update({ muted: !audio.settings.muted }).catch(() => ui.notice("Audio is not available in this browser.", true));
      case "t":
        return cycleTarget();
      case "u": {
        // Buys the selected tower's next upgrade; a choice between paths stays with the buttons.
        const t = game.state.towers.find((t) => t.id === view.selected);
        if (!t) return;
        const open = openUpgrades(t, game.content);
        if (open.length === 1) execute({ type: "upgrade", id: t.id, upgrade: open[0] });
        else if (open.length > 1) ui.notice("Choose a path on the tower card.", true);
        return;
      }
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
          `Cell ${String.fromCharCode(65 + view.hover.x)}${view.hover.y + 1}. ${game.canBuild(view.hover.x, view.hover.y, view.build ?? undefined) ? "Buildable." : "Occupied."}`,
        );
      }
      if (e.key === "Enter") {
        e.preventDefault();
        chooseCell(p.x, p.y);
      }
    }
  }
  return { chooseCell, chooseEnemy, cancel, confirmBuild, dropPending, closeGameMenu, click, key };
}
