# Run Mode: Roguelite Depth Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase by phase; every phase ends with a balance gate (`scripts/run-balance.ts`) and must leave the game shippable.

**Goal:** Turn the Run mode (`src/run/`, `/#run`) from "five generated missions in a row" into a roguelite with a real power curve, carried resources, meaningful drafts and relics, a plannable route and reasons to play again.

**Architecture:** Unchanged at its core. Everything new stays in pure `src/run/` modules (state transitions, generators, transforms) driven by the run seed, and reaches the game only as data: a `MissionDefinition` plus a `ContentPack` built by `runMission`. The simulation never learns about runs (CLAUDE.md). The one new app-side piece is a mission journal for resuming (Task 3).

**Tech Stack:** TypeScript strict ESM, Vitest, plain DOM in `ui/run-view.ts`, `scripts/run-balance.ts` for tuning.

## Context: findings of the review

Bot baseline (`npx vite-node scripts/run-balance.ts -- --seeds 30`): mission 1 won 20/30, mission 2 9/20, mission 3 4/9, mission 4 0/4, mission 5 never reached. Causes, in order of weight:

1. **No power curve.** Every mission starts on its source mission's credits; a drafted tower adds an option, not power; relics are small flat percentages; levels 6–8 are open from mission 1. Difficulty rises twice meanwhile (`BANDS` moves to later campaign missions, `DEPTH_HP` 0.65 → 0.85).
2. **Nothing carries over.** The reactor resets per mission; a 3★ win and a 1-energy win lead to the same next step.
3. **Elites are a pure penalty on steps 1 and 3:** `paysRelic` already pays a relic on odd steps, so an elite there adds 15% HP for nothing.
4. **Drafting a Detector makes runs harder:** `enemyPool` filters stealth out until the roster has one.
5. **The draft is a non-decision:** 1 of 3 by tab weight, no synergy, no rarity, no reroll, skipping is worthless, a bigger roster is never worse.
6. **Relics are stat sticks:** 12 flat buffs, no rule changes, no trade-offs, no tiers.
7. **The route is flat:** two nodes, one step of foresight, no non-combat nodes.
8. **Free retries:** reloading the page (or opening another mission) during a run mission leaves the run in phase `mission`, and Deploy restarts it from wave 1.
9. **No endgame or meta:** the boss node is a longer mission with Titans; the record is best/wins/runs only.

## Decisions to confirm with the user

These change the plan's shape; the defaults below are what the tasks assume.

| Question | Default in this plan | Alternative |
| --- | --- | --- |
| What does a lost mission do? | **Hull:** the run carries 100 Hull; reactor damage wears it down, a lost mission costs a large chunk but the run goes on; Hull 0 ends the run. | Keep "one loss ends the run" (then Hull only measures damage). |
| Run length | 5 required missions + optional elite missions on the map (0–3). | Fixed 5, elites only as a variant of a required node. |
| Are levels 6–8 gated in a run? | **Yes**, by licenses bought or won during the run. | Leave them open, find vertical power elsewhere. |
| Meta progression | **Light:** threat levels (ascension), daily seed, cosmetic/starter-choice unlocks only. No permanent power. | Permanent upgrades between runs. |

## Global Constraints

- **Pure and seeded.** Every new offer, map, event and shop stock is drawn from `streamOf(seed, "<purpose>", step, …)` with its own purpose key, so adding a stream never shifts existing ones. No `Math.random` in `src/run/` (only `randomSeed` in the view, as today).
- **The simulation never learns about runs.** New effects are content or mission transforms (`ContentPack`, `MissionDefinition`). If a relic truly needs new behaviour, add an optional field to content that stays `undefined` in the campaign (CLAUDE.md "Solo play is the baseline") and test that campaign balance does not move.
- **Upgrade costs stay positive integers** (validation): a "free" upgrade costs 1.
- **Storage:** `RunState` goes to `v: 2`; `parseRun` migrates a `v: 1` run (adds defaults) instead of dropping it. Run record goes to `v: 2` with per-threat-level bests; v1 records still read.
- **English everywhere**, texts in `ui/run-view.ts` / `run/*.ts`.
- **Tests stay lean:** a few focused tests per mechanic in `src/run/*.test.ts`.
- Before finishing any task: `npm test`, `npm run build`; after any change to generator, relics, bands, rewards or difficulty: `scripts/run-balance.ts` (CLAUDE.md).

## Review Focus

1. **Replays stay identical:** the same seed and the same choices give the same map, offers, shop stock, events and missions. → test `walk()` twice and compare every offer and generated mission.
2. **Every generated mission validates** with its run pack (relics, licenses, mods applied). → extend the existing 40-seed validation test to the new state.
3. **Resume is exact or refuses:** a resumed mission reproduces the `stateHash` stored with its journal, or falls back visibly; it never resumes into a different game. → Task 3 tests.
4. **Campaign untouched:** `scripts/balance.ts` for one sector before and after phases that touch content types (should be byte-identical output).

---

## Phase 0: Quick fixes (≈1 day)

### Task 1: Elites always pay extra

**Files:** `src/run/run.ts`, `src/ui/run-view.ts`, `src/run/run.test.ts`

- [ ] Split the reward rule: `paysRelic` stays the regular cadence (odd steps); add `elitePrize(run)` for elite nodes.
- [ ] Elite reward = the regular reward **plus** a fourth tower card (`OFFERED_TOWERS + 1`) **and** a relic offer, drawn from a separate stream `streamOf(seed, "elite-relics", step)` so it never duplicates the regular one. On an odd step the player takes both relics (two pick panels). Once rarity exists (Task 10) the elite offer is drawn from Rare and up.
- [ ] Update `KIND_NOTE.elite` ("Tougher enemies; pays an extra relic and a fourth draft card").
- [ ] Test: an elite on step 1 yields two relic offers with no overlap; a normal node on step 0 yields none.

### Task 2: Threat tags on route cards

**Files:** new `src/run/threats.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `threatsOf(mission, content)`: from the **generated** waves (not the source), report `air` (share of budget, show when ≥ 15%), `stealth`, `burrow`, `titans`, `fast` (any group with speed ≥ 1.4× the median), plus the dominant traits (`armor`, `shield`, `regen`, `split`) when they carry ≥ 20% of the budget.
- [ ] Route and deploy cards show the tags as chips (icon + word, `title` with the share). Suppressed threats (the source has them, the roster cannot answer) show struck through: "Stealth: none (no Detector)". This makes the Detector effect visible instead of a hidden penalty; Task 5 adds hazard pay to make it worth it.
- [ ] Replace the raw enemy-name list on the card with the tags; keep names in the `title`.
- [ ] Test: a source mission with stealth and a roster without Detector reports `stealth` as suppressed; with a Detector as present.

### Task 3: Mission journal (close the free-retry loophole)

**Files:** new `src/run/journal.ts` (pure), `src/app/input.ts`, `src/render/scene.ts` (`LocalDriver`), `src/run/storage.ts`, `src/ui/run-view.ts`

Design: the simulation is deterministic, so a run mission can be rebuilt from its commands instead of a snapshot.

- [ ] `Journal { missionId, entries: { tick: number; command: Command }[]; tick: number; hash?: string }`. `record(cmd)` stores the command at the current tick; `advance()` counts ticks. Skip view-only commands (`pause`, speed) so replays do not stall.
- [ ] `LocalDriver.advance` gets an optional `onTick` callback; `input.ts` wires it to the journal only while `isRunMission(game.mission)`. `execute` records every successful command of a run mission.
- [ ] Persist the journal to `ion-bastion:run-journal` at each wave end and every 10 s of wave time (cheap: commands only), together with `stateHash(game.state)`.
- [ ] `replay(journal, mission, content): Game` (pure): new `Game`, apply entries at their ticks, tick to `journal.tick`, check the hash.
- [ ] On the Run page in phase `mission` with no live game but a journal for this mission: the button reads **Resume mission (wave n)**; it replays (about 0.3–1 s, show a spinner) and opens the game paused. Hash mismatch or missing journal after Deploy: **the mission counts as lost** (Hull penalty, Task 6), with the reason shown; a mismatch is logged with `console.warn` as a bug.
- [ ] Deploy marks the run `node.deployed = true` (saved). A second Deploy of a deployed node is impossible; only Resume.
- [ ] Clear the journal in `settleRun` and when a new run starts.
- [ ] Tests: replaying a scripted 3-wave session reproduces the hash; a tampered entry is detected; `settleRun` clears it.

### Phase 0 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 40` (expect slightly better elite results).

---

## Phase 1: Economy and power curve (≈4–5 days)

### Task 4: `RunState` v2 and Scrap

**Files:** `src/run/run.ts`, `src/run/storage.ts`, `src/run/session.ts`, `src/main.ts`, `src/run/run.test.ts`

- [ ] `RunState` v2 adds `scrap: number`, `hull: number`, `licenses: string[]` (`<towerId>:<path>`), `mods: RunMod[]` (per-tower cards, Task 7), `threat: number` (Task 16, 0 for now), `log: RunLogEntry[]` (per mission: stars, energy left, kills, scrap earned; used by the summary).
- [ ] `finishMission(run, result, content)` takes `MissionResult { won; livesLeft; energy; kills }` instead of `won`; `main.ts` passes it from `game.state` at the `end` event (`settleRun` signature changes accordingly).
- [ ] Scrap earned per win: `SCRAP_BASE` 20 + stars bonus (1★ 0, 2★ 15, 3★ 30, via the existing `missionStars`) + elite ×1.5 + hazard pay (Task 5). Losses pay nothing.
- [ ] Skipping the draft pays `SKIP_TOWER` 20 Scrap; skipping a relic pays `SKIP_RELIC` 30 Scrap.
- [ ] Migration: v1 → v2 with `scrap 0, hull 100, licenses = every path of every roster tower` (so old runs keep levels 6–8), `mods []`, `threat 0`, `log []`.
- [ ] Status bar shows Scrap and Hull.
- [ ] Tests: scrap per star tier; skip pays; v1 migrates and validates.

### Task 5: Hazard pay

**Files:** `src/run/threats.ts`, `src/run/run.ts`

- [ ] Each present threat that is normally suppressed for rosters without a counter (`stealth`, `burrow`) and `air` ≥ 30% pays `HAZARD` 10 Scrap on a win. Shown on the route card ("+10 ◈ hazard pay").
- [ ] Result: drafting a Detector now adds stealth **and** income, a choice instead of a penalty.

### Task 6: Hull (carried damage)

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/ui/run-view.ts`

- [ ] Start Hull 100 (`HULL_START`). After each mission: `hull -= round(HULL_WEAR × (1 − livesLeft / energy))` with `HULL_WEAR` 40. A lost mission costs `HULL_LOSS` 60 and gives no reward, but the run moves on to the next route choice (the step is still consumed: you fall behind on drafts).
- [ ] Hull ≤ 0 → phase `lost`. Winning the boss → `won` regardless of Hull.
- [ ] Optional softener for low Hull: below 30 Hull, the next mission's reactor energy is reduced by 20% ("damaged reactor"), shown on the card. Keep behind a constant so it can be tuned off.
- [ ] Abandon still ends the run.
- [ ] If the user keeps "one loss ends the run": Hull still exists as the carried damage meter, `HULL_LOSS` = ∞.
- [ ] Tests: wear formula; a loss with Hull 70 continues, a loss with Hull 50 ends.

### Task 7: Requisition (Scrap shop in the reward screen)

**Files:** new `src/run/shop.ts`, `src/run/run.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`

Until the map brings shop nodes (Phase 3), the reward screen gets a Requisition panel after the picks. Stock drawn from `streamOf(seed, "shop", step)`, 4 items:

| Item | Cost | Effect (all pure transforms) |
| --- | --- | --- |
| Reroll draft | 15, +10 per use in this reward | New 3 tower cards from `streamOf(seed, "towers", step, rerolls)` |
| Field Funds | 30 | +100 starting credits on the **next** mission only (`run.nextMission.credits`) |
| Repair crew | 25 | +25 Hull (cap 100) |
| Specialization license | 60 | Unlock one path (levels 6–8) of a roster tower (Task 8) |
| Drill | 35 | A roster tower's first two upgrades cost 1 credit for the rest of the run (`mods`) |
| Prototype discount | 30 | A roster tower costs 25% less for the rest of the run (`mods`) |

- [ ] `RunMod = { tower: TowerId; kind: "drill" | "discount" }`; `runMission` applies mods as a content transform before relics (reuse `mapTowers`, `price` from `relics.ts`, move them to a shared `run/transform.ts`).
- [ ] Buying advances nothing; "Continue" leaves the reward phase (`settleReward` gets an explicit `continue` action instead of auto-advancing after both picks).
- [ ] Tests: shop stock is seeded and stable; buying deducts Scrap and refuses when short; mods change the pack and validate.

### Task 8: Specialization licenses (vertical power)

**Files:** `src/run/transform.ts`, `src/run/generate.ts`, `src/run/run.ts`, `src/ui/run-view.ts`

- [ ] `lockSpecializations(licenses)`: content transform that removes every upgrade with `isSpecialization(u)` whose `<tower>:<path>` is not licensed. Check that `validateMission` accepts a tower whose `visual.paths` names paths without upgrades (it only checks upgrade → visual today); if not, also filter `visual.paths`.
- [ ] Sources of licenses: shop (Task 7), elite prize option ("or take a license instead of the fourth card"), boss-free events (Phase 3), the starter (choose one path of one starter tower? **no**: keep the start lean).
- [ ] The license picker lists the tower's three paths with `visual.paths[path].name` and role.
- [ ] HUD: a locked path in the upgrade panel shows "Locked in this run" (the upgrade simply does not exist in the run pack, so the panel needs only an empty-state text; verify how `upgradeOptions` renders a tower whose level-5 has no successors).
- [ ] Tests: unlicensed tiers are gone from the pack, licensed ones intact, campaign pack unchanged (`DEFAULT_CONTENT` identity).

### Task 9: Retune the difficulty curve

**Files:** `src/run/generate.ts`, `scripts/run-balance.ts`

- [ ] Extend the bot: spends Scrap greedily (license for its most-built tower first, then Drill, then Repair below 50 Hull), buys specialization tiers when licensed (first path, cheapest tier), reports Hull and Scrap per step.
- [ ] New tuning knobs in one place (`run/tuning.ts`): `DEPTH_HP`, `ELITE_HP`, `SCRAP_*`, `HULL_*`, shop prices.
- [ ] Targets for the greedy bot (a human should beat these): mission win rates ≈ 85 / 75 / 65 / 55 / 45%, ≥ 15% of runs complete, median Hull at the boss 30–60. Start by lowering `DEPTH_HP` for steps 3–4 (the current cliff), then let licenses carry the late game.

### Phase 1 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 60` hits the targets within ±10 points.

---

## Phase 2: Draft and relic depth (≈4 days)

### Task 10: Tags, synergy weighting and counter guarantee

**Files:** new `src/run/tags.ts`, `src/run/run.ts`

- [ ] `tagsOf(tower)`: derived where possible (attack kind, `targets`, placement): `burn` (burn, pool, oil), `chill` (slow, encase), `status` (catalyst, hex, stabilizer, vulnerable, mark), `chain`, `area`, `antiair`, `trap`, `economy` (vault, workshop, bounty, siphon), `support`. A small hand table in `tags.ts` covers what derivation misses; `tags.test.ts` fails if a tower has no tag.
- [ ] Draft weight = tab weight × (1 + 0.5 × tags shared with the roster), capped at ×2. Keeps archetypes forming without forcing them.
- [ ] **Counter guarantee:** if the next band's missions can carry a threat the roster cannot answer (air beyond one tower, stealth, burrow), one of the three cards is drawn from towers that answer it.
- [ ] Card shows its tags and a "Synergy" badge when it shares two or more.
- [ ] Tests: weighting is deterministic; the guarantee places a Detector-capable card when stealth is ahead and none is in the roster.

### Task 11: Rarity for towers and relics

**Files:** `src/run/run.ts`, `src/run/relics.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] Tower rarity from cost within its tab (bottom 50% Common, next 35% Rare, top 15% Epic); draw odds per step: step 0 70/25/5 → step 3 45/40/15. Elite fourth card is Rare+.
- [ ] Relic rarity: `rarity: "common" | "rare" | "legendary" | "cursed"` on `Relic`. The current 12 are Common. Boss-free legendary relics come from elite prizes and events only.
- [ ] Card frames per rarity (CSS only).

### Task 12: Relic expansion (rule and cursed relics)

**Files:** `src/run/relics.ts`, `src/run/relics.test.ts`

All as content/mission transforms. Target ≈ 30 relics. Candidates that need **no** simulation change:

| Relic | Rarity | Transform |
| --- | --- | --- |
| Wildfire Doctrine | Rare | Burn and pool attacks: duration +50% (attack params) |
| Arc Lattice | Rare | Chain attacks: +1 hop, −10% damage |
| Cryo Lattice | Rare | Slow attacks: factor 15% stronger, duration +30% |
| Siege Doctrine | Rare | Splash/mortar: range +20%, interval +10% |
| Minefield | Rare | Traps cost 40% less; trap radius unchanged, trap damage −10% |
| Prototype Lab | Rare | The cheapest tower in the roster costs 1 credit for its first build (mod on the pack: cost → price floor is 1) — check validation of cost 1 |
| Glass Reactor | Cursed | All towers +25% damage; reactor energy −40% |
| Austerity | Cursed | +180 starting credits; wave bonuses 0 |
| Overclocked Grid | Cursed | Attack towers fire 20% faster; all upgrades cost 25% more |
| Bounty Market | Cursed | Enemies pay +2; starting credits −30% |
| Sabotage Cell | Legendary | Enemies have −8% HP in every mission (`hpMultiplier` × 0.92) |
| Veteran Corps | Legendary | Every roster tower's `level-2` costs 1 |
| Deep Pockets | Legendary | Field Funds effect on every mission (+100 credits) |

- [ ] Re-check every attack-param scaling against `params` checks (validation ranges) and round like `scaleStat` does; add `scaleParam(kind, key, factor, filter)` to `run/transform.ts`.
- [ ] Cursed relics are offered only in events and as an elite option "take a cursed relic, gain 60 Scrap".
- [ ] Order matters (discount then floor): `applyRelics` keeps the pick order; document it on `RELICS`.
- [ ] Tests: each relic's pack validates on 3 sample missions; the cursed set changes both sides.

### Phase 2 gate
- [ ] `run-balance.ts`: completion rate within target; no single relic changes the bot's completion rate by more than +15 points (add `--relic <id>` to force one at the start).

---

## Phase 3: Route map (≈5 days)

### Task 13: Map generation

**Files:** new `src/run/map.ts`, `src/run/run.ts`, `src/run/storage.ts`

- [ ] `runMap(seed, content, threat)`: pure, derived from the seed (not stored; the run stores only `position` and `visited`). 9 columns, up to 3 lanes each:
  - Columns 0, 2, 4, 6: **mission** nodes (sources from `BANDS[0..3]`, never repeating a source in the run).
  - Columns 1, 3, 5, 7: **camp** nodes: Shop, Forge (licenses and Drill at a discount), Repair (+35 Hull), Event, or **Elite** (an optional extra mission from the next band, ELITE_HP, prize as Task 1).
  - Column 8: the **boss** (one node, visible from the start with its modifier, Task 15).
- [ ] Edges to the same or neighbouring lane only (Slay the Spire style); every lane is reachable; no column has two of the same camp kind; at least one Repair and one Shop on every path through columns 3–7.
- [ ] `RunState.step` becomes "missions cleared" (for difficulty) and `position` the map column/lane; `routeOffers` is replaced by `nextNodes(map, position)`.
- [ ] Tests: generation is stable per seed; constraints hold for 200 seeds; every source mission validates.

### Task 14: Camp nodes and events

**Files:** `src/run/camp.ts`, `src/run/events.ts`, `src/ui/run-view.ts`

- [ ] Shop and Forge reuse Task 7 (`shop.ts`) with their own stock lists; the reward-screen Requisition panel shrinks to "Reroll draft" only.
- [ ] Events: 8–10 text events, each a pure `(run, choice) → run` with 2–3 choices and visible costs. Examples:
  - *Derelict depot:* take a random Rare relic, or a random cursed relic + 60 Scrap, or leave.
  - *Mercenary crew:* a random Epic tower joins for the next mission only (`run.loan`), or pay 40 Scrap to keep it.
  - *Salvage the wreck:* +40 Scrap, −15 Hull.
  - *Field school:* a license for a roster tower's random path, −20 Hull.
  - *Quiet sector:* +20 Hull.
- [ ] Event choices draw from `streamOf(seed, "event", column)`.
- [ ] Tests: every event choice keeps the run valid (roster, relic ids, scrap ≥ 0).

### Task 15: Map view

**Files:** `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] An SVG node map across the page (horizontal on desktop, vertical on phones), node icons per kind, the reachable next nodes highlighted, visited path drawn, boss with its modifier at the end. Clicking a mission node opens the existing deploy card (map preview, threat tags, hazard pay).
- [ ] Keyboard: arrow keys move between reachable nodes, Enter chooses.
- [ ] Reuse `ui/sector-atlas.ts` route styles where it is cheap; do not couple the modules.

### Phase 3 gate
- [ ] `run-balance.ts` bot walks the map (policy: Repair below 50 Hull, else Shop if Scrap ≥ 60, else the lane with the fewest elites); targets from Task 9 still hold; average run length ≤ 6 missions.

---

## Phase 4: Endgame and replay value (≈4 days)

### Task 16: Boss modifiers

**Files:** new `src/run/boss.ts`, `src/run/generate.ts`

- [ ] `BOSS_MODS`, each a content/mission transform shown on the map from the start:
  - *Iron Vanguard:* ground groups gain the armor trait (or their armored variant) in this pack.
  - *Swarm Tide:* counts ×1.5, HP ×0.7 (budget kept), intervals shorter.
  - *Air Superiority:* the remix prefers air types for swaps (bias in `remixWave`), air share at least 40%.
  - *Titan Escort:* the last three waves each add one Titan.
  - *Blackout:* stealth groups added if the roster has a Detector, else +20% HP.
- [ ] One modifier at threat 0–4, two from threat 5 (Task 17).
- [ ] Tests: each modifier validates on every boss-band source mission.

### Task 17: Threat levels (ascension)

**Files:** `src/run/threat.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] Threat 0–10, unlocked one at a time by completing a run at the previous level. Cumulative: 1 elites +10% HP; 2 −10% starting credits; 3 Hull starts at 80; 4 shop prices +20%; 5 two boss modifiers; 6 `DEPTH_HP` +0.05 per step; 7 one cursed relic at the start; 8 Repair heals half; 9 elite prize drops the fourth card; 10 all of it plus +10% HP.
- [ ] Run record v2: `{ best, wins, runs, threat: { [level]: { best, wins } }, history: last 10 runs }`.
- [ ] Threat picker on the intro screen (locked levels greyed, with their rule visible).

### Task 18: Daily run

**Files:** `src/run/daily.ts`, `src/ui/run-view.ts`, `src/run/storage.ts`

- [ ] Seed `fnv(stable(["daily", YYYY-MM-DD UTC]))`, threat 3, a fixed starter (first pack). Wall-clock is read in the view only.
- [ ] One attempt per day (the journal makes retries impossible); local record per date; a "copy result" line (seed, missions, Hull, relics) for sharing.

### Task 19: Run summary and history

**Files:** `src/ui/run-view.ts`, `src/run/run.ts`

- [ ] End screen: per mission stars, energy left, Scrap earned (`run.log`), the final roster and relics, damage per tower type summed over the run (needs a per-mission tally: read `kill`/`damage` events app-side like stars, store in `log`; never from the sim state).
- [ ] History list of the last 10 runs on the intro screen (seed, threat, result), each with "Play this seed".
- [ ] Light unlocks (no power): completing threat 2 unlocks choosing among 4 starter packs; threat 4 unlocks a "Trap pack" starter column; first win unlocks the daily run.

### Phase 4 gate
- [ ] `run-balance.ts -- --threat 0` and `--threat 5`: completion at threat 5 roughly half of threat 0.

---

## Execution order and estimates

| Phase | Tasks | Effort | Ships alone? |
| --- | --- | --- | --- |
| 0 Quick fixes | 1–3 | ~1 day | yes |
| 1 Economy and power | 4–9 | ~4–5 days | yes (shop lives in the reward screen) |
| 2 Draft and relics | 10–12 | ~4 days | yes |
| 3 Route map | 13–15 | ~5 days | yes |
| 4 Endgame | 16–19 | ~4 days | yes |

Phase 1 is the one that matters most: without carried resources and vertical power, Phases 2–4 decorate a flat curve. Phases 2 and 3 can run in parallel after Phase 1 (they touch different files except `run-view.ts`; agree on the reward-screen layout first).

## Verification (end to end)

- [ ] `npm test`, `npm run build`.
- [ ] `npx vite-node scripts/run-balance.ts -- --seeds 60` against the Task 9 targets after every phase.
- [ ] `scripts/balance.ts` for sector I before/after Phase 1 and 2: identical (campaign untouched).
- [ ] Manual: `npm run dev`, `/#run`: play a seed through two missions, reload mid-wave and resume (hash match), check that a second Deploy is impossible, finish a reward with shop purchases, abandon, start a daily.
- [ ] Update CLAUDE.md's Run paragraph (new modules, storage keys `ion-bastion:run-journal`, v2 record, tuning file).
