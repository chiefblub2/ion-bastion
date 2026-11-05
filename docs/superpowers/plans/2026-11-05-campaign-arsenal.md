# Campaign Arsenal: an earned tech tree for towers

## Problem

The campaign starts with all 60 towers and every upgrade open: only 10 of the 60 campaign missions set
`availableTowers`, so mission 1 hands a new player four tabs of towers. Winning a mission earns the next mission and
nothing else; stars are recorded but buy nothing. There is no sense of a growing arsenal.

## Decisions

| Question | Decision |
| --- | --- |
| Unlock model | **Fully earned tech tree** (designer's call): the player spends research on towers of their choice. |
| Upgrade depth | **Unchanged**: levels 1–8 and all paths stay open on every tower the player has. Only the roster grows. |
| Balance runs | **Unchanged** (designer's call): no new checks, no strategy edits, no re-tuning. See "Balance stays put". |
| Scope | Campaign only. Circuit, Training, multiplayer, the editor, Run mode, `?mission=` links and `?unlock=all` keep every tower. |

## Content model

A campaign mission offers `(core ∪ loadout ∪ researched) ∩ availableTowers`, where an absent `availableTowers` means
all towers.

- **Core kit**, always available: Pulse, Nova (`blast`), Cryo (`frost`), Flak, Tesla, Aura. This is the whole of sector I.
- **Mission loadout** (`MissionDefinition.loadout?: TowerId[]`): the towers a mission hands out for itself, its
  "signature" towers. An unresearched loadout tower works for that mission only and carries a "Loadout" tag.
- **Research**: towers made permanent with Research Points. This is the only way to get the 37 towers no mission
  ever lends.

### Balance stays put

Strategies A/B across the campaign build only 23 distinct towers: the 6 core towers and 17 more. The loadouts below
are exactly each mission's strategy towers outside the core kit. So whatever a player has researched, every mission
offers at least what its strategies were balanced with. `scripts/balance.ts` builds games without an arsenal (every
tower), and its results do not change. No script, check or strategy is touched.

## The loadouts (content)

The loadouts are copied from strategies A/B. Missions 1–5 have none, and the Circuit (61–73) is out of scope.
**First** marks the mission where a tower appears in the field for the first time. Its briefing gets a "New in the
field: …" line, and the Codex entry opens there.

| No. | Mission | Loadout | First |
| --- | --- | --- | --- |
| 06 | Icebreaker | lance | **Lance** |
| 07 | Cryo Valley | inferno | **Ember** |
| 08–09 | Crevasse, Polar Night | — | |
| 10 | Frostwall | decay, lance, acid | **Decay**, **Corrosion** |
| 11 | Seepage Pit | acid | |
| 12 | Fog Swamp | stasis | **Stasis** |
| 13 | Brackish Water | acid | |
| 14 | Digester Tower | — | |
| 15 | Toxic Cauldron | acid, detector, decay | **Detector** |
| 16 | Docking Ring | refinery | **Refinery** |
| 17 | Cargo Lock | — | |
| 18 | Zero-G | detector, decay, lance | |
| 19 | Solar Sail | lance, detector | |
| 20 | Command Bridge | decay, acid, detector, lance | |
| 21 | Rubble Avenue | lance | |
| 22 | Bunker Line | — (restricted to core towers) | |
| 23 | Cathedral | acid, lance | |
| 24 | Elevated Rail | lance, inferno, decay | |
| 25 | Citadel | lance, decay, detector, acid, inferno | |
| 26 | Event Horizon | stasis, decay, lance | |
| 27 | Rift | lance, acid, decay | |
| 28 | Time Loop | acid, lance, decay, stasis, inferno | |
| 29 | Zero Point | lance, acid, decay | |
| 30 | Core of the Singularity | decay, acid, lance, detector, stasis, inferno | |
| 31 | Quicksand | acid, lance, decay | |
| 32 | Caravan Road | mine, spikes, decay, quake | **Mine**, **Caltrops**, **Quake** |
| 33 | Glass Plain | mine, tar, spikes, pit | **Tar Pit**, **Pitfall** |
| 34 | Storm Crest | mine, spikes, quake, decay | |
| 35 | Oasis Zero | mine, spikes, quake, decay | |
| 36 | Continental Shelf | pit, lance, executioner, decay | **Executioner** |
| 37 | Coral Trench | lance, executioner, focus, pit, decay | **Focus** |
| 38 | Pressure Chamber | pit, executioner, decay, lance, focus, stasis | |
| 39 | Black Smoker | detector, pit, executioner, decay, lance | |
| 40 | Abyss | detector, lance, executioner, decay, pit, focus, stasis | |
| 41 | Heat Lightning | pit, executioner, decay | |
| 42 | Hailfield | executioner, lance, tar, pit, decay | |
| 43 | Lightning Rod | decay, executioner | |
| 44 | Gust Corridor | detector, pit, executioner, decay, lance | |
| 45 | Eye of the Storm | detector, lance, executioner, decay, pit, focus, stasis | |
| 46 | Vine Trail | shrapnel, executioner, decay, mortar, quake | **Shrapnel**, **Mortar** |
| 47 | Temple Steps | decay, executioner, quake, acid, mortar | |
| 48 | Mangrove Swamp | decay, executioner, quake, shrapnel, mortar, acid | |
| 49 | Snake Pit | decay, shrapnel, executioner, quake, acid, mortar | |
| 50 | Heart of the Jungle | decay, shrapnel, executioner, quake, acid, mortar | |
| 51 | Ashfield | executioner, tar, decay, stasis | |
| 52 | Lava Flow | executioner, tar, decay, stasis, snare | **Bear Trap** |
| 53 | Slag Ridge | executioner, decay, mortar, quake, spikes, shrapnel, acid, inferno | |
| 54 | Ember Chamber | executioner, tar, decay, stasis, snare, shrapnel | |
| 55 | Volcano Throat | executioner, tar, decay, quake, stasis, shrapnel, snare, acid | |
| 56 | Quartz Gallery | inferno, tar, stasis, executioner, acid | |
| 57 | Hall of Mirrors | inferno, executioner, decay, stasis, tar, acid | |
| 58 | Geode Chamber | inferno, executioner | |
| 59 | Prism Shaft | detector, inferno, executioner, decay, stasis, acid | |
| 60 | Crystal Heart | inferno, executioner, decay, stasis, acid, tar | |

Restricted missions keep their restriction: the loadout lies inside it, and research outside it does not apply.

## The tree (content)

There are four branches, one per build tab (`pageOf`), with four tiers each. A tower needs any one researched tower
of the tier below in its branch; the core towers count as tier 0. Tiers open with the campaign:

| Tier | Opens | Price |
| --- | --- | --- |
| I | from the start | 2 RP |
| II | Core Fortress (05) won | 3 RP |
| III | Ashkar reached (sector V open) | 4 RP |
| IV | Thessaly Prime reached (sector IX open) | 5 RP |

Towers in *italics* are never part of a loadout. Research is the only way to get them.

| Branch | Tier I | Tier II | Tier III | Tier IV |
| --- | --- | --- | --- | --- |
| **Attack** (core: Pulse, Nova, Flak, Tesla) | Lance, Ember | Decay, Shrapnel, Executioner | Mortar, Quake, Focus, *Skyburst* | *Catalyst*, *Orbital* |
| **Control** (core: Cryo) | Corrosion, Stasis | *Snare Net*, *Jammer*, *Siphon*, *Tether* | *Gravitron*, *Cyclone*, *Amber*, *Shrink Ray* | *Magnetar*, *Mesmer*, *Hex*, *Plasma* |
| **Traps** | Mine, Caltrops, Tar Pit | Bear Trap, Pitfall, *Flame Grate*, *Oil Slick* | *Barricade*, *Sticky Mine*, *Spring*, *Harpoon* | *Arc Plate*, *Grinder*, *Warp Pad*, *Tripwire* |
| **Support** (core: Aura) | Detector, Refinery | *Bounty Beacon*, *Tracker*, *Workshop*, *Repair Dock* | *Vault*, *Fire Control*, *Armory*, *Skylink* | *Overclock*, *Recycler*, *Nexus*, *Shield Generator* |

The placement follows three rules:
- Tier I holds the towers the first loadouts lend, so the first research makes a familiar tower permanent.
- Each branch climbs from plain to combo towers (Catalyst, Hex, Oil Slick, Nexus, Recycler need other towers to
  shine).
- Air answers are spread out (Skyburst III, Snare Net II, Cyclone III, Harpoon III, Skylink III), so anti-air variety
  is something to research, while Flak stays core.

The cost is 197 RP for all 54 towers (Attack 39, Control 52, Traps 54, Support 52).

### Research Points

- **Stars:** each star earned for the first time is worth 1 RP. The best stars per mission count, so a replay for a
  better rating pays only the difference.
- **Sector commendation:** +2 RP the first time a sector finale is won.
- **Field-tested:** a loadout tower costs 1 RP less once the player has won a mission that lent it.
- **Totals:** 60 × 3 stars + 12 × 2 = 204 RP, so three stars everywhere buys the whole tree with a few points to
  spare. Two stars everywhere (144 RP) buys about three quarters of it. Sector I alone (at most 17 RP) buys tier I
  of one or two branches.
- **Derived, never stored:** RP come from the record, so they cannot drift. Only the list of researched towers is saved.
- **Refund:** free at full price, outside a mission. Open question; see below.
- **Returning players:** they keep their stars and open the Arsenal with their earned RP and nothing researched. A
  "new" flag points them to the page once.

### Dossiers (content)

Each of the 54 towers gets a one-line research dossier: what it adds to the arsenal and which enemy or situation calls
for it. It's written in the field-manual voice and shown on the Arsenal card and in the Codex while the tower is
locked. Examples:

- **Snare Net:** "Drags flyers into reach of your ground guns. Wanted wherever Stormbirds outrun the Flak."
- **Barricade:** "A wall on the path: walkers stop and chew. Pair it with anything that hits a crowd."
- **Vault:** "Interest on unspent credits. For commanders who can hold a line on less."

The dossiers live in `content/arsenal.ts` next to the tree, and every towerId must have one (validation).

## Implementation outline

1. **Content:** `content/arsenal.ts` with `CORE_KIT`, `ARSENAL_TREE` (branch, tier, tower, dossier), tier gates and
   RP knobs. Add `loadout` to the 55 campaign missions above, and validate that the loadout names known towers and
   lies inside `availableTowers`.
2. **Pure logic:** `campaign/arsenal.ts` with `researchPoints(record)`, `canResearch`, `research`/`refund`,
   `fieldTested`, `campaignTowers(mission, researched, content)` and `firstInField(mission)`. Focused tests for each.
3. **Storage:** `ion-bastion:arsenal` (researched ids; unknown ids dropped), kept apart from the star record.
4. **Simulation hook:** the `mission` command takes an optional `towers` list (solo only). `state.arsenal` is absent
   unless given, so every other mode, the balance scripts and existing hashes stay as they are.
   `availableTowers()` intersects with it. The definition stays unmodified, so the win still records.
5. **UI:**
   - the `/#arsenal` page (four branch columns, one shelf per branch in the fitted layout) and an Arsenal button on
     the home page with a dot when something is affordable;
   - a briefing kit row with "New in the field: …";
   - RP on the win overlay;
   - Codex locks with the dossier;
   - a "Loadout" tag in the build menu.
6. **CLAUDE.md:** the Arsenal section, the storage key and the `loadout` field.

## Open questions

- **Refund:** free (encourages experiment) or permanent (every pick matters)? Recommendation: free.
- **Starting state:** should a new player start with 2–4 RP to make one tier I pick before Outpost 07? That would
  teach the Arsenal screen at once.
- **Unlocked-by-tier vs unlocked-by-sector:** should tier II open after sector I's finale, or after any five wins?
  Recommendation: the finale, since it gives Core Fortress a payoff.
