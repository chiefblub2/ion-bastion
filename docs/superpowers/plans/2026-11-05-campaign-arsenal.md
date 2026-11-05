# Campaign Arsenal: an earned tech tree for towers

## Problem

The campaign starts with all 60 towers and every upgrade open: only 10 of 60 campaign missions set `availableTowers`, so
mission 1 hands a new player four tabs of towers. Winning a mission earns the next mission and nothing else; stars are
recorded but buy nothing. There is no sense of a growing arsenal.

## Decisions

| Question | Decision |
| --- | --- |
| Unlock model | **Fully earned tech tree** (designer's call): the player spends research on towers of their choice. |
| Upgrade depth | **Unchanged**: levels 1–8 and all paths stay open on every tower the player has. Only the roster grows. |
| Scope | Campaign only. Circuit, Training, multiplayer, the editor, Run mode, `?mission=` links and `?unlock=all` keep every tower. |

## The balance problem and its answer

A free tech tree makes each mission's difficulty depend on the save: a player who researched only Traps meets Polar
Night's glider swarms without anti-air. Two guarantees keep every mission winnable and `scripts/balance.ts` exact:

1. **Core kit**, always available: Pulse, Nova (`blast`), Cryo (`frost`), Flak, Tesla, Aura. This is exactly what the
   sector I strategies build.
2. **Field issue** per mission: `MissionDefinition.issued?: TowerId[]`, the counters the mission demands (Detector for
   Phantoms, Executioner/Pitfall for crabs, traps for Burrowers, …). An issued tower the player has not researched is
   available for that mission only and shows a "Field issue" tag in the build menu and briefing.

The tower set of a campaign mission is `(core ∪ issued ∪ researched) ∩ availableTowers`, where an absent
`availableTowers` means all towers.

Strategies A/B across the whole campaign build only 23 distinct towers. A new rule in `core/mission-checks.ts`
(shared by `missions.test.ts` and the balance script) requires every strategy build to lie in `core ∪ issued`. So
`balance.ts` keeps measuring the **guaranteed minimum kit**, and research only ever adds options. The research
cannot make a mission harder. Seed `issued` once from the strategies with a throwaway script, then curate it.

## Research

- **Currency: Research Points (RP).** Each star earned for the first time is worth 1 RP (best stars per mission, so a
  replay for a better rating pays only the difference), and a sector's finale is worth +2 the first time it is won.
  That gives about 180 + 24 RP over the 60 missions. RP are derived from the record, never stored, so they cannot drift.
- **Tree: four branches, one per build tab** (Attack, Control, Traps, Support: `pageOf`), each holding the 13–14 towers
  of its tab that are outside the core kit, in four tiers. A tower requires any one tower of the tier below in its
  branch. Tiers 3 and 4 also need the second and third planet reached (`WORLD_TIERS`), so the early game cannot buy
  the endgame.
- **Prices** of 2 / 3 / 4 / 6 RP per tier make the whole tree cost about 190 RP. A player who wins everything at
  2 stars (about 144 RP) owns roughly three quarters of it. Every knob goes in `campaign/arsenal-tuning.ts`.
- **Refund:** free and at full price, any time outside a mission. With a refund, earning research means the pool grows
  with each star, while the choice of towers stays open for experiment. Open question: drop the refund if playtests
  show players never commit to a build.
- **Migration:** an existing record already holds its stars, so returning players open the Arsenal with the RP
  they have earned and nothing researched. Unlike the old full roster, their towers are now opt-in; the first menu
  visit flags the Arsenal page as new.

## Implementation

### Pure logic (`src/campaign/`)

- `arsenal.ts`: `ARSENAL_TREE` (branch, tier, price per tower, derived from `pageOf` plus a hand-ordered tier list),
  `CORE_KIT`, `researchPoints(record)`, `canResearch(state, record, tower)`, `research`/`refund`, and
  `campaignTowers(mission, researched, content)`. Tests cover: the core always available, issued only for its mission,
  the restriction still wins, RP accounting with refunds, the tier and planet gates.
- `record.ts`: the record gains `researched: TowerId[]` (record v2; v1 and the bare map still read, unknown ids
  dropped). Alternatively a separate key `ion-bastion:arsenal`, to keep wins and spending apart. Pick the separate
  key if `record.ts` stays star-only.

### Simulation (`src/core/`)

- The `mission` command gains an optional `towers?: readonly TowerId[]` (solo only, else `arsenal-solo`). `Game` keeps
  it on `state.arsenal` (absent when not given, so all other modes and existing hashes stay unchanged), and
  `availableTowers()` intersects with it. `restart` keeps it. The mission definition stays unmodified, so the
  `game.mission === findMission(...)` win check in `main.ts` still records the win.
- `validation.ts`: `issued` names known towers, not in conflict with `availableTowers`.
- `mission-checks.ts`: strategy builds ⊆ `CORE_KIT ∪ issued`.

### App and UI

- `app/menu-nav.ts`: campaign mission loads pass `campaignTowers(...)`. Circuit, multiplayer, the editor and Run pass
  nothing.
- New menu page `/#arsenal` (`MenuPage` `"arsenal"`, `ui/arsenal-view.ts`, lazy-loaded like the Run view): four
  branch columns, tower cards with the Codex icon (`docs/images/towers/`), price, the gate text, Research / Refund. RP
  sit in the header. The fitted landscape layout gets one branch per swipe shelf, like the codices.
- Home page: an Arsenal button next to the Codex, with a dot when research is affordable.
- Atlas briefing: a "Kit" row with core, issued (tag) and researched counts, and a warning when the mission's needs
  (`needsOf`/`rosterCovers` from `run/threats.ts`) are covered only by field issue.
- Win overlay (`Interface.result`): "+3 RP" next to the stars and a "Research available" link.
- Tower Codex: unresearched campaign towers show a lock with branch, tier and price. Their stats stay readable.
- Build menu: a "Field issue" corner tag on issued towers. Tabs appear once `PAGED_FROM` towers are available,
  so early missions show one flat bar of six or seven towers on their own.

### Content pass

- Seed `issued` for all 60 campaign missions from the strategies, then trim it to the counters the mission truly
  demands. Run `scripts/balance.ts` per sector. Nothing should change, since the strategies already fit the kit.
- Update the briefings' focus lines where they name a tower that is neither core nor issued.

## Tasks

1. `campaign/arsenal.ts` with tuning and tests.
2. Storage (`ion-bastion:arsenal` or record v2) and migration.
3. `mission` command `towers`, `state.arsenal`, `availableTowers` intersection, validation, the lockstep test
   untouched (field absent).
4. `issued` field, seeding script, the strategy rule in `mission-checks.ts`, balance runs for all 12 sectors.
5. Menu wiring in `menu-nav.ts` and the win overlay RP.
6. The Arsenal page, home button and fitted layout (`menu-fit-check.ts` gains the page).
7. Codex locks, briefing kit row, build-menu tag.
8. CLAUDE.md: Arsenal section, storage key, the new mission field, the check.

## Open questions

- Should the refund stay free? Recommendation: yes for now; revisit after playtests.
- Should Circuit share the Arsenal? Recommendation: no. Circuit is the sandbox with everything.
- Should research also be possible from wins without stars (1 RP per first win as a floor)? Already implied, since a
  win is at least 1 star.
