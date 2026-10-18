# Tower action card

## Intent

The user's problem: when a built tower is selected, its Upgrade button is often reachable only by scrolling.

The cause is the selection panel (`#selection`, filled by `towerDetails` in `ui/tower-details.ts`). It lives in the sidebar, below the build menu, and a tab of that menu holds up to 15 tower cards. Outside full screen, a phone held sideways gets a single column, so the panel sits below the board *and* below the whole build menu. In phone full screen it shares a narrow sidebar with the build menu.

The goal: the actions a player needs mid-wave sit right next to the tower they just clicked.

## Decided by the user

- **A compact action card next to the tower** (option A of four mockups). It holds:
  - the tower name and level;
  - the Upgrade action with its price;
  - the target priority;
  - Sell with its refund.
- **Path choices go in the card.** When the tower offers a choice instead of a single next level, the card shows every open option as its own button, each with its name, its role and its price. That covers the three Aura paths, and the three specializations after level 5.
- **The phone target is full screen in landscape.** The user plays on a phone in full screen. There the layout is already two columns: the board plus a narrow 150–200 px sidebar (`style.css`, `orientation: landscape and max-height: 540px`). Today that sidebar swaps the build menu for the tower panel while a tower is selected (`.sidebar.inspecting`, `ui/interface.ts`). With the card, **phone full screen stops that swap for towers**: the sidebar keeps the build menu, and the card is the only place for the tower's actions. (Selected enemies may keep using the swap.) On desktop and outside full screen the sidebar panel stays as it is, and the card is added.
- **It must work on a phone.** On small boards the card is slimmer, and the target priority becomes one button that cycles First → Last → Strong → Weak → Close. The card opens on the side of the tower away from the board edge. If it fits on neither side, it docks along the bottom edge of the board. (The user confirmed this proposal.)

## Goals

- Clicking a built tower shows its actions next to it, without any scrolling, on desktop and on a phone in landscape.
- Every action works from the card:
  - upgrade, including path and specialization choices;
  - targeting;
  - sell.
- Prices and affordability update live during a wave. An unaffordable option is shown disabled, as in the sidebar today.

## Non-goals

- No redesign of the build menu, the sidebar layout or the page's single-column phone layout.
- No change to the simulation, commands or balance. The card only issues the existing `upgrade`, `target` and `sell` commands.
- No radial menu. The full stats do not move into the card.

## Anti-goals (a failure even if it works)

- The card hides the tower it belongs to, or covers the stretch of path that tower is shooting at, more than it has to.
- The card fights the existing input. A click on the card must never reach the board and build or select something under it.
- On a phone the card is so small that buttons are hard to hit (touch targets under ~40 px tall).

## Behaviour

- **Opening:** selecting a tower opens the card: `view.selected` set through `input.chooseCell` or the keyboard Enter on a cell. One card at a time.
- **Closing:** any of these close it:
  - clicking an empty board cell;
  - Esc;
  - right click;
  - choosing a tower to build;
  - selling;
  - the mission ending (won or lost);
  - a mission change or restart.

  This follows what already clears `view.selected` (`input.cancel`, `chooseCell`, `choose`). The card follows `view.selected`; it has no state of its own. *(My call:)* clicking the selected tower again keeps it selected, as `chooseCell` does today. There is no toggle, so Enter on the selected cell never closes the card.
- **Contents, in order:**
  1. Header: tower icon/name and level, e.g. `Pulse · Lv 2/8`. Aura towers show their path or "Choose path" (same wording as the `selection-heading` in `towerDetails`).
  2. Upgrade:
     - If a single next level is on offer, it is one wide button: `Upgrade → Lv 3 · ◇ 120`.
     - If several options are open (Aura paths, specializations), each is a button with its label, role/summary and price. This reuses the option data `upgradeControl` already computes, including the Workshop discount.
     - At the maximum it shows a disabled "Max level".
  3. Target priority (attack towers only, never support towers or traps). Desktop: the five priority chips. Phone: one cycling button that shows the active priority.
  4. Sell: `Sell · ◇ <sellValue>`.
- **The ⓘ upgrade details:** the existing upgrade tooltips (before → after values) stay available from the sidebar panel. The card has no tooltip buttons, so it stays compact. *(Builder may add them if it costs little.)*
- **Sidebar:** outside phone full screen, the `#selection` panel keeps showing the full details for a selected tower, unchanged. In phone full screen the build menu stays visible instead (see above).
- **Keyboard:** `U` (upgrade) and `T` (cycle target) keep working as today. The card's buttons are real buttons in tab order.
- **Multiplayer:**
  - In co-op the card shows for any tower. For a tower owned by someone else, its action buttons are disabled with a short "Owned by <player>" line, mirroring what the `ownTower` guard in `game.ts` would reject.
  - In versus only the local field's towers are clickable anyway.
- **Pause and overlay:** the card stays usable while the game is paused (building and upgrading are allowed then). It is hidden while `#game-overlay` shows a mission end.

## Placement

- **Anchor:** the selected tower's cell, converted to page coordinates with `Battlefield.cellRect` (added with the Training coach in `render/scene.ts`).
- **Side:** the card goes on the left or right of the cell, vertically centred on the cell and clamped inside the board. *(My call:)* among the sides where the card fits, pick the one whose rectangle covers the fewest path cells (`map.path`); on a tie, pick the one with more room. That makes the "don't cover the path" anti-goal a rule, using only the map, not the range.
- **Fallbacks:**
  - If neither side has room for the card's width, it goes above or below the cell, whichever has more room.
  - If that doesn't fit either (a small phone board), it docks as a full-width strip along the bottom edge of the board (bottom sheet style), with the tower cell still highlighted by the existing selection ring. *(My call:)* if the tower sits in the rows the strip would cover, the strip docks at the top edge instead. In the strip the options sit side by side in one row: header, upgrade options, target, sell.
- *(My call:)* the slim variant keeps every path option to one line (label + price, role as a `title`), so a three-way choice stays about 3 × 40 px and the card can sit next to the tower on most phone boards; docking is the fallback, not the norm.
- **Updates:** it re-places on window resize, scroll, full-screen changes and board refit (`Battlefield.fit`). A tower never moves, so nothing else changes its position.
- **Bounds:** the card stays inside `#board-wrap`, so the overlay and full-screen layout keep working.

## Constraints from the project

- **Render and UI never change state.** All actions go through `input.execute` (and in multiplayer through the relay), like the sidebar buttons.
- **No duplicate ids.** The sidebar already uses `#sell-btn`, `#cancel-selection` and `upgrade-tooltip-<id>`. The card's buttons use data attributes (`data-upgrade`, `data-priority`, a new `data-sell`) so the existing click handler in `app/input.ts` serves both.
- **Clicks stay on the card.** A pointer down on the card must not reach Phaser's `pointerdown` on the board.
- **Language and tests:**
  - All text is English, in the existing tone.
  - Tests stay pure Vitest without a DOM. The placement maths (side choice, clamping, dock fallback) should be a pure function with a few focused tests. The card's HTML builder can be tested as a string, like `ui/players.test.ts`.
- **Interaction with the Training coach:** the coach's "select" and "upgrade" steps currently point at the sidebar (`#selection [data-upgrade]`). They should point at the card's upgrade button instead. *(My call:)* the coach bubble already re-places itself on every HUD refresh; when its target is inside the card, it places itself on the side of the card away from the tower, so the two never overlap.
- **Before finishing:** `npm test` and `npm run build`, plus a look in the real app at desktop and phone landscape sizes (playwright-core via `scripts/browser.ts`). Check:
  - a tower near each board edge;
  - an Aura path choice;
  - a level-5 specialization choice;
  - co-op ownership.

## Left to the builder

- Exact visuals within the existing HUD style (`style.css` tokens, chamfered panels, the cyan accent).
- The breakpoint that switches to the slim phone variant: board width or the existing phone media queries. It must cover phone full screen in landscape (roughly 640–932 × 320–430 px viewports); the real-app check uses that, e.g. 844 × 390 with `:root.is-fullscreen`.
- Whether the card animates in. If it does, a short fade, none under reduced motion.
- How to render the card: a new `ui/tower-card.ts` builder plus a small view class, or an extension of `Interface.refresh`, as long as it only re-renders when its content key changes (the way `selectionKey` works today).
