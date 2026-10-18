# Tower Action Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Selecting a built tower opens a compact card next to it (upgrade or path choice, targeting, sell), so its actions never need scrolling, on desktop and in phone full screen.

**Architecture:** The card has three parts, plus the existing click handling:
- **Placement:** a pure function decides where the card goes, in board-local pixels.
- **Content:** a pure builder returns the card's HTML from the game state.
- **View:** a `TowerCard` class renders into `#tower-card` inside `#board-wrap` after every HUD refresh (`Interface.onRefresh`) and places it.
- **Actions:** clicks reuse the existing `data-*` handler in `app/input.ts`, so every action still goes through `input.execute`.

**Tech Stack:** TypeScript (strict, ESM), Vitest 3 (pure, no DOM), Phaser 3 board, plain DOM HUD.

**Spec:** `docs/superpowers/specs/2026-10-18-tower-action-card-design.md`

## Global Constraints

- All player-facing text is in English. Render and UI code only read state; every action goes through `input.execute`.
- No duplicate ids. The sidebar keeps `#sell-btn`, `#cancel-selection` and `upgrade-tooltip-<id>`. The card uses only data attributes: `data-upgrade`, `data-priority`, `data-sell`, `data-priority-cycle` and `data-deselect`.
- Touch targets in the card are at least 40 px tall.
- Phone target: full screen in landscape, `(orientation: landscape) and (max-height: 540px)` with `:root.is-fullscreen`. Check it at 844 × 390.
- In phone full screen a selected **tower** no longer swaps the sidebar to the tower panel; a selected **enemy** still does.
- Tests are lean and pure Vitest. Before finishing, run `npm test` (the 6 enemy-art/animation failures come from missing Git LFS in this checkout) and `npm run build`.

## Review Focus

1. **A tower in a corner or edge cell** (column 0, the last column, row 0, the last row): the card stays fully inside the board. Covered by a Task 1 test.
2. **A card taller than the space around the tower** (a phone board with three path options): it docks along the bottom, or along the top when the tower sits in the bottom rows. Covered by a Task 1 test.
3. **Credits changing during a wave:** an unaffordable option is disabled and becomes enabled once it is affordable. Covered by a Task 2 test.
4. **A tower at its maximum level, a support tower and a trap:** the card shows "Max level", and has no targeting control for support towers. Covered by a Task 2 test.
5. **The selected tower disappearing** (sold by a co-op partner, a restart, a mission change): the card hides instead of showing stale buttons. Covered by the Task 3 `cardTower` test.

---

### Task 1: Pure card placement

**Files:**
- Create: `src/ui/tower-card-place.ts`
- Test: `src/ui/tower-card-place.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CardPlaceInput {
    board: { width: number; height: number };      // board size in CSS px
    columns: number; rows: number;
    cell: Point;                                     // the selected tower
    card: { width: number; height: number };        // measured card size
    path: readonly Point[];                          // map.path
  }
  export type CardPlacement =
    | { mode: "float"; side: "left" | "right" | "above" | "below"; x: number; y: number }   // top-left, board-local px
    | { mode: "dock"; edge: "top" | "bottom" };
  export function placeTowerCard(input: CardPlaceInput): CardPlacement;
  export const CARD_GAP = 8;  // px between the cell and the card
  ```

**Algorithm**, which the tests pin down:
1. `size = board.width / columns`. The cell rectangle is `cell × size`.
2. Candidate sides, in this order: right, left, then above, below.
   - Right and left are vertically centred on the cell.
   - Above and below are horizontally centred on it.
   - All are offset `CARD_GAP` from the cell and clamped into the board along the cross axis.
3. A side **fits** when the card lies fully inside the board along the main axis.
4. **First pass, left/right:** among the fitting sides, take the one whose rectangle overlaps the fewest path cells (any overlap counts). On a tie, take the side with more free room.
5. **Second pass, above/below:** only if neither left nor right fits, the same rule applies to above and below.
6. **Dock:** if nothing fits, dock. The edge is `"bottom"` unless the cell's row is in the bottom `ceil(card.height / size)` rows, then `"top"`.

- [ ] **Step 1: Write the failing tests** in `tower-card-place.test.ts`:
  - `prefers the side that covers fewer path cells`: an 18×12 board, 900×600 px, card 160×140, cell (6,2), and a path along row 3 under the right side only. Expect `side: "left"`.
  - `stays inside the board for edge cells`: for cells (0,0), (17,0), (0,11) and (17,11) with an empty path, the result is `float` with `0 ≤ x`, `x + 160 ≤ 900`, `0 ≤ y` and `y + 140 ≤ 600`.
  - `falls back to above/below when neither side fits`: board 300×200, columns 6, rows 4, card 200×60, cell (3,2). Expect `mode: "float"` and side `above` or `below`.
  - `docks when nothing fits, at the top for a bottom-row tower`: board 400×300, columns 8, rows 6, card 300×280. Cell (4,1) expects `{ mode: "dock", edge: "bottom" }`; cell (4,5) expects `edge: "top"`.
- [ ] **Step 2:** Run `npx vitest run src/ui/tower-card-place.test.ts`. Expected: it FAILS because the module is not found.
- [ ] **Step 3:** Implement `placeTowerCard` in `src/ui/tower-card-place.ts` as described above.
- [ ] **Step 4:** Run the same command. Expected: 4 tests PASS.
- [ ] **Step 5:** Commit: `git add src/ui/tower-card-place.ts src/ui/tower-card-place.test.ts && git commit -m "Tower card: pure placement"`.

### Task 2: Card content builder

**Files:**
- Create: `src/ui/tower-card.ts`
- Test: `src/ui/tower-card.test.ts`

**Interfaces:**
- Consumes:
  - `upgradeOptions` and `isSpecialization`, `towerLevel`, `maxTowerLevel`, `towerPath` from `core/upgrades`;
  - `upgradeDiscount` and `discountedCost` from `systems/workshop`;
  - `sellValue` from `core/game`;
  - `isSupport` from `systems/attacks`;
  - `PRIORITY_LABELS` from `ui/messages`;
  - `TARGET_PRIORITIES` from `systems/combat`;
  - `escape` from `ui/format`.
- Produces:
  ```ts
  export interface CardChoice { id: string; label: string; detail: string; price: number; disabled: boolean }
  export function cardChoices(tower: Tower, towers: readonly Tower[], credits: number, content?: ContentPack): CardChoice[];
  export interface CardOptions { credits: number; slim: boolean; owner?: string }   // owner: "Player 2" when the tower is someone else's
  export function towerCardHtml(tower: Tower, towers: readonly Tower[], options: CardOptions, content?: ContentPack): string;
  ```

**What the builder decides:**
- **`cardChoices`:** returns one entry per upgrade option whose status is `"available"`. When an option is a plain level-up (no `path`, `effects.level` set), the `label` is `Upgrade → Lv N`. A path option or specialization takes its `label` from `upgrade.label`. `detail` is the path's role for a specialization (`visual.paths[path].role`) or the aura stat for an Aura path. `price` already includes the Workshop discount. An entry is `disabled` when `credits < price`.
- **`towerCardHtml` produces, in this order:**
  1. **Header:** `<name> · Lv X/Y`. Aura towers show `<name> · <path label>`, or `<name> · Choose path` before their first purchase. The header also holds a `data-deselect` ✕ button.
  2. **Upgrade options:** one `<button class="card-upgrade" data-upgrade="<id>">` per choice. In slim mode the role goes into `title` instead of a second line. With no choices, a disabled `Max level` button.
  3. **Targeting:** attack towers only (`!isSupport(attack)`). On desktop, five `data-priority` buttons. In slim mode, one `data-priority-cycle` button that shows the active label.
  4. **Sell:** `<button data-sell>Sell · ◇ <sellValue></button>`.
  5. **Another player's tower** (`owner` set): every action button is disabled and a line reads `Owned by <owner>`.

- [ ] **Step 1: Write the failing tests** in `tower-card.test.ts`. Build towers as plain objects, as `upgrade-tooltip.test.ts` does.
  - `offers the next level with its price, disabled while unaffordable`: a Pulse with `upgrades: []`. With `credits: 0`, `cardChoices` returns `[{ id: "level-2", price: 72, disabled: true, … }]`. With `credits: 500`, `disabled` is false.
  - `offers three specialization choices after level 5`: a Pulse with `upgrades: ["level-2","level-3","level-4","level-5"]` gets 3 choices, each with a non-empty `detail`.
  - `offers the three Aura paths before the first purchase`: an `aura` tower with `[]` gets 3 choices.
  - `shows Max level, and no targeting for support towers`: a Pulse with all upgrades along one specialization path produces HTML containing `Max level`. A `refinery` produces HTML without `data-priority`.
  - `slim mode cycles the target with one button`: Pulse HTML with `slim: true` contains `data-priority-cycle` and no `data-priority="`.
  - `disables a co-op partner's tower`: with `owner: "Player 2"`, the HTML contains `Owned by Player 2`, and every `data-upgrade` and `data-sell` button carries `disabled`.
- [ ] **Step 2:** Run `npx vitest run src/ui/tower-card.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `cardChoices` and `towerCardHtml` in `src/ui/tower-card.ts`. Export `priorityControl` from `ui/tower-details.ts` only if it can be reused unchanged; otherwise render the chips here.
- [ ] **Step 4:** Run the same command. Expected: 6 tests PASS.
- [ ] **Step 5:** Commit: `git commit -m "Tower card: content builder"` with both files.

### Task 3: Card on the board, actions, sidebar rule

**Files:**
- Create: `src/ui/tower-card-view.ts`
- Modify:
  - `src/ui/interface.ts`: add `<div id="tower-card" class="tower-card-pop" hidden></div>` inside `#board-wrap` after `#game-overlay`. Change the sidebar toggle so `inspecting` is set **only for a selected enemy**. That class is only used by the phone full-screen CSS (`style.css` ~1805), so desktop is unaffected.
  - `src/app/input.ts`: in the click handler, before the `switch`, add:
    - `b.dataset.sell !== undefined` → `execute({ type: "sell", id: view.selected })`;
    - `b.dataset.priorityCycle !== undefined` → the same next-priority logic as the `t` key (extract that logic into a local `cycleTarget()` shared by both);
    - `b.dataset.deselect !== undefined` → `cancel()`.

    The existing `data-upgrade` and `data-priority` branches already serve the card.
  - `src/main.ts`: create `const towerCard = new TowerCard(game, view, () => ui.session())`, and set `ui.onRefresh = () => { towerCard.refresh(); coach.refresh(); }`.
  - `src/style.css`: card styles with the existing tokens (`--panel`, `--neon`, chamfer look):
    - `position: absolute` inside `#board-wrap`, `z-index: 4` (above `#game-overlay`'s 3);
    - `width: 200px`, or `168px` with `.slim`;
    - buttons at least 40 px tall;
    - a docked variant: full width at the top or bottom, with the content in one row.
  - `README.md`, Controls section: one line saying that clicking a tower opens its action card.
- Test: `src/ui/tower-card.test.ts` (extend).

**Interfaces:**
- Consumes: `placeTowerCard` (Task 1); `towerCardHtml` and `CardOptions` (Task 2); `playerName` (`ui/players.ts`); `MultiplayerSession` from `Interface.session`.
- Produces:
  - `export function cardTower(state: GameState, selected: number | null): Tower | undefined` in `tower-card.ts`. It returns undefined when nothing is selected, the tower no longer exists, or the status is `won`/`lost`.
  - `class TowerCard { constructor(game: Game, view: ViewState, session: () => MultiplayerSession | null); refresh(): void }`. Task 4 relies on the element id `#tower-card`.

**`TowerCard.refresh` behaviour:**
- **Hidden:** when `cardTower(...)` is undefined or the menu view is active (`document.documentElement.dataset.view !== "game"`).
- **`slim`:** `matchMedia("(orientation: landscape) and (max-height: 540px)").matches || board.width < 560`.
- **`owner`:** `playerName(t.owner)` only when there is a co-op session (`session()` set and `!session().match`) and `t.owner !== view.player`. Versus fields always belong to the local player.
- **Rendering:** re-render `innerHTML` only when its content key changes. The key is the tower id, its upgrades, its priority, slim, owner, and the `disabled` flags of the choices.
- **Placing:** measure `offsetWidth`/`offsetHeight`, call `placeTowerCard` with `#board`'s client size, and apply `transform: translate(x, y)` or the `dock-top`/`dock-bottom` class. Re-place on `resize` and on `fullscreenchange`.
- **Clicks:** `pointerdown` on the card calls `stopPropagation()`, so it never reaches the board.

- [ ] **Step 1: Write the failing test** `cardTower hides for a missing tower and a finished mission`:
  - a state with tower id 3 gives `cardTower(state, 3)` that tower;
  - `cardTower(state, 99)` is undefined;
  - the same state with `status: "won"` gives undefined.
- [ ] **Step 2:** Run `npx vitest run src/ui/tower-card.test.ts`. Expected: the new test FAILS.
- [ ] **Step 3:** Implement `cardTower`, `TowerCard`, the markup, the CSS, the input branches and the `main.ts` wiring as listed above.
- [ ] **Step 4:** Run `npx tsc --noEmit && npx vitest run src/ui`. Expected: no type errors, and all UI tests pass.
- [ ] **Step 5: Real-app check.** Run `npm run dev`, then a throw-away playwright-core script under `visual-check/` (git-ignored, helpers from `scripts/browser.ts`):
  - **Desktop 1400 × 900,** `?mission=outpost-07&credits=3000`: build a Pulse at (6,2), click it, and screenshot. The card sits next to the tower without covering it. Buying the upgrade from the card raises the level. A click on the card builds nothing underneath.
  - **Tower at (0,0) and at (17,11):** the card is fully inside the board.
  - **Level-5 Pulse:** shows three specialization buttons. **Aura:** shows three path buttons.
  - **Phone 844 × 390,** after adding `is-fullscreen` to `<html>` via `page.evaluate`: the card is slim, and the sidebar still shows the build menu while a tower is selected.
- [ ] **Step 6:** Commit: `git commit -m "Tower card next to the selected tower"` with the files above.

### Task 4: Training coach points at the card

**Files:**
- Modify:
  - `src/ui/coach.ts`: the `upgrade` step target becomes `{ el: "#tower-card [data-upgrade]" }`.
  - `src/ui/coach-view.ts`: in `place()`, when the marked target sits inside `#tower-card`, anchor on `#tower-card`'s rect instead of the button, so the bubble is placed above or below the whole card and never overlaps it.
- Test: `src/ui/coach.test.ts`

**Interfaces:**
- Consumes: the `#tower-card` element (Task 3).

- [ ] **Step 1: Write the failing test.** Extend `asks for a second tower and an upgrade after wave 1…` with `expect(coachStep(game, view(null, first.id), memory)?.target).toEqual({ el: "#tower-card [data-upgrade]" })`.
- [ ] **Step 2:** Run `npx vitest run src/ui/coach.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Make the two changes listed above.
- [ ] **Step 4:** Run `npm test && npm run build`. Expected: everything passes except the 6 known LFS art tests, and the build reports `✓ built`.
- [ ] **Step 5: Real-app check.** Run the Training walk-through from `visual-check/training/walk.ts`. Steps 1–12 still advance, and at step 9 the bubble sits beside the card, not on top of it.
- [ ] **Step 6:** Commit: `git commit -m "Training coach points at the tower card"`.
