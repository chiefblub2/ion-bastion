import { Game, isRunning, SELL_REFUND } from "../core/game";
import { isCircleSector, missionNumber, nextMissionOf, sectorOf } from "../content/missions";
import { upgradeOption } from "../core/upgrades";
import { upgradeDiscount } from "../systems/workshop";
import { towerDetails } from "./tower-details";
import { enemyDetails, enemyKey } from "./enemy-details";
import { isHidden } from "../systems/traits";
import { earlyBonus, wavesLeft } from "../systems/circle";
import { WAVE_BREAK } from "../systems/waves";
import { renderWaveForecast, waveForecast } from "./wave-forecast";
import { liveUnits, renderLiveUnits } from "./live-units";
import { closeCodexPreview } from "./codex-preview";
import { renderEnemyCodex, type CodexTab } from "./enemy-codex";
import { MUSIC_ENABLED } from "../audio/settings";
import { renderTowerCodex } from "./tower-codex";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import type { GameState, MissionSector, TowerId } from "../core/types";
import { starText, type Stars } from "../app/rating";
import { mapPreviewSvg } from "./mission-brief";
import { fillImage, progressOf, roman, type MapImage, unlockNotice } from "./sector-atlas";
import type { Lock, Unlocked } from "../app/campaign-unlock";
import type { HomeAction } from "../app/home-action";
import { BRAND_MARK } from "./brand";
import type { CampaignRecord } from "../app/progress";
import { MODE_IDS, MODES } from "../core/modes";
import { renderPlayers, renderSends, versusOutcome, type MultiplayerSession } from "./players";
export type { MultiplayerSession } from "./players";
import type { ViewState } from "../render/scene";
import { hotkeyTowers, isPaged, menuCollapsed, pageOf, TOWER_PAGES, towerOrder } from "./tower-pages";
import { isPlaytest } from "../editor/playtest-id";
import { isRunMission, runStepOf } from "../run/run-id";
import { missionsOf } from "../run/map";
import { runRecord } from "../run/storage";
const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);
/** Hotkeys for the towers of the open tab, from 1 again on every tab; more than ten continue with letters. */
export const TOWER_KEYS = "1234567890qwery";
export const towerKey = (index: number) => TOWER_KEYS[index]?.toUpperCase() ?? "";
/** "1–9, 0, Q, W" for a tab of twelve towers; `wrap` formats each key, e.g. as `<kbd>`. */
function towerKeyRange(count: number, wrap = (key: string) => key) {
  const keys = [...TOWER_KEYS.slice(0, count).toUpperCase()].map(wrap);
  return keys.length <= 2 ? keys.join(", ") : [`${keys[0]}–${keys[Math.min(8, keys.length - 1)]}`, ...keys.slice(9)].join(", ");
}
/** Header of a start-screen page: back, the brand (a link home) and the title. */
const pageHead = (eyebrow: string, title: string, id: string) =>
  `<header class="menu-page-head"><button class="quiet menu-back" data-back>← Back</button><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">${BRAND_MARK}</span><span>ION<span class="brand-light">BASTION</span></span></a></header><p class="eyebrow" id="${id}-eyebrow">${eyebrow}</p><h1 id="${id}">${title}</h1>`;
export function mountUI(game: Game) {
  const TOWERS = game.content.towers;
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div id="start-screen" class="start-screen">
  <section class="menu-page menu-home" data-page="home" tabindex="-1" aria-labelledby="menu-title"><div class="home-grid"><div class="home-main"><p class="home-label">TACTICAL TOWER DEFENSE</p><h1 id="menu-title" class="menu-title"><span class="brand-mark">${BRAND_MARK}</span><span>ION<span class="brand-light">BASTION</span></span></h1><p class="menu-tagline">Hold the line. Protect the reactor.</p><p class="home-dev" role="note"><b>IN DEVELOPMENT</b> Missions, balance and art still change, and bugs are expected.</p><button id="menu-primary" class="home-primary" data-action="start"><span class="home-primary-copy"><strong id="menu-primary-title">Start Playing</strong><small id="menu-primary-sub">Begin your defense campaign</small></span><span class="home-primary-icon" aria-hidden="true">▶</span></button><div class="home-learn"><button id="menu-training" class="home-training"><strong>Training</strong><span>New here? Learn the basics in 3 minutes.</span></button><button id="menu-help" class="home-rules">Rules <span aria-hidden="true">?</span></button></div><nav aria-label="Game modes"><ul class="home-modes"><li><button id="menu-campaign" class="home-mode"><strong><i aria-hidden="true">◈</i>Campaign</strong><span id="menu-campaign-info"></span></button></li><li><button id="menu-circle" class="home-mode" data-mode="circle"><strong><i aria-hidden="true">⟳</i>Circuit</strong><span id="menu-circle-info"></span></button></li><li><button id="menu-run" class="home-mode" data-mode="run"><strong><i aria-hidden="true">✧</i>Run</strong><span id="menu-run-info"></span></button></li><li><button id="menu-coop" class="home-mode"><strong><i aria-hidden="true">⇄</i>Multiplayer</strong><span>2–4 players · ${MODE_IDS.map((id) => MODES[id].name).join(" · ")}</span></button></li></ul></nav><div class="home-utility"><button id="menu-codex" class="quiet">Enemy Codex <span>◆</span></button><button id="menu-towers" class="quiet">Tower Codex <span>▣</span></button><button id="menu-sound-btn" class="quiet sound-trigger" aria-expanded="false" aria-controls="sound-panel">Sound off</button></div></div><aside id="home-map" class="home-map" aria-label="Operation preview"></aside></div></section>
  <section id="mission-page" class="menu-page atlas" tabindex="-1" data-page="missions" aria-labelledby="missions-title" hidden><header class="atlas-head"><button class="quiet menu-back" data-back>← Back</button><div class="atlas-title"><h1 id="missions-title"><span id="atlas-mode">Campaign</span> <span class="atlas-slash" aria-hidden="true">/</span> Sector Atlas</h1><p id="atlas-context" class="atlas-context"></p></div><div id="mission-modes" class="mode-tabs" role="tablist" aria-label="Game mode" hidden></div><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">${BRAND_MARK}</span><span>ION<span class="brand-light">BASTION</span></span></a></header><p id="mode-rules" class="mode-rules" hidden>Rings without a reactor: enemies circle until they fall. Waves start on a timer, calling one early earns credits, and too many enemies in the ring loses the mission.</p><section class="atlas-world" aria-labelledby="missions-label"><div id="world-view" class="world-view"><div id="world-tilt" class="world-tilt"><div id="world-plane" class="world-plane"><svg id="world-svg" class="world-svg" viewBox="0 0 200 100" aria-hidden="true"></svg></div></div><div id="sector-tabs" class="world-regions" role="tablist" aria-label="Sectors"></div><div id="mission-list" class="world-stations" role="group" aria-label="Missions"></div><nav id="world-nav" class="world-nav" aria-label="Worlds"></nav><div id="system-view" class="system-view"><svg id="system-svg" class="system-svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true"></svg><div id="system-bodies" class="system-bodies" role="group" aria-label="Star system"></div></div><header class="missions-head world-legend"><h2 id="missions-label">Missions</h2><p id="missions-progress" class="missions-progress"></p></header><button id="world-zoom" class="world-zoom" data-world-zoom aria-pressed="false" hidden></button></div></section><div class="atlas-card"><figure id="atlas-preview" class="atlas-preview"><div id="preview-stage" class="preview-stage"><span id="preview-legend" class="preview-legend" aria-hidden="true"></span></div></figure><section id="mission-brief" class="atlas-brief" aria-labelledby="brief-title"><div id="brief-body" class="brief-body"></div><div id="brief-actions" class="brief-actions"></div></section><div id="brief-intel" class="atlas-intel"></div></div></section>
  <section class="menu-page menu-editor" data-page="editor" tabindex="-1" aria-label="Mission editor" hidden><div id="editor-root"></div></section>
  <section id="run-page" class="menu-page menu-run" data-page="run" tabindex="-1" aria-labelledby="run-title" hidden>${pageHead("ROGUELITE RUN", "Ten missions. Three acts. One reactor.", "run-title")}<div id="run-root"></div></section>
  <section id="coop-page" class="menu-page" tabindex="-1" data-page="coop" aria-labelledby="coop-title" hidden>${pageHead("MULTIPLAYER · 2–4 PLAYERS", "Together or against each other.", "coop-title")}<div id="coop-hosting" class="notice notice-warn" role="note" hidden><strong>No multiplayer server on this site.</strong> This copy is a static page (GitHub Pages) and cannot run the relay that connects players. Host one yourself: run <code>npm run server</code> from the source code on a machine everyone can reach, behind TLS (<code>wss://</code>) because this page uses https. Then every player opens this page with <code>?server=wss://&lt;relay-host&gt;</code>. Solo play works without it.</div><p id="coop-error" class="notice notice-error" role="alert" hidden></p><p id="coop-status" class="notice" role="status"></p><div id="coop-choose" class="coop-choose"><button id="coop-create" class="choice-card"><span class="choice-index">01</span><strong>Create Room</strong><span>Host a game, share the four-letter code and pick mode and mission.</span></button><button id="coop-show-join" class="choice-card"><span class="choice-index">02</span><strong>Join Room</strong><span>Enter the code your host gave you.</span></button></div><div id="coop-join-panel" class="coop-panel" hidden><h2>Join a room</h2><form id="coop-join-form" class="coop-join"><label for="coop-code">Room code</label><div class="coop-join-row"><input id="coop-code" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" aria-describedby="coop-code-help"><button id="coop-join" class="primary" type="submit">Join <span aria-hidden="true">▶</span></button></div><p id="coop-code-help" class="field-help">Four letters, for example ABCD. Capitals and spaces do not matter.</p></form><button id="coop-join-back" class="quiet">← Other options</button></div><div id="coop-room" class="coop-room" hidden><div class="lobby-grid"><section class="coop-panel lobby-code" aria-labelledby="lobby-code-label"><span id="lobby-code-label" class="stat-label">ROOM CODE</span><div class="code-row"><input id="coop-room-code" class="room-code" readonly aria-labelledby="lobby-code-label" value="…" size="4"><button id="coop-copy" class="quiet">Copy code</button></div><p id="coop-copy-status" class="field-help" role="status"></p></section><section class="coop-panel" aria-labelledby="lobby-players-label"><span id="lobby-players-label" class="stat-label">PLAYERS</span><p class="lobby-count"><strong id="coop-count">1/4</strong> <span id="coop-role"></span></p><ul id="coop-seats" class="seats"></ul></section></div><div id="coop-host" class="coop-panel host-panel"><span class="host-tag">HOST CONTROLS</span><fieldset id="coop-modes" class="coop-modes"><legend>Mode</legend>${MODE_IDS.map((id) => `<label><input type="radio" name="coop-mode" value="${id}"${id === "coop" ? " checked" : ""}><span>${MODES[id].name}</span></label>`).join("")}</fieldset><p id="coop-rules" class="coop-rules">${MODES.coop.rules}</p><div class="coop-mission"><div><span class="stat-label">MISSION</span><strong id="coop-mission"></strong></div><button id="coop-pick" class="quiet">Change Mission</button></div></div><p id="coop-wait" class="coop-wait" hidden></p><div class="coop-actions"><button id="coop-leave" class="quiet">Leave Room</button><button id="coop-launch" class="primary" hidden>Start Mission <span aria-hidden="true">▶</span></button></div></div></section>
  <section id="codex-page" class="menu-page" tabindex="-1" data-page="codex" aria-labelledby="codex-title" hidden>${pageHead("ENEMY CODEX", "Know your enemy.", "codex-title")}<p>All enemy types in the order the campaign introduces them. HP and speed apply to wave 1; later waves have more HP.</p><div id="codex-tabs" class="codex-tabs" role="tablist" aria-label="Enemy Codex"></div><div id="codex-list" class="codex-list" role="tabpanel"></div></section>
  <section id="towers-page" class="menu-page" tabindex="-1" data-page="towers" aria-labelledby="towers-title" hidden>${pageHead("TOWER CODEX", "Know your arsenal.", "towers-title")}<p>Every tower by build-menu category: cost, targets, levels 1–5 and the paths beyond. Values are base values before Aura bonuses.</p><div id="tower-codex-tabs" class="codex-tabs" role="tablist" aria-label="Tower categories"></div><div id="tower-codex-list" class="codex-list tower-codex-list" role="tabpanel"></div></section>
  <section id="help-page" class="menu-page" tabindex="-1" data-page="help" aria-labelledby="help-title" hidden>${pageHead("FIELD MANUAL", "Your core. Your line.", "help-title")}<p>Survive all waves of a mission. When an enemy reaches the reactor, it loses energy. At 0 the mission is lost.</p><p class="help-training">New to tower defense? <button id="help-training" class="quiet">Play the Training <span>→</span></button></p><ol><li><strong>Build your defense</strong><br>Pick a tower on the right and click a free cell next to the path. Traps go right on the path. The circle shows its range.</li><li><strong>Start a wave</strong><br>Defeated enemies give credits. After each wave you get a bonus, and after ${WAVE_BREAK} seconds the next wave starts on its own. You can also build during a wave. Press <kbd>N</kbd> to start it earlier.</li><li><strong>Upgrade towers</strong><br>Click a built tower. Attack towers reach level 5; levels 4 and 5 are expensive, but give more per credit than another tower. With the Aura tower you pick a path (damage, attack speed or range) and expand it in three levels. For several bonuses, build several Auras. Selling refunds ${SELL_REFUND * 100}% of your investment.</li></ol><div class="tip">Tip: Nova hits groups, but only ground units. Against Gliders in the air, Flak and all other attack towers help. Tesla jumps from enemy to enemy, the Lance pierces whole rows. Stasis halts enemies briefly, Corrosion makes them take more damage, Decay cracks Titans. Focus gets stronger the longer it stays on the same target, and Gravitron pulls ground enemies back. The Mortar shells groups from long range, Quake shakes everything around the tower, the Executioner finishes off wounded enemies, Shrapnel hits several targets at once, the Jammer switches off shields and healing, and the Snare Net pulls flyers into range of ground towers. Bounty Beacon, Repair Dock and Tracker help without attacking themselves. Traps like Mine, Caltrops, Sticky Mine or Pitfall go directly on the path; they trigger when ground enemies walk over them, stealthed ones too. Aura boosts nearby attack towers once you buy a path. A Refinery built early pays out credits after every wave. A tower can only target stealthed enemies within range of a Detector.</div><p class="keyboard-help">${towerKeyRange(Math.max(...TOWER_PAGES.map((_, i) => Object.values(TOWERS).filter((t) => pageOf(t) === i).length)), (key) => `<kbd>${key}</kbd>`)} Pick a tower on the open tab · <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>${TOWER_PAGES.length}</kbd> Switch tab<br><kbd>Esc</kbd>, right-click or ✕: deselect<br><kbd>Shift</kbd>+click: build several towers of the same type<br><kbd>Space</kbd> Pause · <kbd>N</kbd> Start wave · <kbd>F</kbd> Fullscreen<br><kbd>T</kbd> Cycle target priority of the selected tower · <kbd>U</kbd> Upgrade it (next level or path tier)<br><kbd>C</kbd> Show all tower ranges and path coverage (red: no tower reaches ground units there)<br>Click an enemy: HP and traits<br>On the field: arrow keys + Enter</p><button class="primary" data-back>Got it</button></section>
  </div>
  <div id="game-view"><div id="rotate-hint" class="rotate-hint" role="status"><span aria-hidden="true">⟳</span><p>Turn your phone sideways to play.</p></div><header class="topbar"><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">${BRAND_MARK}</span><span>ION<span class="brand-light">BASTION</span></span></a><span class="edition">TOWER DEFENSE <b id="edition-number">01</b></span><div class="header-actions"><button id="menu-btn" class="quiet">Menu <span>☰</span></button><button id="coop-btn" class="quiet">Multiplayer <span>⇄</span></button><button id="codex-btn" class="quiet">Enemy Codex <span>◆</span></button><button id="help-btn" class="quiet">Help <span>?</span></button><button id="sound-btn" class="quiet sound-trigger" aria-expanded="false" aria-controls="sound-panel">Sound off</button></div></header>
  <main><div class="mission-heading"><div><p class="eyebrow">MISSION <b id="mission-number">01</b> <span>/</span> <b id="mission-sector">DEFENSE</b></p></div><div class="mission-meta"><span class="sector-label" id="sector-label"></span><span class="difficulty" id="difficulty"></span></div></div>
  <div class="workspace"><section class="field-panel" aria-label="Battlefield"><div class="field-toolbar"><div class="resources"><div><span class="stat-label">CREDITS</span><strong class="credits"><span class="resource-icon">◇</span><span id="gold"></span></strong></div><div><span class="stat-label" id="lives-label">REACTOR</span><strong><span class="resource-icon heart">♡</span><span id="lives"></span><small id="lives-max"></small></strong></div><div><span class="stat-label">WAVE</span><strong><span id="wave">00</span><small id="wave-total"></small></strong></div></div><div id="wave-forecast" class="next-wave-slot"></div><div class="playback"><button id="toolbar-start" class="toolbar-start" title="Start next wave (N)"><b>Wave</b> 01 <span>▶</span></button><button id="pause-btn" title="Pause (Space)" aria-label="Pause game" aria-pressed="false">Ⅱ</button><button id="speed-btn" aria-label="Change game speed">1×</button><button id="coverage-btn" title="Show ranges and path coverage (C)" aria-label="Show ranges and path coverage (C)" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5"/></svg></button><button id="fullscreen-btn" title="Fullscreen (F)" aria-label="Fullscreen (F)" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4"/></svg></button></div></div>
  <div id="players-panel" class="players-panel" aria-label="Teammates" hidden></div>
  <div id="board-wrap"><div id="board" tabindex="0" role="application" aria-label="Tower defense battlefield. Arrow keys select a cell; Enter builds or selects a tower. C shows tower ranges. Keys ${towerKeyRange(Object.keys(TOWERS).length)} pick a tower type."></div><div id="game-overlay" hidden><div id="overlay-icon">Ⅱ</div><p class="eyebrow" id="overlay-kicker">TACTICAL PAUSE</p><h2 id="overlay-title">Time for a plan.</h2><p id="overlay-stars" hidden></p><p id="overlay-unlock" class="overlay-unlock" hidden></p><p id="overlay-copy">Press Space or the pause button to resume.</p><div class="overlay-actions"><button id="overlay-next" class="primary" hidden>Next mission <span>→</span></button><button id="overlay-restart" class="primary" hidden>Restart</button><button id="overlay-missions" class="quiet" hidden>Missions</button></div></div><div id="tower-card" class="tower-card-pop" role="group" aria-label="Selected tower" hidden></div></div>
  <div class="field-footer"><span><i class="legend-path"></i>Enemy path</span><span><i class="legend-build"></i>Free build area</span><span id="cell-label">Pick a tower, then click a cell</span></div>
  <div class="wave-timeline"><div class="timeline-label"><span>MISSION PROGRESS</span><b id="progress-label"></b></div><div id="wave-segments"></div></div>
  </section>
  <aside class="sidebar"><div class="section-title towers-title"><button id="tower-menu-toggle" class="tower-menu-toggle" aria-expanded="true" aria-controls="tower-menu"><h2>Towers</h2><i aria-hidden="true">▾</i></button><span>01–${String(Object.keys(TOWERS).length).padStart(2, "0")}</span></div><div id="tower-menu" class="tower-menu"><div id="tower-tabs" class="tower-tabs" role="tablist" aria-label="Tower categories" hidden></div><div id="tower-list" class="tower-list" role="tabpanel">${towerOrder(game)
    .map((id) => TOWERS[id])
    .map(
      (t, i) =>
        `<button class="tower-card ${t.id}" style="--accent:#${t.color.toString(16).padStart(6, "0")}" data-tower="${t.id}" aria-pressed="false" title="${t.role}: ${t.description}" aria-label="${t.name}, ${t.role}, ${t.cost} credits"><span class="tower-symbol">${t.visual.icon}</span><strong class="tower-name">${t.name}</strong><span class="tower-cost"><b>◇ ${t.cost}</b><kbd>${towerKey(i)}</kbd></span></button>`,
    )
    .join("")}</div></div>
  <section id="send-panel" class="send-panel" aria-label="Send enemies" hidden></section><div id="selection" class="selection"></div><section id="live-units" class="live-units" aria-label="Enemies on the field" hidden></section></aside></div>
  <footer class="bottom-bar"><span id="notice" role="status" aria-live="polite">Pick a tower and place it next to the path.</span><button id="restart-btn" class="text-button">Restart</button></footer></main><section id="coach" class="coach" role="status" aria-live="polite" aria-label="Training" hidden></section><div id="build-confirm" class="build-confirm" role="group" aria-label="Confirm build" hidden></div></div>
  <dialog id="restart-dialog"><h2>Restart mission?</h2><p>Your current defense and progress will be reset.</p><div class="dialog-actions"><button id="cancel-restart" class="quiet">Keep playing</button><button id="confirm-restart" class="primary">Restart</button></div></dialog><div id="sound-panel" class="sound-panel" role="dialog" aria-label="Sound and graphics settings" hidden><label class="sound-row sound-switch"><span>Sound</span><input type="checkbox" id="sound-on"></label><label class="sound-row"><span>Master</span><input type="range" min="0" max="100" data-bus="master"></label><label class="sound-row"><span>Effects</span><input type="range" min="0" max="100" data-bus="sfx"></label><label class="sound-row"><span>Interface</span><input type="range" min="0" max="100" data-bus="ui"></label><label class="sound-row"${MUSIC_ENABLED ? "" : " hidden"}><span>Music</span><input type="range" min="0" max="100" data-bus="music"></label><label class="sound-row sound-switch" title="Soft light, reactor-hit flash and strike shake. Turn off on slow devices."><span>Bloom</span><input type="checkbox" id="glow-on"></label><p class="sound-hint">Press <kbd>M</kbd> in game to mute.</p></div>`;
}
/** Everything in the shell that depends on the active mission. */
export function renderMission(game: Game) {
  const m = game.mission,
    total = game.waves.length,
    // A Run mission counts its step instead of a campaign number.
    number = isRunMission(m) ? (runStepOf(m.id) ?? 0) + 1 : missionNumber(m, game.content.missions);
  const board = document.getElementById("board")!;
  board.style.aspectRatio = `${m.map.columns}/${m.map.rows}`;
  // Used by the full-screen layout to fit the board into the available height.
  board.style.setProperty("--cols", String(m.map.columns));
  board.style.setProperty("--rows", String(m.map.rows));
  // Training is outside the campaign: mission 00.
  text("edition-number", pad(number));
  text("mission-number", pad(number));
  // Only the mission's towers are offered, grouped by page; with tabs every page numbers its towers from 1.
  const order = towerOrder(game),
    list = document.getElementById("tower-list")!,
    cards = [...list.querySelectorAll<HTMLButtonElement>("[data-tower]")];
  for (const id of order) list.append(cards.find((c) => c.dataset.tower === id)!);
  for (const card of cards) {
    const id = card.dataset.tower as TowerId,
      d = game.content.towers[id];
    if (!order.includes(id)) card.hidden = true;
    // A Run's relics change prices; the cards were built from the game's own pack.
    card.querySelector(".tower-cost b")!.textContent = `◇ ${d.cost}`;
    card.setAttribute("aria-label", `${d.name}, ${d.role}, ${d.cost} credits`);
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
  text("mission-sector", sector ? `SECTOR ${roman(sectors.indexOf(sector))} · ${sector.name.toUpperCase()}` : m.manualWaves ? "BASIC TRAINING" : isPlaytest(m) ? "PLAYTEST" : isRunMission(m) ? `ROGUELITE RUN · MISSION ${number}` : "DEFENSE");
  // A Run allows no restart: a lost mission ends the run.
  document.getElementById("restart-btn")!.hidden = isRunMission(m);
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
/** A mode's progress from the record: "12/60 cleared · ★ 28", or undefined before its first win. */
function progressInfo(members: readonly MissionSector[], record: CampaignRecord) {
  const { won, stars, count } = progressOf(
    members.flatMap((sector) => sector.missions),
    record,
  );
  return won ? `${won}/${count} cleared · ★ ${stars}` : undefined;
}
/** What the preview card shows for each primary action. */
const PREVIEW_LABEL: Record<HomeAction["kind"], string> = {
  start: "FIRST MISSION",
  resume: "IN PROGRESS",
  continue: "NEXT MISSION",
  restart: "LAST PLAYED",
  run: "RUN",
};
/**
 * Fills the start screen's home page: the primary button for `action`, the modes with the player's progress from
 * `record` and, beside them, the map of the mission that button is about (a second way to run it).
 */
export function renderMenu(game: Game, action: HomeAction, record: CampaignRecord, image?: MapImage, freshPlayer = false) {
  const missions = game.content.missions,
    { campaign, rings } = modeGroups(game.content.sectors ?? []),
    m = action.mission,
    sectors = game.content.sectors ?? [],
    sector = sectorOf(m, sectors),
    number = missionNumber(m, missions),
    best = record[m.id],
    primary = document.getElementById("menu-primary")!;
  primary.dataset.action = action.kind;
  // Emphasised only for a newcomer (see the caller); a returning player gets the quiet line.
  document.getElementById("menu-training")!.classList.toggle("fresh", freshPlayer);
  text("menu-primary-title", action.title);
  text("menu-primary-sub", action.subtitle);
  text(
    "menu-campaign-info",
    progressInfo(campaign, record) ?? (campaign.length ? campaignInfo(campaign) : `${missions.length} ${plural(missions.length, "mission")}`),
  );
  document.getElementById("menu-circle")!.parentElement!.hidden = !rings.length;
  text("menu-circle-info", progressInfo(rings, record) ?? `${missionCount(rings)} ${plural(missionCount(rings), "mission")}`);
  const runs = runRecord();
  text("menu-run-info", runs.runs ? `Best ${runs.best}/${missionsOf("full")} · ${runs.wins + runs.shortWins} completed` : `${missionsOf("full")} missions in three acts`);
  const stat = (label: string, value: string, glyph = "") =>
    `<div><span class="stat-label">${label}</span><strong>${glyph ? `<i aria-hidden="true">${glyph}</i>` : ""}${value}</strong></div>`;
  const place = number ? `MISSION ${pad(number)}` : "TRAINING",
    where = sector ? `SECTOR ${roman(sectors.indexOf(sector))} · ${sector.name.toUpperCase()}` : "OPERATION MAP";
  const map = document.getElementById("home-map")!;
  map.dataset.action = action.kind;
  map.innerHTML = `<div class="home-map-head"><span>${where}</span><span>${place}</span></div><div class="home-map-view">${mapPreviewSvg(m.map)}<img class="home-map-img" alt=""><i class="scan" aria-hidden="true"></i><span class="home-map-play" aria-hidden="true">▶</span></div><div class="home-map-foot"><small class="home-map-kind">${PREVIEW_LABEL[action.kind]}</small><div class="home-map-title"><strong>${m.name}</strong>${best ? `<span class="home-map-stars" aria-label="Best: ${best} of 3 stars">${starText(best)}</span>` : ""}</div><p>${m.focus}</p><div class="home-map-stats">${stat("WAVES", String(m.waves.length))}${stat("CREDITS", String(m.startingCredits), "◇")}${m.circle ? stat("RING LIMIT", String(m.circle.limit)) : stat("REACTOR", String(m.reactorEnergy), "♡")}</div></div>`;
  // The real terrain fades in over the SVG once it is rendered.
  const img = map.querySelector<HTMLImageElement>(".home-map-img");
  if (img && image) fillImage(img, m.map, image);
}
/** Fills the enemy codex page; called when it opens and on every tab change. */
export function renderCodex(game: Game, tab: CodexTab = "enemies") {
  const { tabs, list } = renderEnemyCodex(game.content, tab),
    panel = document.getElementById("codex-list")!;
  closeCodexPreview();
  document.getElementById("codex-tabs")!.innerHTML = tabs;
  panel.innerHTML = list;
  panel.setAttribute("aria-labelledby", `codex-tab-${tab}`);
  panel.scrollTop = 0;
}
/** Fills the tower codex page for one build-menu category; called when it opens and on every tab change. */
export function renderTowerCodexPage(game: Game, page = 0) {
  const { tabs, list } = renderTowerCodex(game.content, page),
    panel = document.getElementById("tower-codex-list")!;
  document.getElementById("tower-codex-tabs")!.innerHTML = tabs;
  panel.innerHTML = list;
  panel.setAttribute("aria-labelledby", `tower-codex-tab-${page}`);
}
/** The mission after the current one, unless the campaign still locks it. */
export function nextMission(game: Game, locks?: ReadonlyMap<string, Lock>) {
  const next = nextMissionOf(game.content.missions, game.mission.id);
  return next && !locks?.has(next.id) ? next : undefined;
}
function text(id: string, value: string) {
  const e = document.getElementById(id)!;
  if (e.textContent !== value) e.textContent = value;
}
export class Interface {
  private selectionKey = "";
  /** The tower or enemy shown in the selection panel; a new one scrolls the sidebar to the top. */
  private selectionSubject = "";
  /** The build menu opened by hand while a selection would collapse it; reset by every new selection. */
  private menuOpened = false;
  private forecastKey = "";
  private liveHtml = "";
  private playersHtml = "";
  private sendHtml = "";
  /** Set by the multiplayer controller; null in single-player. */
  session: () => MultiplayerSession | null = () => null;
  /** The rating of the last recorded win, set by the app for the state it was won in. */
  result: { state: GameState; stars: Stars; best: boolean; unlocked?: Unlocked } | null = null;
  /** The campaign's locked missions, set by the app; undefined locks nothing (multiplayer). */
  locks: () => ReadonlyMap<string, Lock> | undefined = () => undefined;
  /** Runs after every refresh; the Training coach follows the HUD with it. */
  onRefresh: () => void = () => {};
  constructor(
    private game: Game,
    private view: ViewState,
  ) {
    document.addEventListener("click", (e) => {
      if (!(e.target instanceof Element) || !e.target.closest("#tower-menu-toggle")) return;
      this.menuOpened = menuCollapsed(this.view, this.menuOpened);
      this.refresh();
    });
  }
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
      upgradeDiscount(t, s.towers, content), // g5: Workshop
    ]) : "";
    // A selected enemy that died, leaked or vanished into stealth drops out of the panel.
    let enemy = s.enemies.find((e) => e.id === this.view.enemy);
    if (enemy && isHidden(this.game, enemy)) enemy = undefined;
    if (!enemy) this.view.enemy = null;
    const key = enemy ? `enemy/${enemyKey(this.game, enemy)}` : `${t?.id}/${t?.priority}/${this.view.build}/${auraKey}`;
    // A selected tower or enemy collapses the build menu, so its details sit higher in the sidebar; the
    // tower's actions are on the card beside it (tower-card-view.ts). On phones in landscape a selected enemy
    // replaces the tower list (style.css).
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    sidebar.classList.toggle("inspecting", !!enemy);
    const subject = enemy ? `enemy/${enemy.id}` : t ? `tower/${t.id}` : "";
    if (subject !== this.selectionSubject) {
      this.selectionSubject = subject;
      this.menuOpened = false;
      if (subject) sidebar.scrollTop = 0;
    }
    const collapsed = menuCollapsed(this.view, this.menuOpened);
    if (sidebar.classList.contains("menu-collapsed") !== collapsed) {
      sidebar.classList.toggle("menu-collapsed", collapsed);
      const toggle = document.getElementById("tower-menu-toggle")!;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.title = collapsed ? "Show the build menu" : "";
      toggle.querySelector("i")!.textContent = collapsed ? "▸" : "▾";
    }
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
    // Kills change every frame in a wave; patch the number instead of rebuilding the panel.
    const kills = document.getElementById("tower-kills");
    if (kills && t && kills.textContent !== String(t.kills)) kills.textContent = String(t.kills);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-upgrade]")) {
      button.disabled = !t || terminal || foreign || upgradeOption(t, button.dataset.upgrade!, gold, content, upgradeDiscount(t, s.towers, content)).status !== "available";
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
    overlay.classList.toggle("paused", !overlay.hidden && !terminal && !match);
    const rated = !match && s.status === "won" && this.result?.state === s ? this.result : null,
      stars = document.getElementById("overlay-stars")!;
    stars.hidden = !rated;
    if (rated) {
      stars.setAttribute("aria-label", `${rated.stars} of 3 stars${rated.best ? ", new best" : ""}`);
      const html = `<span aria-hidden="true">${starText(rated.stars)}</span>${rated.best ? `<b aria-hidden="true">New best</b>` : ""}`;
      if (stars.innerHTML !== html) stars.innerHTML = html;
    }
    const unlock = document.getElementById("overlay-unlock")!,
      notice = rated?.unlocked ? unlockNotice(rated.unlocked, this.game.content.missions, this.game.content.sectors ?? []) : "";
    unlock.hidden = !notice;
    text("overlay-unlock", notice);
    if (!overlay.hidden && !match) {
      text("overlay-icon", terminal ? (s.status === "won" ? "✦" : "◇") : "Ⅱ");
      const run = isRunMission(this.game.mission);
      text("overlay-kicker", terminal ? (run && s.status === "lost" ? "RUN OVER" : "MISSION OVER") : "TACTICAL PAUSE");
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
            ? `You reached wave ${s.wave} and defeated ${s.kills} ${s.kills === 1 ? "enemy" : "enemies"}. ${run ? "The run ends here." : "Try more upgrades and Cryo support."}`
            : "Build and upgrade freely. Space or ▶ resumes.",
      );
      // A Run goes on from its own page: the reward after a win, the summary after a loss.
      const next = s.status === "won" ? (run ? this.game.mission : nextMission(this.game, this.locks())) : undefined;
      document.getElementById("overlay-next")!.hidden = !next;
      const nextLabel = `${this.game.mission.manualWaves ? "Begin campaign" : run ? "Continue run" : "Next mission"} <span>→</span>`,
        nextButton = document.getElementById("overlay-next")!;
      if (nextButton.innerHTML !== nextLabel) nextButton.innerHTML = nextLabel;
      document.getElementById("overlay-restart")!.hidden = !terminal || !!next || run;
      text("overlay-restart", s.status === "won" ? "Play again" : "Restart");
      document.getElementById("overlay-missions")!.hidden = !terminal;
      text("overlay-missions", isPlaytest(this.game.mission) ? "Editor" : run ? (s.status === "lost" ? "Run summary" : "Run") : "Missions");
    }
    if (this.view.hover)
      text(
        "cell-label",
        `Cell ${String.fromCharCode(65 + this.view.hover.x)}${this.view.hover.y + 1}`,
      );
    this.onRefresh();
  }
}
