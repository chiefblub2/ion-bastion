import { isRunning, type Game } from "../core/game";
import type { CommandResult, EnemyId, TargetPriority, TowerId } from "../core/types";
import { TARGET_PRIORITIES } from "../systems/combat";
import { hasPage, hotkeyTowers, isPaged, pageOf, towerOrder } from "../ui/tower-pages";
import { isSupport } from "../systems/attacks";
import type { MatchCommand } from "../core/match";
import { type Interface, modeGroups, nextMission, renderCodex, renderMenu, renderMission, renderMissionList, TOWER_KEYS } from "../ui/interface";
import { describeResult } from "../ui/messages";
import { playerName } from "../ui/players";
import type { Driver, ViewState } from "../render/scene";
import type { Applied } from "../net/lockstep";
import type { Audio } from "./audio";
import { createCoop } from "./coop";
import { createDialogs } from "./dialogs";
import { createScreens, GAME, HOME, type MenuPage, type Screen } from "./screens";
import { lastMission, rememberMission } from "./progress";
import { isCircleSector, missionById, sectorOf } from "../content/missions";
import type { CodexTab } from "../ui/enemy-codex";
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
}
/** Turns clicks, keys and tab changes into commands and view changes. */
export function createInput({ game, view, ui, audio, reloadBattlefield, fitBattlefield, setDriver, toggleFullscreen, isFullscreen }: InputDeps) {
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
        ui.notice(`${playerName(player)} sends you ${result.params.enemy}!`, true);
      ui.refresh();
      return;
    }
    if (own || (shared && result.ok)) ui.notice(`${own ? "" : `${playerName(player)}: `}${describeResult(result)}`, own && !result.ok);
    if ((c.type === "restart" || c.type === "mission") && result.ok) {
      view.selected = null;
      view.enemy = null;
      view.build = towerOrder(game)[0];
      view.page = pageOf(game.content.towers[view.build]);
      if (!coop.active()) view.speed = 1;
    }
    if (c.type === "mission" && result.ok) {
      rememberMission(c.id);
      resumeAfterMenu = false;
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
  const coop = createCoop({ game, view, ui, pickMission: () => screens.show(page("missions")), applied, setDriver });
  const page = (name: MenuPage): Screen => ({ view: "menu", page: name });
  /** A wave the menu paused when the player left the game; it resumes on the way back. */
  let resumeAfterMenu = false,
    /** The sector the mission page opens on next; undefined opens the current mission's sector. */
    missionSector: number | undefined;
  const screens = createScreens(game.content.missions, () => game.mission.id, enter);
  /** A mission this session has played on, which "Continue" returns to instead of reloading it. */
  const inProgress = () => coop.active() || game.state.wave > 0 || game.state.towers.length > 0;
  /** Shows a screen: pauses or resumes the wave between game and menu and fills the menu page. */
  function enter(to: Screen, from: Screen | null) {
    if (to.view === "game") {
      if (resumeAfterMenu && game.state.paused) execute({ type: "pause" });
      resumeAfterMenu = false;
      requestAnimationFrame(fitBattlefield);
      ui.refresh();
      return;
    }
    // In multiplayer the others keep playing, so the wave runs on.
    if (from?.view === "game") {
      resumeAfterMenu = !coop.active() && isRunning(game.state) && !game.state.paused;
      if (resumeAfterMenu) execute({ type: "pause" });
    }
    let section: HTMLElement | undefined;
    for (const s of document.querySelectorAll<HTMLElement>("#start-screen .menu-page")) {
      s.hidden = s.dataset.page !== to.page;
      if (!s.hidden) section = s;
    }
    if (to.page === "home") renderMenu(game, lastMission(), inProgress());
    if (to.page === "missions") renderMissionList(game, missionSector);
    if (to.page === "coop") coop.render();
    if (to.page === "codex") renderCodex(game);
    missionSector = undefined;
    scrollTo(0, 0);
    section?.focus({ preventScroll: true });
  }
  function choose(type: TowerId) {
    view.build = type;
    view.page = pageOf(game.content.towers[type]);
    view.selected = null;
    view.enemy = null;
    const d = game.content.towers[type];
    ui.notice(`${d.name} selected. Click a free cell ${d.placement === "path" ? "on the path" : "next to the path"}.`);
    ui.refresh();
  }
  /** Leaves build mode and drops the selection (Esc, right click). */
  function cancel() {
    if (view.build === null && view.selected === null && view.enemy === null) return;
    view.build = null;
    view.selected = null;
    view.enemy = null;
    ui.notice("Selection cleared.");
    ui.refresh();
  }
  function chooseCell(x: number, y: number, keepBuilding = false) {
    if (game.state.status === "lost" || game.state.status === "won") return;
    view.enemy = null;
    const tower = game.state.towers.find((t) => t.x === x && t.y === y);
    if (tower) {
      view.selected = tower.id;
      view.build = null;
      ui.notice("Tower selected. Upgrade or sell it.");
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
  /** Shows HP and traits of an enemy in the sidebar; drops the tower selection. */
  function chooseEnemy(id: number) {
    view.enemy = id;
    view.selected = null;
    view.build = null;
    ui.refresh();
  }
  function selectMission(id: string) {
    // In a multiplayer lobby the pick is the room's mission; the host launches it from there.
    if (coop.inLobby()) {
      execute({ type: "mission", id });
      screens.back();
      return;
    }
    execute({ type: "mission", id });
    if (!coop.active()) screens.show(GAME);
  }
  /** "Continue": back to the mission in progress, else the remembered one from an earlier visit. */
  function resume() {
    if (inProgress()) return screens.show(GAME);
    const last = missionById(lastMission() ?? "", game.content.missions);
    if (last) selectMission(last.id);
  }
  /** Opens the mission page on one game mode: the last mission's sector if it belongs to it, else its first sector. */
  function chooseMode(circle: boolean) {
    const sectors = game.content.sectors ?? [],
      { campaign, rings } = modeGroups(sectors),
      last = missionById(lastMission() ?? "", game.content.missions),
      home = last && sectorOf(last, sectors),
      sector = home && isCircleSector(home) === circle ? home : (circle ? rings : campaign)[0];
    missionSector = sector ? sectors.indexOf(sector) : undefined;
    screens.show(page("missions"));
  }
  /** Switches the mission page to another sector tab or game mode and keeps the focus on the clicked bar. */
  function showSector(index: number, bar: string) {
    renderMissionList(game, index);
    document.querySelector<HTMLElement>(`#${bar} [data-sector="${index}"]`)?.focus();
  }
  /** Opens another page of the build menu and keeps the focus on its tab. */
  function showTowerPage(page: number) {
    view.page = page;
    ui.refresh();
    document.getElementById(`tower-tab-${page}`)?.focus();
  }
  // Arrow keys, Home and End move between the visible tower tabs.
  document.getElementById("tower-tabs")!.addEventListener("keydown", (e) => {
    const pages = [...document.querySelectorAll<HTMLElement>("[data-tower-page]")].map((t) => Number(t.dataset.towerPage)),
      current = pages.indexOf(view.page);
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: pages.length - 1 }[e.key];
    if (next === undefined || !pages.length) return;
    e.preventDefault();
    showTowerPage(pages[(next + pages.length) % pages.length]);
  });
  /** Switches the enemy codex to another tab and keeps the focus on the tab bar. */
  function showCodexTab(tab: CodexTab) {
    renderCodex(game, tab);
    document.getElementById(`codex-tab-${tab}`)?.focus();
  }
  document.getElementById("codex-tabs")!.addEventListener("keydown", (e) => {
    const current = (e.target as HTMLElement).closest<HTMLElement>("[data-codex-tab]")?.dataset.codexTab,
      other: CodexTab = current === "enemies" ? "traits" : "enemies";
    const next = ({ ArrowRight: other, ArrowLeft: other, Home: "enemies", End: "traits" } as const)[e.key as "Home"];
    if (!next) return;
    e.preventDefault();
    showCodexTab(next);
  });
  // Arrow keys, Home and End move between the visible tabs of one bar (game modes or the sectors of a mode).
  for (const bar of ["mission-modes", "sector-tabs"]) {
    const tabs = document.getElementById(bar)!;
    tabs.addEventListener("keydown", (e) => {
      const buttons = [...tabs.querySelectorAll<HTMLElement>("[data-sector]")],
        current = buttons.indexOf((e.target as HTMLElement).closest<HTMLElement>("[data-sector]")!);
      const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: buttons.length - 1 }[e.key];
      if (next === undefined || !buttons.length) return;
      e.preventDefault();
      showSector(Number(buttons[(next + buttons.length) % buttons.length].dataset.sector), bar);
    });
  }
  const fullscreen = () =>
    toggleFullscreen().catch(() => ui.notice("Fullscreen is not available in this browser.", true));
  const pauseIfRunning = () => {
    if (isRunning(game.state)) execute({ type: "pause" });
  };
  document.addEventListener("click", async (event) => {
    // The brand links home; a plain click stays in the app instead of reloading it.
    const link = (event.target as HTMLElement).closest("a.brand");
    if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      screens.show(HOME);
      return;
    }
    const b = (event.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.back !== undefined) return screens.back();
    if (b.dataset.tower) return choose(b.dataset.tower as TowerId);
    if (b.dataset.mission) return selectMission(b.dataset.mission);
    if (b.dataset.send) return execute({ type: "send", enemy: b.dataset.send as EnemyId });
    if (b.dataset.sector) return showSector(Number(b.dataset.sector), b.parentElement!.id);
    if (b.dataset.codexTab) return showCodexTab(b.dataset.codexTab as CodexTab);
    if (b.dataset.towerPage) return showTowerPage(Number(b.dataset.towerPage));
    if (b.dataset.priority && view.selected !== null) {
      execute({ type: "target", id: view.selected, priority: b.dataset.priority as TargetPriority });
      return;
    }
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
          b.textContent = on ? "Sound on" : "Sound off";
          b.setAttribute("aria-pressed", String(on));
        } catch {
          ui.notice("Audio is not available in this browser.", true);
        }
        break;
      }
      case "sell-btn":
        if (view.selected !== null) execute({ type: "sell", id: view.selected });
        break;
      case "menu-campaign":
        chooseMode(false);
        break;
      case "menu-circle":
        chooseMode(true);
        break;
      case "menu-btn":
        screens.show(HOME);
        break;
      case "menu-continue":
        resume();
        break;
      case "coop-btn":
      case "menu-coop":
        screens.show(page("coop"));
        break;
      case "help-btn":
      case "menu-help":
        screens.show(page("help"));
        break;
      case "codex-btn":
      case "menu-codex":
        screens.show(page("codex"));
        break;
      case "overlay-missions":
        screens.show(page("missions"));
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
    // The game's hotkeys belong to the game view; on the start screen Esc leads back from a page.
    const current = screens.current();
    if (current.view === "menu") {
      if (e.key === "Escape" && current.page !== "home") screens.back();
      return;
    }
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
    if (e.key.toLowerCase() === "t") {
      // Cycles the selected attack tower to its next target priority.
      const t = game.state.towers.find((t) => t.id === view.selected);
      if (!t || isSupport(game.content.towers[t.type].attack)) return;
      const next = TARGET_PRIORITIES[(TARGET_PRIORITIES.indexOf(t.priority ?? "first") + 1) % TARGET_PRIORITIES.length];
      execute({ type: "target", id: t.id, priority: next });
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
          `Cell ${String.fromCharCode(65 + view.hover.x)}${view.hover.y + 1}. ${game.canBuild(view.hover.x, view.hover.y, view.build ?? undefined) ? "Buildable." : "Occupied."}`,
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
    if (document.hidden && !coop.active() && isRunning(game.state) && !game.state.paused) execute({ type: "pause" });
  });
  return { execute, chooseCell, chooseEnemy, cancel, screens };
}
