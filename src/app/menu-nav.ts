import { isRunning, type Game } from "../core/game";
import type { MatchCommand } from "../core/match";
import type { CommandResult } from "../core/types";
import { isCircleSector, missionById, playableMissions, sectorOf } from "../content/missions";
import { campaignLocks, type Lock } from "../campaign/campaign-unlock";
import { homeAction, type HomeAction } from "../campaign/home-action";
import type { CampaignRecord } from "../campaign/record";
import type { EditorHost } from "../editor/editor-view";
import { isPlaytest } from "../editor/playtest-id";
import { terrainImage } from "../render/terrain-snapshot";
import { isRunMission } from "../run/run-id";
import { closeCodexPreview } from "../ui/codex-preview";
import type { Coach } from "../ui/coach-view";
import type { CodexTab } from "../ui/enemy-codex";
import { type Interface, modeGroups, nextMission, renderCodex, renderMenu, renderPlay, renderTowerCodexPage } from "../ui/interface";
import type { RunHost } from "../ui/run/state";
import { atlasSelection, type BriefTab, showBriefTab } from "../ui/atlas/card";
import { bindGlobe, fitWorld, toggleWorld } from "../ui/atlas/globe-view";
import { atlasNext, type AtlasOptions } from "../ui/atlas/model";
import { renderAtlas, selectMission as featureMission, selectSector, selectWorld } from "../ui/sector-atlas";
import type { Coop } from "./coop";
import { bindMenuKeys, showCodexTab, showTowerCodex } from "./menu-keys";
import { campaignRecord, lastMission, rememberUnlocks, seenUnlocks, trainingDone } from "./progress";
import { arsenalSummary, bountyToday, loadArsenal } from "./arsenal-store";
import { createCampaignFlow } from "./campaign-flow";
import { lastDebrief } from "./campaign-session";
import { campaignComplete, campaignTotals } from "../campaign/finale";
import type { Debrief } from "../campaign/debrief";
import { focusPrimary, renderDebrief, stopStaging } from "../ui/debrief-view";
import { debriefKey } from "../ui/debrief-text";
import { focusVictory, renderVictory } from "../ui/victory-view";
import { beginJournal, storedJournal } from "./run-journal";
import { createScreens, GAME, HOME, type MenuPage, type Screen } from "./screens";

interface MenuNavDeps {
  game: Game;
  ui: Interface;
  coop: Coop;
  coach: Coach;
  execute: (c: MatchCommand) => CommandResult;
  /** Refits the canvas once the game view is visible again. */
  fitBattlefield: () => void;
}
const page = (name: MenuPage): Screen => ({ view: "menu", page: name });
/**
 * The start screen's navigation: which menu page shows and what it renders, the way between menu and game (pausing a
 * solo wave on the way out), the Sector Atlas's selection and campaign locks, the home page's primary button, and the
 * hosts of the lazily loaded editor and Run pages.
 */
export function createMenuNav({ game, ui, coop, coach, execute, fitBattlefield }: MenuNavDeps) {
  /** A wave the menu paused when the player left the game; it resumes on the way back. */
  let resumeAfterMenu = false,
    /** The sector the mission page opens on next; undefined opens the current mission's sector. */
    missionSector: number | undefined,
    /** The mission the briefing opens on next; undefined opens the current mission's. */
    missionPick: string | undefined,
    /** The mission page was opened from the multiplayer page; a pick goes back there instead of into the game. */
    forRoom = false,
    /** What the home page's primary button does right now. */
    primary: HomeAction,
    /**
     * The atlas's sector and mission when the player last left it for another menu page, so coming back (Back, the
     * mode buttons) finds them again. Loading a mission forgets it: the atlas then opens on what is being played.
     */
    browsed: ReturnType<typeof atlasSelection>,
    /** The debrief that opened by itself (or by its button) already, so the timer never opens it twice. */
    opened: string | undefined,
    /** The game entry in the history was pushed from the debrief ("Battlefield"): Back returns to it. */
    debriefBehind = false;
  /** Today's unpaid bounty mission, while the campaign loop is in force (solo, locks on). */
  const bountyId = () => {
    const b = locks() ? bountyToday() : undefined;
    return b && !b.paid ? b.id : undefined;
  };
  /** The Sector Atlas picks for a multiplayer room while the page was opened from there or from a lobby. */
  const atlas = (): AtlasOptions => {
    const lobby = forRoom || coop.inLobby();
    return { lobby, image: terrainImage, record: campaignRecord(), playing: inProgress(), locks: lobby ? undefined : locks(), seen: seenUnlocks(), bounty: lobby ? undefined : bountyId() };
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
  ui.record = () => (coop.active() ? undefined : campaignRecord());
  // The world map keeps its sector in view when the page resizes.
  new ResizeObserver(() => fitWorld()).observe(document.getElementById("world-view")!);
  // A drag turns the atlas's globe.
  bindGlobe();
  const screens = createScreens(playableMissions(game.content), () => game.mission.id, enter);
  /** A mission this session has played on, which "Resume Game" returns to instead of reloading it. */
  const inProgress = () => coop.active() || game.state.wave > 0 || game.state.towers.length > 0;
  /** The briefing and the paying start of solo campaign missions. */
  const flow = createCampaignFlow({
    game,
    execute,
    screens,
    solo: () => !forRoom && !coop.active() && !coop.inLobby(),
    unlockAll,
    locked: (id) => !!locks()?.has(id),
    underWay: () => inProgress() && game.state.status !== "won" && game.state.status !== "lost",
    started: () => {
      browsed = undefined;
    },
    image: terrainImage,
    fielded: (a) => {
      ui.fielded = a;
    },
  });
  /** Shows a screen: pauses or resumes the wave between game and menu and fills the menu page. */
  function enter(to: Screen, from: Screen | null) {
    // A briefing without a briefed mission (a stale entry, another tab's link): the atlas instead. First, because the
    // nested `show` enters the atlas itself.
    if (to.view === "menu" && to.page === "briefing" && !flow.mission()) return screens.show(page("missions"), { replace: true });
    // The same for a debrief that is gone (a new tab) and a campaign that is not complete.
    if (to.view === "menu" && to.page === "debrief" && !lastDebrief()) return screens.show(page("missions"), { replace: true });
    if (to.view === "menu" && to.page === "victory" && !campaignComplete(campaignRecord(), game.baseContent.sectors ?? [])) return screens.show(page("missions"), { replace: true });
    if (from?.view === "menu" && from.page === "debrief") stopStaging();
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
    if (from?.view === "menu" && from.page === "missions") browsed = atlasSelection(game) ?? browsed;
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
      renderMenu(game, primary, record, terrainImage, !trainingDone() && !Object.keys(record).length && !lastMission(), primary.kind !== "play" && bountyId() === primary.mission.id);
    }
    if (to.page === "play") renderPlay(game, campaignRecord());
    if (to.page !== "missions") forRoom = false;
    if (to.page === "missions") {
      const options = atlas();
      const back = missionSector === undefined && missionPick === undefined ? browsed : undefined;
      renderAtlas(game, options, missionSector ?? back?.sector, missionPick ?? back?.pick);
      renderAtlasArsenal(!!options.lobby);
      // Every unlock shown now has had its reveal; the next visit only reveals what a later win opens.
      if (options.locks) rememberUnlocks([...(options.seen ?? []), ...game.content.missions.filter((m) => !options.locks!.has(m.id)).map((m) => m.id)]);
    }
    if (to.page === "coop") coop.render();
    if (to.page === "editor") void import("../editor/editor-view").then((m) => m.openEditor(editorHost));
    if (to.page === "run") void import("../ui/run-view").then((m) => m.openRun(runHost));
    if (to.page === "arsenal") {
      // Opened from the briefing, the Arsenal leads back to it instead of offering a mission of its own.
      const briefing = from?.view === "menu" && from.page === "briefing" ? flow.mission() : undefined,
        debrief = from?.view === "menu" && from.page === "debrief" ? lastDebrief()?.mission.name : undefined,
        next = briefing || debrief ? undefined : arsenalNext(),
        // A solo campaign mission under way keeps its towers and gear until its next start or Restart.
        underway = !coop.active() && game.arsenal !== undefined && inProgress() && game.state.status !== "won" && game.state.status !== "lost";
      void import("../ui/arsenal-view").then((m) => m.renderArsenal(document.getElementById("arsenal-root")!, game.baseContent, { next, briefing, debrief, underway }));
    }
    if (to.page === "briefing") flow.render();
    if (to.page === "debrief") {
      const d = lastDebrief()!;
      debriefBehind = false;
      // What the Arsenal buys now, not what it bought when the mission ended.
      renderDebrief(document.getElementById("debrief-root")!, { ...d, ready: arsenalSummary().ready }, game.baseContent);
    }
    if (to.page === "victory") {
      const sectors = game.baseContent.sectors ?? [],
        record = campaignRecord(),
        hunt = modeGroups(sectors).campaign.flatMap((sector) => sector.missions).find((m) => (record[m.id] ?? 0) < 3);
      renderVictory(document.getElementById("victory-root")!, campaignTotals(record, loadArsenal(), sectors), hunt && { id: hunt.id, name: hunt.name, stars: record[hunt.id] ?? 0 });
    }
    // Any page change ends a codex animation preview; opening the codex renders it closed.
    closeCodexPreview();
    if (to.page === "codex") renderCodex(game);
    if (to.page === "towers") renderTowerCodexPage(game);
    missionSector = missionPick = undefined;
    scrollTo(0, 0);
    section?.focus({ preventScroll: true });
    // The briefing's first stop is Start.
    if (to.page === "briefing") flow.focusStart();
    if (to.page === "debrief") focusPrimary(document.getElementById("debrief-root")!);
    if (to.page === "victory") focusVictory(document.getElementById("victory-root")!);
  }
  /** Opens the debrief page: it takes the finished game's history entry; from a battlefield opened out of it, Back returns. */
  function openDebrief() {
    const d = lastDebrief(),
      now = screens.current();
    if (!d) return;
    opened = debriefKey(d);
    if (now.view === "menu" && now.page === "debrief") return;
    if (now.view === "game" && debriefBehind) {
      debriefBehind = false;
      return screens.back();
    }
    screens.show(page("debrief"), { replace: now.view === "game" });
  }
  /** What the debrief's buttons do; every exit but Battlefield takes the debrief's history entry. */
  function debriefAction(what: string) {
    const d = lastDebrief();
    if (!d) return;
    const atlas = (sector?: number) => {
      missionSector = sector;
      missionPick = undefined;
      screens.show(page("missions"), { replace: true });
    };
    if (what === "field") {
      debriefBehind = true;
      return screens.show(GAME);
    }
    if (what === "missions") return atlas();
    if (what === "replay") return flow.brief(d.mission.id, { replace: true }) || atlas();
    // Next: a briefing, the atlas flown to the sector the win opened (its flare is the reveal), or the ending.
    const next = d.next;
    if (next.kind === "briefing" && next.id) return flow.brief(next.id, { replace: true }) || atlas();
    if (next.kind === "atlas") return atlas(next.sector === undefined ? undefined : next.sector - 1);
    if (next.kind === "victory") return screens.show(page("victory"), { replace: true });
  }
  /**
   * The campaign mission the Arsenal page offers to start: the next open unwon one, unless a mission is under way (Back
   * returns to it) or a multiplayer session is open.
   */
  function arsenalNext() {
    const s = game.state.status;
    if (coop.active() || (inProgress() && s !== "won" && s !== "lost")) return undefined;
    const missions = modeGroups(game.content.sectors ?? []).campaign.flatMap((sector) => sector.missions);
    return atlasNext(missions, campaignRecord(), locks());
  }
  /** The atlas header's Arsenal button: Salvage on hand and what it buys now; hidden in a lobby (the CSS hides it on the Circuit). */
  function renderAtlasArsenal(lobby: boolean) {
    const button = document.getElementById("atlas-arsenal")!,
      { salvage, ready } = arsenalSummary();
    button.hidden = lobby;
    button.toggleAttribute("data-ready", ready > 0);
    button.setAttribute("aria-label", `Arsenal: ${salvage} Salvage${ready ? `, ${ready} ready to buy` : ""}`);
    document.getElementById("atlas-arsenal-info")!.innerHTML = `<b>${salvage}</b><span> Salvage</span>${ready ? ` <em class="atlas-arsenal-ready">${ready} ready</em>` : ""}`;
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
    // A solo campaign mission with the Arsenal in force is briefed first; its Start loads it (`campaign-flow.ts`).
    if (flow.brief(id)) return;
    execute({ type: "mission", id });
    browsed = undefined;
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
      // A journal the current rules cannot reproduce was dropped: the mission started over with a fresh one.
      beginJournal(game, r.code === "run-replay-reset" ? undefined : resumed);
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
  /** The home page's primary button: open the Play page when there is nothing to continue, return to the game in memory, move on to the next unwon mission, or replay the remembered one from wave 1. */
  function runPrimary() {
    if (primary.kind === "resume") return screens.show(GAME);
    if (primary.kind === "run") return screens.show(page("run"));
    // Reachable after a won or lost playtest: the home button then offers "restart" with the playtest mission.
    if (primary.kind === "restart" && isPlaytest(primary.mission)) {
      execute({ type: "restart" });
      return screens.show(GAME);
    }
    if (primary.kind === "restart" || primary.kind === "continue") return selectMission(primary.mission.id);
    screens.show(page("play"));
  }
  /** Opens the mission page on one game mode: the last mission's sector if it belongs to it, else its first sector. */
  function chooseMode(circle: boolean) {
    const sectors = game.content.sectors ?? [],
      { campaign, rings } = modeGroups(sectors),
      last = missionById(lastMission() ?? "", game.content.missions),
      home = last && sectorOf(last, sectors),
      sector = home && isCircleSector(home) === circle ? home : (circle ? rings : campaign)[0];
    missionSector = sector ? sectors.indexOf(sector) : undefined;
    // Back on the mode the player was browsing: the same sector and mission.
    if (browsed?.circle === circle) {
      missionSector = browsed.sector;
      missionPick = browsed.pick;
    }
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
  bindMenuKeys({ game, pickMission, showSector });
  /** Pointer shortcuts outside buttons: the home page's map preview and the atlas's land; false when `target` is neither. */
  function clickArea(target: Element): boolean {
    // The home page's map preview is a pointer shortcut for the primary button, which stays the keyboard route.
    if (target.closest("#home-map")) return runPrimary(), true;
    // A landmass on the atlas's world map selects its sector, like its label.
    const land = target.closest<SVGGElement>("#world-svg .land");
    if (land) return showSector(Number(land.dataset.sector), "sector-tabs"), true;
    return false;
  }
  /** The menu's and the atlas's buttons, and the game's ways out to the menu; false when `b` is none of them. */
  function click(b: HTMLButtonElement): boolean {
    if (b.dataset.back !== undefined) return screens.back(), true;
    // The Codex's Enemies | Towers switch swaps the page in place, so Back still leaves the Codex.
    if (b.dataset.codex) return screens.show(page(b.dataset.codex as "codex" | "towers"), { replace: true }), true;
    if (b.dataset.toTop !== undefined) return scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), true;
    if (b.dataset.worldZoom !== undefined) return toggleWorld(), true;
    if (b.dataset.planet) return selectWorld(game, Number(b.dataset.planet), atlas()), true;
    if (b.dataset.mission) return selectMission(b.dataset.mission), true;
    if (b.dataset.arsenal !== undefined) return screens.show(page("arsenal")), true;
    if (b.dataset.debrief) return debriefAction(b.dataset.debrief), true;
    switch (b.dataset.victory) {
      case "circuit":
        return chooseMode(true), true;
      case "atlas":
        return chooseMode(false), true;
      case "run":
        return screens.show(page("run")), true;
    }
    if (b.dataset.briefTab) return showBriefTab(b.dataset.briefTab as BriefTab), true;
    if (b.dataset.pick) {
      pickMission(b.dataset.pick);
      // The inspector's previous/next buttons are rendered anew; the focus stays on the same side, or moves to Start
      // at the sector's first or last mission.
      if (b.dataset.step)
        document.querySelector<HTMLElement>(`#brief-actions [data-step="${b.dataset.step}"]:not(:disabled), #brief-actions .atlas-start`)?.focus({ preventScroll: true });
      return true;
    }
    if (b.dataset.sector) return showSector(Number(b.dataset.sector), b.parentElement!.id), true;
    if (b.dataset.codexTab) return showCodexTab(game, b.dataset.codexTab as CodexTab), true;
    if (b.dataset.towerCodex) return showTowerCodex(game, Number(b.dataset.towerCodex)), true;
    switch (b.id) {
      case "menu-campaign":
        chooseMode(false);
        break;
      case "menu-circle":
        chooseMode(true);
        break;
      case "menu-run":
        screens.show(page("run"));
        break;
      case "atlas-arsenal":
        screens.show(page("arsenal"));
        break;
      case "overlay-debrief":
        openDebrief();
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
      case "menu-play":
        screens.show(page("play"));
        break;
      case "overlay-missions":
        screens.show(page(isPlaytest(game.mission) ? "editor" : isRunMission(game.mission) ? "run" : "missions"));
        break;
      case "overlay-next": {
        if (isRunMission(game.mission)) {
          screens.show(page("run"));
          break;
        }
        const next = nextMission(game, locks(), ui.record());
        if (next) selectMission(next.id);
        break;
      }
      default:
        return false;
    }
    return true;
  }
  return {
    screens,
    click,
    clickArea,
    /** "Choose mission" in a multiplayer lobby: the atlas picks the room's mission. */
    pickForRoom() {
      forRoom = true;
      screens.show(page("missions"));
    },
    /** HUD Restart: a paying campaign game starts again with its loadout and the current gear, any other restarts. */
    restart() {
      if (!flow.restart()) execute({ type: "restart" });
    },
    /** A newly loaded mission starts fresh: no wave waits to resume from a menu pause. */
    missionLoaded() {
      resumeAfterMenu = false;
      debriefBehind = false;
    },
    /**
     * A paying campaign game just ended: the debrief opens by itself after a moment, once, unless the player already
     * opened it, left the game view or started something else.
     */
    debriefSoon(d: Debrief) {
      const key = debriefKey(d);
      setTimeout(() => {
        if (opened === key || screens.current().view !== "game" || ui.debrief?.state !== game.state) return;
        openDebrief();
      }, 1200);
    },
  };
}
