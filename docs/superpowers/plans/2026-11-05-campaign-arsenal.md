# Campaign Arsenal: research towers, level up your gear

## Problem

The campaign starts with all 60 towers and every upgrade open: only 10 of 60 campaign missions set `availableTowers`,
so mission 1 hands a new player four tabs of towers. Winning a mission earns the next mission and nothing else, and
replaying a mission earns nothing at all. There is no sense of a growing arsenal and no reason to go back.

## Decisions (designer's calls)

| Question | Decision |
| --- | --- |
| Unlock model | **Earned research**: the player researches towers of their choice. Research is gated **only by Salvage**: no campaign progress, no prerequisites. Any tower can be bought as soon as it is affordable. |
| Guarantees | **None, except the Detector**: a mission with invisible enemies always offers it. Players who research badly will find their way. |
| Currency | **Not stars.** **Salvage** is earned by playing: every wave cleared pays, replays included. |
| Replays | **Rewarded**: they pay Salvage and train the towers used, which levels up their **gear** (Mk I–V). |
| Upgrade levels | Unchanged: levels 1–8 and all paths stay open on every tower the player has. |
| Balance | **Balance tests and scripts stay as they are.** `scripts/balance.ts`, `sim-golden`, the strategies and `mission-checks.ts` play the base content with every tower, as today. The Arsenal is a campaign-only pack applied on top. |
| Scope | Campaign only. Circuit, Training, multiplayer, the editor, Run mode, `?mission=` links and `?unlock=all` keep every tower at base stats. |

## The three loops

1. **Play → Salvage → Research.** Every mission, won or lost, pays Salvage for its waves. Research makes a tower
   available in every campaign mission.
2. **Use → Tower XP.** Each tower type earns XP from its own kills in campaign missions (plus assists for Control,
   trap and Support towers, as in the Run). XP raises its **veterancy rank** (0–5) and is never spent.
3. **Rank + Salvage → Gear.** Gear marks (Mk I–V) make a tower type permanently stronger in the campaign. Each mark
   costs Salvage and needs the veterancy rank of the same number. A replay therefore pays twice: Salvage to spend,
   and XP for the towers you fielded.

## Tower availability

A campaign mission offers `(core ∪ researched ∪ detector-if-stealth) ∩ availableTowers`, where an absent
`availableTowers` means all towers.

- **Core kit**, owned from the start: Pulse, Nova (`blast`), Cryo (`frost`), Flak, Tesla, Aura.
- **Detector exception:** when `hasStealth(mission)` holds (`core/mission-checks.ts`: stealth or cloakField
  enemies), the Detector is offered whether researched or not. Its card shows "Issued: invisible enemies ahead". This
  covers Toxic Cauldron, Zero-G, Solar Sail, Command Bridge, Citadel, Core of the Singularity, Black Smoker, Abyss,
  Gust Corridor, Eye of the Storm, Prism Shaft and any later stealth mission, with no list to maintain.
- **Restricted missions** keep their restriction: research outside it does not apply, so for example Bunker Line
  still offers only its four towers.

## Salvage (content)

Every number below lives in `content/arsenal.ts` (`SALVAGE`), so it can be tuned in one place.

| Source | Pays | Notes |
| --- | --- | --- |
| Wave cleared (win) | `1 + sector` per wave (sector I: 2, sector XII: 13) | Later sectors pay more, so farming the frontier beats farming mission 1. |
| Loss | half of the cleared waves' Salvage, rounded down | A failed attempt still moves the player forward, but less than a win. |
| Victory | +10 | Every win, replays included. |
| First victory | +20 + 5 × sector | Once per mission (derived from the star record: the mission was not won before). |
| Daily bounty | ×2 on everything above | One campaign mission per day, picked from the open ones by a date seed (as `run/daily.ts` does). It's shown on the home page and in the atlas with a bounty badge. |

**Rough scale:** about 1,000 waves in the 60 campaign missions × an average of 7.5 Salvage, plus the victory
bonuses, gives about 10,500 Salvage for one clean pass. That's about 85% of the tree (12,390). The rest of the tree
and all the gear come from replays.

Runs started with `&wave=` or `&credits=` and playtests pay nothing. This reuses the existing "unmodified
definition" check in `main.ts`.

## The research catalogue (content)

Research is gated only by Salvage. There are no campaign gates and no prerequisites: the 54 researchable towers
are a catalogue in four branches (the build tabs, `pageOf`), and the tier is only a price band. A player can save up
for Orbital from the first missions, or spread the Salvage over cheap traps. The order is the player's strategy.

| Tier (price band) | Price |
| --- | --- |
| I | 60 Salvage |
| II | 150 Salvage |
| III | 250 Salvage |
| IV | 400 Salvage |

| Branch | Tier I | Tier II | Tier III | Tier IV |
| --- | --- | --- | --- | --- |
| **Attack** (core: Pulse, Nova, Flak, Tesla) | Lance, Ember | Decay, Shrapnel, Executioner | Mortar, Quake, Focus, Skyburst | Catalyst, Orbital |
| **Control** (core: Cryo) | Corrosion, Stasis | Snare Net, Jammer, Siphon, Tether | Gravitron, Cyclone, Amber, Shrink Ray | Magnetar, Mesmer, Hex, Plasma |
| **Traps** | Mine, Caltrops, Tar Pit | Bear Trap, Pitfall, Flame Grate, Oil Slick | Barricade, Sticky Mine, Spring, Harpoon | Arc Plate, Grinder, Warp Pad, Tripwire |
| **Support** (core: Aura) | Detector, Refinery | Bounty Beacon, Tracker, Workshop, Repair Dock | Vault, Fire Control, Armory, Skylink | Overclock, Recycler, Nexus, Shield Generator |

The price bands follow three rules:
- Plain, broadly useful towers are cheap.
- Towers that need others to shine, or that bend the rules, are expensive (Catalyst, Hex, Oil Slick, Nexus,
  Recycler, Orbital, Warp Pad).
- The Detector is cheap: it is free on stealth missions anyway, and owning it elsewhere is a small luxury.

**Pacing without gates:** a sector I mission pays about 55–65 Salvage on its first win (10–15 waves × 2, +10, +25 the first
time). The first tier I tower comes after one or two missions, and a tier IV tower after about eight sector I wins
(fewer with replays of later sectors, which pay more per wave). Saving for a big tower means playing the early
sectors with the core kit longer. That's the trade-off, and it's the player's to make.

**Strategies this opens:**
- **Trap line:** Mine, Caltrops and Tar Pit for 180 Salvage before sector II. That's a cheap, wide arsenal that
  shines on long paths.
- **Economy first:** Refinery, then Bounty Beacon and Vault. Credits snowball inside missions and make the hard
  sectors easier.
- **Heavy gun:** skip everything and save for Orbital or Catalyst. The core kit carries the early sectors.
- **Specialist:** one branch end to end, such as Control for slow, stun and pull combos with Cryo and Stasis, with
  that branch's towers geared to Mk V early through veterancy.
- **Anti-air depth:** Snare Net, Skyburst, Harpoon and Skylink for the flyer-heavy sectors.

The whole catalogue costs 12,390 Salvage (Attack 2,370 · Control 3,320 · Traps 3,380 · Support 3,320).

### Dossiers

Each of the 54 researchable towers gets a one-line dossier: what it adds and which enemy or situation calls for it.
It's written in the field-manual voice and shown on the research card and in the Codex while the tower is
unresearched. Examples:

- **Snare Net:** "Drags flyers into reach of your ground guns. Wanted wherever Stormbirds outrun the Flak."
- **Barricade:** "A wall on the path: walkers stop and chew. Pair it with anything that hits a crowd."
- **Vault:** "Interest on unspent credits. For commanders who can hold a line on less."

## Gear (content)

Gear is permanent per tower type, campaign only, and applied as a content-pack transform. It reuses the Run's pure
transforms in `run/transform.ts` (`scaleStat`, `upgradePrice`, `only`, `compose`), so there is no new simulation
logic.

**Veterancy** (XP per tower type, never spent): 1 XP per kill, plus `XP_BUILT`-style XP for each tower built and
Run-style assists (`run/xp.ts` `assistsOf`) for Control, trap and Support towers. Rank thresholds:
200 / 600 / 1,500 / 3,500 / 7,000 XP.

| Mark | Needs | Price | Attack and Control towers | Traps | Support towers |
| --- | --- | --- | --- | --- | --- |
| Mk I | rank 1 | 80 | +4% damage | +4% damage | +5% range (radius) |
| Mk II | rank 2 | 160 | +5% range | levels 2–3 cost 20% less | levels 2–3 cost 20% less |
| Mk III | rank 3 | 280 | levels 2–3 cost 20% less | +8% damage (total) | +10% range (total) |
| Mk IV | rank 4 | 450 | +8% damage (total) | build cost −10% | build cost −10% |
| Mk V | rank 5 | 700 | **Signature mod** (below) | **Signature mod** | **Signature mod** |

**Signature mods (Mk V)** give each of the 60 towers a small effect none of its paths grant, like the Run's
`MASTERY` (Concussion, Static Charge and Tracer Rounds already exist for Nova, Tesla and Pulse). Each one is bounded,
deals no damage of its own beyond its tower's own attack, and needs no new simulation system. There are three
mechanisms:

- **Hit status (24 mods):** a `slow`, `stun` or `vulnerable` applied on hit, the shape `Protocols.mastery`
  (`MasteryEffect`) already carries into the simulation for the Run. It works for attack, control and trap hits
  alike. The usual merge rules apply (the stronger slow or vulnerable wins; stun and pull block each other until
  recovery), so a weak mod never overrides a path's stronger effect.
- **Pack transform (35 mods):** a parameter or stat step through `run/transform.ts` (`mapParam`, `scaleStat`), the way
  the Run's relics change towers. Support towers only have parameters, so all of theirs are this kind.
- **New kind (1 mod):** `bounty` in `MasteryEffect`, for Executioner's credit per kill.

**Build order:** the 19 marked ★ come first: the core kit, the tier I non-trap towers, the tier II Attack and Control
towers, Detector and Refinery. The other 41 follow in a second batch. Until then their Mk V shows "Signature in a
later update" and gives +4% damage (+5% radius for Support towers) as a stand-in.

#### Attack

| Tower | Mod | Effect | Mechanism |
| --- | --- | --- | --- |
| ★ Pulse | Tracer Rounds | hits: target takes +6% damage for 1.5 s | vulnerable (exists) |
| ★ Nova | Concussion | blasts stun for 0.2 s (then 2 s immune) | stun (exists) |
| ★ Flak | Flight Breaker | hit flyers slow to 85% for 1 s | slow |
| ★ Tesla | Static Charge | arcs slow to 85% for 1 s | slow (exists) |
| ★ Lance | Overpenetration | every enemy on the line takes +8% damage for 1 s | vulnerable |
| ★ Ember | Choking Smoke | hits slow to 90% for 1.5 s | slow |
| ★ Decay | Brittle Rot | hits: target takes +5% damage for 2 s | vulnerable |
| ★ Shrapnel | Stagger | hits slow to 85% for 0.5 s | slow |
| ★ Executioner | Reaper's Due | its kills pay +1 credit | new kind `bounty` |
| Mortar | Danger Close | dead zone 1.5 → 1.0 cells | `minRange` |
| Quake | Tremor | hit walkers slow to 80% for 0.6 s | slow |
| Focus | Overcharge | beam ramps to 12 stacks instead of 10 | `stacks` |
| Skyburst | Flechette Cloud | burst radius 0.9 → 1.1 cells | `radius` |
| Catalyst | Volatile Mix | counts up to 5 effects instead of 4 | `cap` |
| Orbital | Rapid Uplink | strike lands after 1.0 s instead of 1.4 s | `delay` |

#### Control

| Tower | Mod | Effect | Mechanism |
| --- | --- | --- | --- |
| ★ Cryo | Deep Chill | hits: target takes +5% damage for 2 s | vulnerable |
| ★ Corrosion | Caustic Shock | hits stun for 0.15 s (then 3 s immune) | stun |
| ★ Stasis | Afterchill | halted enemies stay slowed to 80% for 1 s | slow |
| ★ Snare Net | Weighted Mesh | netted flyers take +6% damage for 2 s | vulnerable |
| ★ Jammer | Feedback | disrupted enemies slow to 85% for 1.5 s | slow |
| ★ Siphon | Overdraw | drained enemies take +5% damage for 1.5 s | vulnerable |
| ★ Tether | Taut Line | grappled enemies take +5% damage for 3 s | vulnerable |
| Gravitron | Event Horizon | pulled enemies take +6% damage for 2 s | vulnerable |
| Cyclone | Downdraft | thrown flyers slow to 80% for 1.5 s | slow |
| Amber | Fault Lines | shatter bonus +50% → +65% | `bonus` |
| Shrink Ray | Lasting Shrink | shrink lasts 5 s instead of 4 s | `duration` |
| Magnetar | Strong Field | drag radius 1.6 → 1.9 cells | `radius` |
| Mesmer | Lingering Daze | hit enemies slow to 85% for 2.5 s, outlasting the confusion | slow |
| Hex | Deep Curse | echo 40% → 50% of the damage taken | `share` |
| Plasma | Long Burn | pools burn 5 s instead of 4 s | `duration` |

#### Traps

| Tower | Mod | Effect | Mechanism |
| --- | --- | --- | --- |
| Mine | Shaped Charge | blast radius 1.1 → 1.3 cells | `radius` |
| Caltrops | Hobble | bleeding walkers slow to 90% for 4 s | slow |
| Tar Pit | Sticky Residue | the slow holds 2.5 s instead of 1.5 s after leaving the pit | `duration` |
| Bear Trap | Torn Tendon | caught enemies take +8% damage for 2 s | vulnerable |
| Pitfall | Wider Mouth | swallows enemies up to size 0.24 instead of 0.2 | `size` |
| Flame Grate | White Heat | burn 3× → 3.6× the hit | `ratio` |
| Oil Slick | Slick Coat | oiled walkers slow to 85% for 4 s | slow |
| Barricade | Reinforced | 320 → 400 HP | `hp` |
| Sticky Mine | Short Fuse | detonates after 1.5 s instead of 2 s | `fuse` |
| Spring | Hard Landing | thrown enemies take +6% damage for 2 s | vulnerable |
| Harpoon | Barbed Head | pins flyers 4 s instead of 3 s | `duration` |
| Arc Plate | Grounded Coil | 4 jumps instead of 3 | `jumps` |
| Grinder | Chew | grazed walkers slow to 85% for 1 s, so they stand on the blades longer | slow |
| Warp Pad | Deep Warp | sends 5 cells back instead of 4 | `cells` |
| Tripwire | Long Wire | reloads towers within 3 cells instead of 2.5 | `radius` |

Trap mods never change a trap's trigger radius (`range`), as the trap rules require.

#### Support

| Tower | Mod | Effect | Mechanism |
| --- | --- | --- | --- |
| ★ Aura | Wide Field | +15% aura radius | `range` |
| ★ Detector | Long Sight | +20% detection radius | `range` |
| ★ Refinery | Dividend | 25 → 30 credits per completed wave | `amount` |
| Bounty Beacon | Finder's Fee | kills in its radius pay +60% instead of +50% | `bonus` |
| Tracker | Painted Target | marked enemies take +18% instead of +15% | `amount` |
| Workshop | Master Tools | upgrades in its radius cost 25% less instead of 20% | `amount` |
| Repair Dock | Spare Cells | restores 2 reactor energy per wave instead of 1 (still capped at the start) | `amount` |
| Vault | Compound Interest | interest cap 40 → 55 credits | `cap` |
| Fire Control | Hot Rounds | crits deal 3× instead of 2.5× | `multiplier` |
| Armory | AP Rounds | hits ignore 60% of armor instead of 50% | `fraction` |
| Skylink | Sky Lock | ground towers hit flyers at 70% instead of 60% | `factor` |
| Nexus | Wider Net | counts up to 7 tower types instead of 6 | `cap` |
| Overclock | Long Burst | the burst lasts 4 s instead of 3 s per 10 s | `window` |
| Recycler | Long Chain | overkill jumps 2.6 cells instead of 2 | `reach` |
| Shield Generator | Hardened Cells | absorbs 4 reactor damage per wave instead of 3 | `amount` |

Parameter values are read from the definitions at build time (`mapParam` scales the base value), so a later
re-tune of a tower carries over. The table shows today's base values.

The ceiling for one tower is about +8% damage, +5–10% range, cheaper early levels and one small effect. That is
meaningful but bounded, and the campaign stays recognisable.

A full gear set costs 1,670 Salvage per tower, and about 100,000 for all 60. That's a long-tail goal for replays,
not something to finish.

## Implementation outline

1. **Content:** `content/arsenal.ts` with `CORE_KIT`, `ARSENAL_TREE` (branch, tier, tower, dossier), tier gates,
   `SALVAGE`, `VETERANCY`, `GEAR` (marks and effects) and the signature mods. Validation: every researchable tower
   has a branch, a tier and a dossier.
2. **Pure logic:** `campaign/arsenal.ts`:
   - `salvageOf(mission, result, firstWin, bounty)`, `dailyBounty(date, openMissions)`;
   - `research`/`canResearch`, `veterancy(xp)`, `canForge`/`forge`;
   - `campaignTowers(mission, arsenal, content)` (the Detector exception lives here);
   - `gearTransform(arsenal)`, built from the `run/transform.ts` steps;
   - focused tests for each.
3. **Storage:** `ion-bastion:arsenal` `{ v, salvage, researched, xp, gear }`, kept apart from the star record.
   Unknown ids are dropped.
4. **Loading:** a `campaign` command, next to the `run` command (solo only, else `campaign-solo`), loads a mission
   with an active pack (`Game.content`) built inside `Game` from the base pack plus the serialised arsenal (`towers`,
   `gear`), so commands stay plain data. `state` gains nothing. The win check in `main.ts` compares against the base
   definition by id, so wins and stars still record. Restart keeps the pack.
5. **Settling:** `main.ts` builds the mission result on `end`: waves cleared, kills per tower type and assists (reusing
   `app/run-result.ts`), then credits Salvage and XP and shows them on the overlay.
6. **UI:**
   - an `/#arsenal` page (`MenuPage` `"arsenal"`, lazy-loaded) with two tabs: **Research** (four branch columns) and
     **Gear** (each owned tower with rank, XP bar, marks and the next mark's price). In the fitted layout each branch
     is a swipe shelf.
   - Home page: an Arsenal button with a dot when something is affordable, and the daily bounty line.
   - Atlas: a bounty badge on the station, and the briefing's Salvage estimate.
   - Win and lose overlays: "+184 Salvage · Lance +38 XP · Rank up: Pulse 3".
   - Codex: unresearched towers locked with their dossier; owned towers show rank and gear.
   - Build menu: a small Mk badge on geared towers.
7. **CLAUDE.md:** the Arsenal section, the storage key and the `campaign` command.

No balance script, strategy, golden file or mission check changes.

## Settled

- **Research is permanent:** no refunds.
- **A loss pays half** of its cleared waves' Salvage, with no victory bonus.
- **Signature mods:** all 60 are planned (tables above). The 19 marked ★ are built first, the other 41 in a second batch.
- **Research gates:** Salvage only. There are no campaign-progress gates and no prerequisites.
- **Circuit:** no research and no gear. Circuit keeps every tower at base stats.
