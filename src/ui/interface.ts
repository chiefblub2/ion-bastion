import { Game, isRunning, SELL_REFUND } from "../core/game";
import { isCircleSector, missionNumber, sectorOf } from "../content/missions";
import { upgradeOption } from "../core/upgrades";
import { towerDetails } from "./tower-details";
import { enemyDetails, enemyKey } from "./enemy-details";
import { isHidden } from "../systems/traits";
import { earlyBonus, wavesLeft } from "../systems/circle";
import { WAVE_BREAK } from "../systems/waves";
import { renderWaveForecast, waveForecast } from "./wave-forecast";
import { liveUnits, renderLiveUnits } from "./live-units";
import { renderEnemyCodex, type CodexTab } from "./enemy-codex";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import type { MissionSector, TowerId } from "../core/types";
import { MODE_IDS, MODES } from "../core/modes";
import { renderPlayers, renderSends, versusOutcome, type MultiplayerSession } from "./players";
export type { MultiplayerSession } from "./players";
import type { ViewState } from "../render/scene";
import { hotkeyTowers, isPaged, pageOf, TOWER_PAGES, towerOrder } from "./tower-pages";
const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI"];
const roman = (index: number) => ROMAN[index] ?? String(index + 1);
/** Hotkeys for the towers of the open tab, from 1 again on every tab; more than ten continue with letters. */
export const TOWER_KEYS = "1234567890qwer";
export const towerKey = (index: number) => TOWER_KEYS[index]?.toUpperCase() ?? "";
/** "1–9, 0, Q, W" for a tab of twelve towers; `wrap` formats each key, e.g. as `<kbd>`. */
function towerKeyRange(count: number, wrap = (key: string) => key) {
  const keys = [...TOWER_KEYS.slice(0, count).toUpperCase()].map(wrap);
  return keys.length <= 2 ? keys.join(", ") : [`${keys[0]}–${keys[Math.min(8, keys.length - 1)]}`, ...keys.slice(9)].join(", ");
}
/** Header of a start-screen page: back, the brand (a link home) and the title. */
const pageHead = (eyebrow: string, title: string, id: string) =>
  `<header class="menu-page-head"><button class="quiet menu-back" data-back>← Back</button><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">I</span><span>ION<span class="brand-light">BASTION</span></span></a></header><p class="eyebrow">${eyebrow}</p><h1 id="${id}">${title}</h1>`;
export function mountUI(game: Game) {
  const TOWERS = game.content.towers;
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="start-screen" class="start-screen">
  <section class="menu-page menu-home" data-page="home" tabindex="-1" aria-labelledby="menu-title"><p class="eyebrow">TOWER DEFENSE</p><h2 id="menu-title" class="menu-title"><span class="brand-mark">I</span><span>ION<span class="brand-light">BASTION</span></span></h2><p class="menu-tagline">Hold the line. Protect the reactor.</p><div class="menu-options"><button id="menu-continue" class="mission-mode menu-continue" hidden><strong>Continue ▶</strong><span id="menu-continue-mission"></span></button><button id="menu-campaign" class="mission-mode"><strong>Campaign</strong><span>Defend the reactor</span><small id="menu-campaign-info"></small></button><button id="menu-circle" class="mission-mode" data-mode="circle"><strong>⟳ Circuit</strong><span>Keep the ring under the limit</span><small id="menu-circle-info"></small></button><button id="menu-coop" class="mission-mode"><strong>Multiplayer ⇄</strong><span>Together or against each other</span><small>2–4 players · ${MODE_IDS.map((id) => MODES[id].name).join(" · ")}</small></button></div><div class="dialog-actions"><button id="menu-codex" class="quiet">Enemy Codex <span>◆</span></button><button id="menu-help" class="quiet">Help <span>?</span></button></div></section>
  <section id="mission-page" class="menu-page" tabindex="-1" data-page="missions" aria-labelledby="missions-title" hidden>${pageHead("OPERATIONS", "Choose a mission.", "missions-title")}<p id="mission-warning" class="mission-warning" hidden>Your current defense and progress will be reset.</p><div id="mission-modes" class="mission-modes" role="tablist" aria-label="Game mode" hidden></div><div id="sector-tabs" class="sector-tabs" role="tablist" aria-label="Sectors" hidden></div><p id="mode-rules" class="mode-rules" hidden>Closed rings without a reactor: enemies circle until they fall. Waves start on a timer; calling one early earns credits. If more enemies are in the ring than the limit allows, the mission is lost.</p><div id="mission-list" class="mission-list"></div></section>
  <section id="coop-page" class="menu-page" tabindex="-1" data-page="coop" aria-labelledby="coop-title" hidden>${pageHead("MULTIPLAYER · 2–4 PLAYERS", "Together or against each other.", "coop-title")}<fieldset id="coop-modes" class="coop-modes"><legend>Mode</legend>${MODE_IDS.map((id) => `<label><input type="radio" name="coop-mode" value="${id}"${id === "coop" ? " checked" : ""}><span>${MODES[id].name}</span></label>`).join("")}</fieldset><p id="coop-rules" class="coop-rules">${MODES.coop.rules}</p><p class="coop-mission">Mission: <b id="coop-mission"></b> <button id="coop-pick" class="text-button">Choose mission</button></p><p id="coop-status" role="status"></p><div id="coop-lobby"><div class="dialog-actions"><button id="coop-create" class="primary">Create room</button></div><form id="coop-join-form" class="coop-join"><label for="coop-code">Room code</label><input id="coop-code" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD"><button id="coop-join" class="quiet" type="submit">Join</button></form></div><div id="coop-room" hidden><p class="coop-code">Room <b id="coop-room-code"></b></p><div class="dialog-actions"><button id="coop-leave" class="quiet">Leave room</button><button id="coop-launch" class="primary" hidden>Start mission</button></div></div></section>
  <section id="codex-page" class="menu-page" tabindex="-1" data-page="codex" aria-labelledby="codex-title" hidden>${pageHead("ENEMY CODEX", "Know your enemy.", "codex-title")}<p>All enemy types in the order the campaign introduces them. HP and speed apply to wave 1; later waves have more HP.</p><div id="codex-tabs" class="codex-tabs" role="tablist" aria-label="Enemy Codex"></div><div id="codex-list" class="codex-list" role="tabpanel"></div></section>
  <section id="help-page" class="menu-page" tabindex="-1" data-page="help" aria-labelledby="help-title" hidden>${pageHead("FIELD MANUAL", "Your core. Your line.", "help-title")}<p>Survive all waves of a mission. When an enemy reaches the reactor, it loses energy. At 0 the mission is lost.</p><ol><li><strong>Build your defense</strong><br>Pick a tower on the right and click a free cell next to the path. Traps go right on the path. The circle shows its range.</li><li><strong>Start a wave</strong><br>Defeated enemies give credits. After each wave you get a bonus, and after ${WAVE_BREAK} seconds the next wave starts on its own. You can also build during a wave. Press <kbd>N</kbd> to start it earlier.</li><li><strong>Upgrade towers</strong><br>Click a built tower. Attack towers reach level 5; levels 4 and 5 are expensive, but give more per credit than another tower. With the Aura tower you pick a path (damage, attack speed or range) and expand it in three levels. For several bonuses, build several Auras. Selling refunds ${SELL_REFUND * 100}% of your investment.</li></ol><div class="tip">Tip: Nova hits groups, but only ground units. Against Gliders in the air, Flak and all other attack towers help. Tesla jumps from enemy to enemy, the Lance pierces whole rows. Stasis halts enemies briefly, Corrosion makes them take more damage, Decay cracks Titans. Focus gets stronger the longer it stays on the same target, and Gravitron pulls ground enemies back. The Mortar shells groups from long range, Quake shakes everything around the tower, the Executioner finishes off wounded enemies, Shrapnel hits several targets at once, the Jammer switches off shields and healing, and the Snare Net pulls flyers into range of ground towers. Bounty Beacon, Repair Dock and Tracker help without attacking themselves. Traps like Mine, Caltrops, Sticky Mine or Pitfall go directly on the path; they trigger when ground enemies walk over them, stealthed ones too. Aura boosts nearby attack towers once you buy a path. A Refinery built early pays out credits after every wave. A tower can only target stealthed enemies within range of a Detector.</div><p class="keyboard-help">${towerKeyRange(Math.max(...TOWER_PAGES.map((_, i) => Object.values(TOWERS).filter((t) => pageOf(t) === i).length)), (key) => `<kbd>${key}</kbd>`)} Pick a tower on the open tab · <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>${TOWER_PAGES.length}</kbd> Switch tab<br><kbd>Esc</kbd>, right-click or ✕: deselect<br><kbd>Shift</kbd>+click: build several towers of the same type<br><kbd>Space</kbd> Pause · <kbd>N</kbd> Start wave · <kbd>F</kbd> Fullscreen<br><kbd>T</kbd> Cycle target priority of the selected tower<br>Click an enemy: HP and traits<br>On the field: arrow keys + Enter</p><button class="primary" data-back>Got it</button></section>
  </div>
  <div id="game-view"><header class="topbar"><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">I</span><span>ION<span class="brand-light">BASTION</span></span></a><span class="edition">TOWER DEFENSE <b id="edition-number">01</b></span><div class="header-actions"><button id="menu-btn" class="quiet">Menu <span>☰</span></button><button id="coop-btn" class="quiet">Multiplayer <span>⇄</span></button><button id="codex-btn" class="quiet">Enemy Codex <span>◆</span></button><button id="help-btn" class="quiet">Help <span>?</span></button><button id="sound-btn" class="quiet" aria-pressed="false">Sound off</button></div></header>
  <main><div class="mission-heading"><div><p class="eyebrow">MISSION <b id="mission-number">01</b> <span>/</span> <b id="mission-sector">DEFENSE</b></p><h1>Hold the line.</h1><p id="mission-focus" class="mission-focus"></p></div><div class="mission-meta"><span class="sector-label" id="sector-label"></span><span class="difficulty" id="difficulty"></span></div></div>
  <div class="workspace"><section class="field-panel" aria-label="Battlefield"><div class="field-toolbar"><div class="resources"><div><span class="stat-label">CREDITS</span><strong class="credits"><span class="resource-icon">◇</span><span id="gold"></span></strong></div><div><span class="stat-label" id="lives-label">REACTOR</span><strong><span class="resource-icon heart">♡</span><span id="lives"></span><small id="lives-max"></small></strong></div><div><span class="stat-label">WAVE</span><strong><span id="wave">00</span><small id="wave-total"></small></strong></div></div><div id="wave-forecast" class="next-wave-slot"></div><div class="playback"><button id="toolbar-start" class="toolbar-start" title="Start next wave (N)"><b>Wave</b> 01 <span>▶</span></button><button id="pause-btn" title="Pause (Space)" aria-label="Pause game" aria-pressed="false">Ⅱ</button><button id="speed-btn" aria-label="Change game speed">1×</button><button id="fullscreen-btn" title="Fullscreen (F)" aria-label="Fullscreen (F)" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4"/></svg></button></div></div>
  <div id="players-panel" class="players-panel" aria-label="Teammates" hidden></div>
  <div id="board-wrap"><div id="board" tabindex="0" role="application" aria-label="Tower defense battlefield. Arrow keys select a cell; Enter builds or selects a tower. Keys ${towerKeyRange(Object.keys(TOWERS).length)} pick a tower type."></div><div id="game-overlay" hidden><div id="overlay-icon">Ⅱ</div><p class="eyebrow" id="overlay-kicker">TACTICAL PAUSE</p><h2 id="overlay-title">Time for a plan.</h2><p id="overlay-copy">Press Space or the pause button to resume.</p><div class="overlay-actions"><button id="overlay-next" class="primary" hidden>Next mission <span>→</span></button><button id="overlay-restart" class="primary" hidden>Restart</button><button id="overlay-missions" class="quiet" hidden>Missions</button></div></div></div>
  <div class="field-footer"><span><i class="legend-path"></i>Enemy path</span><span><i class="legend-build"></i>Free build area</span><span id="cell-label">Pick a tower, then click a cell</span></div>
  <div class="wave-timeline"><div class="timeline-label"><span>MISSION PROGRESS</span><b id="progress-label"></b></div><div id="wave-segments"></div></div>
  </section>
  <aside class="sidebar"><div class="section-title towers-title"><h2>Towers</h2><span>01–${String(Object.keys(TOWERS).length).padStart(2, "0")}</span></div><div class="tower-menu"><div id="tower-tabs" class="tower-tabs" role="tablist" aria-label="Tower categories" hidden></div><div id="tower-list" class="tower-list" role="tabpanel">${towerOrder(game)
    .map((id) => TOWERS[id])
    .map(
      (t, i) =>
        `<button class="tower-card ${t.id}" style="--accent:#${t.color.toString(16).padStart(6, "0")}" data-tower="${t.id}" aria-pressed="false" title="${t.role}: ${t.description}" aria-label="${t.name}, ${t.role}, ${t.cost} credits"><span class="tower-symbol">${t.visual.icon}</span><strong class="tower-name">${t.name}</strong><span class="tower-cost"><b>◇ ${t.cost}</b><kbd>${towerKey(i)}</kbd></span></button>`,
    )
    .join("")}</div></div>
  <section id="send-panel" class="send-panel" aria-label="Send enemies" hidden></section><div id="selection" class="selection"></div><section id="live-units" class="live-units" aria-label="Enemies on the field" hidden></section></aside></div>
  <footer class="bottom-bar"><span id="notice" role="status" aria-live="polite">Pick a tower and place it next to the path.</span><button id="restart-btn" class="text-button">Restart</button></footer></main></div>
  <dialog id="restart-dialog"><h2>Restart mission?</h2><p>Your current defense and progress will be reset.</p><div class="dialog-actions"><button id="cancel-restart" class="quiet">Keep playing</button><button id="confirm-restart" class="primary">Restart</button></div></dialog>`;
}
/** Everything in the shell that depends on the active mission. */
export function renderMission(game: Game) {
  const m = game.mission,
    total = game.waves.length,
    number = missionNumber(m, game.content.missions);
  const board = document.getElementById("board")!;
  board.style.aspectRatio = `${m.map.columns}/${m.map.rows}`;
  // Used by the full-screen layout to fit the board into the available height.
  board.style.setProperty("--cols", String(m.map.columns));
  board.style.setProperty("--rows", String(m.map.rows));
  text("edition-number", pad(number));
  text("mission-number", pad(number));
  // Only the mission's towers are offered, grouped by page; with tabs every page numbers its towers from 1.
  const order = towerOrder(game),
    list = document.getElementById("tower-list")!,
    cards = [...list.querySelectorAll<HTMLButtonElement>("[data-tower]")];
  for (const id of order) list.append(cards.find((c) => c.dataset.tower === id)!);
  for (const card of cards) {
    const id = card.dataset.tower as TowerId;
    if (!order.includes(id)) card.hidden = true;
    card.querySelector("kbd")!.textContent = towerKey(hotkeyTowers(game, pageOf(game.content.towers[id])).indexOf(id));
  }
  const tabs = document.getElementById("tower-tabs")!;
  tabs.hidden = !isPaged(game);
  tabs.innerHTML = TOWER_PAGES.map((page, i) => {
    const count = order.filter((id) => pageOf(game.content.towers[id]) === i).length;
    return count ? `<button class="tower-tab" role="tab" id="tower-tab-${i}" data-tower-page="${i}" aria-controls="tower-list" aria-selected="false" tabindex="-1" title="Shift+${i + 1}" aria-keyshortcuts="Shift+${i + 1}">${page.name} <small>${count}</small></button>` : "";
  }).join("");
  const sectors = game.content.sectors ?? [],
    sector = sectorOf(m, sectors);
  text("mission-sector", sector ? `SECTOR ${roman(sectors.indexOf(sector))} · ${sector.name.toUpperCase()}` : "DEFENSE");
  text("mission-focus", m.focus);
  text("sector-label", m.map.name);
  text("difficulty", `${total} ${plural(total, "wave")} · ◇ ${m.startingCredits} starting credits`);
  // A ring has no reactor; the HUD counts the enemies in it against the limit instead.
  text("lives-label", m.circle ? "IN RING" : "REACTOR");
  text("lives-max", `/ ${m.circle ? m.circle.limit : m.reactorEnergy}`);
  text("wave-total", `/ ${total}`);
  document.getElementById("wave-segments")!.innerHTML = Array.from(
    { length: total },
    (_, i) => `<span data-wave="${i + 1}"><i></i><small>${pad(i + 1)}</small></span>`,
  ).join("");
}
/** The campaign sectors and the Circuit sectors, each a game mode of its own. */
export function modeGroups(sectors: readonly MissionSector[]) {
  return { campaign: sectors.filter((sector) => !isCircleSector(sector)), rings: sectors.filter(isCircleSector) };
}
const missionCount = (members: readonly MissionSector[]) => members.reduce((n, sector) => n + sector.missions.length, 0);
const campaignInfo = (campaign: readonly MissionSector[]) => `Sector I–${roman(campaign.length - 1)} · ${missionCount(campaign)} ${plural(missionCount(campaign), "mission")}`;
/**
 * Fills the start screen's home page. "Continue" returns to `resume` when a mission is in progress in this
 * session, else it loads the remembered mission `last` while it still exists.
 */
export function renderMenu(game: Game, last: string | undefined, resume: boolean) {
  const missions = game.content.missions,
    { campaign, rings } = modeGroups(game.content.sectors ?? []),
    target = resume ? game.mission : missions.find((m) => m.id === last);
  document.getElementById("menu-continue")!.hidden = !target;
  if (target) text("menu-continue-mission", `Mission ${pad(missionNumber(target, missions))} · ${target.name}${resume ? ` · Wave ${pad(Math.max(1, game.state.wave))}` : ""}`);
  text("menu-campaign-info", campaign.length ? campaignInfo(campaign) : `${missions.length} ${plural(missions.length, "mission")}`);
  document.getElementById("menu-circle")!.hidden = !rings.length;
  text("menu-circle-info", `${missionCount(rings)} ${plural(missionCount(rings), "mission")}`);
}
/**
 * Fills the mission page; called each time it opens and on every tab change.
 * With sectors, one tab per sector shows its missions; it opens on the active mission's sector.
 */
export function renderMissionList(game: Game, sectorIndex?: number) {
  const s = game.state,
    missions = game.content.missions,
    sectors = game.content.sectors ?? [],
    current = sectorOf(game.mission, sectors),
    selected = sectors[sectorIndex ?? (current ? sectors.indexOf(current) : 0)];
  document.getElementById("mission-warning")!.hidden =
    s.wave === 0 && s.towers.length === 0;
  // Circuit sectors form their own mode with its own tab, apart from the campaign sectors.
  const circle = !!selected && isCircleSector(selected),
    group = sectors.filter((sector) => isCircleSector(sector) === circle),
    { campaign, rings } = modeGroups(sectors),
    modes = document.getElementById("mission-modes")!;
  modes.hidden = !campaign.length || !rings.length;
  modes.innerHTML = modes.hidden
    ? ""
    : ([
        [false, campaign, "Campaign", "Defend the reactor", campaignInfo(campaign)],
        [true, rings, "⟳ Circuit", "Keep the ring under the limit", `${missionCount(rings)} ${plural(missionCount(rings), "mission")}`],
      ] as const).map(([ring, members, name, goal, info]) => {
        const active = ring === circle,
          i = sectors.indexOf(members[0]);
        return `<button class="mission-mode" role="tab" id="mission-mode-${ring ? "circle" : "campaign"}" data-sector="${i}"${ring ? ' data-mode="circle"' : ""} aria-controls="mission-list" aria-selected="${active}" tabindex="${active ? 0 : -1}"${!!current && isCircleSector(current) === ring ? ' data-current="true"' : ""}><strong>${name}</strong><span>${goal}</span><small>${info}</small></button>`;
      }).join("");
  document.getElementById("mission-page")!.toggleAttribute("data-circle", circle);
  document.getElementById("mode-rules")!.hidden = !circle;
  const tabs = document.getElementById("sector-tabs")!;
  tabs.hidden = !selected || group.length < 2;
  tabs.innerHTML = tabs.hidden ? "" : group.map((sector) => {
    const i = sectors.indexOf(sector),
      first = missionNumber(sector.missions[0], missions),
      last = first + sector.missions.length - 1,
      active = sector === selected;
    return `<button class="sector-tab" role="tab" id="sector-tab-${i}" data-sector="${i}" aria-controls="mission-list" aria-selected="${active}" tabindex="${active ? 0 : -1}"${sector === current ? ' data-current="true"' : ""}><span class="sector-index">${roman(i)} <small>${pad(first)}–${pad(last)}</small></span><span class="sector-name">${sector.name}</span></button>`;
  }).join("");
  const list = document.getElementById("mission-list")!;
  if (selected && !tabs.hidden) {
    list.setAttribute("role", "tabpanel");
    list.setAttribute("aria-labelledby", `sector-tab-${sectors.indexOf(selected)}`);
  } else if (!modes.hidden) {
    list.setAttribute("role", "tabpanel");
    list.setAttribute("aria-labelledby", `mission-mode-${circle ? "circle" : "campaign"}`);
  } else {
    list.removeAttribute("role");
    list.removeAttribute("aria-labelledby");
  }
  list.innerHTML = (selected?.missions ?? missions).map((m) => {
    const n = missionNumber(m, missions);
    return `<button class="mission-card" data-mission="${m.id}"${m.id === game.mission.id ? ' aria-current="true"' : ""}><span class="mission-index">${pad(n)}</span><span class="mission-copy"><strong>${m.name}</strong><small>${m.focus}</small></span><span class="mission-stats"><b>${m.waves.length} ${plural(m.waves.length, "wave")}</b><small>◇ ${m.startingCredits}</small>${m.circle ? `<small class="ring-badge">⟳ Ring · max ${m.circle.limit}</small>` : ""}</span></button>`;
  }).join("");
}
/** Fills the enemy codex page; called when it opens and on every tab change. */
export function renderCodex(game: Game, tab: CodexTab = "enemies") {
  const { tabs, list } = renderEnemyCodex(game.content, tab),
    panel = document.getElementById("codex-list")!;
  document.getElementById("codex-tabs")!.innerHTML = tabs;
  panel.innerHTML = list;
  panel.setAttribute("aria-labelledby", `codex-tab-${tab}`);
  panel.scrollTop = 0;
}
export function nextMission(game: Game) {
  const missions = game.content.missions;
  return missions[missions.findIndex((m) => m.id === game.mission.id) + 1];
}
function text(id: string, value: string) {
  const e = document.getElementById(id)!;
  if (e.textContent !== value) e.textContent = value;
}
export class Interface {
  private selectionKey = "";
  private forecastKey = "";
  private liveHtml = "";
  private playersHtml = "";
  private sendHtml = "";
  /** Set by the multiplayer controller; null in single-player. */
  session: () => MultiplayerSession | null = () => null;
  constructor(
    private game: Game,
    private view: ViewState,
  ) {}
  /** Flashes the credits counter when refineries pay out. */
  flashCredits() {
    const e = document.querySelector(".credits")!;
    e.classList.remove("income-flash");
    void (e as HTMLElement).offsetWidth;
    e.classList.add("income-flash");
  }
  notice(message: string, error = false) {
    text("notice", message);
    document.getElementById("notice")!.classList.toggle("error", error);
  }
  refresh() {
    const { towers: TOWERS } = this.game.content,
      content = this.game.content,
      s = this.game.state,
      session = this.session(),
      match = session?.match ?? null,
      me = this.view.player,
      terminal = s.status === "won" || s.status === "lost" || !!match?.result;
    // In versus the local field is a solo game: its only wallet is ours.
    const gold = (match ? s.wallets[0] : s.wallets[me]) ?? 0;
    text("gold", String(gold));
    const players = document.getElementById("players-panel")!,
      playersHtml = session ? renderPlayers(this.game, session, me) : "";
    players.hidden = !session;
    if (playersHtml !== this.playersHtml) {
      this.playersHtml = playersHtml;
      players.innerHTML = playersHtml;
    }
    const sends = document.getElementById("send-panel")!,
      sendHtml = match && MODES[match.mode].sends ? renderSends(match, me, terminal || !match.isAlive(me)) : "";
    sends.hidden = !sendHtml;
    if (sendHtml !== this.sendHtml) {
      this.sendHtml = sendHtml;
      sends.innerHTML = sendHtml;
    }
    const circle = this.game.mission.circle,
      ringCount = s.enemies.length;
    text("lives", String(circle ? ringCount : s.lives));
    text("wave", String(s.wave).padStart(2, "0"));
    text(
      "progress-label",
      `${s.status === "ready" || s.status === "won" ? s.wave : Math.max(0, s.wave - 1)} / ${this.game.waves.length}`,
    );
    document
      .getElementById("lives")!
      .classList.toggle("critical", circle ? ringCount >= circle.limit * 0.8 : s.lives <= 5);
    const pause = document.getElementById("pause-btn")! as HTMLButtonElement;
    pause.textContent = s.paused ? "▶" : "Ⅱ";
    pause.setAttribute("aria-pressed", String(s.paused));
    pause.setAttribute(
      "aria-label",
      s.paused ? "Resume game" : "Pause game",
    );
    pause.disabled = !isRunning(s);
    pause.hidden = !!match;
    text("speed-btn", `${this.view.speed}×`);
    // Without tabs every available tower shows; with tabs only the current page.
    const paged = isPaged(this.game),
      available = this.game.availableTowers(),
      building = this.view.build ? pageOf(TOWERS[this.view.build]) : -1;
    for (const tab of document.querySelectorAll<HTMLButtonElement>("[data-tower-page]")) {
      const page = Number(tab.dataset.towerPage),
        current = page === this.view.page;
      tab.setAttribute("aria-selected", String(current));
      tab.tabIndex = current ? 0 : -1;
      tab.toggleAttribute("data-building", page === building && !current);
    }
    for (const el of document.querySelectorAll<HTMLButtonElement>(
      "[data-tower]",
    )) {
      const id = el.dataset.tower as TowerId;
      el.hidden = !available.includes(id) || (paged && pageOf(TOWERS[id]) !== this.view.page);
      el.classList.toggle("active", this.view.build === id);
      el.classList.toggle("unaffordable", gold < TOWERS[id].cost);
      el.setAttribute("aria-pressed", String(this.view.build === id));
      el.disabled = terminal;
    }
    for (const el of document.querySelectorAll<HTMLElement>("[data-wave]")) {
      const n = Number(el.dataset.wave);
      el.classList.toggle(
        "complete",
        n < s.wave ||
          (n === s.wave && (s.status === "ready" || s.status === "won")),
      );
      el.classList.toggle("current", n === s.wave && s.status === "wave");
    }
    const forecast = document.getElementById("wave-forecast")!,
      forecastKey = `${this.game.mission.id}/${s.wave}/${s.status}`;
    if (forecastKey !== this.forecastKey) {
      this.forecastKey = forecastKey;
      const next = waveForecast(this.game);
      forecast.innerHTML = next
        ? renderWaveForecast(next)
        : `<p class="next-wave-empty">${terminal ? `MISSION OVER · ${s.status === "won" ? "All waves repelled" : circle ? "Ring overloaded" : "Reactor lost"}` : "FINAL WAVE IN PROGRESS"}</p>`;
    }
    const panel = document.getElementById("live-units")!,
      live = liveUnits(this.game),
      liveHtml = live ? renderLiveUnits(live, s.wave) : "";
    panel.hidden = !live;
    if (liveHtml !== this.liveHtml) {
      this.liveHtml = liveHtml;
      panel.innerHTML = liveHtml;
    }
    const t = s.towers.find((t) => t.id === this.view.selected),
      foreign = !!t && t.owner !== this.view.player,
      d = t ? TOWERS[t.type] : this.view.build ? TOWERS[this.view.build] : null;
    const auraKey = t ? JSON.stringify([
      t.upgrades,
      effectiveTowerStats(t, s.towers, content).bonuses,
      TOWERS[t.type].attack.kind === "aura" ? s.towers.filter(target => isInAura(t, target, content)).length : 0,
    ]) : "";
    // A selected enemy that died, leaked or vanished into stealth drops out of the panel.
    let enemy = s.enemies.find((e) => e.id === this.view.enemy);
    if (enemy && isHidden(this.game, enemy)) enemy = undefined;
    if (!enemy) this.view.enemy = null;
    const key = enemy ? `enemy/${enemyKey(this.game, enemy)}` : `${t?.id}/${t?.priority}/${this.view.build}/${auraKey}`;
    if (key !== this.selectionKey) {
      this.selectionKey = key;
      const box = document.getElementById("selection")!;
      if (enemy) {
        box.innerHTML = enemyDetails(this.game, enemy);
      } else if (d) {
        box.innerHTML = towerDetails(d.id as TowerId, t, s.towers, content);
      } else
        box.innerHTML =
          '<div class="selection-heading"><span>TACTICS</span><b>◇</b></div><p>Build at bends to keep enemies in range longer.</p><div class="placement-note">Click a built tower to upgrade it, or an enemy to see its HP and traits.</div>';
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-upgrade]")) {
      button.disabled = !t || terminal || foreign || upgradeOption(t, button.dataset.upgrade!, gold, content).status !== "available";
    }
    const sell = document.getElementById(
      "sell-btn",
    ) as HTMLButtonElement | null;
    if (sell) sell.disabled = terminal || foreign;
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-priority]")) button.disabled = terminal || foreign;
    // On a ring the next wave comes on a timer and may be called early for a bonus.
    const quick = document.getElementById("toolbar-start") as HTMLButtonElement,
      ready = !!match?.ready[me],
      callable = !!circle && s.status === "wave" && wavesLeft(this.game) > 0,
      quickLabel = callable
        ? `<b>Wave</b> ${pad(s.wave + 1)} <small>${Math.ceil(s.circle!.next)} s · +${earlyBonus(this.game)} ◇</small> <span>▶</span>`
        : s.status === "wave"
          ? "<b>Wave</b> running"
          : match
            ? `<b>${ready ? "Ready ✓" : "Ready"}</b> ${pad(s.wave + 1)}${ready ? "" : " <span>▶</span>"}`
            : `<b>Wave</b> ${pad(s.wave + 1)}${s.nextWave !== undefined ? ` <small>${Math.ceil(s.nextWave)} s</small>` : ""} <span>▶</span>`;
    quick.hidden = terminal;
    quick.disabled = !callable && (s.status !== "ready" || ready);
    if (quick.innerHTML !== quickLabel) {
      quick.innerHTML = quickLabel;
      quick.setAttribute(
        "aria-label",
        callable ? `Call wave ${s.wave + 1} now` : s.status === "wave" ? "Wave running" : match ? `Ready for wave ${s.wave + 1}` : `Start wave ${s.wave + 1}${s.nextWave !== undefined ? ` (starts on its own in ${Math.ceil(s.nextWave)} s)` : ""}`,
      );
    }
    const overlay = document.getElementById("game-overlay")!;
    if (match) {
      const outcome = versusOutcome(match, me),
        host = me === 0 && !!outcome?.over;
      overlay.hidden = !outcome;
      if (outcome) {
        text("overlay-icon", outcome.icon);
        text("overlay-kicker", outcome.kicker);
        text("overlay-title", outcome.title);
        text("overlay-copy", outcome.copy);
        const next = host ? nextMission(this.game) : undefined;
        document.getElementById("overlay-next")!.hidden = !next;
        document.getElementById("overlay-restart")!.hidden = !host;
        text("overlay-restart", "Rematch");
        document.getElementById("overlay-missions")!.hidden = !host;
      }
    } else overlay.hidden = !s.paused && !terminal;
    if (!overlay.hidden && !match) {
      text("overlay-icon", terminal ? (s.status === "won" ? "✦" : "◇") : "Ⅱ");
      text("overlay-kicker", terminal ? "MISSION OVER" : "TACTICAL PAUSE");
      text(
        "overlay-title",
        s.status === "won"
          ? circle ? "The ring is empty." : "The line holds."
          : s.status === "lost"
            ? circle ? "Ring overloaded." : "Reactor lost."
            : "Time for a plan.",
      );
      text(
        "overlay-copy",
        s.status === "won"
          ? circle
            ? `${this.game.mission.name}: all ${this.game.waves.length} ${plural(this.game.waves.length, "wave")} wiped out. ${s.kills} ${s.kills === 1 ? "enemy" : "enemies"} defeated.`
            : `${this.game.mission.name}: all ${this.game.waves.length} ${plural(this.game.waves.length, "wave")} repelled. ${s.kills} ${s.kills === 1 ? "enemy" : "enemies"} defeated. ${s.lives} reactor energy left.`
          : s.status === "lost" && circle
            ? `More than ${circle.limit} enemies circled at once. You reached wave ${s.wave} and defeated ${s.kills} ${s.kills === 1 ? "enemy" : "enemies"}. Only call waves when the ring is emptier.`
          : s.status === "lost"
            ? `You reached wave ${s.wave} and defeated ${s.kills} ${s.kills === 1 ? "enemy" : "enemies"}. Try more upgrades and Cryo support.`
            : "You can keep building. Use the pause button to continue.",
      );
      const next = s.status === "won" ? nextMission(this.game) : undefined;
      document.getElementById("overlay-next")!.hidden = !next;
      document.getElementById("overlay-restart")!.hidden = !terminal || !!next;
      text("overlay-restart", s.status === "won" ? "Play again" : "Restart");
      document.getElementById("overlay-missions")!.hidden = !terminal;
    }
    if (this.view.hover)
      text(
        "cell-label",
        `Cell ${String.fromCharCode(65 + this.view.hover.x)}${this.view.hover.y + 1}`,
      );
  }
}
