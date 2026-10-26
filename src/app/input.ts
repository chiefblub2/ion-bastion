import { isRunning, type Game } from "../core/game";
import { isPlaytest } from "../editor/playtest-id";
import type { EditorHost } from "../editor/editor-view";
import type { RunHost } from "../ui/run-view";
import { isRunMission } from "../run/run-id";
import { beginJournal, journalCommand, persist, storedJournal } from "./run-journal";
import type { CommandResult, EnemyId, TargetPriority, TowerId } from "../core/types";
import { TARGET_PRIORITIES } from "../systems/combat";
import { hasPage, hotkeyTowers, isPaged, pageOf, towerOrder } from "../ui/tower-pages";
import { isSupport } from "../systems/attacks";
import { openUpgrades } from "../core/upgrades";
import type { MatchCommand } from "../core/match";
import { type Interface, modeGroups, nextMission, renderCodex, renderMenu, renderMission, renderTowerCodexPage, TOWER_KEYS } from "../ui/interface";
import { type AtlasOptions, fitWorld, renderAtlas, selectMission as featureMission, selectSector, selectWorld, toggleWorld } from "../ui/sector-atlas";
import { terrainImage } from "../render/terrain-snapshot";
import { describeResult } from "../ui/messages";
import { isTouch } from "../ui/touch";
import { playerName } from "../ui/players";
import type { Driver, ViewState } from "../render/scene";
import type { Applied } from "../net/lockstep";
import type { Audio } from "./audio";
import { createCoop } from "./coop";
import { createDialogs } from "./dialogs";
import { createScreens, GAME, HOME, type MenuPage, type Screen } from "./screens";
import { campaignRecord, type CampaignRecord, lastMission, rememberMission, rememberUnlocks, seenUnlocks, trainingDone } from "./progress";
import { campaignLocks, type Lock } from "./campaign-unlock";
import { homeAction, type HomeAction } from "./home-action";
import { isCircleSector, missionById, playableMissions, sectorOf } from "../content/missions";
import type { CodexTab } from "../ui/enemy-codex";
import { bindCodexPreviews, closeCodexPreview } from "../ui/codex-preview";
import type { Coach } from "../ui/coach-view";
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
/** Turns clicks, keys and tab changes into commands and view changes. */
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
  const coop = createCoop({ game, view, ui, pickMission: () => {
      forRoom = true;
      screens.show(page("missions"));
    }, applied, setDriver });
  const page = (name: MenuPage): Screen => ({ view: "menu", page: name });
  /** A wave the menu paused when the player left the game; it resumes on the way back. */
  let resumeAfterMenu = false,
    /** The sector the mission page opens on next; undefined opens the current mission's sector. */
    missionSector: number | undefined,
    /** The mission the briefing opens on next; undefined opens the current mission's. */
    missionPick: string | undefined,
    /** The mission page was opened from the multiplayer page; a pick goes back there instead of into the game. */
    forRoom = false,
    /** What the home page's primary button does right now. */
    primary: HomeAction;
  /** The Sector Atlas picks for a multiplayer room while the page was opened from there or from a lobby. */
  const atlas = (): AtlasOptions => {
    const lobby = forRoom || coop.inLobby();
    return { lobby, image: terrainImage, record: campaignRecord(), playing: inProgress(), locks: lobby ? undefined : locks(), seen: seenUnlocks() };
  };
  /** `?unlock=all` (QA) opens every mission for this page load. */
  const unlockAll = new URLSearchParams(location.search).get("unlock") === "all";
  let lockCache: { record: CampaignRecord; locks: ReadonlyMap<string, Lock> } | undefined;
  /** The campaign's locked missions for solo play; multiplayer and `?unlock=all` lock nothing. */
  function locks(): ReadonlyMap<string, Lock> | undefined {
    if (unlockAll || coop.active()) return undefined;
    const record = campaignRecord();
    if (lockCache?.record !== record) lockCache = { record, locks: campaignLocks(game.content.sectors ?? [], record) };
    return lockCache.locks;
  }
  ui.locks = locks;
  // The world map keeps its sector in view when the page resizes.
  new ResizeObserver(() => fitWorld()).observe(document.getElementById("world-view")!);
  const screens = createScreens(playableMissions(game.content), () => game.mission.id, enter);
  /** A mission this session has played on, which "Resume Game" returns to instead of reloading it. */
  const inProgress = () => coop.active() || game.state.wave > 0 || game.state.towers.length > 0;
  /** Shows a screen: pauses or resumes the wave between game and menu and fills the menu page. */
  function enter(to: Screen, from: Screen | null) {
    if (to.view === "game") {
      // Shown on the game view only; refresh() re-places it once the board is laid out.
      requestAnimationFrame(() => coach.refresh());
      if (resumeAfterMenu && game.state.paused) execute({ type: "pause" });
      resumeAfterMenu = false;
      scrollTo(0, 0);
      requestAnimationFrame(fitBattlefield);
      ui.refresh();
      return;
    }
    // In multiplayer the others keep playing, so the wave runs on.
    if (from?.view === "game") {
      resumeAfterMenu = !coop.active() && isRunning(game.state) && !game.state.paused;
      if (resumeAfterMenu) execute({ type: "pause" });
    }
    coach.refresh();
    let section: HTMLElement | undefined;
    for (const s of document.querySelectorAll<HTMLElement>("#start-screen .menu-page")) {
      s.hidden = s.dataset.page !== to.page;
      if (!s.hidden) section = s;
    }
    if (to.page === "home") {
      const record = campaignRecord();
      primary = homeAction(game.content.missions, lastMission(), {
        mission: game.mission,
        wave: game.state.wave,
        status: game.state.status,
        inProgress: inProgress(),
        multiplayer: coop.active(),
      }, record, locks());
      // A newcomer: no Training won, no mission won and none started yet.
      renderMenu(game, primary, record, terrainImage, !trainingDone() && !Object.keys(record).length && !lastMission());
    }
    if (to.page !== "missions") forRoom = false;
    if (to.page === "missions") {
      const options = atlas();
      renderAtlas(game, options, missionSector, missionPick);
      // Every unlock shown now has had its reveal; the next visit only reveals what a later win opens.
      if (options.locks) rememberUnlocks([...(options.seen ?? []), ...game.content.missions.filter((m) => !options.locks!.has(m.id)).map((m) => m.id)]);
    }
    if (to.page === "coop") coop.render();
    if (to.page === "editor") void import("../editor/editor-view").then((m) => m.openEditor(editorHost));
    if (to.page === "run") void import("../ui/run-view").then((m) => m.openRun(runHost));
    // Any page change ends a codex animation preview; opening the codex renders it closed.
    closeCodexPreview();
    if (to.page === "codex") renderCodex(game);
    if (to.page === "towers") renderTowerCodexPage(game);
    missionSector = missionPick = undefined;
    scrollTo(0, 0);
    section?.focus({ preventScroll: true });
  }
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
  function selectMission(id: string) {
    // Picked for multiplayer (from its page or in a lobby), it is the room's mission; the host launches it from there.
    if (forRoom || coop.inLobby()) {
      execute({ type: "mission", id });
      screens.back();
      return;
    }
    // A locked campaign mission is only shown on the atlas, never started.
    if (locks()?.has(id)) {
      missionSector = undefined;
      missionPick = id;
      screens.show(page("missions"));
      return;
    }
    execute({ type: "mission", id });
    if (!coop.active()) screens.show(GAME);
  }
  /** What the lazily loaded mission editor may do in the app. */
  const editorHost: EditorHost = {
    content: game.content,
    playtest(mission) {
      const r = execute({ type: "playtest", mission });
      if (r.ok) screens.show(GAME);
    },
    canPlaytest: () => !coop.active(),
    base: location.origin + location.pathname,
  };
  /** What the lazily loaded Run page may do in the app. */
  const runHost: RunHost = {
    content: game.baseContent,
    launch(mission, content, resumed) {
      const r = execute({ type: "run", mission, content, replay: resumed });
      if (!r.ok) return;
      beginJournal(game, resumed);
      // A resumed mission opens paused, so the player finds their bearings first.
      if (resumed && isRunning(game.state) && !game.state.paused) execute({ type: "pause" });
      screens.show(GAME);
    },
    canRun: () => !coop.active(),
    playing: () => (isRunMission(game.mission) && inProgress() && (game.state.status === "ready" || game.state.status === "wave") ? game.mission.id : undefined),
    resume: () => screens.show(GAME),
    journal: storedJournal,
    image: terrainImage,
  };
  /** The home page's primary button: begin on the first campaign mission, return to the game in memory, move on to the next unwon mission, or replay the remembered one from wave 1. */
  function runPrimary() {
    if (primary.kind === "resume") return screens.show(GAME);
    if (primary.kind === "run") return screens.show(page("run"));
    // Reachable after a won or lost playtest: the home button then offers "restart" with the playtest mission.
    if (primary.kind === "restart" && isPlaytest(primary.mission)) {
      execute({ type: "restart" });
      return screens.show(GAME);
    }
    if (primary.kind === "restart" || primary.kind === "continue") return selectMission(primary.mission.id);
    const sectors = game.content.sectors ?? [],
      first = (modeGroups(sectors).campaign[0] ?? sectors[0]) as (typeof sectors)[number] | undefined;
    missionSector = first ? sectors.indexOf(first) : undefined;
    missionPick = (first?.missions ?? game.content.missions)[0]?.id;
    screens.show(page("missions"));
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
  /** Switches the atlas to another sector card or game mode and keeps the focus on the clicked bar. */
  function showSector(index: number, bar: string) {
    selectSector(game, index, atlas());
    document.querySelector<HTMLElement>(`#${bar} [data-sector="${index}"]`)?.focus({ preventScroll: true });
  }
  /** Features a mission in the atlas without loading it; the briefing's button starts it. */
  function pickMission(id: string) {
    featureMission(game, id, atlas());
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
  /** Switches the enemy codex to another tab and keeps the focus on the tab bar. */
  function showCodexTab(tab: CodexTab) {
    renderCodex(game, tab);
    document.getElementById(`codex-tab-${tab}`)?.focus();
  }
  /** Switches the tower codex to another category and keeps the focus on its tab. */
  function showTowerCodex(page: number) {
    renderTowerCodexPage(game, page);
    document.getElementById(`tower-codex-tab-${page}`)?.focus({ preventScroll: true });
  }
  document.getElementById("tower-codex-tabs")!.addEventListener("keydown", (e) => {
    const pages = [...document.querySelectorAll<HTMLElement>("[data-tower-codex]")].map((t) => Number(t.dataset.towerCodex)),
      current = pages.indexOf(Number((e.target as HTMLElement).closest<HTMLElement>("[data-tower-codex]")?.dataset.towerCodex));
    const next = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: pages.length - 1 }[e.key];
    if (next === undefined || !pages.length) return;
    e.preventDefault();
    showTowerCodex(pages[(next + pages.length) % pages.length]);
  });
  bindCodexPreviews(document.getElementById("codex-list")!);
  document.getElementById("codex-tabs")!.addEventListener("keydown", (e) => {
    const current = (e.target as HTMLElement).closest<HTMLElement>("[data-codex-tab]")?.dataset.codexTab,
      other: CodexTab = current === "enemies" ? "traits" : "enemies";
    const next = ({ ArrowRight: other, ArrowLeft: other, Home: "enemies", End: "traits" } as const)[e.key as "Home"];
    if (!next) return;
    e.preventDefault();
    showCodexTab(next);
  });
  // Arrow keys, Home and End move between the missions of the sector and feature the one reached.
  document.getElementById("mission-list")!.addEventListener("keydown", (e) => {
    const nodes = [...document.querySelectorAll<HTMLElement>("#mission-list [data-pick]")],
      current = nodes.indexOf((e.target as HTMLElement).closest<HTMLElement>("[data-pick]")!);
    const next = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: nodes.length - 1 }[e.key];
    if (next === undefined || !nodes.length) return;
    e.preventDefault();
    const node = nodes[(next + nodes.length) % nodes.length];
    pickMission(node.dataset.pick!);
    node.focus({ preventScroll: true });
  });
  // Arrow keys, Home and End move between the visible tabs of one bar (game modes or the sector cards of a mode).
  for (const bar of ["mission-modes", "sector-tabs"]) {
    const tabs = document.getElementById(bar)!;
    tabs.addEventListener("keydown", (e) => {
      const buttons = [...tabs.querySelectorAll<HTMLElement>("[data-sector]")],
        current = buttons.indexOf((e.target as HTMLElement).closest<HTMLElement>("[data-sector]")!);
      const next = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: buttons.length - 1 }[e.key];
      if (next === undefined || !buttons.length) return;
      e.preventDefault();
      showSector(Number(buttons[(next + buttons.length) % buttons.length].dataset.sector), bar);
    });
  }
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
    pausedByMenu = !coop.active() && isRunning(game.state) && !game.state.paused;
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
    // The home page's map preview is a pointer shortcut for the primary button, which stays the keyboard route.
    if ((event.target as HTMLElement).closest("#home-map")) return runPrimary();
    // A landmass on the atlas's world map selects its sector, like its label.
    const land = (event.target as Element).closest<SVGGElement>("#world-svg .land");
    if (land) return showSector(Number(land.dataset.sector), "sector-tabs");
    // The compact layout's side rail shows the next wave as icons; a tap opens the full forecast over the board.
    const forecast = (event.target as HTMLElement).closest("#wave-forecast");
    if (forecast && document.documentElement.classList.contains("is-compact")) {
      forecast.classList.toggle("open");
      return;
    }
    const b = (event.target as HTMLElement).closest("button");
    if (!b) return;
    // Every entry of the ⚙ menu closes it; Resume also resumes.
    if (b.closest("#game-menu")) closeGameMenu(b.id === "menu-resume");
    if (b.dataset.back !== undefined) return screens.back();
    if (b.dataset.toTop !== undefined) return scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (b.dataset.worldZoom !== undefined) return toggleWorld();
    if (b.dataset.planet) return selectWorld(game, Number(b.dataset.planet), atlas());
    if (b.dataset.tower) return choose(b.dataset.tower as TowerId);
    if (b.dataset.mission) return selectMission(b.dataset.mission);
    if (b.dataset.pick) return pickMission(b.dataset.pick);
    if (b.dataset.send) return execute({ type: "send", enemy: b.dataset.send as EnemyId });
    if (b.dataset.sector) return showSector(Number(b.dataset.sector), b.parentElement!.id);
    if (b.dataset.codexTab) return showCodexTab(b.dataset.codexTab as CodexTab);
    if (b.dataset.towerCodex) return showTowerCodex(Number(b.dataset.towerCodex));
    if (b.dataset.towerPage) return showTowerPage(Number(b.dataset.towerPage));
    if (b.dataset.priority && view.selected !== null) {
      execute({ type: "target", id: view.selected, priority: b.dataset.priority as TargetPriority });
      return;
    }
    if (b.dataset.upgrade && view.selected !== null) {
      execute({ type: "upgrade", id: view.selected, upgrade: b.dataset.upgrade });
      return;
    }
    // The tower card's buttons (ui/tower-card.ts).
    if (b.dataset.sell !== undefined && view.selected !== null) return void execute({ type: "sell", id: view.selected });
    if (b.dataset.priorityCycle !== undefined) return cycleTarget();
    if (b.dataset.deselect !== undefined) return cancel();
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
      case "menu-fullscreen":
        fullscreen();
        break;
      case "rail-settings":
        if (gameMenu.hidden) openGameMenu();
        else closeGameMenu(true);
        break;
      case "overlay-resume":
        pauseIfRunning();
        break;
      case "coverage-btn":
        toggleCoverage();
        break;
      case "speed-btn":
        if (!coop.active()) {
          view.speed = view.speed === 1 ? 2 : 1;
          ui.refresh();
        } else if (view.player === 0) coop.setSpeed(view.speed === 1 ? 2 : 1);
        else ui.notice(describeResult({ ok: false, code: "host-only" }), true);
        break;
      case "sell-btn":
        if (view.selected !== null) execute({ type: "sell", id: view.selected });
        break;
      case "menu-campaign":
        chooseMode(false);
        break;
      case "menu-circle":
        chooseMode(true);
        break;
      case "menu-run":
        screens.show(page("run"));
        break;
      case "menu-btn":
      case "rail-menu":
        screens.show(isPlaytest(game.mission) ? page("editor") : isRunMission(game.mission) ? page("run") : HOME);
        break;
      case "menu-primary":
        runPrimary();
        break;
      case "menu-training":
      case "help-training":
        if (game.content.training) selectMission(game.content.training.id);
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
      case "menu-towers":
        screens.show(page("towers"));
        break;
      case "overlay-missions":
        screens.show(page(isPlaytest(game.mission) ? "editor" : isRunMission(game.mission) ? "run" : "missions"));
        break;
      case "overlay-next": {
        if (isRunMission(game.mission)) {
          screens.show(page("run"));
          break;
        }
        const next = nextMission(game, locks());
        if (next) selectMission(next.id);
        break;
      }
      case "restart-btn":
      case "rail-restart":
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
    if (e.code === "Space" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) {
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
    if (e.key.toLowerCase() === "c") {
      toggleCoverage();
      return;
    }
    if (e.key.toLowerCase() === "m") {
      audio.update({ muted: !audio.settings.muted }).catch(() => ui.notice("Audio is not available in this browser.", true));
      return;
    }
    if (e.key.toLowerCase() === "t") {
      cycleTarget();
      return;
    }
    if (e.key.toLowerCase() === "u") {
      // Buys the selected tower's next upgrade; a choice between paths stays with the buttons.
      const t = game.state.towers.find((t) => t.id === view.selected);
      if (!t) return;
      const open = openUpgrades(t, game.content);
      if (open.length === 1) execute({ type: "upgrade", id: t.id, upgrade: open[0] });
      else if (open.length > 1) ui.notice("Choose a path with the upgrade buttons.", true);
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
  // The long codex pages offer a way back to their tabs once scrolled well down.
  addEventListener("scroll", () => document.documentElement.classList.toggle("scrolled-far", scrollY > 1200), { passive: true });
  document.addEventListener("visibilitychange", () => {
    // In multiplayer the others keep playing; pausing stays an explicit choice.
    if (document.hidden && !coop.active() && isRunning(game.state) && !game.state.paused) execute({ type: "pause" });
    if (document.hidden) persist(game);
  });
  window.addEventListener("pagehide", () => persist(game));
  return { execute, chooseCell, chooseEnemy, cancel, confirmBuild, dropPending, screens, match: coop.match };
}
