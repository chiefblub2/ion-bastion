import { Game, SELL_REFUND } from "../core/game";
import { missionNumber, sectorOf } from "../content/missions";
import { upgradeOption } from "../core/upgrades";
import { towerDetails } from "./tower-details";
import { enemyDetails, enemyKey } from "./enemy-details";
import { isHidden } from "../systems/traits";
import { earlyBonus, wavesLeft } from "../systems/circle";
import { renderWaveForecast, waveForecast } from "./wave-forecast";
import { liveUnits, renderLiveUnits } from "./live-units";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import type { TowerId } from "../core/types";
import { MODE_IDS, MODES } from "../core/modes";
import { renderPlayers, renderSends, versusOutcome, type MultiplayerSession } from "./players";
export type { MultiplayerSession } from "./players";
import type { ViewState } from "../render/scene";
import { hotkeyTowers, isPaged, pageOf, TOWER_PAGES, towerOrder } from "./tower-pages";
const pad = (n: number) => String(n).padStart(2, "0");
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const roman = (index: number) => ROMAN[index] ?? String(index + 1);
/** Hotkeys for the towers of the open tab, from 1 again on every tab; more than ten continue with letters. */
export const TOWER_KEYS = "1234567890qwer";
export const towerKey = (index: number) => TOWER_KEYS[index]?.toUpperCase() ?? "";
/** "1–9, 0, Q, W" for a tab of twelve towers; `wrap` formats each key, e.g. as `<kbd>`. */
function towerKeyRange(count: number, wrap = (key: string) => key) {
  const keys = [...TOWER_KEYS.slice(0, count).toUpperCase()].map(wrap);
  return keys.length <= 2 ? keys.join(", ") : [`${keys[0]}–${keys[Math.min(8, keys.length - 1)]}`, ...keys.slice(9)].join(", ");
}
export function mountUI(game: Game) {
  const TOWERS = game.content.towers;
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="topbar"><a class="brand" href="/" aria-label="ION BASTION Startseite"><span class="brand-mark">I</span><span>ION<span class="brand-light">BASTION</span></span></a><span class="edition">TOWER DEFENSE <b id="edition-number">01</b></span><div class="header-actions"><button id="missions-btn" class="quiet">Missionen <span>◇</span></button><button id="coop-btn" class="quiet">Mehrspieler <span>⇄</span></button><button id="help-btn" class="quiet">Spielhilfe <span>?</span></button><button id="sound-btn" class="quiet" aria-pressed="false">Ton aus</button></div></header>
  <main><div class="mission-heading"><div><p class="eyebrow">MISSION <b id="mission-number">01</b> <span>/</span> <b id="mission-sector">VERTEIDIGUNG</b></p><h1>Halte die Linie.</h1><p id="mission-focus" class="mission-focus"></p></div><div class="mission-meta"><span class="sector-label" id="sector-label"></span><span class="difficulty" id="difficulty"></span></div></div>
  <div class="workspace"><section class="field-panel" aria-label="Spielfeld"><div class="field-toolbar"><div class="resources"><div><span class="stat-label">CREDITS</span><strong class="credits"><span class="resource-icon">◇</span><span id="gold"></span></strong></div><div><span class="stat-label" id="lives-label">REAKTOR</span><strong><span class="resource-icon heart">♡</span><span id="lives"></span><small id="lives-max"></small></strong></div><div><span class="stat-label">WELLE</span><strong><span id="wave">00</span><small id="wave-total"></small></strong></div></div><div id="wave-forecast" class="next-wave-slot"></div><div class="playback"><button id="toolbar-start" class="toolbar-start" title="Nächste Welle starten (N)"><b>Welle</b> 01 <span>▶</span></button><button id="pause-btn" title="Pause (Leertaste)" aria-label="Spiel pausieren" aria-pressed="false">Ⅱ</button><button id="speed-btn" aria-label="Spieltempo ändern">1×</button><button id="fullscreen-btn" title="Vollbild (F)" aria-label="Vollbild (F)" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 5.5v-4h4M10.5 1.5h4v4M14.5 10.5v4h-4M5.5 14.5h-4v-4"/></svg></button></div></div>
  <div id="players-panel" class="players-panel" aria-label="Mitspieler" hidden></div>
  <div id="board-wrap"><div id="board" tabindex="0" role="application" aria-label="Tower-Defense-Spielfeld. Pfeiltasten wählen ein Feld; Enter baut oder wählt einen Turm. Tasten ${towerKeyRange(Object.keys(TOWERS).length)} wählen einen Turmtyp."></div><div id="game-overlay" hidden><div id="overlay-icon">Ⅱ</div><p class="eyebrow" id="overlay-kicker">TAKTISCHE PAUSE</p><h2 id="overlay-title">Zeit für einen Plan.</h2><p id="overlay-copy">Drücke die Leertaste oder die Pause-Taste zum Fortsetzen.</p><div class="overlay-actions"><button id="overlay-next" class="primary" hidden>Nächste Mission <span>→</span></button><button id="overlay-restart" class="primary" hidden>Neu starten</button><button id="overlay-missions" class="quiet" hidden>Missionen</button></div></div></div>
  <div class="field-footer"><span><i class="legend-path"></i>Gegnerpfad</span><span><i class="legend-build"></i>Freie Baufläche</span><span id="cell-label">Turm wählen, dann Feld anklicken</span></div>
  <div class="wave-timeline"><div class="timeline-label"><span>MISSIONSFORTSCHRITT</span><b id="progress-label"></b></div><div id="wave-segments"></div></div>
  </section>
  <aside class="sidebar"><div class="section-title towers-title"><h2>Türme</h2><span>01–${String(Object.keys(TOWERS).length).padStart(2, "0")}</span></div><div class="tower-menu"><div id="tower-tabs" class="tower-tabs" role="tablist" aria-label="Turmkategorien" hidden></div><div id="tower-list" class="tower-list" role="tabpanel">${towerOrder(game)
    .map((id) => TOWERS[id])
    .map(
      (t, i) =>
        `<button class="tower-card ${t.id}" style="--accent:#${t.color.toString(16).padStart(6, "0")}" data-tower="${t.id}" aria-pressed="false" title="${t.role}: ${t.description}" aria-label="${t.name}, ${t.role}, ${t.cost} Credits"><span class="tower-symbol">${t.visual.icon}</span><strong class="tower-name">${t.name}</strong><span class="tower-cost"><b>◇ ${t.cost}</b><kbd>${towerKey(i)}</kbd></span></button>`,
    )
    .join("")}</div></div>
  <section id="send-panel" class="send-panel" aria-label="Gegner schicken" hidden></section><div id="selection" class="selection"></div><section id="live-units" class="live-units" aria-label="Gegner im Feld" hidden></section></aside></div>
  <footer class="bottom-bar"><span id="notice" role="status" aria-live="polite">Wähle einen Turm und platziere ihn neben dem Pfad.</span><button id="restart-btn" class="text-button">Neu starten</button></footer></main>
  <dialog id="help-dialog"><button class="dialog-close" id="close-help" aria-label="Spielhilfe schließen">×</button><p class="eyebrow">FELDHANDBUCH</p><h2>Dein Kern. Deine Linie.</h2><p>Überstehe alle <span id="help-waves"></span> Wellen. Erreicht ein Gegner den Reaktor, verliert er Energie. Bei 0 ist die Mission verloren.</p><ol><li><strong>Verteidigung bauen</strong><br>Wähle rechts einen Turm und klicke auf ein freies Feld neben dem Pfad. Fallen gehören direkt auf den Weg. Der Kreis zeigt seine Reichweite.</li><li><strong>Welle starten</strong><br>Besiegte Gegner geben Credits. Nach jeder Welle bekommst du einen Bonus und Zeit zum Bauen.</li><li><strong>Türme verbessern</strong><br>Klicke einen gebauten Turm an. Angriffstürme erreichen Stufe 5; die Stufen 4 und 5 sind teuer, bringen pro Credit aber mehr als ein weiterer Turm. Beim Aura-Turm wählst du einen Pfad (Schaden, Angriffstempo oder Reichweite) und baust ihn in drei Stufen aus. Für mehrere Boni baue mehrere Auren. Verkauf erstattet ${SELL_REFUND * 100} % deiner Investition.</li></ol><div class="tip">Tipp: Nova trifft Gruppen, aber nur Bodeneinheiten. Gegen Gleiter in der Luft helfen Flak und alle übrigen Angriffstürme. Tesla springt von Gegner zu Gegner, die Lanze durchschlägt ganze Reihen. Stasis hält Gegner kurz an, Korrosion lässt sie mehr Schaden nehmen, Zerfall knackt Titanen. Fokus wird stärker, je länger er auf demselben Ziel bleibt, und Gravitron zieht Bodengegner zurück. Der Mörser beschießt Gruppen aus großer Entfernung, Beben erschüttert alles rund um den Turm, der Henker erledigt angeschlagene Gegner, Schrapnell trifft mehrere Ziele zugleich, der Störsender schaltet Schilde und Heilung ab, und das Fangnetz holt Flieger in Reichweite von Bodentürmen. Prämienbake, Reparaturdock und Peilsender helfen ohne eigenen Angriff. Fallen wie Mine, Krähenfüße, Haftmine oder Fallgrube baust du direkt auf den Weg; sie lösen aus, wenn Bodengegner darüberlaufen, auch getarnte. Aura verstärkt nahe Angriffstürme, sobald du einen Pfad kaufst. Eine früh gebaute Raffinerie zahlt nach jeder Welle Credits aus. Getarnte Gegner kann ein Turm nur im Bereich eines Detektors anvisieren.</div><p class="keyboard-help">${towerKeyRange(Math.max(...TOWER_PAGES.map((_, i) => Object.values(TOWERS).filter((t) => pageOf(t) === i).length)), (key) => `<kbd>${key}</kbd>`)} Turm im offenen Tab wählen · <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>${TOWER_PAGES.length}</kbd> Tab wechseln<br><kbd>Esc</kbd>, Rechtsklick oder ✕: Auswahl aufheben<br><kbd>Shift</kbd>+Klick: mehrere Türme desselben Typs bauen<br><kbd>Leertaste</kbd> Pause · <kbd>N</kbd> Welle starten · <kbd>F</kbd> Vollbild<br><kbd>T</kbd> Zielpriorität des ausgewählten Turms wechseln<br>Gegner anklicken: HP und Eigenschaften<br>Auf dem Spielfeld: Pfeiltasten + Enter</p><button id="help-done" class="primary">Verstanden</button></dialog>
  <dialog id="mission-dialog"><button class="dialog-close" id="close-missions" aria-label="Missionsauswahl schließen">×</button><p class="eyebrow">EINSATZPLAN</p><h2>Mission wählen.</h2><p id="mission-warning" class="mission-warning" hidden>Deine aktuelle Verteidigung und dein Fortschritt werden zurückgesetzt.</p><div id="sector-tabs" class="sector-tabs" role="tablist" aria-label="Sektoren" hidden></div><div id="mission-list" class="mission-list"></div></dialog>
  <dialog id="coop-dialog"><button class="dialog-close" id="close-coop" aria-label="Mehrspieler schließen">×</button><p class="eyebrow">MEHRSPIELER · 2–4 SPIELER</p><h2>Zusammen oder gegeneinander.</h2><fieldset id="coop-modes" class="coop-modes"><legend>Modus</legend>${MODE_IDS.map((id) => `<label><input type="radio" name="coop-mode" value="${id}"${id === "coop" ? " checked" : ""}><span>${MODES[id].name}</span></label>`).join("")}</fieldset><p id="coop-rules" class="coop-rules">${MODES.coop.rules}</p><div id="coop-lobby"><div class="dialog-actions"><button id="coop-create" class="primary">Raum erstellen</button></div><form id="coop-join-form" class="coop-join"><label for="coop-code">Raumcode</label><input id="coop-code" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD"><button id="coop-join" class="quiet" type="submit">Beitreten</button></form></div><div id="coop-room" hidden><p class="coop-code">Raum <b id="coop-room-code"></b></p><p id="coop-status" role="status"></p><p class="coop-mission">Mission: <b id="coop-mission"></b></p><div class="dialog-actions"><button id="coop-leave" class="quiet">Raum verlassen</button><button id="coop-launch" class="primary" hidden>Mission starten</button></div></div></dialog>
  <dialog id="restart-dialog"><h2>Mission neu starten?</h2><p>Deine aktuelle Verteidigung und dein Fortschritt werden zurückgesetzt.</p><div class="dialog-actions"><button id="cancel-restart" class="quiet">Weiterspielen</button><button id="confirm-restart" class="primary">Neu starten</button></div></dialog>`;
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
  text("mission-sector", sector ? `SEKTOR ${roman(sectors.indexOf(sector))} · ${sector.name.toUpperCase()}` : "VERTEIDIGUNG");
  text("mission-focus", m.focus);
  text("sector-label", m.map.name);
  text("difficulty", `${total} Wellen · ◇ ${m.startingCredits} Start-Credits`);
  // A ring has no reactor; the HUD counts the enemies in it against the limit instead.
  text("lives-label", m.circle ? "IM RING" : "REAKTOR");
  text("lives-max", `/ ${m.circle ? m.circle.limit : m.reactorEnergy}`);
  text("wave-total", `/ ${total}`);
  text("help-waves", String(total));
  document.getElementById("wave-segments")!.innerHTML = Array.from(
    { length: total },
    (_, i) => `<span data-wave="${i + 1}"><i></i><small>${pad(i + 1)}</small></span>`,
  ).join("");
}
/**
 * Fills the mission dialog; called each time it opens and on every tab change.
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
  const tabs = document.getElementById("sector-tabs")!;
  tabs.hidden = !selected;
  tabs.innerHTML = sectors.map((sector, i) => {
    const first = missionNumber(sector.missions[0], missions),
      last = first + sector.missions.length - 1,
      active = sector === selected;
    return `<button class="sector-tab" role="tab" id="sector-tab-${i}" data-sector="${i}" aria-controls="mission-list" aria-selected="${active}" tabindex="${active ? 0 : -1}"${sector === current ? ' data-current="true"' : ""}><span class="sector-index">${roman(i)} <small>${pad(first)}–${pad(last)}</small></span><span class="sector-name">${sector.name}</span></button>`;
  }).join("");
  const list = document.getElementById("mission-list")!;
  if (selected) {
    list.setAttribute("role", "tabpanel");
    list.setAttribute("aria-labelledby", `sector-tab-${sectors.indexOf(selected)}`);
  } else {
    list.removeAttribute("role");
    list.removeAttribute("aria-labelledby");
  }
  list.innerHTML = (selected?.missions ?? missions).map((m) => {
    const n = missionNumber(m, missions);
    return `<button class="mission-card" data-mission="${m.id}"${m.id === game.mission.id ? ' aria-current="true"' : ""}><span class="mission-index">${pad(n)}</span><span class="mission-copy"><strong>${m.name}</strong><small>${m.focus}</small></span><span class="mission-stats"><b>${m.waves.length} Wellen</b><small>◇ ${m.startingCredits}${m.circle ? ` · ⟳ max. ${m.circle.limit}` : ""}</small></span></button>`;
  }).join("");
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
      s.paused ? "Spiel fortsetzen" : "Spiel pausieren",
    );
    pause.disabled = s.status !== "wave";
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
        : `<p class="next-wave-empty">${terminal ? `MISSION BEENDET · ${s.status === "won" ? "Alle Wellen abgewehrt" : circle ? "Ring überlastet" : "Reaktor verloren"}` : "LETZTE WELLE LÄUFT"}</p>`;
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
          '<div class="selection-heading"><span>TAKTIK</span><b>◇</b></div><p>Baue an Kurven, um Gegner länger in Reichweite zu halten.</p><div class="placement-note">Klicke einen gebauten Turm an, um ihn zu verbessern, oder einen Gegner, um seine HP und Eigenschaften zu sehen.</div>';
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
        ? `<b>Welle</b> ${pad(s.wave + 1)} <small>${Math.ceil(s.circle!.next)} s · +${earlyBonus(this.game)} ◇</small> <span>▶</span>`
        : s.status === "wave"
          ? "<b>Welle</b> läuft"
          : match
            ? `<b>${ready ? "Bereit ✓" : "Bereit"}</b> ${pad(s.wave + 1)}${ready ? "" : " <span>▶</span>"}`
            : `<b>Welle</b> ${pad(s.wave + 1)} <span>▶</span>`;
    quick.hidden = terminal;
    quick.disabled = !callable && (s.status !== "ready" || ready);
    if (quick.innerHTML !== quickLabel) {
      quick.innerHTML = quickLabel;
      quick.setAttribute(
        "aria-label",
        callable ? `Welle ${s.wave + 1} jetzt rufen` : s.status === "wave" ? "Welle läuft" : match ? `Bereit für Welle ${s.wave + 1}` : `Welle ${s.wave + 1} starten`,
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
        text("overlay-restart", "Revanche");
        document.getElementById("overlay-missions")!.hidden = !host;
      }
    } else overlay.hidden = !s.paused && !terminal;
    if (!overlay.hidden && !match) {
      text("overlay-icon", terminal ? (s.status === "won" ? "✦" : "◇") : "Ⅱ");
      text("overlay-kicker", terminal ? "MISSION BEENDET" : "TAKTISCHE PAUSE");
      text(
        "overlay-title",
        s.status === "won"
          ? circle ? "Der Ring ist leer." : "Die Linie hält."
          : s.status === "lost"
            ? circle ? "Ring überlastet." : "Reaktor verloren."
            : "Zeit für einen Plan.",
      );
      text(
        "overlay-copy",
        s.status === "won"
          ? circle
            ? `${this.game.mission.name}: alle ${this.game.waves.length} Wellen aufgerieben. ${s.kills} Gegner besiegt.`
            : `${this.game.mission.name}: alle ${this.game.waves.length} Wellen abgewehrt. ${s.kills} Gegner besiegt. ${s.lives} Reaktorenergie übrig.`
          : s.status === "lost" && circle
            ? `Mehr als ${circle.limit} Gegner kreisten gleichzeitig. Du hast Welle ${s.wave} erreicht und ${s.kills} Gegner besiegt. Rufe Wellen erst, wenn der Ring leerer ist.`
          : s.status === "lost"
            ? `Du hast Welle ${s.wave} erreicht und ${s.kills} Gegner besiegt. Versuche mehr Upgrades und Kryo-Unterstützung.`
            : "Du kannst weiter bauen. Mit der Pause-Taste geht es weiter.",
      );
      const next = s.status === "won" ? nextMission(this.game) : undefined;
      document.getElementById("overlay-next")!.hidden = !next;
      document.getElementById("overlay-restart")!.hidden = !terminal || !!next;
      text("overlay-restart", s.status === "won" ? "Erneut spielen" : "Neu starten");
      document.getElementById("overlay-missions")!.hidden = !terminal;
    }
    if (this.view.hover)
      text(
        "cell-label",
        `Feld ${String.fromCharCode(65 + this.view.hover.x)}${this.view.hover.y + 1}`,
      );
  }
}
