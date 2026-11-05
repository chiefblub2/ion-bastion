# Campaign Arsenal: research towers, level up your gear

## Problem

The campaign starts with all 60 towers and every upgrade open: only 10 of 60 campaign missions set `availableTowers`,
so mission 1 hands a new player four tabs of towers. Winning a mission earns the next mission and nothing else, and
replaying a mission earns nothing at all. There is no sense of a growing arsenal and no reason to go back.

## Decisions (designer's calls)

| Question | Decision |
| --- | --- |
| Unlock model | **Earned tech tree**: the player researches towers of their choice. |
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
| Wave cleared | `1 + sector` per wave (sector I: 2, sector XII: 13) | Won or lost; on a loss, the waves before the loss. Later sectors pay more, so farming the frontier beats farming mission 1. |
| Victory | +10 | Every win, replays included. |
| First victory | +20 + 5 × sector | Once per mission (derived from the star record: the mission was not won before). |
| Daily bounty | ×2 on everything above | One campaign mission per day, picked from the open ones by a date seed (as `run/daily.ts` does). It's shown on the home page and in the atlas with a bounty badge. |

**Rough scale:** about 1,000 waves in the 60 campaign missions × an average of 7.5 Salvage, plus the victory
bonuses, gives about 10,500 Salvage for one clean pass. That's about 85% of the tree (12,390). The rest of the tree
and all the gear come from replays.

Runs started with `&wave=` or `&credits=` and playtests pay nothing. This reuses the existing "unmodified
definition" check in `main.ts`.

## The research tree (content)

There are four branches, one per build tab (`pageOf`), with four tiers each. A tower needs any one researched tower
of the tier below in its branch; the core towers count as tier 0. Tiers open with the campaign:

| Tier | Opens | Price |
| --- | --- | --- |
| I | from the start | 60 Salvage |
| II | Core Fortress (05) won | 150 Salvage |
| III | Ashkar reached (sector V open) | 250 Salvage |
| IV | Thessaly Prime reached (sector IX open) | 400 Salvage |

| Branch | Tier I | Tier II | Tier III | Tier IV |
| --- | --- | --- | --- | --- |
| **Attack** (core: Pulse, Nova, Flak, Tesla) | Lance, Ember | Decay, Shrapnel, Executioner | Mortar, Quake, Focus, Skyburst | Catalyst, Orbital |
| **Control** (core: Cryo) | Corrosion, Stasis | Snare Net, Jammer, Siphon, Tether | Gravitron, Cyclone, Amber, Shrink Ray | Magnetar, Mesmer, Hex, Plasma |
| **Traps** | Mine, Caltrops, Tar Pit | Bear Trap, Pitfall, Flame Grate, Oil Slick | Barricade, Sticky Mine, Spring, Harpoon | Arc Plate, Grinder, Warp Pad, Tripwire |
| **Support** (core: Aura) | Detector, Refinery | Bounty Beacon, Tracker, Workshop, Repair Dock | Vault, Fire Control, Armory, Skylink | Overclock, Recycler, Nexus, Shield Generator |

The placement follows four rules:
- Tier I holds the towers the early sectors' focus lines name (Lance in Icebreaker, Ember in Cryo Valley, Corrosion
  in Seepage Pit), so a player who follows the briefings researches in step with the campaign.
- Each branch climbs from plain to combo towers (Catalyst, Hex, Oil Slick, Nexus and Recycler need other towers to
  shine).
- Anti-air variety is spread out (Snare Net II, Skyburst III, Cyclone III, Harpoon III, Skylink III), while Flak stays
  core.
- The Detector sits in tier I, so a player who wants it outside stealth missions can have it early.

The whole tree costs 12,390 Salvage (Attack 2,370 · Control 3,320 · Traps 3,380 · Support 3,320).

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

**Signature mods (Mk V)** give each tower a small effect none of its paths grant, like the Run's `MASTERY` (Concussion,
Static Charge and Tracer Rounds already exist for Nova, Tesla and Pulse). Each effect is bounded and deals no damage of
its own. The first content wave covers the six core towers plus the twelve tier I and II attack and control towers;
the rest show "Mk V: signature in a later update" and get +4% damage meanwhile. Proposed examples:

- **Flak** "Proximity Fuse": hits splash 20% to flyers within 0.5 cells.
- **Cryo** "Deep Chill": slowed enemies take 5% more damage.
- **Aura** "Resonance": +1 tower counted for Nexus-style bonuses inside its radius.
- **Lance** "Overpenetration": the beam's last target takes +15%.

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

## Open questions

- **Refund:** can research be refunded? Recommendation: no. With Salvage from every play, mistakes are cheap to
  recover.
- **Losses:** should a loss pay the full wave Salvage or half? Recommendation: full.
- **Signature mods:** write all 60 now, or 18 in the first wave as proposed?
- **Gear outside the campaign:** should gear also apply in Circuit? Recommendation: no, Circuit stays the base-stat
  sandbox.
