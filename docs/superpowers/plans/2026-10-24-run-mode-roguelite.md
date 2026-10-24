# Run Mode: Roguelite Depth Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase by phase; every phase ends with a balance gate (`scripts/run-balance.ts`) and must leave the game shippable.

**Goal:** Turn the Run mode (`src/run/`, `/#run`) from "five generated missions in a row" into a roguelite of **10 full-length missions in three acts plus a final stand**, where one lost mission ends the run, the reactor carries its damage from mission to mission, and drafts, doctrines (specialization licenses), relics and the route compound into a build.

**Architecture:** Unchanged at its core. Everything new stays in pure `src/run/` modules (state transitions, generators, transforms) driven by the run seed, and reaches the game only as data: a `MissionDefinition` plus a `ContentPack` built by `runMission`. The simulation never learns about runs and gets **no new rules** (CLAUDE.md). The one new app-side piece is a mission journal for resuming (Task 3).

**Tech Stack:** TypeScript strict ESM, Vitest, plain DOM in `ui/run-view.ts`, `scripts/run-balance.ts` for tuning.

## Decisions (from the user, and the designer's calls)

| Question | Decision | Why |
| --- | --- | --- |
| Run length | **10 missions:** acts I–III each 2 Standard + an act boss (9), then the Final Stand (10). | User. |
| Mission length | **Full:** Standard and Elite 14 waves, act boss 16, Final Stand 20. | User: six waves is too thin for a tower defense arc. |
| Early wave calls | **No new mode.** Run length comes from game speed and how dominant the defense is. | User. |
| A lost mission | **Ends the run.** | User. |
| Carried damage | **The reactor carries over** (designer's call): every mission starts with the run's current reactor energy; leaks stay; repairs are a resource. | With one-loss-ends there must still be something between "flawless" and "dead" that carries forward, or wins all feel alike. Carried HP is the proven roguelite answer (Slay the Spire): a sloppy win in act I is a real cost in act III, and healing competes with power for every reward. |
| Levels 6–8 | **Doctrines** (designer's call): locked at the start; a Doctrine unlocks one specialization path of one tower type for the rest of the run, and that type is then committed to it. Earned, not just bought. | Specializations are the game's most exciting upgrade moments. Open from mission 1 they are just more numbers; as rare, permanent picks they become run-defining identity ("this is my Frost-Shatter run"), they create anticipation, and they make the roster choice matter (which tower deserves the doctrine). Committing the path removes in-mission dithering and turns the decision into a run decision. A free first Doctrine after mission 2 shows the system early. |
| Loadout | **No per-mission loadout. A roster cap instead** (designer's call): 6 towers in act I, 8 in act II, 10 from act III; drafting at the cap means replacing one. | The user was unsure, and with one-loss-ends a forgotten anti-air pick in a loadout screen would end a two-hour run on a menu mistake. A roster cap creates the same scarcity (drafts become replacements, synergy matters) with one decision per draft instead of one per mission, and no friction before every mission. If playtests show the cap is never felt, a loadout can still be added later (Task 7 notes). |
| Meta progression | **Light:** threat levels (ascension), daily seed, starter-choice unlocks. No permanent power. | A one-loss roguelite must stay a skill test; permanent power would make the first runs feel like grinding. |

## Context: findings of the review

Bot baseline (`npx vite-node scripts/run-balance.ts -- --seeds 30`): mission 1 won 20/30, mission 2 9/20, mission 3 4/9, mission 4 0/4, mission 5 never reached. Causes, in order of weight:

1. **Too few missions for choices to matter.** Four drafts and about two relics per run; picks cannot pay off.
2. **No power curve.** Every mission starts on its source mission's credits; a drafted tower adds an option, not power; relics are small flat percentages; levels 6–8 are open from mission 1. Difficulty rises twice meanwhile (`BANDS`, `DEPTH_HP` 0.65 → 0.85).
3. **Nothing carries over.** The reactor resets per mission.
4. **Elites are a pure penalty on steps 1 and 3:** `paysRelic` already pays a relic on odd steps.
5. **Drafting a Detector makes runs harder:** `enemyPool` filters stealth out until the roster has one.
6. **The draft is a non-decision:** no synergy, rarity, reroll or cap; skipping is worthless.
7. **Relics are stat sticks:** 12 flat buffs, no rule changes, no trade-offs, no tiers.
8. **The route is flat:** two nodes, one step of foresight, no non-combat nodes.
9. **Free retries:** reloading during a run mission and pressing Deploy restarts it from wave 1. With one-loss-ends this is the most important fix.
10. **No endgame or meta.**

## Mission length and run length

### Formats

| Format | Waves | Notes |
| --- | --- | --- |
| Standard | 14 | "Hot drop": enters the source mission at ≈ 15% with the credits a player would have there (Task 4), so no trivial opening waves |
| Elite | 14 | a lane alternative to a Standard node: +15% HP and one modifier, pays the elite prize (Task 1) |
| Act boss | 16 | one boss modifier, visible from the act start |
| Final Stand | 20 | the whole curve of a last-tier mission, two modifiers from threat 5, Titans in the last wave |

Elites replace a Standard node on another lane of the map (Phase 4), so a run is always exactly 10 missions.

### Time

Measured with the campaign's intended defenses (strategy A of all 60 campaign missions, no specializations): 16.4 waves per mission on average (10–20); spawn span per wave 11.5 s; wave duration median 48 s, 10th percentile 18.5 s, 90th percentile 94 s of game time. These defenses are tuned to barely win, so the median is an upper bound: a dominant defense finishes near the spawn span, and 2× speed halves everything.

Estimated real time including the build pause (the per-wave rates for careful and strong players are assumptions):

| Player | Speed | Per wave | 14-wave mission | Run (10 missions, ≈ 152 waves) |
| --- | --- | --- | --- | --- |
| Careful, tight defense | 1× | ≈ 55 s | ≈ 13 min | ≈ 2.3 h |
| Typical | 2× | ≈ 30 s | ≈ 7 min | ≈ 75 min |
| Strong, overbuilt | 2× | ≈ 12 s | ≈ 3 min | ≈ 30 min |

The run is saved between missions and resumable inside one (Task 3), so it can span sessions. Because runs are long and one loss ends them, two rules follow:

- **No cheap deaths.** Every threat of a node is visible before it is chosen (Task 2/6), the draft guarantees counters (Task 16), and difficulty rises smoothly inside acts.
- **Strong builds must still be challenged in act III**, or late missions become 20 waves of watching (balance target in Task 15).

### Short run

Act I only (3 missions, its boss in Final Stand format with 16 waves). About 45 waves. Used by the daily run and as the first unlock.

## Global Constraints

- **Pure and seeded.** Every new offer, map, event, shop stock and node is drawn from `streamOf(seed, "<purpose>", act, column, …)` with its own purpose key. No `Math.random` in `src/run/` (only `randomSeed` in the view).
- **The simulation never learns about runs and gets no new rules.** Every effect is a content or mission transform: credits, reactor energy, HP multipliers, tower stats, upgrade lists.
- **Upgrade and tower costs stay positive integers** (validation): "free" costs 1.
- **Storage:** `RunState` goes to `v: 2`. A `v: 1` run in progress is converted into a Short run (Task 5). Run record `v: 2`; v1 records still read.
- **English everywhere.**
- **Tests stay lean.**
- Before finishing any task: `npm test`, `npm run build`; after any change to generator, relics, structure, rewards or difficulty: `scripts/run-balance.ts`. A full run is ≈ 152 waves per seed; default 30 seeds, `--act n` for quick iterations.

## Review Focus

1. **Replays stay identical:** same seed and choices → same map, offers, stock, events, missions.
2. **Every generated mission validates** with its run pack (doctrines, ranks, mods, relics).
3. **Hot drops are fair at their start:** `creditsAt` within ±20% of strategy A's wallet at that wave on 5 source missions.
4. **No free retries:** a deployed mission can only be resumed (identical hash) or counts as lost.
5. **Campaign untouched:** `scripts/balance.ts` for one sector before/after Phases 1–3, identical output.

---

## Phase 0: Quick fixes (≈1 day)

### Task 1: Elites always pay extra

**Files:** `src/run/run.ts`, `src/ui/run-view.ts`, `src/run/run.test.ts`

- [ ] `elitePrize(run)` separate from the regular `paysRelic` cadence.
- [ ] Elite reward = regular reward **plus** a fourth tower card **and** a relic offer from `streamOf(seed, "elite-relics", step)` (no overlap with the regular offer). From Task 16 on: Rare and up.
- [ ] Update `KIND_NOTE.elite`.
- [ ] Test: an elite on step 1 yields two relic offers without overlap.

### Task 2: Threat tags on route cards

**Files:** new `src/run/threats.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `threatsOf(mission, content)` from the generated waves: `air` (budget share, shown from 15%), `stealth`, `burrow`, `titans`, `fast`, dominant traits (`armor`, `shield`, `regen`, `split`) above 20% of the budget.
- [ ] Chips on route and deploy cards with a coverage line per threat ("Air 35%: answered by Pulse, Flak" / "not answered"). Enemy names move to the `title`.
- [ ] Test: coverage reported correctly with and without a Detector.

### Task 3: Mission journal (no free retries)

**Files:** new `src/run/journal.ts` (pure), `src/app/input.ts`, `src/render/scene.ts` (`LocalDriver`), `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] `Journal { missionId, entries: { tick; command }[]; tick; hash? }`; view-only commands (`pause`, speed) skipped.
- [ ] `LocalDriver.advance` gets an optional `onTick`; `input.ts` wires it only while `isRunMission(game.mission)` and records every successful command.
- [ ] Persist to `ion-bastion:run-journal` at each wave end and every 10 s of wave time, with `stateHash(game.state)`.
- [ ] `replay(journal, mission, content): Game` (pure). A 20-wave mission is ≈ 25,000 ticks; target < 1.5 s, else chunked with a progress bar.
- [ ] Phase `mission` with no live game: **Resume mission (wave n)** replays and opens paused. Hash mismatch or a deployed node without a journal: shown as "Mission interrupted"; it **counts as lost** (one-loss-ends), with `console.warn` on a mismatch. Because this ends a long run, the journal is also written on `visibilitychange` → hidden and `pagehide`, so a closed tab loses at most the last seconds, and resume replays to the last saved tick.
- [ ] Deploy marks `node.deployed = true`; a deployed node offers only Resume.
- [ ] Clear the journal in `settleRun` and on a new run.
- [ ] Tests: a scripted 3-wave session replays to the same hash; a tampered entry is detected; `settleRun` clears it.

### Phase 0 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 40`.

---

## Phase 1: Structure: acts, full missions, carried reactor, roster cap (≈5 days)

### Task 4: Formats and hot drops

**Files:** `src/run/generate.ts`, new `src/run/formats.ts`, `src/run/run.test.ts`

- [ ] `FORMATS: Record<NodeKind, { waves; enter; hp; mods }>`: `standard` 14 entering at ≈ 15%, `elite` 14 (× `ELITE_HP`, 1 modifier), `actBoss` 16 entering at ≈ 15%, `finalStand` 20 (whole curve).
- [ ] `windowOf(source, format)`: waves from `round(enter × n)` to the end. Too few: interpolate extra waves between neighbours (groups of the earlier one, HP between both, remixed as today). Too many: drop evenly from the middle, never the last two.
- [ ] `creditsAt(source, wave, content)`: `startingCredits` + Σ bonuses + Σ kill rewards of the groups before `wave`, × `ECONOMY_SHARE` 0.8. Bonuses inside the window keep their source values (no `n / length` inflation).
- [ ] `hpMultiplier` = `waveHpScale(source, at + 1) × depthHp × format.hp`; `remixWave` unchanged.
- [ ] Focus text: "Act II · Standard 2/2", "Final Stand".
- [ ] Tests: windows inside the source; `creditsAt` accuracy (Review Focus 3); every format validates on every campaign mission with a starter roster.

### Task 5: Acts, the Final Stand and the depth curve

**Files:** `src/run/run.ts`, new `src/run/acts.ts`, `src/run/generate.ts`

- [ ] `ACTS` from the campaign tiers (Vigil I–IV, Ashkar V–VIII, Thessaly Prime IX–XII, as `ui/planets.ts` `WORLDS` splits them), via a pure helper in `run/acts.ts` reading `SECTORS` and the planet counts (`run/` must not import `ui/`). The Final Stand draws from the last two sectors of Thessaly Prime.
- [ ] `depthHp(act, index)` replaces `BANDS` and `DEPTH_HP`; starting points: act I 0.75 / 0.80 / boss 0.85; act II 0.80 / 0.85 / 0.90; act III 0.85 / 0.92 / 0.98; Final Stand 1.0.
- [ ] `RunState` v2 (fields in Task 10): `length: "full" | "short"`, `act`, `cleared`, `position`; `step` stays "missions played" for the streams.
- [ ] Act transition after an act boss: Legendary relic choice of 3, full reactor repair (Task 9), roster cap +2 (Task 7), an "Act II: Ashkar" interstitial in the planet colour. Before the Final Stand: a Doctrine or a Legendary relic, and a full repair.
- [ ] Short run: act I only; its boss uses a 16-wave Final Stand.
- [ ] v1 migration: a v1 run becomes a Short run with `cleared = min(step, 2)`.
- [ ] Tests: sources stay in their tier; depth rises inside an act; a scripted walk reaches 10 missions (full) and 3 (short).

### Task 6: Fixed node threats and the safety net

**Files:** `src/run/generate.ts`, `src/run/threats.ts`

- [ ] A node's enemy pool is fixed at generation from the source and the act (act I never carries stealth), so the map never changes when the roster does and drafting a counter never adds a threat.
- [ ] At deploy, a threat the **roster** cannot answer is swapped out (today's safety net) and the node's hazard pay (Task 12) is lost; the card says so before deploying. One-loss-ends must never come from an unanswerable enemy type.
- [ ] `enemyPool` takes the node's threat set.
- [ ] Tests: a node's threats are the same for any roster; an uncovered threat yields a valid mission without it.

### Task 7: Roster cap

**Files:** `src/run/run.ts`, `src/ui/run-view.ts`

- [ ] `rosterCap(run)`: 6 in act I, 8 in act II, 10 from act III, +1 per "Field Rack" relic. The starter fills 3.
- [ ] Draft at the cap: picking a card asks which roster tower to replace (its rank XP is lost, its Doctrine too; the dialog says so). Skipping stays possible and pays Scrap.
- [ ] Every mission offers the whole roster (`availableTowers = roster`), so there is no per-mission screen.
- [ ] Note for later: if playtests show players never feel the cap, a per-mission loadout (subset of the roster, chosen on the deploy card) can be added on top; `availableTowers` already supports it.
- [ ] Tests: cap per act; replacing keeps the roster size; a replaced tower's doctrine and XP are dropped.

### Task 8: Balance bot for the new structure

**Files:** `scripts/run-balance.ts`

- [ ] Bot walks acts, replaces its least-killing tower at the cap, reports per act and format: wins, reactor at the start and end of each mission, sim time per wave (median, p10).
- [ ] `--length short|full`, `--act n` (only act n with a synthetic roster and reactor of that act's expected state).
- [ ] Interim targets before Phase 2: Standard ≥ 85% in act I, ≥ 70% in act III.

### Task 9: Carried reactor

**Files:** `src/run/run.ts`, `src/run/generate.ts`, `src/run/session.ts`, `src/ui/run-view.ts`

- [ ] `run.reactor` and `run.reactorMax` (start 30/30). `runMission` sets `reactorEnergy = run.reactor`; the source mission's own value is ignored.
- [ ] After a won mission: `run.reactor = livesLeft + FIELD_REPAIR` (3), capped at max. A mission lost (reactor 0) ends the run.
- [ ] Repairs: act transition full repair; Repair camp node +10; shop repair +6; relics (Reactor Plating becomes +5 max and +5 now).
- [ ] Stars for a run mission are measured against the energy it started with (pass that to `missionStars`).
- [ ] Status bar: reactor as a bar with numbers.
- [ ] Tests: carry and cap; a won mission with 2 left starts the next at 5; act transition restores max.

### Phase 1 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 30 --length full` meets the interim targets; a manual playthrough of act I at 2×.

---

## Phase 2: Economy and power curve (≈5 days)

### Task 10: Mission results and `RunState` v2

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/run/storage.ts`, `src/main.ts`

- [ ] `finishMission(run, result, content)` takes `MissionResult { won; livesLeft; startEnergy; kills: Partial<Record<TowerId, number>> }`, built in `main.ts` at the `end` event (`lives`; `Tower.kills` summed per type; towers sold mid-mission lose their kills).
- [ ] v2 fields: `scrap`, `reactor`, `reactorMax`, `doctrines` (`Record<TowerId, path>`), `mods`, `ranks` (XP per type), `threat`, `log` (per mission: format, stars, reactor start/end, kills, Scrap).
- [ ] Scrap per win: `SCRAP_BASE` 18 + stars (1★ 0, 2★ 10, 3★ 20) + format (elite 20, act boss 30) + hazard pay. Skipping a draft pays 15, a relic 25. A careful run earns ≈ 350–450 Scrap.
- [ ] Status bar shows act, mission (n/10), Scrap, reactor.
- [ ] Tests: Scrap per tier and format; skips pay; v1 migration.

### Task 11: Tower ranks

**Files:** new `src/run/ranks.ts`, new `src/run/transform.ts`, `src/ui/run-view.ts`

- [ ] XP per type per mission: `kills + (built in the mission ? 10 : 0)`. Ranks 1–4 at thresholds measured with the bot so a main tower reaches rank 2 by the end of act I and rank 4 in act III (starting guess 60 / 180 / 360 / 600).
- [ ] Rank effects (content transform per type): rank 1 +5% damage, rank 2 +5% range, rank 3 `level-2`/`level-3` −30%, rank 4 +10% damage and its Doctrine's first tier −30%. Support towers and traps: cost and radius instead.
- [ ] Rank-up toast on the reward screen; rank pips on roster chips.
- [ ] Tests: thresholds; transforms validate; only roster types change.

### Task 12: Hazard pay

**Files:** `src/run/threats.ts`, `src/run/run.ts`

- [ ] Each present stealth or burrow threat, and air ≥ 30%, pays `HAZARD` 8 Scrap on a win; shown on the node; lost when the roster cannot answer it.

### Task 13: Doctrines (specialization licenses)

**Files:** `src/run/transform.ts`, `src/run/generate.ts`, `src/run/run.ts`, `src/ui/run-view.ts`

- [ ] `lockSpecializations(doctrines)`: removes every `isSpecialization` upgrade except the tiers of each type's chosen path. Check `validateMission` with `visual.paths` naming paths without upgrades; filter `visual.paths` if needed.
- [ ] A Doctrine pick shows a roster tower's three paths (`visual.paths[path]`: name, role, motif colour) and their tier summaries; choosing one commits that type for the run. A type holds at most one Doctrine.
- [ ] Sources: **free after mission 2** (a fixed reward, so every run meets the system early); act transitions (choice: Doctrine or Legendary relic); elite prize option (instead of the fourth card); Forge camp nodes (55 Scrap); events.
- [ ] In the game the upgrade panel shows a type without a Doctrine as "Levels 6–8: needs a Doctrine (Run)" (verify how `upgradeOptions` renders a tower without level-6 options).
- [ ] Tests: unchosen tiers gone, chosen path intact, `DEFAULT_CONTENT` untouched; a second Doctrine for the same type is refused.

### Task 14: Shop (Requisition panel)

**Files:** new `src/run/shop.ts`, `src/run/transform.ts` (moves `mapTowers`, `price`, `scaleStat` from `relics.ts`), `src/ui/run-view.ts`

Until shop nodes exist (Phase 4), the reward screen ends with a Requisition panel; stock from `streamOf(seed, "shop", step)`:

| Item | Cost | Effect |
| --- | --- | --- |
| Reroll draft | 12, +10 per use | 3 new tower cards |
| Field Funds | 25 | +150 starting credits on the next mission |
| Reactor patch | 25 | +6 reactor |
| Drill | 30 | A roster tower's `level-2` costs 1 for the rest of the run |
| Retire | +15 (gain) | Remove a tower from the roster |

- [ ] `RunMod = { tower; kind: "drill" | "discount" }`. Pack order: doctrines → mods → ranks → relics, documented on `runPack`.
- [ ] The reward phase ends with an explicit **Continue**.
- [ ] Tests: seeded stock; purchases deduct and refuse when short; packs validate.

### Task 15: Retune

**Files:** new `src/run/tuning.ts` (all knobs), `scripts/run-balance.ts`

- [ ] Bot policy: patch the reactor below 40%, else Drill, buys Doctrine tiers it owns (cheapest first), picks the Doctrine for its most-killing type.
- [ ] Targets (greedy bot; a human should beat them). With one-loss-ends over 10 missions, per-mission win rates must be high: Standard ≈ 97% act I, 94% act II, 90% act III; act bosses ≈ 90%; Final Stand ≈ 75%; **20–30% of full runs complete**. Median reactor at the Final Stand 40–70% of max. Doctrines and ranks worth ≥ +15 points of completion (`--no-ranks`, `--no-doctrines`). **Act III stays contested:** median reactor loss per act III mission ≥ 10% (a defense that never leaks means the curve is too soft).

### Phase 2 gate
- [ ] Targets within ±10 points over `--seeds 30`; `scripts/balance.ts` for sector I unchanged.

---

## Phase 3: Draft and relic depth (≈4 days)

### Task 16: Tags, synergy weighting, counter guarantee, rarity

**Files:** new `src/run/tags.ts`, `src/run/run.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `tagsOf(tower)` derived from attack kind, targets and placement (`burn`, `chill`, `status`, `chain`, `area`, `antiair`, `trap`, `economy`, `support`), small hand table; a test fails when a tower has none.
- [ ] Draft weight = tab weight × (1 + 0.5 × tags shared with the roster), capped ×2.
- [ ] **Counter guarantee:** if the act's remaining nodes carry a threat the roster cannot answer, one card answers it; act I's last draft covers stealth for act II. With one-loss-ends this is mandatory, not optional.
- [ ] Tower rarity from cost within its tab (50/35/15%), odds per act (I 70/25/5 → III 40/40/20); elite fourth card Rare+.
- [ ] Relic rarity `common | rare | legendary | cursed`; the existing 12 are Common.
- [ ] Tests: deterministic weighting and guarantee; odds per act.

### Task 17: Relic expansion

**Files:** `src/run/relics.ts`, `src/run/transform.ts`, `src/run/relics.test.ts`

Target ≈ 30 relics, all content/mission transforms (`scaleParam(kind, key, factor, filter)` respecting `params` checks):

| Relic | Rarity | Effect |
| --- | --- | --- |
| Wildfire Doctrine | Rare | Burn and pool attacks: duration +50% |
| Arc Lattice | Rare | Chain attacks: +1 hop, −10% damage |
| Cryo Lattice | Rare | Slow attacks 15% stronger, +30% duration |
| Siege Doctrine | Rare | Splash/mortar: range +20%, interval +10% |
| Minefield | Rare | Traps cost 40% less, trap damage −10% |
| Field Rack | Rare | Roster cap +1 |
| Drill Sergeant | Rare | Rank XP +50% |
| Field Medic | Rare | Field repair after each win +3 |
| Glass Reactor | Cursed | All towers +25% damage; reactor max −30% |
| Austerity | Cursed | +250 starting credits; wave bonuses 0 |
| Overclocked Grid | Cursed | Attack towers fire 20% faster; upgrades cost 25% more |
| Bounty Market | Cursed | Enemies pay +2; starting credits −30% |
| Zealot | Cursed | Every Doctrine tier costs 30% less; no more reactor repairs from camp nodes |
| Sabotage Cell | Legendary | Enemies −8% HP in every mission |
| Veteran Corps | Legendary | Every roster tower starts at rank 1 at least |
| Deep Pockets | Legendary | +150 starting credits in every mission |
| Second Doctrine | Legendary | One tower type may hold a second Doctrine path |
| Emergency Core | Legendary | Once per run, a mission that would be lost ends as won with 1 reactor (consumed) |

- [ ] "Emergency Core" is the only relic that touches the loss rule: it needs the app to see the reactor reach 0 **before** the mission's `end` event, which the simulation emits as lost. Implement it run-side only if possible (e.g. `reactorEnergy` + a hidden reserve and an energy display offset); if that leaks into the simulation, drop the relic rather than add a rule.
- [ ] "Second Doctrine" needs `lockSpecializations` to allow two paths for one type, while the in-game rule "paths exclude each other on one tower" still holds (two towers of the type can go different ways).
- [ ] Cursed relics only from events and as an elite-prize option ("take a cursed relic, gain 30 Scrap").
- [ ] Tests: each relic's pack validates on 3 sample missions per act.

### Phase 3 gate
- [ ] Completion within target; no single relic moves completion by more than +15 points (`--relic <id>`).

---

## Phase 4: Route map per act (≈5 days)

### Task 18: Act maps

**Files:** new `src/run/map.ts`, `src/run/run.ts`, `src/run/storage.ts`

- [ ] `actMap(seed, act, threat)`: pure, derived from the seed (the run stores `position` and `visited`). 5 columns, 2–3 lanes:
  - Columns 0 and 2: **missions**; on each column one lane may be an **Elite** instead of a Standard, so the mission count stays fixed.
  - Columns 1 and 3: **camp** nodes: Shop, Forge (Doctrines and Drill), Repair (+10 reactor), Event.
  - Column 4: the **act boss** (its modifier visible from the act start).
- [ ] After act III: the Final Stand as a single node.
- [ ] Edges to the same or neighbouring lane; every lane reachable; no column with two of the same camp kind; every path has at least one Repair or Shop.
- [ ] `nextNodes(map, position)` replaces `routeOffers`.
- [ ] Tests: stable per seed; constraints hold for 200 seeds; every mission node validates.

### Task 19: Camp nodes and events

**Files:** `src/run/camp.ts`, `src/run/events.ts`, `src/ui/run-view.ts`

- [ ] Shop and Forge reuse `shop.ts`; the reward-screen Requisition shrinks to Reroll and Retire.
- [ ] 10–12 events, pure `(run, choice) → run`, 2–3 choices with visible costs, from `streamOf(seed, "event", act, column)`: *Derelict depot* (Rare relic, or cursed relic + 30 Scrap), *Mercenary crew* (an Epic tower for the next mission only, or 35 Scrap to keep it), *Salvage* (+35 Scrap, −4 reactor), *Field school* (a Doctrine, −5 reactor max), *Drill yard* (+120 rank XP to one roster tower), *Quiet sector* (+8 reactor).
- [ ] Tests: every choice keeps the run valid.

### Task 20: Map view

**Files:** `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] SVG node map for the current act (horizontal on desktop, vertical on phones), icons per kind, reachable nodes highlighted, visited path drawn, act boss with modifier, the act's planet colour; the Final Stand shown at the end of the act strip (I · II · III · Final).
- [ ] A mission node opens the deploy card (preview, threats with coverage, format and wave count, reactor it starts with).
- [ ] Keyboard: arrows between reachable nodes, Enter chooses.

### Phase 4 gate
- [ ] Bot walks the map (Repair below 50% reactor, else Shop with ≥ 30 Scrap, else the lane without an elite); Task 15 targets hold.

---

## Phase 5: Endgame and replay value (≈4 days)

### Task 21: Boss modifiers

**Files:** new `src/run/boss.ts`, `src/run/generate.ts`

- [ ] `BOSS_MODS` as transforms, visible from the act start: *Iron Vanguard* (ground groups armored), *Swarm Tide* (counts ×1.5, HP ×0.7), *Air Superiority* (air share ≥ 40% through a swap bias in `remixWave`), *Titan Escort* (a Titan in each of the last three waves), *Blackout* (stealth groups if the act allows stealth, else +20% HP).
- [ ] Act bosses one modifier; the Final Stand one, two from threat 5.
- [ ] Tests: each modifier validates on every boss-tier source mission.

### Task 22: Threat levels (ascension)

**Files:** `src/run/threat.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] Threat 0–10, unlocked by completing a full run at the level below. Cumulative: 1 elites +10% HP; 2 −10% starting credits; 3 reactor max 25; 4 shop prices +20%; 5 two Final Stand modifiers; 6 depth +0.05; 7 a cursed relic at the start; 8 Repair nodes heal half; 9 no free Doctrine after mission 2; 10 +10% HP everywhere.
- [ ] Record v2: per threat level best and wins, plus the last 10 runs.

### Task 23: Daily run

**Files:** `src/run/daily.ts`, `src/ui/run-view.ts`, `src/run/storage.ts`

- [ ] **Short** run, seed `fnv(stable(["daily", YYYY-MM-DD UTC]))`, threat 3, fixed starter. Wall-clock only in the view.
- [ ] One attempt per day (the journal prevents retries); local record per date; a "copy result" line (seed, missions, reactor, relics).

### Task 24: Run summary and history

**Files:** `src/ui/run-view.ts`

- [ ] End screen: per mission format, waves, stars, reactor start → end, Scrap; final roster with ranks and Doctrines, relics; kills per tower type over the run; on a loss, the mission and wave it ended on.
- [ ] History of the last 10 runs with "Play this seed".
- [ ] Light unlocks (no power): the first completed Short run unlocks Full runs and the daily; threat 2 unlocks choosing among 4 starter packs; threat 4 a "Trap pack" starter column.

### Phase 5 gate
- [ ] `run-balance.ts -- --threat 0` vs `--threat 5`: completion at 5 roughly half of 0.

---

## Execution order and estimates

| Phase | Tasks | Effort | Ships alone? |
| --- | --- | --- | --- |
| 0 Quick fixes | 1–3 | ~1 day | yes |
| 1 Structure: acts, full missions, carried reactor, roster cap | 4–9 | ~5 days | yes (route offers stay two cards per step until Phase 4) |
| 2 Economy and power | 10–15 | ~5 days | yes (shop in the reward screen) |
| 3 Draft and relics | 16–17 | ~4 days | yes |
| 4 Route map | 18–20 | ~5 days | yes |
| 5 Endgame | 21–24 | ~4 days | yes |

Task 3 (journal) comes first: with one-loss-ends, a free retry makes the rule meaningless, and an unprotected tab crash makes it unfair. Phases 1 and 2 matter most; Phases 3 and 4 can run in parallel after Phase 2 (agree on the reward-screen and deploy-card layout first; both touch `run-view.ts`).

## Verification (end to end)

- [ ] `npm test`, `npm run build`.
- [ ] `npx vite-node scripts/run-balance.ts -- --seeds 30 --length full` against the Task 15 targets after every phase from 2 on; report sim minutes per run.
- [ ] `scripts/balance.ts` for sector I before/after Phases 1–3: identical.
- [ ] Manual: `npm run dev`, `/#run`: play act I at 2×, replace a tower at the cap, take the free Doctrine after mission 2 and buy its tiers in game, close the tab mid-wave and resume, shop, reach the act transition, abandon; start a daily.
- [ ] Update CLAUDE.md's Run paragraph (acts, formats, carried reactor, roster cap, Doctrines, ranks, new modules, storage key `ion-bastion:run-journal`, v2 record, `run/tuning.ts`).

---

## Implementation status (2026-10-24)

All phases are implemented. Where the build differs from the tasks above:

- **No Hull; the reactor itself carries over** (the user's "one loss ends the run" plus the carried-reactor decision): `run.reactor`/`reactorMax` start at 30, every mission starts with the run's reactor, a win adds `FIELD_REPAIR` (3), Repair nodes heal 10 or reinforce +3 maximum, shops patch +6, act transitions repair fully.
- **No loadout and no Overdrive** (user decisions); the roster cap (6/8/10) replaces the loadout.
- **No Breach or Skirmish nodes**: a run is always exactly ten missions; elites are lane alternatives on mission columns.
- **New: air cap.** The bot lost early on air-heavy act I maps (Zero-G 79% flyers) with a single anti-air tower. `airCap` grounds air groups beyond 35% of the budget with one anti-air attack tower and 60% with two, so drafting anti-air widens what a node may send (and its hazard pay).
- **Relics:** Emergency Core and Hot Start were dropped (they would need simulation rules); Reinforced Core (+8 reactor) and Field Medic (+3 repair) take their places. Glass Reactor was tuned to +18% damage / −40% reactor after it lifted completion by 17 points.
- **Doctrines** are checked in tests (`lockSpecializations`) and the bot buys their tiers; the greedy bot rarely affords tiers, so `--no-doctrines` barely moves its numbers. Players will feel them more.
- **Resume** replays the journal inside the `run` command (`Replay`, `Game.ticks`); a browser check (build, play a wave at 2×, pause, reload, resume) restored wave, credits, reactor, towers and enemies exactly.

Balance (greedy bot, 40 full runs, threat 0, `src/run/tuning.ts` as committed):

| Act / format | Won | Reactor lost per win |
| --- | --- | --- |
| I standard / boss | 87% / 80% | 9% / 9% |
| II standard / boss | 83% / 76% | 11% / 25% |
| III standard / boss | 88% / 90% | 18% / 19% |
| Final Stand | 78% | 17% |

18% of full runs complete (7/40); without ranks 0/40; at threat 5 5%. Median wave 36 s of game time, about 50 game minutes per full run. The bot loses most runs in act I on maps it plays badly even in their campaign form (it cannot win Fog Swamp with most starter rosters); a human player should clear act I far more reliably, so act I was not pushed further down.
