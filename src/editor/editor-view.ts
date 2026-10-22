/**
 * The hidden mission editor (`/#editor`): a toolbar, the paintable grid with the traced path, the settings panel
 * and the wave list. The module keeps one `draft`; every change recompiles it, refreshes only the regions it
 * touched and autosaves it after a short pause. The DOM is built once; later entries only re-render.
 */
import "./editor.css";
import { copyText } from "../app/room-code";
import { BRAND_MARK } from "../ui/brand";
import { playableMissions } from "../content/missions";
import type { ContentPack, MapTheme, MissionDefinition, TowerId } from "../core/types";
import { THEMES } from "../render/terrain";
import { escape } from "../ui/format";
import { pageOf, TOWER_PAGES } from "../ui/tower-pages";
import { decodeDraft, shareUrl } from "./codec";
import { blankDraft, type Compiled, compileDraft, draftFromMission, type EditorDraft, editWaves, LIMITS, paint, resize, type Tile } from "./draft";
import { exportTypeScript } from "./export";
import { asPlaytest } from "./playtest-id";
import { currentDraft, deleteDraft, keepTarget, rememberDraft, saveDraft, savedDrafts } from "./storage";
import { waveClickEdit, waveInputEdit, wavesHtml } from "./wave-panel";

/** What the mission editor may do in the app; implemented by `app/input.ts`. */
export interface EditorHost {
  content: ContentPack;
  /** Loads the mission as a playtest and switches to the game on success. */
  playtest(mission: MissionDefinition): void;
  /** False while a multiplayer room is active. */
  canPlaytest(): boolean;
  /** `location.origin + location.pathname`, for share links. */
  base: string;
}

const TOOLS: readonly { tile: Tile; name: string }[] = [
  { tile: "S", name: "Entry" },
  { tile: "R", name: "Reactor" },
  { tile: "=", name: "Path" },
  { tile: "#", name: "Obstacle" },
  { tile: ".", name: "Free" },
];
const TILE_NAMES: Record<Tile, string> = { S: "entry", R: "reactor", "=": "path", "#": "obstacle", ".": "free" };
const REMEMBER_DELAY = 300;

let host: EditorHost,
  draft: EditorDraft,
  compiled: Compiled,
  tool: Tile = "=",
  painting = false,
  rememberTimer: ReturnType<typeof setTimeout> | undefined,
  keysBound = false;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);
const columns = () => draft.sketch[0].length;
const rows = () => draft.sketch.length;
const isRing = () => !draft.sketch.some((row) => row.includes("R"));

/** A size field's value rounded and clamped; undefined for empty or non-finite input. */
function sizeOf(input: HTMLInputElement, [lo, hi]: readonly [number, number]): number | undefined {
  const raw = input.value.trim(),
    n = raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined;
}

/** Renders the editor into `#editor-root`; runs on every entry to the page. */
export function openEditor(h: EditorHost): void {
  host = h;
  const root = document.getElementById("editor-root");
  if (!root) return;
  if (root.dataset.ready !== "1") {
    build(root);
    root.dataset.ready = "1";
    draft = currentDraft() ?? blankDraft();
  }
  readShareLink();
  renderAll();
}

/** Takes `?draft=` from the URL once and strips it, so a reload or Back does not load it again. */
function readShareLink() {
  const url = new URL(location.href),
    code = url.searchParams.get("draft");
  if (code === null) return;
  url.searchParams.delete("draft");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  const shared = decodeDraft(code);
  if (shared) {
    replaceDraft(shared, `Loaded "${shared.name}" from the share link.`);
  } else say("The share link could not be read. It may be cut off or from another version.", "error");
}

function say(text: string, tone: "ok" | "error" = "ok") {
  const line = $("ed-message");
  line.textContent = text;
  line.dataset.tone = tone;
}

function remember(now = false) {
  clearTimeout(rememberTimer);
  if (now) rememberDraft(draft);
  else rememberTimer = setTimeout(() => rememberDraft(draft), REMEMBER_DELAY);
}

/** Replaces the whole draft (new, loaded, from a mission) and redraws every region. */
function replaceDraft(next: EditorDraft, message: string) {
  const kept = keepUnsaved(next);
  draft = next;
  remember();
  renderAll();
  say(kept ? `${message} ${kept}` : message);
}

/** Saves the open draft first when it holds work no saved copy has, never over another saved draft; returns the note for the message line. */
function keepUnsaved(incoming: EditorDraft): string {
  const keep = keepTarget(draft, incoming, savedDrafts());
  if (!keep) return "";
  saveDraft(keep);
  return `Previous draft saved as "${keep.name}" (${keep.id}).`;
}

/** After a change: recompile, refresh status, trace and ring rules, and autosave. */
function changed() {
  compiled = compileDraft(draft, host.content);
  renderStatus();
  renderTrace();
  $("ed-ring").hidden = !isRing();
  remember();
}

function build(root: HTMLElement) {
  const tools = TOOLS.map(
    (t, i) =>
      `<button type="button" class="ed-tool" data-tool="${escape(t.tile)}" aria-pressed="false"><span class="ed-swatch" data-t="${escape(t.tile)}">${t.tile === "S" || t.tile === "R" ? t.tile : ""}</span>${t.name}<kbd>${i + 1}</kbd></button>`,
  ).join("");
  const field = (label: string, input: string, wide = false) => `<label class="ed-field${wide ? " wide" : ""}"><span>${label}</span>${input}</label>`;
  const n = (attrs: string) => `<input type="number" inputmode="decimal" ${attrs}>`;
  root.innerHTML = `<header class="menu-page-head"><button class="quiet menu-back" data-back>← Back</button><a class="brand" href="/" aria-label="ION BASTION home"><span class="brand-mark">${BRAND_MARK}</span><span>ION<span class="brand-light">BASTION</span></span></a></header>
<p class="eyebrow">DEVELOPER TOOL</p><h1>Mission Editor</h1>
<div class="ed-toolbar" role="toolbar" aria-label="Editor actions">
  <div class="ed-tool-group"><label class="ed-size">${n(`id="ed-new-cols" min="${LIMITS.columns[0]}" max="${LIMITS.columns[1]}" value="18" aria-label="Columns of the new map"`)}</label><span aria-hidden="true">×</span><label class="ed-size">${n(`id="ed-new-rows" min="${LIMITS.rows[0]}" max="${LIMITS.rows[1]}" value="12" aria-label="Rows of the new map"`)}</label><button type="button" class="quiet" id="ed-new">New</button></div>
  <div class="ed-tool-group"><select id="ed-drafts" aria-label="Saved drafts"></select><button type="button" class="quiet" id="ed-load-draft">Load</button><button type="button" class="quiet" id="ed-delete-draft">Delete</button></div>
  <div class="ed-tool-group"><select id="ed-from-mission" aria-label="Load from mission"><option value="">Load from mission…</option>${playableMissions(host.content).map((m) => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join("")}</select></div>
  <div class="ed-tool-group"><button type="button" class="quiet" id="ed-save">Save</button><button type="button" class="quiet" id="ed-share">Copy share link</button><button type="button" class="quiet" id="ed-export">Copy TypeScript</button></div>
  <div class="ed-tool-group"><button type="button" class="primary" id="ed-playtest">Playtest ▶</button></div>
</div>
<p id="ed-message" class="ed-message" role="status" aria-live="polite"></p>
<div class="ed-main">
  <div class="ed-board">
    <div class="ed-palette" role="group" aria-label="Paint tile">${tools}</div>
    <div class="ed-stage"><div id="ed-grid" class="ed-grid" aria-label="Map grid"></div><svg id="ed-trace" class="ed-trace" aria-hidden="true"></svg></div>
    <ul id="ed-status" class="ed-status" aria-live="polite"></ul>
  </div>
  <form id="ed-settings" class="ed-settings" autocomplete="off">
    <h2>Mission</h2>
    ${field("Id", `<input data-setting="id" spellcheck="false">`)}
    ${field("Name", `<input data-setting="name">`)}
    ${field("Focus", `<textarea data-setting="focus" rows="2"></textarea>`, true)}
    ${field("Theme", `<select data-setting="theme">${Object.keys(THEMES).map((t) => `<option value="${t}">${t}</option>`).join("")}</select>`)}
    <div class="ed-pair">${field("Columns", n(`id="ed-cols" min="${LIMITS.columns[0]}" max="${LIMITS.columns[1]}"`))}${field("Rows", n(`id="ed-rows" min="${LIMITS.rows[0]}" max="${LIMITS.rows[1]}"`))}</div>
    <div class="ed-pair">${field("Credits", n(`data-setting="startingCredits" min="0" step="1"`))}${field("Energy", n(`data-setting="reactorEnergy" min="1" step="1"`))}</div>
    ${field("HP growth per wave", n(`data-setting="hpGrowth" min="0" step="any" placeholder="0.14 (default)"`))}
    <fieldset id="ed-ring" class="ed-ring"><legend>Ring rules (no reactor)</legend><div class="ed-pair">${field("Interval s", n(`data-ring="interval" min="1" step="any"`))}${field("Limit", n(`data-ring="limit" min="1" step="1"`))}</div>${field("Early bonus / s", n(`data-ring="earlyBonus" min="0" step="any"`))}</fieldset>
    <fieldset class="ed-towers"><legend>Towers</legend><label class="ed-check"><input type="checkbox" id="ed-all-towers"> All towers</label><div id="ed-tower-list" class="ed-tower-list"></div></fieldset>
  </form>
</div>
<section id="ed-waves" class="ed-waves" aria-label="Waves"></section>`;
  bindGrid();
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  $("ed-settings").addEventListener("submit", (e) => e.preventDefault());
  // Esc in a field only leaves the field; the app's own Esc would leave the page.
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isField(e.target)) {
      (e.target as HTMLElement).blur();
      e.stopPropagation();
    }
  });
  if (!keysBound) {
    keysBound = true;
    document.addEventListener("keydown", onKey);
  }
}

/** Keys 1–5 pick a tile while the editor page is shown and no form field has the focus. */
function onKey(e: KeyboardEvent) {
  const page = document.getElementById("editor-root")?.closest<HTMLElement>(".menu-page");
  if (document.documentElement.dataset.view !== "menu" || !page || page.hidden) return;
  if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.repeat || isField(e.target)) return;
  const index = ["1", "2", "3", "4", "5"].indexOf(e.key);
  if (index < 0) return;
  e.preventDefault();
  setTool(TOOLS[index].tile);
}

function setTool(tile: Tile) {
  tool = tile;
  for (const b of document.querySelectorAll<HTMLElement>("#editor-root [data-tool]")) b.setAttribute("aria-pressed", String(b.dataset.tool === tile));
}

// Grid --------------------------------------------------------------------------------------------------------

function bindGrid() {
  const grid = $("ed-grid");
  const paintAt = (x: number, y: number) => {
    if (draft.sketch[y]?.[x] === tool) return;
    const before = draft.sketch;
    draft = paint(draft, x, y, tool);
    updateCells(before);
    changed();
  };
  const cellAt = (e: PointerEvent) => {
    const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("#ed-grid [data-x]");
    return cell ? { x: Number(cell.dataset.x), y: Number(cell.dataset.y) } : undefined;
  };
  grid.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const at = cellAt(e);
    if (!at) return;
    e.preventDefault();
    painting = true;
    grid.setPointerCapture(e.pointerId);
    paintAt(at.x, at.y);
  });
  grid.addEventListener("pointermove", (e) => {
    if (!painting) return;
    const at = cellAt(e);
    if (at) paintAt(at.x, at.y);
  });
  const stop = () => (painting = false);
  grid.addEventListener("pointerup", stop);
  grid.addEventListener("pointercancel", stop);
  grid.addEventListener("lostpointercapture", stop);
}

/** Lays out all cells for the current size and theme. */
function renderGrid() {
  const grid = $("ed-grid"),
    theme = THEMES[draft.theme],
    style = grid.parentElement!.style;
  style.setProperty("--cols", String(columns()));
  style.setProperty("--rows", String(rows()));
  style.setProperty("--ed-ground-a", hex(theme.ground[0]));
  style.setProperty("--ed-ground-b", hex(theme.ground[1]));
  style.setProperty("--ed-path", hex(theme.path.edge));
  style.setProperty("--ed-line", hex(theme.path.line));
  style.setProperty("--ed-block", hex(theme.backdrop));
  style.setProperty("--ed-accent", hex(theme.accent));
  const cells: string[] = [];
  draft.sketch.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) cells.push(cellHtml(x, y, row[x] as Tile));
  });
  grid.innerHTML = cells.join("");
}

const cellHtml = (x: number, y: number, t: Tile) =>
  `<div class="ed-cell${(x + y) % 2 ? " odd" : ""}" data-x="${x}" data-y="${y}" data-t="${escape(t)}" title="${x},${y} ${TILE_NAMES[t]}">${t === "S" || t === "R" ? t : ""}</div>`;

/** Redraws only the cells that differ from `before` (a paint may also move S or R). */
function updateCells(before: readonly string[]) {
  const grid = $("ed-grid");
  draft.sketch.forEach((row, y) => {
    if (row === before[y]) return;
    for (let x = 0; x < row.length; x++) {
      if (row[x] === before[y][x]) continue;
      const cell = grid.children[y * row.length + x] as HTMLElement,
        t = row[x] as Tile;
      cell.dataset.t = t;
      cell.title = `${x},${y} ${TILE_NAMES[t]}`;
      cell.textContent = t === "S" || t === "R" ? t : "";
    }
  });
}

/** The traced path with arrows along its direction; nothing while the draft does not compile. */
function renderTrace() {
  const svg = $("ed-trace");
  svg.setAttribute("viewBox", `0 0 ${columns()} ${rows()}`);
  if (!compiled.ok) {
    svg.innerHTML = "";
    return;
  }
  const { path, loop } = compiled.mission.map,
    points = [...path, ...(loop ? [path[0]] : [])].map((p) => `${p.x + 0.5},${p.y + 0.5}`).join(" ");
  svg.innerHTML = `<defs><marker id="ed-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="0.34" markerHeight="0.34" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1 L9,5 L1,9 z"/></marker></defs><polyline points="${points}" marker-mid="url(#ed-arrow)" marker-end="url(#ed-arrow)"/>`;
}

// Panels ------------------------------------------------------------------------------------------------------

function renderAll() {
  compiled = compileDraft(draft, host.content);
  setTool(tool);
  renderGrid();
  renderTrace();
  renderSettings();
  renderTowers();
  renderWaves();
  renderDrafts();
  renderStatus();
}

function renderStatus() {
  const list = $("ed-status"),
    item = (tone: string, text: string) => `<li data-tone="${tone}">${escape(text)}</li>`;
  if (!compiled.ok) list.innerHTML = compiled.errors.map((e) => item("error", e)).join("");
  else
    list.innerHTML =
      compiled.warnings.map((w) => item("warn", w)).join("") +
      item("ok", `Ready: ${compiled.mission.map.loop ? "ring" : "reactor"} map, ${compiled.mission.map.path.length} path cells, ${compiled.mission.waves.length} waves.`);
  const playtest = $<HTMLButtonElement>("ed-playtest"),
    canPlay = host.canPlaytest();
  playtest.disabled = !compiled.ok || !canPlay;
  playtest.title = !canPlay ? "Leave the multiplayer room to playtest." : compiled.ok ? "Play this draft" : "Fix the errors first.";
  const exp = $<HTMLButtonElement>("ed-export");
  exp.disabled = !compiled.ok;
  exp.title = compiled.ok ? "Copy the mission as TypeScript for a sector file" : "Fix the errors first.";
}

function renderSettings() {
  const form = $<HTMLFormElement>("ed-settings");
  for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-setting]")) {
    const value = draft[el.dataset.setting as keyof EditorDraft];
    el.value = value === undefined ? "" : String(value);
  }
  for (const el of form.querySelectorAll<HTMLInputElement>("[data-ring]")) el.value = String(draft.circle[el.dataset.ring as keyof EditorDraft["circle"]]);
  $<HTMLInputElement>("ed-cols").value = String(columns());
  $<HTMLInputElement>("ed-rows").value = String(rows());
  $("ed-ring").hidden = !isRing();
}

function renderTowers() {
  const all = !draft.availableTowers,
    chosen = new Set(draft.availableTowers ?? []),
    towers = Object.values(host.content.towers);
  $<HTMLInputElement>("ed-all-towers").checked = all;
  const list = $("ed-tower-list");
  list.hidden = all;
  list.innerHTML = all
    ? ""
    : TOWER_PAGES.map((page, i) => {
        const boxes = towers
          .filter((t) => pageOf(t) === i)
          .map((t) => `<label class="ed-check"><input type="checkbox" data-tower="${escape(t.id)}"${chosen.has(t.id as TowerId) ? " checked" : ""}> ${escape(t.name)}</label>`)
          .join("");
        return boxes ? `<div class="ed-tower-page"><h3>${page.name}</h3>${boxes}</div>` : "";
      }).join("");
}

function renderWaves() {
  const enemies = Object.values(host.content.enemies).sort((a, b) => a.name.localeCompare(b.name));
  $("ed-waves").innerHTML = wavesHtml(draft.waves, enemies, playableMissions(host.content));
}

function renderDrafts() {
  const saved = savedDrafts();
  $("ed-drafts").innerHTML = saved.length
    ? saved.map((d) => `<option value="${escape(d.id)}"${d.id === draft.id ? " selected" : ""}>${escape(d.name)} (${escape(d.id)})</option>`).join("")
    : `<option value="">No saved drafts</option>`;
  $<HTMLButtonElement>("ed-load-draft").disabled = $<HTMLButtonElement>("ed-delete-draft").disabled = !saved.length;
}

// Events ------------------------------------------------------------------------------------------------------

async function onClick(e: MouseEvent) {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
  if (!b || b.disabled) return;
  if (b.dataset.tool) return setTool(b.dataset.tool as Tile);
  if (b.dataset.waveAction) {
    const edit = waveClickEdit(b);
    if (!edit) return;
    draft = { ...draft, waves: editWaves(draft.waves, edit) };
    renderWaves();
    changed();
    return;
  }
  switch (b.id) {
    case "ed-new": {
      const c = sizeOf($("ed-new-cols"), LIMITS.columns),
        r = sizeOf($("ed-new-rows"), LIMITS.rows);
      if (c === undefined || r === undefined) return say("Enter a size: columns 6–24, rows 5–16.", "error");
      return replaceDraft(blankDraft(c, r), `New ${c}×${r} draft.`);
    }
    case "ed-load-draft": {
      const id = $<HTMLSelectElement>("ed-drafts").value,
        found = savedDrafts().find((d) => d.id === id);
      return found ? replaceDraft(found, `Loaded "${found.name}".`) : undefined;
    }
    case "ed-delete-draft": {
      const id = $<HTMLSelectElement>("ed-drafts").value;
      if (!id) return;
      deleteDraft(id);
      renderDrafts();
      return say(`Deleted the saved draft "${id}". The open draft stays.`);
    }
    case "ed-save":
      saveDraft(draft);
      remember(true);
      renderDrafts();
      return say(`Saved "${draft.name}" under its id "${draft.id}".`);
    case "ed-share":
      return (await copyText(shareUrl(draft, host.base)))
        ? say("Share link copied.")
        : say("Could not copy the share link: the clipboard is not available.", "error");
    case "ed-export":
      if (!compiled.ok) return say("Fix the errors before copying the TypeScript.", "error");
      return (await copyText(exportTypeScript(draft)))
        ? say("TypeScript copied. Paste it into a sector file.")
        : say("Could not copy the TypeScript: the clipboard is not available.", "error");
    case "ed-playtest":
      return playtest();
  }
}

function playtest() {
  if (!compiled.ok) return say("Fix the errors before playtesting.", "error");
  if (!host.canPlaytest()) return say("Leave the multiplayer room to playtest.", "error");
  remember(true);
  host.playtest(asPlaytest(compiled.mission));
  // A rejected playtest keeps the editor on screen.
  if (document.documentElement.dataset.view === "menu") say("The game rejected the playtest.", "error");
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.closest("#ed-waves")) {
    const edit = waveInputEdit(el);
    if (!edit) return;
    draft = { ...draft, waves: editWaves(draft.waves, edit) };
    return changed();
  }
  const key = el.dataset.setting;
  if (key === "id" || key === "name" || key === "focus") {
    draft = { ...draft, [key]: el.value };
    return changed();
  }
  const raw = el.value.trim(),
    value = raw === "" ? undefined : Number(raw);
  if (value !== undefined && !Number.isFinite(value)) return;
  if (key === "startingCredits" || key === "reactorEnergy") {
    if (value === undefined) return;
    draft = { ...draft, [key]: value };
    return changed();
  }
  if (key === "hpGrowth") {
    const { hpGrowth: _, ...rest } = draft;
    draft = value === undefined ? rest : { ...draft, hpGrowth: value };
    return changed();
  }
  const ring = el.dataset.ring as keyof EditorDraft["circle"] | undefined;
  if (ring && value !== undefined) {
    draft = { ...draft, circle: { ...draft.circle, [ring]: value } };
    return changed();
  }
}

function onChange(e: Event) {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  switch (el.id) {
    case "ed-cols":
    case "ed-rows": {
      const c = sizeOf($("ed-cols"), LIMITS.columns),
        r = sizeOf($("ed-rows"), LIMITS.rows);
      if (c !== undefined && r !== undefined && (c !== columns() || r !== rows())) {
        draft = resize(draft, c, r);
        renderGrid();
        changed();
      }
      $<HTMLInputElement>("ed-cols").value = String(columns());
      $<HTMLInputElement>("ed-rows").value = String(rows());
      return;
    }
    case "ed-from-mission":
    case "ed-copy-waves": {
      const m = playableMissions(host.content).find((x) => x.id === el.value);
      el.value = "";
      if (!m) return;
      if (el.id === "ed-from-mission") return replaceDraft(draftFromMission(m), `Loaded the mission "${m.name}" as a draft.`);
      draft = { ...draft, waves: draftFromMission(m).waves };
      renderWaves();
      changed();
      return say(`Copied ${m.waves.length} waves from "${m.name}".`);
    }
    case "ed-all-towers": {
      const { availableTowers: _, ...rest } = draft;
      draft = (el as HTMLInputElement).checked ? rest : { ...draft, availableTowers: Object.keys(host.content.towers) as TowerId[] };
      renderTowers();
      return changed();
    }
  }
  if (el.dataset.tower) {
    const on = new Set([...document.querySelectorAll<HTMLInputElement>("#ed-tower-list [data-tower]:checked")].map((x) => x.dataset.tower));
    draft = { ...draft, availableTowers: (Object.keys(host.content.towers) as TowerId[]).filter((id) => on.has(id)) };
    return changed();
  }
  if (el.dataset.setting === "theme") {
    draft = { ...draft, theme: el.value as MapTheme };
    renderGrid();
    return changed();
  }
}
