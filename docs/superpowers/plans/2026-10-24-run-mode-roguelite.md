# Run Mode: Roguelite Depth Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking. Execute phase by phase; every phase ends with a balance gate (`scripts/run-balance.ts`) and must leave the game shippable.

**Goal:** Turn the Run mode (`src/run/`, `/#run`) from "five generated missions in a row" into a roguelite with **enough missions for decisions to compound** (about 12 per run in three acts), a real power curve, carried resources, per-mission loadouts, meaningful drafts and relics, a plannable route and reasons to play again.

**Architecture:** Unchanged at its core. Everything new stays in pure `src/run/` modules (state transitions, generators, transforms) driven by the run seed, and reaches the game only as data: a `MissionDefinition` plus a `ContentPack` built by `runMission`. The simulation never learns about runs (CLAUDE.md). The one new app-side piece is a mission journal for resuming (Task 3).

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

## Why more missions need shorter missions

Measured with the current generator (no towers, every enemy walks the whole path): a 12-wave run mission takes 430–700 s of wave time, about 50 s per wave, plus build time. Today's run is about 62 waves (≈ 50–60 min at 1×).

The new run keeps roughly that length but splits it into more, shorter missions:

| Format | Waves | Where | Count per full run |
| --- | --- | --- | --- |
| Skirmish | 4 | camp-column alternative, early acts | 0–3 |
| Standard | 6 | the normal mission | 6 |
| Elite | 6, +HP, elite prize | optional, camp columns | 0–3 |
| Act boss | 8, one boss modifier | end of acts I and II | 2 |
| Final boss | 10, one or two modifiers, Titans | end of act III | 1 |

A full run: 3 acts × (3 Standard + 1 boss) = **12 required missions, about 74 waves** (≈ 60–65 min at 1×, ≈ 35 min at 2×), plus optional elites and skirmishes. The run is saved between missions and resumable inside one (Task 3), so it can span sessions. A **Short run** (one act, 4 missions, about 25 waves) serves the daily and quick sessions.

What makes the extra missions *matter* (each is a task below):
- **Loadout** (Task 7): you own a growing roster but bring only a few towers into each mission, chosen against the node's visible threats. Twelve loadout choices per run.
- **Tower ranks** (Task 13): the tower types you actually field gain rank across missions. What you build early compounds.
- **Hull** (Task 11): damage carries over twelve missions; a sloppy win early costs you later.
- **Acts** (Task 5): three acts with their own campaign tier, boss and relic reward give the run a shape: build an engine in act I, specialise in act II, survive act III.

## Decisions to confirm with the user

| Question | Default in this plan | Alternative |
| --- | --- | --- |
| What does a lost mission do? | **Hull:** the run carries 100 Hull; reactor damage wears it down, a lost mission costs a large chunk but the run goes on; Hull 0 ends the run. | Keep "one loss ends the run" (very harsh over 12 missions). |
| Run length | **Full: 3 acts, 12 required missions (+ optional). Short: 1 act, 4 missions.** | 2 acts / 8 missions. |
| Mission length | Standard 6 waves, boss 8 / 10. | Standard 8 waves (run ≈ 90 min). |
| Are levels 6–8 gated in a run? | **Yes**, by licenses bought or won during the run. | Leave them open. |
| Loadout size | 4 slots in act I, 5 in act II, 6 in act III (relics can add one). | No loadout limit. |
| Meta progression | **Light:** threat levels (ascension), daily seed, starter-choice unlocks. No permanent power. | Permanent upgrades between runs. |

## Global Constraints

- **Pure and seeded.** Every new offer, map, event, shop stock and node is drawn from `streamOf(seed, "<purpose>", act, column, …)` with its own purpose key, so adding a stream never shifts existing ones. No `Math.random` in `src/run/` (only `randomSeed` in the view, as today).
- **The simulation never learns about runs.** New effects are content or mission transforms. If a relic truly needs new behaviour, add an optional content field that stays `undefined` in the campaign (CLAUDE.md "Solo play is the baseline") and show that campaign balance does not move.
- **Upgrade and tower costs stay positive integers** (validation): "free" costs 1.
- **Storage:** `RunState` goes to `v: 2`. A `v: 1` run in progress is converted into a Short run at the matching mission (Task 4) instead of being dropped. Run record goes to `v: 2`; v1 records still read.
- **English everywhere.**
- **Tests stay lean:** a few focused tests per mechanic in `src/run/*.test.ts`.
- Before finishing any task: `npm test`, `npm run build`; after any change to generator, relics, structure, rewards or difficulty: `scripts/run-balance.ts` (CLAUDE.md).

## Review Focus

1. **Replays stay identical:** the same seed and the same choices give the same map, offers, shop stock, events and missions. → test a full scripted walk twice and compare every offer and generated mission.
2. **Every generated mission validates** with its run pack (relics, licenses, ranks, mods, loadout applied). → extend the existing 40-seed validation test to every format and act.
3. **Short missions are fair at their start:** a slice that starts late in its source mission must give the credits a player would have had there. → Task 4 test compares the estimate with a bot's actual wallet at that wave on 5 source missions (within ±20%).
4. **Resume is exact or refuses:** a resumed mission reproduces the stored `stateHash`, or falls back visibly. → Task 3 tests.
5. **Campaign untouched:** `scripts/balance.ts` for one sector before and after Phases 2 and 3 (identical output).

---

## Phase 0: Quick fixes (≈1 day)

Independent of the new structure; ship first.

### Task 1: Elites always pay extra

**Files:** `src/run/run.ts`, `src/ui/run-view.ts`, `src/run/run.test.ts`

- [ ] Split the reward rule: `paysRelic` stays the regular cadence; add `elitePrize(run)` for elite nodes.
- [ ] Elite reward = the regular reward **plus** a fourth tower card **and** a relic offer from `streamOf(seed, "elite-relics", step)` (never duplicating the regular offer). Once rarity exists (Task 16) it is drawn from Rare and up.
- [ ] Update `KIND_NOTE.elite`.
- [ ] Test: an elite on step 1 yields two relic offers without overlap.

### Task 2: Threat tags on route cards

**Files:** new `src/run/threats.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `threatsOf(mission, content)` from the **generated** waves: `air` (budget share, shown from 15%), `stealth`, `burrow`, `titans`, `fast`, and dominant traits (`armor`, `shield`, `regen`, `split`) above 20% of the budget.
- [ ] Route and deploy cards show chips (icon + word, share in `title`); suppressed threats are struck through ("Stealth: none (no Detector)"). The raw enemy-name list moves into the `title`.
- [ ] Test: stealth is reported suppressed without a Detector and present with one.

### Task 3: Mission journal (close the free-retry loophole)

**Files:** new `src/run/journal.ts` (pure), `src/app/input.ts`, `src/render/scene.ts` (`LocalDriver`), `src/run/storage.ts`, `src/ui/run-view.ts`

The simulation is deterministic, so a run mission is rebuilt from its commands instead of a snapshot. With 12 missions per run, resuming inside a mission matters even more.

- [ ] `Journal { missionId, entries: { tick; command }[]; tick; hash? }`; skip view-only commands (`pause`, speed).
- [ ] `LocalDriver.advance` gets an optional `onTick`; `input.ts` wires it to the journal only while `isRunMission(game.mission)` and records every successful command of a run mission.
- [ ] Persist to `ion-bastion:run-journal` at each wave end and every 10 s of wave time, with `stateHash(game.state)`.
- [ ] `replay(journal, mission, content): Game` (pure): apply entries at their ticks, tick to `journal.tick`, check the hash.
- [ ] Run page in phase `mission` with no live game but a journal: **Resume mission (wave n)** replays (show a spinner) and opens the game paused. A hash mismatch, or a deployed node without a journal, counts the mission as lost (Task 11 Hull penalty) with the reason shown; mismatches `console.warn`.
- [ ] Deploy marks `node.deployed = true`; a deployed node offers only Resume.
- [ ] Clear the journal in `settleRun` and on a new run.
- [ ] Tests: a scripted 3-wave session replays to the same hash; a tampered entry is detected; `settleRun` clears it.

### Phase 0 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 40`.

---

## Phase 1: Run structure: acts, short missions, loadouts (≈5 days)

The foundation for everything after it: more, shorter missions in three acts.

### Task 4: Mission formats and wave slices

**Files:** `src/run/generate.ts`, new `src/run/formats.ts`, `src/run/run.test.ts`

Today `runMission` resamples the **whole** source curve into 12 waves. Short missions instead play a **slice** of the source mission, entered at the economy a player would have had there.

- [ ] `FORMATS: Record<NodeKind, { waves: number; hp: number; mods: number }>`: `skirmish` 4, `standard` 6, `elite` 6 (hp × `ELITE_HP`), `actBoss` 8 (1 modifier), `finalBoss` 10 (1–2 modifiers, Titans in the last wave as today).
- [ ] `sliceOf(source, format, depth)`: a window of the source waves. Its **start** moves through the source mission with the run depth inside the act (first mission of an act starts near wave 1, the boss ends on the source's last wave). Stride 1 when the window fits, else every second wave (`at = start + i × stride`).
- [ ] `creditsAt(source, wave, content)`: `startingCredits` + Σ wave bonuses before `wave` + Σ kill rewards of the groups before `wave`, × `ECONOMY_SHARE` (0.8: a player does not spend perfectly and loses some kills). The mission's `startingCredits` becomes `round(creditsAt(...))`; wave bonuses inside the slice stay as in the source (no more inflation by `n / length`).
- [ ] `hpMultiplier` per wave keeps `waveHpScale(source, at + 1) × depthHp × format.hp`, so a late slice is as tough as that point of the campaign mission.
- [ ] `remixWave` is unchanged (budget-preserving swaps).
- [ ] Mission focus text names the format and act ("Act II · Standard 2/3").
- [ ] Tests: slice windows stay inside the source; `creditsAt` matches a bot's wallet at that wave within ±20% on 5 source missions (Review Focus 3); every format validates on every campaign mission with the starter roster.

### Task 5: Acts and the depth curve

**Files:** `src/run/run.ts`, new `src/run/acts.ts`, `src/run/generate.ts`

- [ ] `ACTS`: three acts drawn from the campaign tiers the atlas already shows (`ui/planets.ts` `WORLDS`/`worldsOf`: Vigil I–IV, Ashkar V–VIII, Thessaly Prime IX–XII). Move the split into a pure helper the run can import without UI (`content/` or `run/acts.ts` reading `SECTORS` and the planet counts) so `run/` does not import `ui/`. Each act's sources come from its tier; theme and look change per act for free.
- [ ] Replace `BANDS` and `DEPTH_HP` by `depthHp(act, index)`: a gentle in-act ramp (e.g. act I 0.70 → 0.80, act II 0.75 → 0.85, act III 0.80 → 0.92 before tuning) that resets a little at each act start, because the source tier jumps.
- [ ] `RunState` v2 (all of Phase 1–2 fields, see Task 10): `length: "full" | "short"`, `act`, `column`, `cleared` (missions won), `position`. `step` stays as "missions played" for the streams.
- [ ] Act transition after an act boss: a dedicated reward screen (Legendary relic choice of 3, Hull +30, loadout slot +1) and a short "Act II: Ashkar" interstitial using the planet colour.
- [ ] Short run = act I only, its boss is the final boss format.
- [ ] v1 migration: a v1 run in progress becomes a Short run at act I with `cleared = step`.
- [ ] Tests: act sources stay in their tier; depth is monotonic inside an act; a full scripted walk reaches 12 missions; a short walk 4.

### Task 6: Fixed node threats and the safety net

**Files:** `src/run/generate.ts`, `src/run/threats.ts`

With a visible map (Phase 4) a node's threats must not change when the roster changes, or the map would lie, and drafting a counter must never add the threat it counters.

- [ ] A node's enemy pool is decided at generation from the source mission and the act: act I never carries stealth (starter rosters cannot have a Detector yet); burrow and air come from the source as today.
- [ ] At deploy, a threat the **loadout** cannot answer is still swapped out (the current safety net), but the node's hazard pay (Task 12) is lost and the card says so ("No Detector in loadout: stealth replaced, no hazard pay").
- [ ] Remove the roster-dependent filtering from `enemyPool` (it now takes the node's threat set).
- [ ] Tests: threats of a node are the same for any roster; a loadout without a counter gets a valid mission without that threat.

### Task 7: Loadout

**Files:** `src/run/run.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

The roster is what you own; the loadout is what you bring into this mission. `availableTowers` already restricts a mission, so this is UI plus state.

- [ ] `loadoutSlots(run)`: 4 in act I, 5 in act II, 6 in act III, +1 per "Field Rack" relic. Before the roster outgrows the slots the whole roster is the loadout.
- [ ] Deploy card: roster grid with toggles, slot counter, threat chips with a coverage check per threat ("Air 35%: answered by Pulse, Flak"), and warnings for uncovered threats. The last loadout is the default; "Suggest" picks one by a simple rule (one answer per threat, then highest rank, then synergy).
- [ ] `runMission` uses the loadout for `availableTowers` and for the deploy-time safety net (Task 6).
- [ ] Stored on the run (`loadout: TowerId[]`), validated in `parseRun` (subset of roster, size ≤ slots).
- [ ] Tests: slots per act; a loadout larger than the slots is rejected; the mission's `availableTowers` equals the loadout.

### Task 8: Balance bot for the new structure

**Files:** `scripts/run-balance.ts`

- [ ] Bot walks acts, picks a loadout by the "Suggest" rule, reports per act and per format: wins, reactor left, and wall time estimate (sum of wave time from the sim, `Game.state.time`).
- [ ] `--length short|full`, `--act n` (play only act n with a synthetic roster of that act's expected size).
- [ ] Interim targets before Phase 2 (no economy yet): Standard win rate ≥ 75% in act I, ≥ 60% in act III; median run wave time 55–70 min at 1×.

### Phase 1 gate
- [ ] `npm test`, `npm run build`, `run-balance.ts -- --seeds 40 --length full` hits the interim targets; manual playthrough of one act.

---

## Phase 2: Economy and power curve (≈5 days)

### Task 9: Mission results reach the run

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/main.ts`

- [ ] `finishMission(run, result, content)` takes `MissionResult { won; livesLeft; energy; kills: Partial<Record<TowerId, number>> }`; `main.ts` builds it at the `end` event from `game.state` (`lives`, and `Tower.kills` summed per type; towers sold during the mission lose their kills, acceptable).
- [ ] `run.log` keeps one entry per mission (format, stars via `missionStars`, energy left, kills per type, Scrap earned) for ranks and the summary.

### Task 10: `RunState` v2 fields and Scrap

**Files:** `src/run/run.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] v2 adds `scrap`, `hull`, `licenses` (`<towerId>:<path>`), `mods`, `ranks` (`Record<TowerId, number>` of rank XP), `loadout`, `threat`, `log`.
- [ ] Scrap per win: `SCRAP_BASE` 12 + stars (1★ 0, 2★ 8, 3★ 16) + format bonus (elite 15, act boss 25) + hazard pay. Skipping the draft pays 12, skipping a relic 20. Over 12 missions a careful player earns ≈ 300–400 Scrap; prices in Task 14 are set against that.
- [ ] Status bar shows act, mission, Scrap, Hull.
- [ ] Tests: Scrap per star tier and format; skip pays.

### Task 11: Hull (carried damage)

**Files:** `src/run/run.ts`, `src/run/session.ts`, `src/ui/run-view.ts`

- [ ] Start 100. After each mission `hull -= round(HULL_WEAR × (1 − livesLeft / energy))`, `HULL_WEAR` 25 (a mission won on 1 energy costs about a quarter). A lost mission costs `HULL_LOSS` 40, gives no reward, and the run moves on. Hull ≤ 0 ends the run. Winning the final boss wins regardless of Hull.
- [ ] Act transitions heal 30, Repair nodes 35.
- [ ] Below 30 Hull the next mission's reactor energy is −20% ("damaged reactor"), behind a constant.
- [ ] Tests: wear formula; a loss at Hull 50 continues, at Hull 40 ends.

### Task 12: Hazard pay

**Files:** `src/run/threats.ts`, `src/run/run.ts`

- [ ] Each present stealth or burrow threat, and air ≥ 30%, pays `HAZARD` 6 Scrap on a win; shown on the node. Lost when the loadout cannot answer it (Task 6).

### Task 13: Tower ranks

**Files:** new `src/run/ranks.ts`, `src/run/transform.ts`, `src/ui/run-view.ts`

The main reason twelve missions feel different from five: the towers you field grow.

- [ ] XP per tower type per mission: `kills × 1 + (type was in the loadout and built ? 5 : 0)`; ranks at 20 / 60 / 120 / 200 XP (rank 1–4).
- [ ] Rank effects as a content transform per type: rank 1 +5% damage, rank 2 +5% range, rank 3 `level-2` and `level-3` upgrades −30%, rank 4 +10% damage and the first specialization tier of a licensed path −30%. Support towers and traps: rank effects on cost and radius instead (table in `ranks.ts`).
- [ ] Rank-up toast on the reward screen; rank pips on roster chips and loadout toggles.
- [ ] Tests: XP thresholds; rank transforms validate; ranks never touch towers outside the roster.

### Task 14: Shops and the Requisition panel

**Files:** new `src/run/shop.ts`, `src/run/transform.ts` (move `mapTowers`, `price`, `scaleStat` here from `relics.ts`), `src/run/generate.ts`, `src/ui/run-view.ts`

Until shop nodes exist (Phase 4) the reward screen gets a Requisition panel with stock from `streamOf(seed, "shop", step)`:

| Item | Cost | Effect |
| --- | --- | --- |
| Reroll draft | 10, +8 per use | 3 new tower cards (`streamOf(seed, "towers", step, rerolls)`) |
| Field Funds | 20 | +100 starting credits on the next mission |
| Repair crew | 20 | +20 Hull |
| Specialization license | 45 | Unlock one path (levels 6–8) of a roster tower |
| Drill | 25 | A roster tower's `level-2` costs 1 for the rest of the run |
| Retire | +15 (gain) | Remove a tower from the roster (keeps the draft pool tight for later synergy) |

- [ ] `RunMod = { tower; kind: "drill" | "discount" }` applied as a content transform before ranks and relics. Order: licenses → mods → ranks → relics, documented on `runPack`.
- [ ] The reward phase ends with an explicit **Continue** (no auto-advance after the picks).
- [ ] Tests: stock is seeded; purchases deduct Scrap and refuse when short; packs validate.

### Task 15: Specialization licenses

**Files:** `src/run/transform.ts`, `src/run/generate.ts`, `src/ui/run-view.ts`

- [ ] `lockSpecializations(licenses)` removes every `isSpecialization` upgrade whose `<tower>:<path>` is unlicensed. Check `validateMission` with `visual.paths` naming paths without upgrades; filter `visual.paths` too if needed.
- [ ] Sources: shop, Forge nodes, elite prize option (a license instead of the fourth card), act-transition reward option, events.
- [ ] Upgrade panel shows "Locked in this run" past level 5 (verify how `upgradeOptions` renders a tower without level-6 options).
- [ ] Tests: unlicensed tiers gone, licensed intact, `DEFAULT_CONTENT` untouched.

### Task 15b: Retune

**Files:** new `src/run/tuning.ts` (all knobs), `scripts/run-balance.ts`

- [ ] Bot policy: spend Scrap (license for its most-killing type, then Drill, Repair below 50 Hull), buy specialization tiers when licensed, keep the loadout by rank.
- [ ] Targets (greedy bot; a human should beat them): Standard wins ≈ 90% act I, 80% act II, 70% act III; act bosses ≈ 70%; final boss ≈ 55%; **25–35% of full runs complete**; median Hull at the final boss 30–60. Ranks and licenses should be worth at least +15 points of act III win rate (compare with `--no-ranks`, `--no-licenses`).

### Phase 2 gate
- [ ] Targets within ±10 points over `--seeds 60`; `scripts/balance.ts` for sector I unchanged.

---

## Phase 3: Draft and relic depth (≈4 days)

With ~11 drafts per run the roster outgrows the loadout, so drafts become about building a collection that covers threats and combos.

### Task 16: Tags, synergy weighting, counter guarantee, rarity

**Files:** new `src/run/tags.ts`, `src/run/run.ts`, `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] `tagsOf(tower)` derived from attack kind, targets and placement (`burn`, `chill`, `status`, `chain`, `area`, `antiair`, `trap`, `economy`, `support`), with a small hand table; a test fails when a tower has none.
- [ ] Draft weight = tab weight × (1 + 0.5 × tags shared with the roster), capped ×2.
- [ ] **Counter guarantee:** if the act's remaining nodes carry a threat the roster cannot answer, one card answers it. In act I's last draft the guarantee covers stealth for act II.
- [ ] Tower rarity from cost within its tab (50/35/15%); odds shift per act (act I 70/25/5 → act III 40/40/20). Elite fourth card Rare+.
- [ ] Relic rarity `common | rare | legendary | cursed`; the 12 existing are Common; Legendary only from act transitions, elite prizes and events.
- [ ] Tests: weighting and guarantee are deterministic; odds per act.

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
| Field Rack | Rare | +1 loadout slot |
| Drill Sergeant | Rare | Rank XP +50% |
| Glass Reactor | Cursed | All towers +25% damage; reactor energy −40% |
| Austerity | Cursed | +180 starting credits; wave bonuses 0 |
| Overclocked Grid | Cursed | Attack towers fire 20% faster; upgrades cost 25% more |
| Bounty Market | Cursed | Enemies pay +2; starting credits −30% |
| Specialist | Cursed | −1 loadout slot; every tower in the loadout counts one rank higher |
| Sabotage Cell | Legendary | Enemies −8% HP in every mission |
| Veteran Corps | Legendary | Every roster tower starts at rank 1 at least |
| Deep Pockets | Legendary | +100 starting credits in every mission |
| Master License | Legendary | One license per act transition for free |

- [ ] Cursed relics only from events and as an elite-prize option ("take a cursed relic, gain 30 Scrap").
- [ ] Tests: each relic's pack validates on 3 sample missions per act.

### Phase 3 gate
- [ ] `run-balance.ts`: completion within target; no single relic moves completion by more than +15 points (`--relic <id>`).

---

## Phase 4: Route map per act (≈5 days)

### Task 18: Act maps

**Files:** new `src/run/map.ts`, `src/run/run.ts`, `src/run/storage.ts`

- [ ] `actMap(seed, act, threat)`: pure, derived from the seed (the run stores only `position` and `visited`). 7 columns, up to 3 lanes:
  - Columns 0, 2, 4: **Standard** missions from the act's tier (no source twice in a run).
  - Columns 1, 3, 5: **camp** nodes: Shop, Forge (licenses and Drill at a discount), Repair (+35 Hull), Event, **Elite** (optional 6-wave mission, elite prize) or **Skirmish** (optional 4-wave mission, half rewards, rank XP ×2).
  - Column 6: the **act boss** (one node, visible with its modifier from the act start).
- [ ] Edges to the same or neighbouring lane; every lane reachable; no column with two of the same camp kind; at least one Repair and one Shop on every path through columns 3–5.
- [ ] `nextNodes(map, position)` replaces `routeOffers`.
- [ ] Tests: stable per seed; constraints hold for 200 seeds; every mission node validates.

### Task 19: Camp nodes and events

**Files:** `src/run/camp.ts`, `src/run/events.ts`, `src/ui/run-view.ts`

- [ ] Shop and Forge reuse `shop.ts` with their own stock; the reward-screen Requisition shrinks to Reroll and Retire.
- [ ] 10–12 events, each a pure `(run, choice) → run`, 2–3 choices with visible costs, drawn from `streamOf(seed, "event", act, column)`. Examples: *Derelict depot* (Rare relic, or cursed relic + 30 Scrap), *Mercenary crew* (an Epic tower for the next mission only, or 30 Scrap to keep it), *Salvage* (+30 Scrap, −12 Hull), *Field school* (a license, −15 Hull), *Drill yard* (+40 rank XP to one roster tower), *Quiet sector* (+20 Hull).
- [ ] Tests: every choice keeps the run valid.

### Task 20: Map view

**Files:** `src/ui/run-view.ts`, `src/ui/run.css`

- [ ] SVG node map for the current act (horizontal on desktop, vertical on phones), node icons per kind, reachable nodes highlighted, visited path drawn, act boss with modifier at the end, the act's planet colour as background. A mission node opens the deploy card (preview, threats, loadout).
- [ ] An act strip above (I · II · III) with the next act's tier name.
- [ ] Keyboard: arrows between reachable nodes, Enter chooses.

### Phase 4 gate
- [ ] Bot walks the map (Repair below 50 Hull, else Shop with ≥ 45 Scrap, else the lane with fewer elites); Task 15b targets hold; median optional missions per run 1–3.

---

## Phase 5: Endgame and replay value (≈4 days)

### Task 21: Boss modifiers

**Files:** new `src/run/boss.ts`, `src/run/generate.ts`

- [ ] `BOSS_MODS` as transforms, shown on the map from the act start: *Iron Vanguard* (ground groups armored), *Swarm Tide* (counts ×1.5, HP ×0.7), *Air Superiority* (air share ≥ 40% through a swap bias in `remixWave`), *Titan Escort* (a Titan in each of the last three waves), *Blackout* (stealth groups if the act allows stealth, else +20% HP).
- [ ] Act bosses one modifier, the final boss two from threat 5.
- [ ] Tests: each modifier validates on every boss-tier source mission.

### Task 22: Threat levels (ascension)

**Files:** `src/run/threat.ts`, `src/run/storage.ts`, `src/ui/run-view.ts`

- [ ] Threat 0–10, unlocked by completing a full run at the level below. Cumulative: 1 elites +10% HP; 2 −10% starting credits; 3 Hull starts at 80; 4 shop prices +20%; 5 two final-boss modifiers; 6 depth +0.05; 7 a cursed relic at the start; 8 Repair heals half; 9 one loadout slot fewer in act I; 10 +10% HP everywhere.
- [ ] Record v2: per threat level best and wins, plus the last 10 runs.

### Task 23: Daily run

**Files:** `src/run/daily.ts`, `src/ui/run-view.ts`, `src/run/storage.ts`

- [ ] **Short** run (one act), seed `fnv(stable(["daily", YYYY-MM-DD UTC]))`, threat 3, fixed starter. Wall-clock only in the view.
- [ ] One attempt per day (the journal prevents retries); local record per date; a "copy result" line.

### Task 24: Run summary and history

**Files:** `src/ui/run-view.ts`

- [ ] End screen: per mission format, stars, energy left, Scrap; final roster with ranks, licenses, relics; kills per tower type over the run (from `run.log`).
- [ ] History of the last 10 runs with "Play this seed".
- [ ] Light unlocks (no power): threat 2 unlocks choosing among 4 starter packs; threat 4 a "Trap pack" starter column; the first completed Short run unlocks Full runs and the daily.

### Phase 5 gate
- [ ] `run-balance.ts -- --threat 0` vs `--threat 5`: completion at 5 roughly half of 0.

---

## Execution order and estimates

| Phase | Tasks | Effort | Ships alone? |
| --- | --- | --- | --- |
| 0 Quick fixes | 1–3 | ~1 day | yes |
| 1 Structure: acts, short missions, loadouts | 4–8 | ~5 days | yes (route offers stay two cards per column until Phase 4) |
| 2 Economy and power | 9–15b | ~5 days | yes (shop in the reward screen) |
| 3 Draft and relics | 16–17 | ~4 days | yes |
| 4 Route map | 18–20 | ~5 days | yes |
| 5 Endgame | 21–24 | ~4 days | yes |

Phases 1 and 2 matter most: more missions without carried power (ranks, licenses, Hull, Scrap) just make a long flat run. Phases 3 and 4 can run in parallel after Phase 2 (agree on the reward-screen and deploy-card layout first; both touch `run-view.ts`).

## Verification (end to end)

- [ ] `npm test`, `npm run build`.
- [ ] `npx vite-node scripts/run-balance.ts -- --seeds 60 --length full` against the Task 15b targets after every phase from 2 on; median wave time per full run 55–70 min.
- [ ] `scripts/balance.ts` for sector I before/after Phases 2 and 3: identical.
- [ ] Manual: `npm run dev`, `/#run`: play act I of a seed, change the loadout against a threat, reload mid-wave and resume, buy in a shop, reach the act transition, abandon; start a daily.
- [ ] Update CLAUDE.md's Run paragraph (acts, formats, loadout, ranks, new modules, storage keys `ion-bastion:run-journal`, v2 record, `run/tuning.ts`).
