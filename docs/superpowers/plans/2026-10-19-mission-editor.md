# Mission Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. First step of execution: copy this file to `docs/superpowers/plans/2026-10-19-mission-editor.md` and commit it.

**Goal:** A hidden in-app page (`/#editor`) where the developer designs a whole mission (map, theme, waves, towers, credits, ring rules), playtests it right away, keeps drafts locally, shares drafts by link and exports TypeScript ready to paste into a sector file.

**Architecture:** Pure editor logic in a new `src/editor/` folder (draft model, compile/validate, link codec, storage, TS export), all tested in Node. A new `playtest` command loads an ad-hoc `MissionDefinition` through `Game.command`, so the rule "all state changes go through commands" still holds. The DOM view (`src/editor/editor-view.ts`) is loaded lazily when the page opens, so the game bundle barely grows.

**Tech Stack:** TypeScript strict ESM, Vitest, plain DOM (like the other menu pages), existing `parseMap`/`validateMission`.

**Spec:** No separate spec doc. The design decisions the user made in this session are recorded under **Decisions** below.

## Context

New levels are currently hand-written as ASCII sketches in `src/content/maps.ts` / `src/content/sectors/*.ts`, with waves as `g()`/`wave()` calls. Each iteration means editing code, reloading and navigating to the mission. The editor shortens that loop: paint → playtest → tweak → export.

## Decisions (from the user)

- Audience: the developer, inside the app. **Shipped, hidden:** it is in the production build, has no menu button and is reached only via `/#editor`.
- Scope: a full mission editor (map, waves, tower availability, credits, energy, HP growth).
- Map kinds: reactor paths **and** rings (Circuit `circle` rules).
- Persistence: drafts in localStorage, plus a share link that encodes the draft (`?draft=<code>#editor`).
- Export: **Copy TypeScript** to the clipboard (a `parseMap(...)` const plus a mission object literal).

## Global Constraints

- All player-facing text and code are in English (CLAUDE.md "Language").
- The editor never changes `DEFAULT_CONTENT`. Playtest missions go through the new `playtest` command only.
- Playtests are solo only: the command fails with `playtest-solo` when `g.players > 1`, and `Match.command` rejects it.
- Playtest mission ids are `playtest:<draft id>` (`PLAYTEST_PREFIX = "playtest:"`). They are never recorded as campaign wins (the existing identity check in `main.ts` already ensures this) and never remembered as the last mission.
- Grid size: columns 6–24, rows 5–16 (the campaign uses 11×7 up to 22×15).
- Default ring rules: `{ interval: 20, limit: 30, earlyBonus: 3 }`. Default credits and energy come from `MISSIONS[0]` (240 / 20). Default waves are a copy of `WAVES` (`content/waves.ts`).
- localStorage keys: `ion-bastion:editor-drafts` (all saved drafts) and `ion-bastion:editor-current` (autosave of the open draft). Every access is wrapped in try/catch, like `app/progress.ts`.
- Run `npm test` and `npm run build` before finishing. `scripts/balance.ts` is not needed, because no campaign content changes.

## Review Focus

1. **A malformed or truncated share link** (`?draft=garbage`) must not crash the app. The editor opens a blank draft and shows a notice. → Task 2 test `decodeDraft rejects garbage`.
2. **An exported snippet must compile to the same mission** that was playtested; a quote in a name or `hpMultiplier` on a wave must survive. → Task 3 round-trip test over all campaign missions plus a name containing `"`.
3. **After a playtest, "Restart Last Mission" on the home page** must restart the playtest, not fail with `mission-unknown`. The win overlay must not offer "Next mission" (which would be `missions[0]`). → Task 4/5 (`nextMission` returns `undefined` for unknown ids; `runPrimary` restarts playtests).
4. **Painting a second S or R** must move it rather than duplicate it. A sketch with two `R`s (possible through a share link) must be rejected, because `parseMap` accepts it silently. → Task 1 tests.
5. **A playtest in versus or co-op** must be rejected, not forwarded to a field: `Match.command`'s `default` case would otherwise forward it. → Task 4 test.

---

### Task 1: Draft model and compilation

**Files:**
- Create: `src/editor/draft.ts`, `src/editor/draft.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Tile = "S" | "R" | "=" | "#" | ".";
  export interface EditorDraft {
    version: 1;
    id: string; name: string; focus: string;
    theme: MapTheme;
    sketch: string[];            // rows of Tile characters, all the same length
    waves: WaveDefinition[];
    startingCredits: number; reactorEnergy: number;
    hpGrowth?: number;
    availableTowers?: TowerId[]; // absent = all towers
    circle: CircleRules;         // kept always, used only when the sketch has no R
  }
  export const LIMITS = { columns: [6, 24], rows: [5, 16] } as const;
  export const PLAYTEST_PREFIX = "playtest:";
  export const isPlaytest = (m: MissionDefinition) => m.id.startsWith(PLAYTEST_PREFIX);
  export function blankDraft(columns?: number, rows?: number): EditorDraft;   // 18×12 default, S at left edge row ⌊rows/2⌋, straight path, R at right edge
  export function paint(d: EditorDraft, x: number, y: number, tile: Tile): EditorDraft; // returns a new draft
  export function resize(d: EditorDraft, columns: number, rows: number): EditorDraft;   // clamps to LIMITS, crops/pads with "."
  export function sketchOf(map: MapDefinition): string[];
  export function draftFromMission(m: MissionDefinition): EditorDraft;
  export type Compiled = { ok: true; mission: MissionDefinition; warnings: string[] } | { ok: false; errors: string[] };
  export function compileDraft(d: EditorDraft, content?: ContentPack): Compiled;
  export const asPlaytest = (m: MissionDefinition): MissionDefinition => ({ ...m, id: PLAYTEST_PREFIX + m.id });
  ```

- [ ] **Step 1: Write failing tests** in `draft.test.ts`:
  - `blankDraft compiles`: `compileDraft(blankDraft()).ok === true`, map is 18×12, `loop` absent.
  - `sketchOf round-trips every mission`: for each `m` in `playableMissions(DEFAULT_CONTENT)`, `parseMap(m.map.id, m.map.name, sketchOf(m.map), m.map.theme)` deep-equals `m.map`.
  - `draftFromMission compiles back`: for `MISSIONS[0]` and one circle mission, `compileDraft(draftFromMission(m))` gives a mission deep-equal to `m`, except that `map.id` and `map.name` become `m.id` and `m.name` (see Step 3).
  - `paint moves S and R`: painting `S` at a new cell turns the old `S` into `=`; the same holds for `R`; out-of-bounds painting returns the same draft object.
  - `resize clamps`: `resize(d, 99, 1)` gives 24 columns × 5 rows.
  - `two reactors rejected`: a sketch with two `R`s gives `ok: false` with an error containing `"More than one reactor"`.
  - `ring gets circle rules`: removing `R` (path closed into a ring) compiles with `mission.circle` equal to `d.circle` and `map.loop === true`. A reactor draft compiles without a `circle` key.
  - `errors are collected, not thrown`: an empty `waves` array gives `ok: false` with the `ContentError` text.
  - `warns about stealth without a detector`: a draft whose waves contain a stealth enemy and whose `availableTowers` has no detector-kind tower returns a warning (use `hasStealth` from `core/mission-checks.ts`).
- [ ] **Step 2:** Run `npx vitest run src/editor/draft.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `draft.ts`.**
  - `compileDraft` calls `parseMap(d.id, d.name, d.sketch, d.theme)` (map id = mission id) and counts `R`s first.
  - It builds the mission with `circle` only when `map.loop` and `hpGrowth`/`availableTowers` only when set, then runs `validateMission(mission, content)`.
  - It catches `Error`/`ContentError` and returns their `.message`.
  - Warnings: stealth without a detector (`hasStealth`), and air without any available tower whose `targets` include `"air"` (`hasAir`).
  - `draftFromMission` deep-copies waves into plain mutable objects.
  - For the draft's `circle` it uses `m.circle ?? the default ring rules`.
- [ ] **Step 4:** Run the same test file. Expected: PASS.
- [ ] **Step 5:** Commit `feat(editor): draft model and compilation`.

### Task 2: Share-link codec and local drafts

**Files:**
- Create: `src/editor/codec.ts`, `src/editor/storage.ts`, `src/editor/codec.test.ts`

**Interfaces:**
- Consumes: `EditorDraft`, `LIMITS` (Task 1).
- Produces:
  ```ts
  // codec.ts
  export function encodeDraft(d: EditorDraft): string;            // base64url of UTF-8 JSON, no padding
  export function decodeDraft(code: string): EditorDraft | undefined;
  export function parseDraft(data: unknown): EditorDraft | undefined; // shape check: version 1, strings, rows equal length within LIMITS, only Tile chars, waves/groups numeric fields finite
  export const shareUrl = (d: EditorDraft, base: string) => `${base}?draft=${encodeDraft(d)}#editor`;
  // storage.ts
  export function savedDrafts(): EditorDraft[];   // from ion-bastion:editor-drafts, invalid entries dropped via parseDraft
  export function saveDraft(d: EditorDraft): void; // upsert by id
  export function deleteDraft(id: string): void;
  export function currentDraft(): EditorDraft | undefined;  // ion-bastion:editor-current
  export function rememberDraft(d: EditorDraft): void;
  ```
- [ ] **Step 1: Write failing tests** (codec only; storage is a thin try/catch wrapper like `progress.ts`):
  - `round-trips`: `decodeDraft(encodeDraft(d))` deep-equals `d` for `blankDraft()` and for `draftFromMission` of a circle mission, with a name containing `"ü\"<`.
  - `the code is URL-safe`: matches `/^[A-Za-z0-9_-]+$/`.
  - `decodeDraft rejects garbage`: returns `undefined` for `"garbage"`, `""`, a truncated code, valid base64 of `{"version":2}`, ragged rows, and a sketch containing `"X"`.
- [ ] **Step 2:** Run `npx vitest run src/editor/codec.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Use `TextEncoder`/`TextDecoder` plus `btoa`/`atob` (both available in Node 22 and browsers). No compression: an 18×12 draft with 10 waves is about 2–3 KB.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(editor): share links and local drafts`.

### Task 3: TypeScript export

**Files:**
- Create: `src/editor/export.ts`, `src/editor/export.test.ts`

**Interfaces:**
- Consumes: `EditorDraft`, `compileDraft` (Task 1).
- Produces: `export function exportTypeScript(d: EditorDraft): string`.

  The output has this shape (strings via `JSON.stringify`, the const name is the id in UPPER_SNAKE_CASE):
  ```ts
  export const <CONST> = parseMap("<id>", "<name>", [
    "<row>",
    ...
  ], "<theme>");

  // Add to a sector's missions (imports: parseMap from content/maps, g and wave from content/waves):
  {
    id: "<id>", name: "<name>", focus: "<focus>", map: <CONST>,
    startingCredits: N, reactorEnergy: N,[ hpGrowth: N,][ availableTowers: [...],][ circle: { interval, limit, earlyBonus },]
    waves: [
      wave(<bonus>, g("<type>", count, interval, delay)),   // delay omitted when 0
      { ...wave(<bonus>, ...), hpMultiplier: N },          // only when set
    ],
  },
  ```
- [ ] **Step 1: Write the failing test** `export evaluates to the compiled mission`.
  - For every campaign mission plus `blankDraft()` with a name containing `"`, take `d = draftFromMission(m)` and `code = exportTypeScript(d)`.
  - Strip `export `, wrap it as `new Function("parseMap", "g", "wave", code.replace(/^\{/m, "return {"))`. The mission literal is the last statement.
  - Call it with the real helpers. Expect the result to deep-equal `compileDraft(d).mission`.
- [ ] **Step 2:** Run `npx vitest run src/editor/export.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `exportTypeScript`.**
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit `feat(editor): TypeScript export`.

### Task 4: `playtest` command

**Files:**
- Modify: `src/core/types.ts`:
  - `Command` gets `| { type: "playtest"; mission: MissionDefinition }`.
  - `MessageCode` gets `"playtest-loaded" | "playtest-solo" | "playtest-invalid"`.
- Modify: `src/core/game.ts` (`HANDLERS`), `src/core/match.ts` (`command` switch), `src/ui/messages.ts`.
- Modify: `src/ui/interface.ts` (`nextMission`).
- Test: `src/core/game.test.ts` (or the existing nearest command test file), `src/core/match.test.ts`.

**Interfaces:**
- Consumes: `asPlaytest`, `compileDraft`, `blankDraft` (Task 1, tests only).
- Produces: `game.command({ type: "playtest", mission })` returns `{ ok, code: "playtest-loaded", params: { name } }`.

- [ ] **Step 1: Write failing tests:**
  - `playtest loads an ad-hoc mission`: `game.command({ type: "playtest", mission: asPlaytest(compiled) })` is ok, `game.mission.id` starts with `"playtest:"` and `game.state.wave === 0`.
  - `playtest is solo only`: after `game.setPlayers(2)` it fails with `playtest-solo`.
  - `invalid playtest fails cleanly`: a mission with `waves: []` gives `playtest-invalid`, and the previous mission stays loaded.
  - `versus rejects playtest`: `match.command({ type: "playtest", mission, player: 0 })` gives `playtest-solo`.
- [ ] **Step 2:** Run those test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The handler checks `g.players > 1` (→ `playtest-solo`), then `try { g.loadMission(c.mission) } catch { return fail("playtest-invalid") }`. `loadMission` validates before assigning, so a failure leaves the state untouched.
  - `Match`: add `case "playtest": return fail("playtest-solo");`.
  - Messages:
    - `"playtest-loaded"`: `Playtest: ${p.name}.`
    - `"playtest-solo"`: `Playtests run in single-player only.`
    - `"playtest-invalid"`: `The draft is not a valid mission.`
  - `nextMission`: return `undefined` when `findIndex` is `-1`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: playtest command for ad-hoc missions`.

### Task 5: Hidden `/#editor` page and game wiring

**Files:**
- Modify: `src/app/screens.ts`: add `"editor"` to `MenuPage` and `SLUGS` (`editor: "editor"`). Test: `src/app/screens.test.ts`.
- Modify: `src/ui/interface.ts`: add `<section class="menu-page menu-editor" data-page="editor" tabindex="-1" aria-label="Mission editor" hidden><div id="editor-root"></div></section>` inside `#start-screen`. No menu button.
- Modify: `src/app/input.ts`:
  - In the `enter` handler: `if (to.page === "editor") void import("../editor/editor-view").then((m) => m.openEditor(host))`.
  - `case "overlay-missions"` and `case "menu-btn"` go to `page("editor")` when `isPlaytest(game.mission)`.
  - `runPrimary`: when `primary.kind === "restart" && isPlaytest(primary.mission)`, it runs `execute({ type: "restart" })` and then `screens.show(GAME)`.
- Modify: `src/ui/interface.ts` overlay code: when `isPlaytest(game.mission)` the `#overlay-missions` label reads `Editor`.

**Interfaces:**
- Produces, for Task 6:
  ```ts
  export interface EditorHost {
    content: ContentPack;
    playtest(mission: MissionDefinition): void; // execute({type:"playtest", mission}); on ok → reloadBattlefield(); screens.show(GAME)
    canPlaytest(): boolean;                     // !coop.active()
    notice(text: string): void;                 // ui.notice
    base: string;                               // location.origin + location.pathname, for share links
  }
  export function openEditor(host: EditorHost): void; // in src/editor/editor-view.ts
  ```
- [ ] **Step 1: Write failing tests** in `screens.test.ts`:
  - `#editor` maps to `{ view: "menu", page: "editor" }`.
  - `?draft=abc#editor` also opens the editor (there is no `mission` param).
  - Add `"editor"` to the round-trip list.
- [ ] **Step 2:** Run `npx vitest run src/app/screens.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the screens change and the wiring above.** Until Task 6 lands, `editor-view.ts` is a stub `openEditor` that renders a heading.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: PASS. The chunk-size warning is expected, and `editor-view` appears as its own chunk.
- [ ] **Step 5:** Commit `feat: hidden editor page and playtest flow`.

### Task 6: Editor view

**Files:**
- Create: `src/editor/editor-view.ts`, `src/editor/editor.css` (imported by the view, so it is lazy too; reuse the `--m-*` tokens from `menu.css`).

**Interfaces:**
- Consumes:
  - `EditorHost`/`openEditor` (Task 5)
  - Task 1: `blankDraft`, `paint`, `resize`, `compileDraft`, `draftFromMission`, `asPlaytest`, `LIMITS`, `Tile`
  - Task 2: `decodeDraft`, `shareUrl`, `savedDrafts`, `saveDraft`, `deleteDraft`, `currentDraft`, `rememberDraft`
  - Task 3: `exportTypeScript`
  - `copyText` from `app/room-code.ts`, `THEMES` for cell colours, `playableMissions`.

Layout: a toolbar on top, the grid on the left, the settings panel on the right; it stacks on narrow screens.

- **Opening:**
  - Takes `?draft=` when present. It strips the param with `history.replaceState` and shows a notice when decoding fails.
  - Otherwise takes `currentDraft()`, otherwise `blankDraft()`.
- **Toolbar:**
  - New (size inputs), the Drafts dropdown (load / delete), Load from mission (`playableMissions` → `draftFromMission`)
  - Save, Copy share link, Copy TypeScript (`copyText(exportTypeScript(d))`)
  - Playtest: disabled unless `compiled.ok && host.canPlaytest()`; it calls `host.playtest(asPlaytest(mission))`.
- **Grid:** CSS grid of cells in theme colours, with a palette for S, R, path, obstacle and free (keys `1`–`5` while the page is focused).
  - Painting: `pointerdown` paints and captures; `pointermove` paints the cell under `document.elementFromPoint`, which also covers touch.
  - When the draft compiles, an SVG polyline over the grid shows the traced path and its direction (from `mission.map.path`; closed for rings).
- **Settings panel:**
  - id, name, focus, theme `<select>` (keys of `THEMES`), columns/rows
  - credits, energy, HP growth
  - ring rules: shown only when there is no `R`
  - tower checklist: "All towers" toggle; otherwise checkboxes grouped by `pageOf`
- **Waves:** one card per wave.
  - Wave fields: bonus, optional HP multiplier.
  - Group rows: enemy `<select>` over all `content.enemies` sorted by name, count, interval, delay, remove.
  - Buttons: add group, duplicate wave, move up/down, remove wave, "Copy waves from mission…".
- **Status:** a live list of `errors` (red) or `warnings` (amber) from `compileDraft`, recomputed on every change. Every change also calls `rememberDraft`, debounced by 300 ms.
- The view keeps a single `draft` variable and re-renders only the region that changed (grid cell, waves panel, status), following the `sector-atlas.ts` style.

- [ ] **Step 1:** Implement the view and CSS.
- [ ] **Step 2: Manual check.** Run `npm run dev` and open `http://localhost:4173/#editor`. Then:
  1. Paint a new S–R path and fix the error shown.
  2. Playtest it. The game shows the map, and the win/loss overlay offers "Editor", not "Next mission".
  3. Go back. The draft is intact.
  4. Erase R to make a ring. Ring rules appear, and the playtest runs with the circle timer.
  5. Copy the share link, open it in a new tab, and check the same draft loads.
  6. Open `?draft=garbage#editor`. A notice appears and the app does not crash.
  7. Copy the TypeScript, paste it temporarily into a sector, and check that `npx tsc --noEmit` passes. Revert afterwards.
  8. Check the page at phone width.
- [ ] **Step 3:** Run `npm test && npm run build`. Expected: PASS.
- [ ] **Step 4:** Commit `feat(editor): mission editor view`.

### Task 7: Docs

**Files:** Modify `CLAUDE.md`:
- a `src/editor/` row in the Layout table;
- one paragraph near the URL notes: `/#editor` is hidden and shipped, `?draft=`, the `playtest` command, `playtest:` ids are never recorded, and the export flow ("paste the const + mission into a sector, then run `scripts/balance.ts` for it").

README stays unchanged (hidden feature).

- [ ] **Step 1:** Edit CLAUDE.md.
- [ ] **Step 2:** Commit `docs: mission editor notes`.

## Execution

I recommend **Subagent-driven** execution: there are 7 tasks, Tasks 4–6 depend on the interfaces of Tasks 1–3, and a per-task reviewer catches drift in the shared names (`EditorDraft`, `EditorHost`) early. **Native** execution is the cheaper alternative, with one review at the end.

## Verification (end to end)

- `npm test`: the new suites `src/editor/*.test.ts`, plus the playtest tests in `game`/`match`/`screens`.
- `npm run build`: tsc clean; `editor-view` is split into its own chunk.
- The Task 6 manual checklist on the dev server. Optionally take a screenshot with `scripts/browser.ts` helpers at `/#editor`.
