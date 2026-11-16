# Campaign loop, loadouts and Arsenal rebuild

## Context

The campaign has the content (60 missions, 60 towers, the Sector Atlas) but no loop around it:

- **No moment before a mission.** Start, "Next mission" and "Continue Campaign" drop the player on the board. The only preparation is a "Loadout 6/60" count on the atlas card.
- **No moment after it.** The result is the pause box with a star row and one joined text line; the loss tip is the same on every mission.
- **Stars do nothing**, and their thresholds are never shown.
- **The Arsenal page is a text list**: 60 rows, no icons, no description, nothing saying what a mark or signature does, no reason on a disabled button. About half the UI of the 2026-11-05 Arsenal plan was never built.
- **Progress is invisible in play** (no rank or Mk mark anywhere in the HUD), and many gear marks are dead: damage scaling rounds to whole numbers, so "+4% damage" changes nothing below 13 damage (25 towers at level 1); four range-less supports get no-op range marks; Aura's Mk II does nothing.
- **Ranks grant nothing** and take 35–100 missions per tower; research stops being a choice early because the player brings everything they own.
- **Two upgrade surfaces in a mission** (floating card, sidebar) offer the same actions with different labels; the path choice shows a tier label, not the path.
- **No finales, no ending**: after mission 60 "Next mission" continues into the Circuit.

Decided with the owner: keep the systems (Salvage research, XP ranks, gear Mk I–V) and fix their feel; ranks pay Salvage, show an insignia and give a small passive in play; add loadout slots; rebuild the Arsenal page; one in-mission upgrade surface; sector finales and a campaign ending. Out of scope: story text, Heroic variants, and the known `scripts/balance.ts` failures in sectors V, IX, XII (no mission, wave or strategy changes here).

Outcome: every solo campaign mission runs **Briefing → Mission → Debrief → (Arsenal) → next Briefing**.

## Design

**Loop and pages** (three new `MenuPage`s: `briefing`, `debrief`, `victory`)

```
Briefing  | map, focus, stats | intel (NEW tags), need chips,   | loadout 6/7: tabs, tile grid,
          |                   | rewards: first win, per star, ×2 | rank/Mk marks, Auto-fill · Arsenal · START
Debrief   | title, ★★☆ with thresholds | Salvage ledger counting up | XP bar per tower used, rank-ups
          | Sector secured / unlocked · N upgrades ready · NEXT · Arsenal · Replay · Missions · Battlefield
Arsenal   | band: Salvage · towers x/60 · slots · bounty · Next mission
          | tabs + filters + tower tiles (icon, chevrons, Mk pips, status) | detail: dossier, stats, veterancy bar,
          |                                                               | gear track I–V with effect texts, one action
```

- Every solo campaign start with locks in force goes through the briefing (atlas Start, home Continue/Retry, debrief Next/Replay, Arsenal Next). Circuit, Training, multiplayer, `?mission=`, `?unlock=all`, editor and Run are unchanged.
- The debrief is a menu page, not an enlarged overlay (the overlay is board-sized, is re-filled on every command, and cannot be fit-checked). For a paying game the end overlay shows only the title and a "Debrief →" button and opens the page after about 1.2 s; "Battlefield" returns to the board. Start and all debrief exits replace the history entry.

**Loadout** — `slotsOf(record)`: 6 at the start, +1 for the first win of the finales of sectors I, III, VI, IX (max 10; verified: the narrower of strategies A/B fits in every unrestricted mission). Picks ⊆ owned ∩ allowed. The Detector issued on stealth missions takes no slot. Special ops (restricted missions) lend their whole list, owned or not, capped by the slots when longer. One last loadout is stored; Auto-fill keeps valid picks, then covers uncovered needs, then fills by XP. The `mission` command already takes `towers`: no simulation change.

**Economy** (all knobs in `src/content/arsenal.ts`; provisional, tuned with a new script)

| Knob | Value |
| --- | --- |
| New star, once | 4 × (1 + sector) Salvage |
| Finale first win (sector cache) | 40 + 15 × sector |
| Rank-up bonus | 15 / 25 / 40 / 60 / 90 |
| Rank passive in play | −3% build cost per rank (through `gearPack`; each rank must change the price) |
| `VETERANCY_XP` | 150 / 450 / 1000 / 2200 / 4500 |
| `XP_FIELDED` | about 30 per tower type built in a mission, so traps and supports rank too |
| Bounty | stored pick per day, doubles waves + win pay, once per day |

A clean three-star pass then pays about 20k against 12.4k research plus 1,670 gear per tower, so research and gear compete to the end. Star thresholds stay 90% / 50% and are shown. Loss pay counts cleared waves (`wave - 1`).

**Gear** — every mark must do something for every tower: marks move into a `GEAR_MARKS` data table; geared damage keeps one decimal (a precision argument used only by gear, Run packs unchanged); range-less supports and Aura get marks that apply (cost or upgrade-price steps, Aura's early levels by position). A guard test (`markDelta` non-empty for every tower and mark) enforces it. Mark and signature texts come from pure describers over the data, never hand-typed numbers.

**Finales and ending** — a finale's first win adds "Sector secured" to the debrief (stars x/15, cache, slot if due). Any win that opens a sector makes Next fly to it on the atlas (the existing fresh-unlock flare is the reveal). Mission 60's first win leads to `/#victory` (totals, three-star hunt, Circuit, Run, short credits). One pure "next mission" rule everywhere: next unwon open mission of the same mode, never crossing into the Circuit. Training's dead "Begin campaign" leads to mission 1's briefing.

**In mission** — the floating card is the only place to act; the sidebar becomes read-only (stats, target, path ladder). Every upgrade shows its stat diff inline. Path/track choice: one option per branch with name, colour, role, three tier prices and total, tier I's diff, and one line saying the choice is exclusive; an accordion on the slim phone card (no `title` attributes). Header on a path: `Lv 6/8 · Ricochet I/III`. Rank chevrons and Mk badge in the build menu and card; the signature text in the sidebar. HUD Restart of a campaign game re-issues the mission with the same picks and the current gear.

**My calls** (not discussed; say so if you disagree): debrief as a page with auto-open; special ops lend their list; finale stays skippable (sector gate unchanged); one global last loadout; derived dossiers (tower description plus "answers" chips) instead of 54 hand-written lines; path choice stays one click on desktop; back pay for stars, finales and ranks already earned when the store migrates.

## Phases (each leaves the game working)

**1. Pure rules and knobs** — no UI change.
- `src/content/arsenal.ts`: `SALVAGE` additions, `RANK_BONUS`, `RANK_PASSIVE`, `LOADOUT`, `VETERANCY_XP`, `XP_FIELDED`, `GEAR_MARKS`.
- New in `src/campaign/`: `next-mission.ts` (`nextMission`), `loadout.ts` (`slotsOf`, `nextSlot`, `kitOf`, `validLoadout`, `fieldedTowers`, `autoLoadout`, `needChips`), `pay.ts` (`payOf` lines, `payPreview`, `rankGains`), `finale.ts` (`isFinale`, `securedOf`, `campaignComplete`, `campaignTotals`).
- `campaign/arsenal.ts`: `Arsenal` gains `loadout`, `bounty`; `standingOf`, `rankProgress`, `xpOf`. `campaign/gear.ts`: `markSteps` from `GEAR_MARKS`, rank passive, `markEffects`, `markDelta`. `campaign/rating.ts`: `starThresholds`. `run/threats.ts`: additive `missionNeeds`. `run/transform.ts`: optional precision on `scaleStat`.
- `home-action.ts`, `ui/atlas/model.ts` (`atlasNext`), `interface.ts` (`nextMission`) delegate to the one rule.
- New `src/ui/gear-text.ts` (`markText`, `signatureText`, `gearLines`), `src/ui/gear-badge.ts` (`rankChevrons`, `markPips`, `gearBadge`), `src/ui/tower-branches.ts` (grouping lifted out of `codexTowers`). Codex pages render `game.baseContent` (bug fix).
- New on-demand `scripts/arsenal-economy.ts`: plays A/B on base content with `play`, prints stars, XP per type, pay lines, cumulative ranks and Salvage; used to settle the numbers above.

**2. Storage v2 and settle** — old overlay still works.
- `src/app/arsenal-store.ts`: version 2 with a real migration (`campaign/migrate.ts`, back pay, never a wipe; an unknown newer version is never overwritten), `updateArsenal`, `bountyToday`.
- `leak` event carries `enemy` (`core/types.ts`, `systems/movement.ts`; events are not hashed).
- New `campaign/tally.ts` (leaks per enemy type), `campaign/tip.ts` (`lossTip`: an owned counter, else the cheapest researchable one), `campaign/debrief.ts` (`debriefOf`, `afterDebrief`), `app/campaign-session.ts` (`begin`, `end` → `Debrief`, mirrored to `sessionStorage`). `main.ts` end hook calls it under today's guards.

**3. Briefing and loadout** — `app/screens.ts` (pages), `interface.ts` (shells), `app/menu-nav.ts` (`selectMission` → `briefable` branch), new `app/campaign-flow.ts` and `ui/briefing-view.ts`, `ui/atlas/card.ts` (Start becomes "Briefing ▶", slots and reward preview), `menu.css` plus fitted block. Reuse `fillImage`, `mapPreviewSvg`, `missionEnemies`, `towerIconHtml`, `TOWER_PAGES`, `rovingKeys`.

**4. Debrief, finales, ending** — new `ui/debrief-view.ts` (sections laid out from the start, staged by opacity, skippable, final values at once under reduced motion) and `ui/victory-view.ts`; overlay change in `interface.ts`; atlas finale node shows cache and "+1 slot"; bounty badge on atlas node, home preview and briefing.

**5. Arsenal page** — new `ui/arsenal/model.ts` (`arsenalTiles`, `branchCounts`, `gearNodes`, `researchBlock`, `dossier`, `arsenalStatus` moved here to break the import cycle), `tiles.ts`, `detail.ts`, `ui/arsenal.css`; `ui/arsenal-view.ts` rewritten (persistent regions, one delegated listener, focus and selection survive a purchase, flare on the changed tile and node, `aria-disabled` action with its reason). Remove `menu.css` 3825–3843. Codex gains rank and a gear line.

**6. One upgrade surface, gear in play** — `ui/tower-card.ts` (`CardChoice` with `changes` and `branch`, `cardSub`), `tower-card-view.ts` (accordion state), `ui/tower-details.ts` (read-only, `pathLadder`), rename `upgrade-tooltip.ts` → `upgrade-changes.ts` (drop `upgradeControl`, `bindUpgradeTooltip`), remove the sidebar button code in `interface.ts`, `game-input.ts`, `main.ts`, `style.css`; `Interface.fielded` set in `selectMission` before `execute`; drop "Locks the other two paths." from tier I descriptions.

**7. Docs and checks** — `scripts/campaign-states.ts` (fresh, mid, late fixtures; fullest win and loss debrief) and `scripts/menu-fit-check.ts` steps for briefing, debrief, victory, Arsenal; add `arsenal.css` to `app/compact.test.ts`; update CLAUDE.md, README, the field manual line; save this plan as `docs/superpowers/plans/2026-11-11-campaign-loop.md`.

## Execution: Opus 5.5 and Sonnet 5.5 agents

All implementation is done by subagents (`model: "opus"` or `"sonnet"`); the main session only briefs them, reviews each diff, runs the checks below and commits. Work happens on a branch `feat/campaign-loop`, one commit per task after its checks pass. Tasks run in the order listed, on the one working tree (they share `interface.ts`, `menu-nav.ts` and the stylesheets, so no parallel worktrees), except where marked parallel (disjoint files).

| # | Task | Model | Why |
| --- | --- | --- | --- |
| 1a | Phase 1 rules and knobs: `content/arsenal.ts`, `campaign/*` (next-mission, loadout, pay, finale, gear marks and rank passive, rating), `run/threats.ts`, `run/transform.ts`, the delegating call sites, tests | Opus | Game rules, determinism, the dead-mark data fix |
| 1b | `ui/gear-text.ts`, `ui/gear-badge.ts`, `ui/tower-branches.ts`, Codex `baseContent` fix, tests (parallel with 1c) | Sonnet | Fully specified pure helpers |
| 1c | `scripts/arsenal-economy.ts` and a report of the measured numbers (parallel with 1b) | Sonnet | A script over existing `play` |
| 1d | Settle the economy knobs from the 1c report | Opus | Judgement on pacing |
| 2 | Phase 2: store v2 and migration, `leak` event, tally, tip, debrief model, `campaign-session.ts`, `main.ts` hook, tests | Opus | Persistence and the settle order must be exactly right |
| 3 | Phase 3: briefing page, loadout editor, `campaign-flow.ts`, `menu-nav.ts` routing, atlas card, fitted layout | Opus | Navigation, History API and the tightest fitted screen |
| 4a | Phase 4 debrief view and overlay change, from the finished `Debrief` model | Sonnet | View over a fixed data shape |
| 4b | Victory page, Training "Begin campaign", atlas finale and bounty badges | Sonnet | Small, specified pieces |
| 5 | Phase 5: Arsenal page rebuild (`ui/arsenal/*`, `arsenal.css`, controller) | Opus | The page the owner called out; needs design judgement |
| 6a | Phase 6: tower card and read-only sidebar, removals in `interface.ts`, `game-input.ts`, `main.ts`, `style.css` | Opus | Touches the live HUD and its placement logic |
| 6b | Gear in play (`Interface.fielded`, build-menu and card badges, sidebar gear line), test moves from `upgrade-tooltip.test.ts` and `auras.test.ts` | Sonnet | Mechanical once 6a and 1b exist |
| 7 | `scripts/campaign-states.ts`, `menu-fit-check.ts` steps, `compact.test.ts`, CLAUDE.md, README, plan doc | Sonnet | Fixtures and docs |

Each agent gets: this plan, the section for its task, the files to read first, the constraints from CLAUDE.md that apply (all state changes through `Game.command`, determinism, solo baseline unchanged, English only, lean tests, `--ion-*` tokens, shape primitives), and the checks it must run before reporting (`npm test`, `npm run build`, plus the golden diffs for 1a, 2 and 6a). After each task the main session reads the diff, re-runs the checks itself, and for the UI tasks (3, 4a, 5, 6a) takes the screenshots listed under Verification before moving on; a task that fails review goes back to the same agent with the findings.

## Tests (lean, pure Vitest)

Loadout (slots only from the listed finales, pool ⊆ owned ∩ allowed, Detector without a slot, special op lends, auto-fill answers a need and never exceeds slots); next mission (wraps to a skipped one, never crosses mode); pay (stars only when new, cache only on a finale's first win, loss counts `wave - 1`, values read from `SALVAGE`); migration (keeps every field, back pay once); tally and tip; `afterDebrief`; gear (`markDelta` guard, rank passive changes every price, describers for the four signature forms); Arsenal model (status at the price boundary, rank named before Salvage); tower card (plain levels carry changes, branch total, rule line, `cardSub`, slim has no `title=`); a two-player `mission` command with `towers` sets no arsenal. Move the cases from `upgrade-tooltip.test.ts` and `auras.test.ts`.

## Verification

- `npx vite-node scripts/sim-golden.ts > before.txt` and `sh scripts/run-golden.sh > run-before.txt 2>&1` before phase 1; both diffs empty after phases 1, 2 and 6 (base content and Run packs must not change).
- `npm test` and `npm run build` after every phase.
- With `npm run dev`: `npx vite-node scripts/menu-fit-check.ts` (no scrolling, Start and action buttons on screen at the phone sizes, selection and focus kept after a purchase).
- End to end in the browser from a cleared profile: Play → Campaign → mission 1 briefing → win at 2× → debrief ledger and XP bars → Arsenal research → next briefing with the new tower selectable; then a loss (tip names what leaked), a finale (Sector secured, slot 7, atlas flight), a v1 save (migration with back pay), a special op, and a co-op lobby start (no briefing, no pay).
- Screenshots through `scripts/browser.ts` at 1440×900, 932×430 and 667×375 of briefing, debrief, Arsenal (fresh, mid, one Mk V), and the card at a plain level, a path choice, on a path, an Aura track choice and docked.
- `scripts/arsenal-economy.ts` output reviewed for the final knob values. `scripts/balance.ts` is not part of this plan's checks (missions unchanged, known failures).

## Risks

- Fitted layout: the briefing with 60 owned towers at 740 × 360 and the fullest debrief are the tight states; both have fixtures.
- Card height at a path choice (about 420 px with three open options) falls back to docking; the slim accordion must re-clamp, not re-place.
- Three stars are beyond the reference strategies after sector I, so star pay is mostly a replay-with-gear goal; the thresholds are one constant if that proves too stingy.

## As built

Where the implementation differs from the plan above (the nine commits on `feat/campaign-loop` and the final checks):

- **Gear track.** The Arsenal's Mk I–V track is a vertical ladder in the detail panel (one row per mark with its effect text, state and, for the next mark, its real before → after values), not a horizontal track; the narrow detail column scrolls under a fixed action row.
- **Debrief ready count.** `Debrief.ready` is stored when the mission ends, but the page reads `arsenalSummary().ready` when it renders, so it shows what the Arsenal buys now (after a purchase or a reload), not what it bought at the end of the mission.
- **XP knob.** `XP_FIELDED` is a table by gear class (`armed` 30, `trap` 60, `support` 30, `field` 80) instead of one value of about 30, because traps and range-less Supports rarely kill or earn assists; `gearClassOf` moved to `campaign/arsenal.ts` so `xpOf` and the gear marks share it.
- **Bounty.** It doubles only the waves and the win pay (not stars, cache or rank bonuses), once per UTC day (`paid`); the day's pick is stored in the Arsenal (`bounty`) so it does not move when a win opens missions.
- **`briefable`.** The "is this mission briefed" rule is its own pure module, `campaign/briefable.ts`, not part of `menu-nav.ts`; `campaign-flow.ts` uses it (the atlas card applies the same rule inline: solo, locks in force, not a ring mission).
- **Card height.** The three-path choice card is about 484 px tall (the plan expected about 420 px); it docks to a board edge when it does not fit beside the tower, and the slim phone card keeps the accordion.
- **New modules not in the plan.** `ui/gear-standing.ts` (`standingIn`, `gearBlock`: what the HUD shows of a campaign tower's gear, read through `Interface.fielded`), `ui/debrief-text.ts` (the debrief's wording as pure functions) and `campaign/briefable.ts`. `arsenalTowers` stays in `app/arsenal-store.ts` for its tests but the menu no longer calls it (the briefing's `kitOf` replaced it).
- **Fixtures.** `scripts/campaign-states.ts` builds the stored states through the pure functions; the fullest win lists the next sector's first mission among its unlocks by hand, because a finale win in a reachable record opens only the sector.
- **Final checks.** The coach bubble sits beside the phone layout's rail instead of over it (at 932 × 430 it covered the speed and settings buttons during "Start the wave"); a finale's atlas label wraps to two lines on a phone instead of overflowing its plate; the Tower Codex's Arsenal fact spans two cells; the loss tip asks for towers, not upgrades, when none were built (`lossTip`'s optional `built`).
