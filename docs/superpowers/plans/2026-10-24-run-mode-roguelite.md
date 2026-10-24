# Run Mode: Roguelite Depth Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase by phase; every phase ends with a balance gate (`scripts/run-balance.ts`) and must leave the game shippable.

**Goal:** Turn the Run mode (`src/run/`, `/#run`) from "five generated missions in a row" into a roguelite with **enough full-length missions for decisions to compound** (9 required missions of 14–20 waves in three acts), a real power curve, carried resources, per-mission loadouts, meaningful drafts and relics, a plannable route and reasons to play again. Strong play is rewarded with speed: waves can be called early.

**Architecture:** Unchanged at its core. Everything new stays in pure `src/run/` modules (state transitions, generators, transforms) driven by the run seed, and reaches the game only as data: a `MissionDefinition` plus a `ContentPack` built by `runMission`. The simulation never learns about runs (CLAUDE.md). Two app/sim additions: a mission journal for resuming (Task 3) and an optional, generic "call waves early" mission rule (Task 9), `undefined` in the campaign.

**Tech Stack:** TypeScript strict ESM, Vitest, plain DOM in `ui/run-view.ts`, `scripts/run-balance.ts` for tuning.

## Context: findings of the review

Bot baseline (`npx vite-node scripts/run-balance.ts -- --seeds 30`): mission 1 won 20/30, mission 2 9/20, mission 3 4/9, mission 4 0/4, mission 5 never reached. Causes, in order of weight:

1. **Too few missions for choices to matter.** Five missions give four drafts and about two relics; a pick cannot pay off before the run ends, and one bad map ends everything.
2. **No power curve.** Every mission starts on its source mission's credits; a drafted tower adds an option, not power; relics are small flat percentages; levels 6–8 are open from mission 1. Difficulty rises twice meanwhile (`BANDS`, `DEPTH_HP` 0.65 → 0.85).
3. **Nothing carries over.** The reactor resets per mission; a 3★ win and a 1-energy win lead to the same next step.
4. **Elites are a pure penalty on steps 1 and 3:** `paysRelic` already pays a relic on odd steps.
5. **Drafting a Detector makes runs harder:** `enemyPool` filters stealth out until the roster has one.
6. **The draft is a non-decision:** 1 of 3 by tab weight, no synergy, no rarity, no reroll, skipping is worthless, a bigger roster is never worse.
7. **Relics are stat sticks:** 12 flat buffs, no rule changes, no trade-offs, no tiers.
8. **The route is flat:** two nodes, one step of foresight, no non-combat nodes.
9. **Free retries:** reloading during a run mission leaves the run in phase `mission`, and Deploy restarts it from wave 1.
10. **No endgame or meta:** the boss node is a longer mission with Titans; the record is best/wins/runs only.

## Mission length and run length

### Missions stay full length

A tower defense mission needs room to grow a defense from a few towers into a machine: openings, a mid-game economy decision, a late-game test. Six waves cut that arc off. Run missions therefore keep campaign length:

| Format | Waves | Notes |
| --- | --- | --- |
| Standard | 14 | "Hot drop": enters the source mission at about wave 3 with the credits a player would have there (Task 4), so no trivial opening waves |
| Elite | 14 | +15% HP and one modifier; elite prize (Task 1) |
| Breach | 10 | optional camp-column mission: enters the source late (≈ 55% through) with matching credits; all hard waves, double rank XP |
| Act boss | 16 | one boss modifier |
| Final boss | 20 | the whole source curve, two modifiers from threat 5, Titans in the last wave |

The campaign for comparison: 60 missions, 10–20 waves, 16.4 on average.

### What a wave really costs

Measured with the campaign's intended defenses (strategy A of all 60 campaign missions, no specializations):

| Measure | Game time |
| --- | --- |
| Spawn span of a wave (first to last enemy), average | 11.5 s |
| Wave duration, 10th percentile | 18.5 s |
| Wave duration, median | 48 s |
| Wave duration, 90th percentile | 94 s |
| Whole mission, average | 821 s (13.7 min) |

These defenses are tuned to *barely* win (`scripts/balance.ts`), so enemies walk most of the path: the median is an upper bound. A player who outbuilds the wave kills it near the entry, close to the 11.5 s spawn span, and 2× speed halves everything. Real time per wave, including the build pause:

| Player | Speed | Per wave | 14-wave mission | Run (≈ 9 missions, ≈ 135 waves) |
| --- | --- | --- | --- | --- |
| Careful, tight defense | 1× | ≈ 55 s | ≈ 13 min | ≈ 2 h |
| Typical | 2× | ≈ 30 s | ≈ 7 min | ≈ 70 min |
| Strong, overbuilt | 2× | ≈ 12 s | ≈ 3 min | ≈ 30 min |

So run length is mostly driven by how dominant the player is, not by the wave count. Two consequences:

- **Speed must be a reward, not a side effect.** Strong players should be able to call the next wave while the current one is still alive, for bonus credits (Task 9, "Overdrive"), the way Circuit missions already reward early calls. This shortens a dominant player's missions further *and* converts dominance into resources; a careful player is never forced to rush.
- **The difficulty must keep strong players honest.** Ranks, licenses and relics make a run snowball; the depth curve and the boss modifiers (Tasks 5, 22) must keep act III missions contested even for a strong build, otherwise late missions become 20 waves of watching.

### Run structure

- **Full run:** 3 acts × (2 Standard + 1 act boss) = **9 required missions**, plus optional Elite and Breach missions on the map. About 135 waves; 30 min to 2 h depending on player and speed (table above). The run is saved between missions and resumable inside one (Task 3), so it can span sessions.
- **Short run:** act I only (3 missions, its boss as a final boss). About 45 waves, 10–40 min. Used by the daily run and as the first unlock.

What makes the missions *matter* (each is a task below):
- **Loadout** (Task 7): you own a growing roster but bring only a few towers into each mission, chosen against the node's visible threats.
- **Tower ranks** (Task 14): the tower types you actually field gain rank across missions. What you build early compounds.
- **Hull** (Task 12): damage carries over; a sloppy win early costs you later.
- **Acts** (Task 5): three acts with their own campaign tier, boss and relic reward: build an engine in act I, specialise in act II, survive act III.
- **Overdrive** (Task 9): calling waves early turns a strong defense into credits, and every mission becomes a risk-versus-greed decision.

## Decisions to confirm with the user

| Question | Default in this plan | Alternative |
| --- | --- | --- |
| What does a lost mission do? | **Hull:** the run carries 100 Hull; reactor damage wears it down, a lost mission costs a large chunk but the run goes on; Hull 0 ends the run. | Keep "one loss ends the run". |
| Run length | **Full: 3 acts, 9 required missions (14–20 waves) + optional. Short: 1 act, 3 missions.** | 4 acts / 12 missions (2–3 h for typical players). |
| Early wave calls (Overdrive) | **Yes, in run missions**, as a generic optional mission rule. | No; run length then depends only on game speed. |
| Are levels 6–8 gated in a run? | **Yes**, by licenses bought or won during the run. | Leave them open. |
| Loadout size | 5 slots in act I, 6 in act II, 7 in act III (relics can add one). | No loadout limit. |
| Meta progression | **Light:** threat levels (ascension), daily seed, starter-choice unlocks. No permanent power. | Permanent upgrades between runs. |

## Global Constraints

- **Pure and seeded.** Every new offer, map, event, shop stock and node is drawn from `streamOf(seed, "<purpose>", act, column, …)` with its own purpose key, so adding a stream never shifts existing ones. No `Math.random` in `src/run/` (only `randomSeed` in the view, as today).
- **The simulation never learns about runs.** New effects are content or mission transforms. The one new simulation rule (Overdrive, Task 9) is a generic optional `MissionDefinition` field, `undefined` in every campaign and Circuit mission, so solo state, hashes and balance stay unchanged (CLAUDE.md "Solo play is the baseline").
- **Upgrade and tower costs stay positive integers** (validation): "free" costs 1.
- **Storage:** `RunState` goes to `v: 2`. A `v: 1` run in progress is converted into a Short run (Task 5) instead of being dropped. Run record goes to `v: 2`; v1 records still read.
- **English everywhere.**
- **Tests stay lean:** a few focused tests per mechanic in `src/run/*.test.ts`.
- Before finishing any task: `npm test`, `npm run build`; after any change to generator, relics, structure, rewards or difficulty: `scripts/run-balance.ts` (CLAUDE.md). A full-run balance pass plays about 135 waves per seed; keep the default at 30 seeds and add `--act n` for quick iterations.

## Review Focus

1. **Replays stay identical:** the same seed and the same choices give the same map, offers, shop stock, events and missions. → test a full scripted walk twice and compare every offer and generated mission.
2. **Every generated mission validates** with its run pack (relics, licenses, ranks, mods, loadout applied). → extend the existing 40-seed validation test to every format and act.
3. **Hot drops are fair at their start:** a mission that enters its source late must give the credits a player would have had there. → Task 4 test compares the estimate with strategy A's actual wallet at that wave on 5 source missions (within ±20%).
4. **Overdrive changes nothing when unused:** a run mission played without early calls has the same state hash per tick with and without the field; campaign hashes are untouched. → Task 9 tests.
5. **Resume is exact or refuses:** a resumed mission reproduces the stored `stateHash`, or falls back visibly. → Task 3 tests.
6. **Campaign untouched:** `scripts/balance.ts` for one sector before and after Phases 1–3 (identical output).

---

## Phase 0: Quick fixes (≈1 day)

Independent of the new structure; ship first.

### Task 1: Elites always pay extra

**Files:** `src/run/run.ts`, `src/ui/run-view.ts`, `src/run/run.test.ts`

- [ ] Split the reward rule: `paysRelic` stays the regular cadence; add `elitePrize(run)` for elite nodes.
- [ ] Elite reward = the regular reward **plus** a fourth tower card **and** a relic offer from `streamOf(seed, "elite-relics", step)` (never duplicating the regular offer). Once rarity exists (Task 17) it is drawn from Rare and up.
- [ ] Update `KIND_NOTE.elite`.
- [ ] Test: an elite on step 1 yields two relic offers without overlap.

### Task 2: Threat tags on route cards

**Files:** new `src/run/threats.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `threatsOf(mission, content)` from the **generated** waves: `air` (budget share, shown from 15%), `stealth`, `burrow`, `titans`, `fast`, and dominant traits (`armor`, `shield`, `regen`, `split`) above 20% of the budget.
- [ ] Route and deploy cards show chips (icon + word, share in `title`); suppressed threats are struck through ("Stealth: none (no Detector)"). The raw enemy-name list moves into the `title`.
- [ ] Test: stealth is reported suppressed without a Detector and present with one.

### Task 3: Mission journal (close the free-retry loophole)

**Files:** new `src/run/journal.ts` (pure), `src/app/input.ts`, `src/render/scene.ts` (`LocalDriver`), `src/run/storage.ts`, `src/ui/run-view.ts`

The simulation is deterministic, so a run mission is rebuilt from its commands instead of a snapshot. With 14–20-wave missions, resuming inside a mission is essential, not optional.

- [ ] `Journal { missionId, entries: { tick; command }[]; tick; hash? }`; skip view-only commands (`pause`, speed).
- [ ] `LocalDriver.advance` gets an optional `onTick`; `input.ts` wires it to the journal only while `isRunMission(game.mission)` and records every successful command of a run mission.
- [ ] Persist to `ion-bastion:run-journal` at each wave end and every 10 s of wave time, with `stateHash(game.state)`.
- [ ] `replay(journal, mission, content): Game` (pure): apply entries at their ticks, tick to `journal.tick`, check the hash. A 20-wave mission is about 25,000 ticks; measure the replay (target < 1.5 s, else replay in chunks with a progress bar).
- [ ] Run page in phase `mission` with no live game but a journal: **Resume mission (wave n)** replays and opens the game paused. A hash mismatch, or a deployed node without a journal, counts the mission as lost (Task 12 Hull penalty) with the reason shown; mismatches `console.warn`.
- [ ] Deploy marks `node.deployed = true`; a deployed node offers only Resume.
- [ ] Clear the journal in `settleRun` and on a new run.
- [ ] Tests: a scripted 3-wave session replays to the same hash; a tampered entry is detected; `settleRun` clears it.

### Phase 0 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 40`.

---

## Phase 1: Run structure: acts, full missions, loadouts, Overdrive (≈6 days)

### Task 4: Mission formats and hot drops

**Files:** `src/run/generate.ts`, new `src/run/formats.ts`, `src/run/run.test.ts`

Today `runMission` resamples the whole source curve into 12 waves and inflates the bonuses by `n / length`. The new generator plays a **window** of the source mission, entered at the economy a player would have had there.

- [ ] `FORMATS: Record<NodeKind, { waves; enter; hp; mods }>`: `standard` 14 waves entering at ≈ 15% of the source, `elite` 14 (hp × `ELITE_HP`, 1 modifier), `breach` 10 entering at ≈ 55%, `actBoss` 16, `finalBoss` 20 (whole curve).
- [ ] `windowOf(source, format)`: `start = round(enter × n)`, waves `start … n−1`. When the window has fewer waves than the format, interpolate extra waves between neighbours (repeat a wave's groups with the HP between both, remixed as today); when it has more, drop evenly from the middle, never the last two.
- [ ] `creditsAt(source, wave, content)`: `startingCredits` + Σ wave bonuses before `wave` + Σ kill rewards of the groups before `wave`, × `ECONOMY_SHARE` (0.8). The mission's `startingCredits` is `round(creditsAt(...))`; wave bonuses keep their source values.
- [ ] `hpMultiplier` per wave keeps `waveHpScale(source, at + 1) × depthHp × format.hp`.
- [ ] `remixWave` unchanged (budget-preserving swaps).
- [ ] Focus text names the act and format ("Act II · Standard 2/2").
- [ ] Tests: windows stay inside the source; `creditsAt` within ±20% of strategy A's wallet at that wave on 5 missions (Review Focus 3); every format validates on every campaign mission with the starter roster.

### Task 5: Acts and the depth curve

**Files:** `src/run/run.ts`, new `src/run/acts.ts`, `src/run/generate.ts`

- [ ] `ACTS`: three acts from the campaign tiers (Vigil I–IV, Ashkar V–VIII, Thessaly Prime IX–XII, as `ui/planets.ts` `WORLDS` splits them). Move that split into a pure helper the run can import without UI (`run/acts.ts` reading `SECTORS` and the planet counts) so `run/` does not import `ui/`.
- [ ] Replace `BANDS` and `DEPTH_HP` by `depthHp(act, index)`, starting points before tuning: act I 0.75 / 0.80 / boss 0.85, act II 0.80 / 0.85 / 0.90, act III 0.85 / 0.92 / 1.0. Ranks, licenses and relics are the player's answer; act III must stay contested for a strong build (Task 16 targets).
- [ ] `RunState` v2 (fields listed in Task 11): `length: "full" | "short"`, `act`, `cleared`, `position`. `step` stays "missions played" for the streams.
- [ ] Act transition after an act boss: a reward screen (Legendary relic choice of 3, Hull +30, loadout slot +1) and an "Act II: Ashkar" interstitial in the planet's colour.
- [ ] Short run = act I only, its boss uses the final-boss format.
- [ ] v1 migration: a v1 run in progress becomes a Short run with `cleared = min(step, 2)`.
- [ ] Tests: act sources stay in their tier; depth rises inside an act; a scripted walk reaches 9 missions (full) and 3 (short).

### Task 6: Fixed node threats and the safety net

**Files:** `src/run/generate.ts`, `src/run/threats.ts`

A visible map must not lie, and drafting a counter must never add the threat it counters.

- [ ] A node's enemy pool is decided at generation from the source mission and the act: act I never carries stealth; burrow and air come from the source.
- [ ] At deploy, a threat the **loadout** cannot answer is still swapped out (today's safety net), but the node's hazard pay (Task 13) is lost, and the card says so.
- [ ] `enemyPool` takes the node's threat set instead of the roster.
- [ ] Tests: a node's threats are the same for any roster; a loadout without a counter gets a valid mission without that threat.

### Task 7: Loadout

**Files:** `src/run/run.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `loadoutSlots(run)`: 5 in act I, 6 in act II, 7 in act III, +1 per "Field Rack" relic. Full-length missions use more tower types than six-wave ones would, hence one slot more than a short-mission design.
- [ ] Deploy card: roster grid with toggles, slot counter, threat chips with a coverage check ("Air 35%: answered by Pulse, Flak"), warnings for uncovered threats. The last loadout is the default; "Suggest" picks one answer per threat, then highest rank, then synergy.
- [ ] `runMission` uses the loadout for `availableTowers` and for the safety net (Task 6).
- [ ] Stored on the run (`loadout`), validated in `parseRun` (subset of roster, size ≤ slots).
- [ ] Tests: slots per act; oversized loadouts rejected; `availableTowers` equals the loadout.

### Task 8: Balance bot for the new structure

**Files:** `scripts/run-balance.ts`

- [ ] Bot walks acts, picks a loadout by the Suggest rule, reports per act and format: wins, reactor left, sim time per wave (median, p10) and per mission.
- [ ] `--length short|full`, `--act n` (only act n with a synthetic roster of that act's expected size), `--overdrive` (bot calls early once a wave is half dead and its reactor is full).
- [ ] Interim targets before Phase 2: Standard win rate ≥ 75% in act I, ≥ 55% in act III.

### Task 9: Overdrive (call waves early)

**Files:** `src/core/types.ts`, `src/core/game.ts`, `src/systems/waves.ts` (and the overlap logic from `src/systems/circle.ts`), `src/ui/interface.ts`, `src/ui/messages.ts`, `src/core/validation.ts`, tests in `src/systems/`

A generic optional rule, not a run feature: `MissionDefinition.overdrive?: { bonus: number }`. Absent everywhere except run missions.

- [ ] With `overdrive`, the `start` command is also allowed during `"wave"` once the current wave has finished spawning (its queue is empty): the next wave's spawns are queued right away, each `Spawn` carrying its `wave` for the HP scale (the Circuit already does this through `Spawn.wave`). `state.wave` advances; `settleWave` pays a wave's bonus when its last enemy is gone, so overlapping waves settle in order.
- [ ] Early bonus: `bonus × alive enemies' share of the wave's budget` at the call (the more you overlap, the more you earn), paid immediately, emitted as an event for the HUD and a sound cue (or silent on purpose, CLAUDE.md "Sound").
- [ ] Limit: at most two waves alive at once (a third call is refused with a new `MessageCode`, `overdrive-limit`).
- [ ] HUD: the Start button reads "Call next wave +◇n" while the rule allows it; hotkey unchanged.
- [ ] Versus and co-op: validation rejects `overdrive` together with versus like `circle-versus`; run missions are solo anyway.
- [ ] Run generator sets `overdrive: { bonus: OVERDRIVE_BONUS }` (start 1.0 credit per percent of the wave left, tune with the bot).
- [ ] Tests: without the field nothing changes (hash per tick equal, Review Focus 4); a call during a wave queues the next wave with its own HP scale; bonuses settle in order; the limit holds; `stateHash` coverage test still passes.
- [ ] Risk: this touches `settleWave`, the most central rule in the game. If the overlap proves invasive, fall back to the light variant: `start` allowed as soon as the current wave has spawned completely **and** fewer than `x` enemies are alive, which needs no settlement change.

### Phase 1 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 30 --length full` hits the interim targets; with `--overdrive` the bot's sim time per mission drops by at least a third without lowering win rates by more than 5 points; a manual playthrough of act I at 2× with early calls.

---

## Phase 2: Economy and power curve (≈5 days)

### Task 10: Mission results reach the run

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/main.ts`

- [ ] `finishMission(run, result, content)` takes `MissionResult { won; livesLeft; energy; kills: Partial<Record<TowerId, number>>; earlyCalls }`; `main.ts` builds it at the `end` event from `game.state` (`lives`, `Tower.kills` summed per type; towers sold during the mission lose their kills, acceptable).
- [ ] `run.log` keeps one entry per mission (format, stars via `missionStars`, energy left, kills per type, early calls, Scrap earned).

### Task 11: `RunState` v2 fields and Scrap

**Files:** `src/run/run.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] v2 adds `scrap`, `hull`, `licenses` (`<towerId>:<path>`), `mods`, `ranks` (rank XP per type), `loadout`, `threat`, `log`.
- [ ] Scrap per win: `SCRAP_BASE` 18 + stars (1★ 0, 2★ 10, 3★ 20) + format (elite 20, breach 15, act boss 30) + hazard pay. Skipping the draft pays 15, a relic 25. Over 9 missions a careful player earns ≈ 300–400 Scrap; Task 15 prices are set against that.
- [ ] Status bar shows act, mission, Scrap, Hull.
- [ ] Tests: Scrap per star tier and format; skip pays.

### Task 12: Hull (carried damage)

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/ui/run-view.ts`

- [ ] Start 100. After each mission `hull -= round(HULL_WEAR × (1 − livesLeft / energy))`, `HULL_WEAR` 30. A lost mission costs `HULL_LOSS` 45 and gives no reward; the run moves on. Hull ≤ 0 ends the run; winning the final boss wins regardless.
- [ ] Act transitions heal 30, Repair nodes 35.
- [ ] Below 30 Hull the next mission's reactor energy is −20% ("damaged reactor"), behind a constant.
- [ ] Tests: wear formula; a loss at Hull 50 continues, at Hull 45 ends.

### Task 13: Hazard pay

**Files:** `src/run/threats.ts`, `src/run/run.ts`

- [ ] Each present stealth or burrow threat, and air ≥ 30%, pays `HAZARD` 8 Scrap on a win, shown on the node; lost when the loadout cannot answer it.

### Task 14: Tower ranks

**Files:** new `src/run/ranks.ts`, `src/run/transform.ts`, `src/ui/run-view.ts`

- [ ] XP per type per mission: `kills × 1 + (in the loadout and built ? 10 : 0)`. Full-length missions produce many kills, so thresholds sit higher: ranks at 60 / 180 / 360 / 600 XP (rank 1–4). Measure kills per mission with the bot and set thresholds so a main tower reaches rank 2 by the end of act I and rank 4 in act III.
- [ ] Rank effects as a content transform per type: rank 1 +5% damage, rank 2 +5% range, rank 3 `level-2` and `level-3` −30%, rank 4 +10% damage and the first specialization tier of a licensed path −30%. Support towers and traps: cost and radius instead (table in `ranks.ts`).
- [ ] Rank-up toast on the reward screen; rank pips on roster chips and loadout toggles.
- [ ] Tests: thresholds; rank transforms validate; ranks never touch towers outside the roster.

### Task 15: Shops and the Requisition panel

**Files:** new `src/run/shop.ts`, `src/run/transform.ts` (move `mapTowers`, `price`, `scaleStat` here from `relics.ts`), `src/run/generate.ts`, `src/ui/run-view.ts`

Until shop nodes exist (Phase 4) the reward screen gets a Requisition panel, stock from `streamOf(seed, "shop", step)`:

| Item | Cost | Effect |
| --- | --- | --- |
| Reroll draft | 12, +10 per use | 3 new tower cards (`streamOf(seed, "towers", step, rerolls)`) |
| Field Funds | 25 | +150 starting credits on the next mission |
| Repair crew | 25 | +20 Hull |
| Specialization license | 55 | Unlock one path (levels 6–8) of a roster tower |
| Drill | 30 | A roster tower's `level-2` costs 1 for the rest of the run |
| Retire | +15 (gain) | Remove a tower from the roster |

- [ ] `RunMod = { tower; kind: "drill" | "discount" }`. Pack order: licenses → mods → ranks → relics, documented on `runPack`.
- [ ] The reward phase ends with an explicit **Continue**.
- [ ] Tests: stock is seeded; purchases deduct Scrap and refuse when short; packs validate.

### Task 16: Specialization licenses and retune

**Files:** `src/run/transform.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, new `src/run/tuning.ts`, `scripts/run-balance.ts`

- [ ] `lockSpecializations(licenses)` removes every `isSpecialization` upgrade whose `<tower>:<path>` is unlicensed; check `validateMission` with `visual.paths` naming paths without upgrades (filter `visual.paths` if needed). Upgrade panel shows "Locked in this run" past level 5.
- [ ] Sources: shop, Forge nodes, elite prize option, act-transition option, events.
- [ ] All knobs in `run/tuning.ts`.
- [ ] Bot policy: spend Scrap (license for its most-killing type, then Drill, Repair below 50 Hull), buy licensed specialization tiers, keep the loadout by rank, Overdrive as in Task 8.
- [ ] Targets (greedy bot; a human should beat them): Standard ≈ 90% act I, 80% act II, 70% act III; act bosses ≈ 70%; final boss ≈ 55%; **25–35% of full runs complete**; median Hull at the final boss 30–60. Ranks and licenses worth ≥ +15 points of act III win rate (`--no-ranks`, `--no-licenses`). **Act III stays contested:** median reactor left in act III won missions ≤ 80% (a defense that never leaks means the curve is too soft).
- [ ] Tests for licenses: unlicensed tiers gone, licensed intact, `DEFAULT_CONTENT` untouched.

### Phase 2 gate
- [ ] Targets within ±10 points over `--seeds 30`; `scripts/balance.ts` for sector I unchanged.

---

## Phase 3: Draft and relic depth (≈4 days)

With 8 drafts per run plus shop and events, the roster outgrows the loadout, so drafts become about a collection that covers threats and combos.

### Task 17: Tags, synergy weighting, counter guarantee, rarity

**Files:** new `src/run/tags.ts`, `src/run/run.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `tagsOf(tower)` derived from attack kind, targets and placement (`burn`, `chill`, `status`, `chain`, `area`, `antiair`, `trap`, `economy`, `support`), small hand table; a test fails when a tower has none.
- [ ] Draft weight = tab weight × (1 + 0.5 × tags shared with the roster), capped ×2.
- [ ] **Counter guarantee:** if the act's remaining nodes carry a threat the roster cannot answer, one card answers it; act I's last draft covers stealth for act II.
- [ ] Tower rarity from cost within its tab (50/35/15%); odds per act (I 70/25/5 → III 40/40/20). Elite fourth card Rare+.
- [ ] Relic rarity `common | rare | legendary | cursed`; the existing 12 are Common; Legendary only from act transitions, elite prizes and events.
- [ ] Tests: weighting and guarantee deterministic; odds per act.

### Task 18: Relic expansion

**Files:** `src/run/relics.ts`, `src/run/transform.ts`, `src/run/relics.test.ts`

Target ≈ 30 relics, all content/mission transforms (`scaleParam(kind, key, factor, filter)` respecting `params` checks):

| Relic | Rarity | Effect |
| --- | --- | --- |
| Wildfire Doctrine | Rare | Burn and pool attacks: duration +50% |
| Arc Lattice | Rare | Chain attacks: +1 hop, −10% damage |
| Cryo Lattice | Rare | Slow attacks 15% stronger, +30% duration |
| Siege Doctrine | Rare | Splash/mortar: range +20%, interval +10% |
| Minefield | Rare | Traps cost 40% less, trap damage −10% |
| Field Rack | Rare | +1 loadout slot |
| Drill Sergeant | Rare | Rank XP +50% |
| Afterburner | Rare | Overdrive bonus +50% |
| Glass Reactor | Cursed | All towers +25% damage; reactor energy −40% |
| Austerity | Cursed | +250 starting credits; wave bonuses 0 |
| Overclocked Grid | Cursed | Attack towers fire 20% faster; upgrades cost 25% more |
| Bounty Market | Cursed | Enemies pay +2; starting credits −30% |
| Specialist | Cursed | −1 loadout slot; every tower in the loadout counts one rank higher |
| Hot Start | Cursed | Overdrive bonus ×2; the first early call each mission costs 3 reactor energy |
| Sabotage Cell | Legendary | Enemies −8% HP in every mission |
| Veteran Corps | Legendary | Every roster tower starts at rank 1 at least |
| Deep Pockets | Legendary | +150 starting credits in every mission |
| Master License | Legendary | One free license at each act transition |

- [ ] "Hot Start" needs a mission-side cost for an early call; implement only if Task 9 exposes it cleanly (an optional `overdrive.cost`), else drop it.
- [ ] Cursed relics only from events and as an elite-prize option ("take a cursed relic, gain 30 Scrap").
- [ ] Tests: each relic's pack validates on 3 sample missions per act.

### Phase 3 gate
- [ ] `run-balance.ts`: completion within target; no single relic moves completion by more than +15 points (`--relic <id>`).

---

## Phase 4: Route map per act (≈5 days)

### Task 19: Act maps

**Files:** new `src/run/map.ts`, `src/run/run.ts`, `src/run/storage.ts`

- [ ] `actMap(seed, act, threat)`: pure, derived from the seed (the run stores `position` and `visited`). 5 columns, up to 3 lanes:
  - Columns 0 and 2: **Standard** missions from the act's tier (no source twice in a run).
  - Columns 1 and 3: **camp** nodes: Shop, Forge (licenses and Drill at a discount), Repair (+35 Hull), Event, **Elite** (optional 14-wave mission, elite prize) or **Breach** (optional 10-wave late-entry mission, double rank XP).
  - Column 4: the **act boss** (one node, its modifier visible from the act start).
- [ ] Edges to the same or neighbouring lane; every lane reachable; no column with two of the same camp kind; at least one Repair or Shop on every path.
- [ ] `nextNodes(map, position)` replaces `routeOffers`.
- [ ] Tests: stable per seed; constraints hold for 200 seeds; every mission node validates.

### Task 20: Camp nodes and events

**Files:** `src/run/camp.ts`, `src/run/events.ts`, `src/ui/run-view.ts`

- [ ] Shop and Forge reuse `shop.ts`; the reward-screen Requisition shrinks to Reroll and Retire.
- [ ] 10–12 events, each a pure `(run, choice) → run` with 2–3 choices and visible costs, from `streamOf(seed, "event", act, column)`: *Derelict depot* (Rare relic, or cursed relic + 30 Scrap), *Mercenary crew* (an Epic tower for the next mission only, or 35 Scrap to keep it), *Salvage* (+35 Scrap, −12 Hull), *Field school* (a license, −15 Hull), *Drill yard* (+120 rank XP to one roster tower), *Quiet sector* (+20 Hull).
- [ ] Tests: every choice keeps the run valid.

### Task 21: Map view

**Files:** `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] SVG node map for the current act (horizontal on desktop, vertical on phones), icons per kind, reachable nodes highlighted, visited path drawn, act boss with modifier at the end, the act's planet colour. A mission node opens the deploy card (preview, threats, loadout, format and wave count).
- [ ] Act strip (I · II · III) with the next act's tier name.
- [ ] Keyboard: arrows between reachable nodes, Enter chooses.

### Phase 4 gate
- [ ] Bot walks the map (Repair below 50 Hull, else Shop with ≥ 55 Scrap, else the lane with fewer elites); Task 16 targets hold; median optional missions per run 1–2.

---

## Phase 5: Endgame and replay value (≈4 days)

### Task 22: Boss modifiers

**Files:** new `src/run/boss.ts`, `src/run/generate.ts`

- [ ] `BOSS_MODS` as transforms, visible from the act start: *Iron Vanguard* (ground groups armored), *Swarm Tide* (counts ×1.5, HP ×0.7), *Air Superiority* (air share ≥ 40% through a swap bias in `remixWave`), *Titan Escort* (a Titan in each of the last three waves), *Blackout* (stealth groups if the act allows stealth, else +20% HP), *Relentless* (Overdrive off; the wave break shortened, through the mission's existing fields only).
- [ ] Act bosses one modifier, the final boss two from threat 5.
- [ ] Tests: each modifier validates on every boss-tier source mission.

### Task 23: Threat levels (ascension)

**Files:** `src/run/threat.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] Threat 0–10, unlocked by completing a full run at the level below. Cumulative: 1 elites +10% HP; 2 −10% starting credits; 3 Hull starts at 80; 4 shop prices +20%; 5 two final-boss modifiers; 6 depth +0.05; 7 a cursed relic at the start; 8 Repair heals half; 9 one loadout slot fewer in act I; 10 +10% HP everywhere.
- [ ] Record v2: per threat level best and wins, plus the last 10 runs.

### Task 24: Daily run

**Files:** `src/run/daily.ts`, `src/ui/run-view.ts`, `src/run/storage.ts`

- [ ] **Short** run (act I, 3 full missions), seed `fnv(stable(["daily", YYYY-MM-DD UTC]))`, threat 3, fixed starter. Wall-clock only in the view.
- [ ] One attempt per day (the journal prevents retries); local record per date; a "copy result" line (seed, missions, Hull, early calls).

### Task 25: Run summary and history

**Files:** `src/ui/run-view.ts`

- [ ] End screen: per mission format, waves, stars, energy left, early calls, Scrap; final roster with ranks, licenses, relics; kills per tower type over the run.
- [ ] History of the last 10 runs with "Play this seed".
- [ ] Light unlocks (no power): the first completed Short run unlocks Full runs and the daily; threat 2 unlocks choosing among 4 starter packs; threat 4 a "Trap pack" starter column.

### Phase 5 gate
- [ ] `run-balance.ts -- --threat 0` vs `--threat 5`: completion at 5 roughly half of 0.

---

## Execution order and estimates

| Phase | Tasks | Effort | Ships alone? |
| --- | --- | --- | --- |
| 0 Quick fixes | 1–3 | ~1 day | yes |
| 1 Structure: acts, full missions, loadouts, Overdrive | 4–9 | ~6 days | yes (route offers stay two cards per column until Phase 4) |
| 2 Economy and power | 10–16 | ~5 days | yes (shop in the reward screen) |
| 3 Draft and relics | 17–18 | ~4 days | yes |
| 4 Route map | 19–21 | ~5 days | yes |
| 5 Endgame | 22–25 | ~4 days | yes |

Phases 1 and 2 matter most: more missions without carried power would just be a long flat run. Task 9 (Overdrive) is the only simulation change and the highest-risk task; it can ship after the rest of Phase 1 if needed (run length is then governed by game speed alone). Phases 3 and 4 can run in parallel after Phase 2 (agree on the reward-screen and deploy-card layout first; both touch `run-view.ts`).

## Verification (end to end)

- [ ] `npm test`, `npm run build`.
- [ ] `npx vite-node scripts/run-balance.ts -- --seeds 30 --length full` against the Task 16 targets after every phase from 2 on; report sim minutes per run with and without `--overdrive`.
- [ ] `scripts/balance.ts` for sector I before/after Phases 1–3: identical.
- [ ] Manual: `npm run dev`, `/#run`: play act I of a seed at 2× with early calls, change the loadout against a threat, reload mid-wave and resume, buy in a shop, reach the act transition, abandon; start a daily.
- [ ] Update CLAUDE.md's Run paragraph (acts, formats, loadout, ranks, Overdrive, new modules, storage key `ion-bastion:run-journal`, v2 record, `run/tuning.ts`).
