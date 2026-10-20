# ION BASTION

Tower defense in the browser, built with TypeScript, Phaser 3 and Vite. <!-- counts:start -->73 missions in 15 sectors<!-- counts:end --> with their own maps, waves and terrain styles, over thirty towers and <!-- counts:start -->71 enemy types<!-- counts:end --> on the ground and in the air. Play solo or with 2–4 players in co-op or versus mode.

![Mission 54 Ember Chamber in the Volcano Chain sector, first wave: Ember Runners in the windings and the first towers](docs/images/screens/glutkammer.png)

The game runs entirely in the browser; only multiplayer needs a small relay server. Saves live in memory on purpose: reloading restarts the current mission (it is in the address, `?mission=<id>`), and `/` leads to the start screen. The browser only remembers the last mission you started, which the start screen offers as "Restart Last Mission" (from wave 1; it is not a saved game), and your best result per won mission.

## Quick start

Requirements: Node.js 22 or newer, [Git LFS](https://git-lfs.com) (art PNGs are stored in LFS).

```sh
git lfs install  # once per machine, before cloning
npm ci
npm run dev      # game on http://localhost:4173
npm test         # tests
npm run build    # production build to dist/
```

Notes for developers and AI agents (architecture, conventions, adding content) are in [CLAUDE.md](CLAUDE.md).

## How it works

Enemies walk a fixed path to the reactor. If one reaches the reactor, it costs reactor energy; at 0 the mission is lost. Between and during waves you build towers next to the path and upgrade them. You start the first wave yourself; after that the next wave starts by itself 3 seconds after the previous one ends (earlier with `N`, without a bonus). Defeated enemies pay credits, and every wave you survive pays a bonus. Selling refunds 70 % of the total investment.

New players can start with **Training** (home page, or `?mission=training`): a short guided mission outside the campaign where a coach walks through the reactor, building, starting a wave, earning credits and upgrading. Waves there only start when you say so.

## Screenshots

Every sector has its own terrain. In the Circuit (bottom right) there is no reactor: enemies circle until they are defeated.

<table>
  <tr>
    <td><img src="docs/images/screens/kernfestung.png" alt="Mission Core Fortress"><br><sub>Core Fortress · Border Zone</sub></td>
    <td><img src="docs/images/screens/polarnacht.png" alt="Mission Polar Night"><br><sub>Polar Night · Frost Belt</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/screens/korallengraben.png" alt="Mission Coral Trench"><br><sub>Coral Trench · Deep Sea</sub></td>
    <td><img src="docs/images/screens/glasebene.png" alt="Mission Glass Plain"><br><sub>Glass Plain · Dune Sea</sub></td>
  </tr>
  <tr>
    <td><img src="docs/images/screens/kristallherz.png" alt="Mission Crystal Heart"><br><sub>Crystal Heart · Crystal Cave</sub></td>
    <td><img src="docs/images/screens/doppelschleife.png" alt="Mission Double Loop"><br><sub>Double Loop · Circuit</sub></td>
  </tr>
</table>

## Controls

`http://localhost:4173/?mission=<id>` opens a mission directly, for example `?mission=korallengraben`.

| Input | Action |
| --- | --- |
| Pick a tower, click a free tile | Build. Build mode ends afterwards; Shift+click builds more towers of the same type. |
| Click a built tower | A card beside it offers the upgrade (or the path choice), the target priority and selling; the sidebar shows the full details |
| Click an enemy | Show hit points, shield, traits and active effects |
| `T` | Cycle the target priority of the selected tower |
| `U` | Buy the next upgrade of the selected tower (next level, or the next tier once a path is chosen; a path choice stays with the buttons) |
| `M` | Sound on or off |
| `C` | Show every tower's range and the path coverage (red: no tower reaches ground units there) |
| Tabs Attack · Control · Traps · Support, `Shift`+`1`–`4` | Switch the tower page (from ten available towers; arrow keys also work on the tabs) |
| `1`–`9`, `0`, `Q`, `W`, `E`, `R`, `Y` | Pick a tower in the open tab; every tab starts at `1` again (the key is shown on the card). Without tabs the keys count across all towers. |
| Right click, `Esc` or ✕ | Cancel build mode and selection. Without a selection, `Esc` leaves fullscreen. |
| `N` | Start the next wave (in versus: "Ready"). From wave 2 on it also starts by itself 10 s after the previous one ends. |
| Space | Pause, only during a wave or the countdown and not in versus |
| `F` or ⛶ | Fullscreen. On phones it also works without browser support (iPhone) and fits board and towers side by side; phones play in landscape only, and a selected tower shows its upgrades in place of the tower list; "Add to Home Screen" launches the game without browser bars. |
| Arrow keys + Enter | Keyboard control on the focused battlefield |

Switching tabs pauses a solo game automatically. Sound is off by default: turn it on with the Sound button (top bar or home page), where four sliders set the volumes. The same panel has a Bloom switch for the soft light, the reactor-hit flash and the strike shake (on by default on a desktop, off on phones and tablets; turn it off on a slow device). Both choices are remembered. The music is a procedural synthwave soundtrack that follows the game, not your towers: the enemies drive the drum machine and the bass, danger to the reactor darkens the mood, later waves fill out the harmony, and a boss or a crowded field brings in the lead. Towers have their own quiet shot sounds, kept level however many fire.

## Multiplayer (2–4 players)

Start in two terminals in the project folder:

```sh
npm run server   # relay on ws://0.0.0.0:4174 (PORT=… overrides the port)
npm run dev      # game on http://0.0.0.0:4173
```

**Host**

1. Open `http://localhost:4173`.
2. On the start screen choose "Multiplayer" → "Create Room". Send the four-letter room code (e.g. `KJSK`) to the other players.
3. Optionally "Change Mission"; you then return to the lobby. Without a choice, the currently loaded mission starts.
4. Choose a mode and "Start mission" once enough players are in the room. Everyone then switches to the game.

**Players**

1. Open the game from the host's machine: `http://<host-IP>:4173`.
2. "Multiplayer" → "Join Room" → enter the room code → "Join". The host's code can be copied with "Copy code".
3. Wait until the host starts the mission. You see the mode when it starts.

**Modes**

| Mode | Players | Rules |
| --- | --- | --- |
| Co-op | 2–4 | Shared map and reactor energy, separate credits. Starting credits, kill bounties and wave bonuses are split; Refineries pay their owner. Together you earn exactly as much as a solo player. Towers belong to their builder (colored corner: blue, amber, green, magenta); only the builder can upgrade and sell them. |
| Race | 2–4 | Everyone defends their own copy of the mission with full starting credits. Waves start for everyone at the same time once everyone has pressed "Ready", after 30 s at the latest. There is no break. The last player to hold their reactor wins. If several survive all waves, reactor energy decides, then the number of kills. |
| Siege | 2–4 | Like Race. In addition, under "Send" you send enemies into the field of the next player who is still in the game. That costs four times the kill bounty. You can only send enemy types that have already appeared in a wave. Sent enemies pay the defender no bounty. |

Circuit missions run in multiplayer as co-op only: everyone defends the same ring, the enemy limit applies to all together, and anyone can call the next wave early.

In all modes the host decides mission, restart and speed. Dialogs and tab switches do not pause in multiplayer.

**Troubleshooting**

- **"No relay reachable …":** `npm run server` is not running, or a firewall blocks port 4174.
- **Relay on another machine or port:** `http://<IP>:4173/?server=ws://<relay-IP>:4174`. Without this, the game connects to port 4174 on the machine that serves the page.
- **Hosted version** (`https://chiefblub2.github.io/ion-bastion/`, deployed by `.github/workflows/pages.yml` on every push to `main`): GitHub Pages cannot run the relay, so solo works out of the box and multiplayer needs a relay reachable over TLS, either per link (`?server=wss://<relay-host>`) or built in through the repository variable `RELAY_URL`. Without either, the Multiplayer page there explains this (the build sets `VITE_STATIC_HOST`).
- **"The room is full …":** A room has four seats. Nobody can join after the mission has started.
- **A player leaves the room:**
  - The game stops and the remaining players move up. If the host leaves, the next player becomes host and can relaunch.
  - "Leave Room" continues the mission alone.
  - Reconnecting is not supported yet.

## Missions

The game opens on the start screen with one primary button ("Start Playing" on a first visit, "Resume Game" while a game is in memory, "Restart Last Mission" after a reload), Campaign, Circuit, Multiplayer, Enemy Codex, Tower Codex (every tower with cost, targets, levels 1–5 and its paths) and How to Play, beside a map of the mission the button is about; each item is its own page with "← Back", and the browser's back button works too. Under "Campaign" and "Circuit" the Sector Atlas lists every sector as an image card; picking a sector shows its missions on a rail below a large preview of the battlefield and the mission briefing, and "Start Mission" launches the selected one. In the game, "Menu" returns to the start screen and pauses the running wave; "Resume Game" resumes it. After a win, "Next mission" moves on. Every win earns 1–3 stars (90 % reactor energy left for three, 50 % for two; on a ring, never more than half, or 80 %, of the limit alive at once); the atlas shows the best per mission and the cleared count per sector. Every mission stays open regardless.

<!-- missions:start -->
| No. | Mission | Focus | Map | Waves | Credits | HP/Wave |
| --- | --- | --- | --- | --- | --- | --- |
| **I** | **Border Zone** | | | | | |
| 01 | Outpost 07 | Build at bends | 18 × 12 | 10 | 240 | 14 % |
| 02 | Lock Ring | Inner bends, let towers fire repeatedly | 18 × 12 | 10 | 280 | 45 % |
| 03 | Shard Field | Build islands, overlapping ranges | 18 × 12 | 12 | 320 | 60 % |
| 04 | Ember Pass | Slow fast enemies with Cryo | 18 × 12 | 12 | 340 | 45 % |
| 05 | Core Fortress | Spiral with three defense zones | 18 × 12 | 15 | 400 | 65 % |
| **II** | **Frost Belt** | | | | | |
| 06 | Icebreaker | Long straights for the Lance | 22 × 11 | 13 | 380 | 72 %¹ |
| 07 | Cryo Valley | Cryo slows, Ember keeps burning | 18 × 12 | 13 | 400 | 58 % |
| 08 | Crevasse | Tight zigzag for Tesla | 18 × 12 | 14 | 420 | 66 %¹ |
| 09 | Polar Night | Glider swarms, anti-air | 18 × 12 | 14 | 440 | 75 % |
| 10 | Frostwall | Finale: two Titans, Decay | 18 × 13 | 15 | 460 | 72 % |
| **III** | **Acid Moor** | | | | | |
| 11 | Seepage Pit | Corrosion strengthens all towers | 18 × 12 | 13 | 420 | 70 % |
| 12 | Fog Swamp | Stasis halts groups | 21 × 12 | 13 | 440 | 80 % |
| 13 | Brackish Water | Only Pulse, Cryo, Corrosion, Flak | 16 × 12 | 14 | 440 | 86 % |
| 14 | Digester Tower | Spiral around the reactor, Aura clusters | 17 × 13 | 14 | 480 | 86 % |
| 15 | Toxic Cauldron | Finale: Tank waves, Corrosion and Decay | 20 × 12 | 15 | 500 | 88 % |
| **IV** | **Orbital Deck** | | | | | |
| 16 | Docking Ring | Build Refineries early | 18 × 12 | 14 | 460 | 80 % |
| 17 | Cargo Lock | Scarce starting credits | 16 × 11 | 14 | 290 | 82 % |
| 18 | Zero-G | Mostly air attacks | 18 × 12 | 15 | 480 | 83 % |
| 19 | Solar Sail | Wide station, long route | 22 × 10 | 15 | 510 | 90 % |
| 20 | Command Bridge | Finale with the full enemy mix | 20 × 12 | 16 | 540 | 90 % |
| **V** | **Ruined City** | | | | | |
| 21 | Rubble Avenue | Few build spots between rubble | 18 × 12 | 15 | 480 | 80 % |
| 22 | Bunker Line | Only Pulse, Nova, Cryo, Flak | 18 × 11 | 15 | 500 | 92 % |
| 23 | Cathedral | Short path, 15 reactor energy | 18 × 12 | 15 | 520 | 88 % |
| 24 | Elevated Rail | Sprinter swarms on long straights | 22 × 11 | 16 | 540 | 92 % |
| 25 | Citadel | Finale: two Titans at once | 20 × 13 | 16 | 580 | 90 % |
| **VI** | **Singularity** | | | | | |
| 26 | Event Horizon | Only 10 reactor energy | 18 × 12 | 16 | 520 | 90 % |
| 27 | Rift | Very short path, compact map | 15 × 10 | 16 | 560 | 95 % |
| 28 | Time Loop | Single waves with HP spikes | 18 × 12 | 17 | 580 | 110 %¹ |
| 29 | Zero Point | No Aura or Refinery, hard Tanks | 18 × 12 | 18 | 590 | 105 % |
| 30 | Core of the Singularity | Finale: 20 waves, three Titans | 20 × 13 | 20 | 650 | 110 % |
| **VII** | **Dune Sea** | | | | | |
| 31 | Quicksand | Armored Scarabs, force instead of spray fire | 16 × 10 | 16 | 600 | 110 % |
| 32 | Caravan Road | Burrowers dive, traps catch them | 16 × 11 | 17 | 620 | 102 % |
| 33 | Glass Plain | Only traps, Nova, Cryo and Flak | 16 × 10 | 16 | 700 | 105 % |
| 34 | Storm Crest | Only 10 reactor energy | 18 × 11 | 18 | 650 | 108 % |
| 35 | Oasis Zero | Finale: echo waves, two Titans | 18 × 11 | 19 | 700 | 112 %¹ |
| **VIII** | **Deep Sea** | | | | | |
| 36 | Continental Shelf | Armor Crabs with burst, Executioner and Pitfall break them | 16 × 9 | 17 | 650 | 110 % |
| 37 | Coral Trench | Healing Jellyfish in the air, Flak | 15 × 11 | 18 | 670 | 110 % |
| 38 | Pressure Chamber | Tight spiral, 10 reactor energy, echo waves | 15 × 11 | 18 | 690 | 110 %¹ |
| 39 | Black Smoker | Phantoms, no Aura or Refinery | 11 × 14 | 18 | 700 | 110 % |
| 40 | Abyss | Finale: all Deep Sea enemies, three Titans | 20 × 13 | 20 | 750 | 110 %¹ |
| **IX** | **Storm Front** | | | | | |
| 41 | Heat Lightning | Gust Runners race in bursts, slows and traps | 16 × 9 | 17 | 680 | 120 %¹ |
| 42 | Hailfield | Stormbirds, only 10 reactor energy | 15 × 11 | 18 | 700 | 110 %¹ |
| 43 | Lightning Rod | No Lance, Focus or Gravitron | 15 × 11 | 18 | 710 | 110 % |
| 44 | Gust Corridor | Echo waves in narrow alleys | 11 × 14 | 18 | 730 | 120 %¹ |
| 45 | Eye of the Storm | Finale: three Titans | 20 × 13 | 20 | 780 | 120 %¹ |
| **X** | **Jungle** | | | | | |
| 46 | Vine Trail | Swarm Ants, area damage thins them out | 15 × 9 | 18 | 720 | 240 % |
| 47 | Temple Steps | Regenerating Colossi, echo waves | 13 × 9 | 19 | 750 | 100 %¹ |
| 48 | Mangrove Swamp | Only area and force towers | 11 × 10 | 18 | 770 | 80 % |
| 49 | Snake Pit | Only 10 reactor energy | 14 × 11 | 18 | 790 | 100 % |
| 50 | Heart of the Jungle | Finale: three Titans | 15 × 13 | 20 | 820 | 58 %¹ |
| **XI** | **Volcano Chain** | | | | | |
| 51 | Ashfield | Ember Runners race at low HP, Cryo and Executioner | 11 × 7 | 18 | 760 | 100 %¹ |
| 52 | Lava Flow | Ash Wings in the air, echo waves | 14 × 9 | 18 | 780 | 100 %¹ |
| 53 | Slag Ridge | No Cryo, Stasis, Tar Pit or Bear Trap | 14 × 9 | 19 | 800 | 110 %¹ |
| 54 | Ember Chamber | Only 10 reactor energy | 14 × 11 | 19 | 830 | 110 %¹ |
| 55 | Volcano Throat | Finale: three Titans | 15 × 13 | 20 | 860 | 120 %¹ |
| **XII** | **Crystal Cave** | | | | | |
| 56 | Quartz Gallery | Crystal Wardens harden in rhythm, Ember burns through | 14 × 8 | 18 | 800 | 120 % |
| 57 | Hall of Mirrors | Shard Moths split into Gliders, echo waves | 13 × 10 | 20 | 820 | 120 %¹ |
| 58 | Geode Chamber | Only 10 reactor energy | 12 × 9 | 18 | 840 | 100 % |
| 59 | Prism Shaft | Phantoms, no Aura or Refinery | 10 × 10 | 18 | 860 | 100 % |
| 60 | Crystal Heart | Finale: three Titans | 14 × 11 | 20 | 880 | 110 %¹ |
| **XIII** | **Circuit** | | | | | |
| 61 | Orbit | Simple ring, max. 30 enemies, a wave every 22 s | 18 × 12 | 25 | 400 | 20 % |
| 62 | Double Loop | A dent merges two lanes, max. 30, every 20 s | 20 × 12 | 25 | 450 | 21 % |
| 63 | Maelstrom | Two dents, max. 35, every 18 s | 20 × 13 | 28 | 500 | 16 % |
| **XIV** | **Gearworks** | | | | | |
| 64 | Ring Gear | Cogwheels speed up the longer they circle, max. 36, every 20 s | 15 × 11 | 25 | 500 | 17 % |
| 65 | Escapement | Piston Tanks harden every lap, max. 32, every 18 s | 21 × 10 | 25 | 550 | 14 % |
| 66 | Balance Wheel | Echo in wave 18, the waist merges four lanes, max. 35, every 16 s | 15 × 11 | 25 | 550 | 27 %¹ |
| 67 | Planet Gear | Only core and control towers, max. 36, every 18 s | 15 × 15 | 25 | 600 | 19 % |
| 68 | Clockwork | Finale: two Titans, max. 34, every 16 s | 15 × 11 | 28 | 600 | 14 % |
| **XV** | **Moon Lake** | | | | | |
| 69 | Ebb | Spray Wings harden every lap, max. 45, every 18 s | 20 × 11 | 25 | 550 | 30 % |
| 70 | Tide Ring | Nautilus: shield and momentum, max. 42, every 17 s | 20 × 11 | 25 | 570 | 25 % |
| 71 | Surf | Long serpentine ring, max. 45, every 16 s | 22 × 12 | 25 | 600 | 20 % |
| 72 | Spring Tide | Short interval, tight limit, max. 35, every 14 s | 20 × 14 | 25 | 620 | 19 % |
| 73 | Lunar Eclipse | Echo wave, finale: three Titans, max. 40, every 16 s | 20 × 13 | 30 | 650 | 22 %¹ |

¹ Individual waves have their own HP factor instead of the linear growth.
<!-- missions:end -->

### Circuit

Circuit is its own game mode with its own tab in the mission picker, separate from the campaign. It has three sectors: Circuit, Gearworks and Moon Lake. Its missions play on closed rings without a reactor:

- You start the first wave yourself. After that a timer starts every further wave, even if the previous one is still running.
- Enemies circle until they fall. They deal no reactor damage.
- If more enemies are in the ring at once than the limit allows, the mission is lost. The "IN RING" display replaces reactor energy.
- With "Wave ▶" or `N` you call the next wave early. Every second saved pays credits; the button shows the bonus.
- Wave bonus and Refinery income arrive when the next wave starts.
- The mission is won when all waves have started and all enemies are defeated.

## Towers

Every enemy moves on the ground or in the air; every attack tower only hits certain layers.

| Tower | Cost | Attack | Targets |
| --- | --- | --- | --- |
| <img src="docs/images/towers/pulse.png" width="36" height="36" alt=""> Pulse | 80 | Single target | Ground · Air |
| <img src="docs/images/towers/blast.png" width="36" height="36" alt=""> Nova | 130 | Area damage | Ground only (including the blast radius) |
| <img src="docs/images/towers/frost.png" width="36" height="36" alt=""> Cryo | 100 | Slow | Ground · Air |
| <img src="docs/images/towers/aura.png" width="36" height="36" alt=""> Aura | 160 | Support, strengthens towers within radius 3 | – |
| <img src="docs/images/towers/flak.png" width="36" height="36" alt=""> Flak | 90 | Single target, fast | Air only |
| <img src="docs/images/towers/skyburst.png" width="36" height="36" alt=""> Skyburst | 140 | Airburst: homing missile bursts on its target, hitting every flyer within 0.9 tiles | Air only (including the blast radius) |
| <img src="docs/images/towers/tesla.png" width="36" height="36" alt=""> Tesla | 150 | Chain lightning: jumps up to 3× to enemies within 1.6 tiles, 75 % damage per jump | Ground · Air |
| <img src="docs/images/towers/lance.png" width="36" height="36" alt=""> Lance | 170 | Pierce: beam up to range 4.4, hits every enemy on the line, 85 % per further hit | Ground · Air |
| <img src="docs/images/towers/inferno.png" width="36" height="36" alt=""> Ember | 120 | Burn: additionally 2.5 times the hit over 3 s | Ground · Air |
| <img src="docs/images/towers/stasis.png" width="36" height="36" alt=""> Stasis | 140 | Stun: pulse in radius 0.9 halts enemies for 0.8 s, then 1.5 s immune | Ground · Air |
| <img src="docs/images/towers/acid.png" width="36" height="36" alt=""> Corrosion | 110 | Weaken: enemies in radius 0.8 take 25 % more damage for 3 s | Ground · Air |
| <img src="docs/images/towers/decay.png" width="36" height="36" alt=""> Decay | 160 | Anti-boss: hit plus 4 % of maximum HP | Ground · Air |
| <img src="docs/images/towers/focus.png" width="36" height="36" alt=""> Focus | 150 | Charge: continuous beam holds its target, every follow-up hit +20 % damage, up to triple | Ground · Air |
| <img src="docs/images/towers/mortar.png" width="36" height="36" alt=""> Mortar | 160 | Artillery: range 5, blast radius 1.3, cannot fire at enemies closer than 1.5 tiles | Ground only |
| <img src="docs/images/towers/quake.png" width="36" height="36" alt=""> Quake | 140 | Close range: shockwave hits all enemies within range 1.8, still 50 % at the edge | Ground only |
| <img src="docs/images/towers/executioner.png" width="36" height="36" alt=""> Executioner | 150 | Execution: enemies below 25 % HP take four times the damage on impact | Ground · Air |
| <img src="docs/images/towers/shrapnel.png" width="36" height="36" alt=""> Shrapnel | 130 | Multi-target: every salvo hits up to 3 different enemies | Ground · Air |
| <img src="docs/images/towers/catalyst.png" width="36" height="36" alt=""> Catalyst | 130 | Synergy: +50 % damage per running effect on the target (slow, burn, stun, weakening, net, disruption, bleeding, …), up to 4; aims at the most affected enemy | Ground · Air |
| <img src="docs/images/towers/jammer.png" width="36" height="36" alt=""> Jammer | 130 | Disruption: pulse in radius 1.1 switches off shield, regeneration, healing, stealth, evasion and leader bonus for 3 s; shields break at once | Ground · Air |
| <img src="docs/images/towers/net.png" width="36" height="36" alt=""> Snare Net | 110 | Air trap: flyers 30 % slower for 3 s and targetable by ground towers like Nova | Air only |
| <img src="docs/images/towers/gravity.png" width="36" height="36" alt=""> Gravitron | 170 | Knockback: pulse in radius 1 pulls enemies back at 1.5 times speed for 0.6 s, then 2.5 s immune; Berserkers resist | Ground only |
| <img src="docs/images/towers/plasma.png" width="36" height="36" alt=""> Plasma | 140 | Area denial: canisters leave a pool of radius 0.85 for 4 s that burns every ground enemy in it for the tower's damage each second, burrowed and stealthed ones too; pools of one tower do not stack | Ground only (also netted flyers) |
<!-- new towers: g1 (Attack+Control A) -->
| <img src="docs/images/towers/orbital.png" width="36" height="36" alt=""> Orbital | 220 | Orbital strike: global range; a beacon paints the spot under the strongest enemy, and 1.4 s after it lands a strike hits every ground enemy within 1.2 tiles there. Fast units can outrun it | Ground only (including the blast radius) |
| <img src="docs/images/towers/mesmer.png" width="36" height="36" alt=""> Mesmer | 150 | Hypnosis: the target walks backwards at its own speed for 1.5 s, then 3 s immune; unstoppable and dampened units resist | Ground · Air |
| <img src="docs/images/towers/amber.png" width="36" height="36" alt=""> Amber | 160 | Encasement: the target stops and is immune for 1.6 s while every hit on it is stored, then the amber shatters for the stored damage +50 %; 3 s immune afterwards | Ground · Air |
| <img src="docs/images/towers/magnetar.png" width="36" height="36" alt=""> Magnetar | 150 | Clustering: pulse drags every enemy within 1.6 tiles of the target up to 0.8 tiles along the path towards it, without pushing the group back | Ground · Air |
| <img src="docs/images/towers/cyclone.png" width="36" height="36" alt=""> Cyclone | 140 | Air knockback: gust in radius 1.1 throws flyers back at 1.6 times speed for 0.6 s, then 2.5 s immune | Air only |
<!-- end g1 -->
<!-- new towers: g2 (Control B) -->
| <img src="docs/images/towers/tether.png" width="36" height="36" alt=""> Tether | 130 | Linking: grapples an enemy and links it with the 2 nearest within 1.4 tiles for 3 s; a slow, stun or burn on one reaches all of them (spread effects never spread again), and none walks faster than the slowest one still walking forward | Ground · Air |
| <img src="docs/images/towers/shrink.png" width="36" height="36" alt=""> Shrink Ray | 140 | Shrink: beam shrinks the biggest enemy in range for 4 s to 60 % size (Pitfall then swallows big units), half its armor, and it leaks 1 reactor energy less (at least 1) | Ground · Air |
| <img src="docs/images/towers/hex.png" width="36" height="36" alt=""> Hex | 150 | Curse: 3 s after the hit the enemy takes 40 % of all damage it took meanwhile once more; echoes are never echoed; prefers uncursed enemies | Ground · Air |
| <img src="docs/images/towers/siphon.png" width="36" height="36" alt=""> Siphon | 150 | Drain beam: slows 25 % for 1.5 s; every slowed, stunned or pulled enemy within its range gives attack towers within 2.2 tiles of the Siphon +6 % fire rate, up to 5 enemies | Ground · Air |
<!-- end g2 -->
| <img src="docs/images/towers/refinery.png" width="36" height="36" alt=""> Refinery | 120 | 25 credits after every wave, no attack | – |
| <img src="docs/images/towers/detector.png" width="36" height="36" alt=""> Detector | 90 | Reveals stealthed enemies within radius 3.5, no attack of its own | – |
| <img src="docs/images/towers/beacon.png" width="36" height="36" alt=""> Bounty Beacon | 100 | Kills within radius 2.5 pay 50 % more credits (several Beacons do not stack), no attack | – |
| <img src="docs/images/towers/dock.png" width="36" height="36" alt=""> Repair Dock | 150 | Restores 1 reactor energy after every wave, up to the starting value; not in the Circuit | – |
| <img src="docs/images/towers/tracker.png" width="36" height="36" alt=""> Tracker | 140 | Enemies within radius 2.2 take 15 % more damage, on top of Corrosion, no attack | – |
<!-- new towers: g4 (Support A) -->
| <img src="docs/images/towers/overclock.png" width="36" height="36" alt=""> Overclock | 150 | Burst: every 10 s, towers within radius 2.2 fire twice as fast for 3 s; several Overclocks share one rhythm and do not stack, no attack | – |
| <img src="docs/images/towers/firectl.png" width="36" height="36" alt=""> Fire Control | 140 | Criticals: every 4th shot of each tower within radius 2.2 deals 2.5 times the damage, no attack | – |
| <img src="docs/images/towers/armory.png" width="36" height="36" alt=""> Armory | 130 | Armor pierce: hits of towers within radius 2.2 ignore 50 % of armor (stacks with Armor Pierce, not with other Armories), no attack | – |
| <img src="docs/images/towers/skylink.png" width="36" height="36" alt=""> Skylink | 170 | Air uplink: flyers within radius 2.5 become targets for ground-only towers (Mortar, Nova, Quake; not traps), whose direct hits deal 60 % damage to them, no attack | – |
| <img src="docs/images/towers/nexus.png" width="36" height="36" alt=""> Nexus | 160 | Synergy: towers within radius 2.2 deal 4 % more damage per different attack tower type in the radius, up to 6 types, no attack | – |
<!-- end g4 -->
<!-- new towers: g5 (Support B) -->
| <img src="docs/images/towers/workshop.png" width="36" height="36" alt=""> Workshop | 120 | Upgrades of towers within radius 2.5 cost 20 % less (several Workshops do not stack, never on another Workshop), no attack | – |
| <img src="docs/images/towers/vault.png" width="36" height="36" alt=""> Vault | 130 | After every wave its owner earns 5 % interest on the credits left at the wave's end (before the wave bonus), at most 40; only your best Vault pays, no attack | – |
| <img src="docs/images/towers/shieldgen.png" width="36" height="36" alt=""> Shield Generator | 160 | Absorbs the first 3 reactor damage of every wave, then recharges; generators add up; not in the Circuit | – |
| <img src="docs/images/towers/recycler.png" width="36" height="36" alt=""> Recycler | 140 | Overkill damage of a kill within radius 2.5 jumps to the nearest enemy within 2 cells, once (never again from that jump), no attack | – |
<!-- end g5 -->

Nova, Mortar, Flak, Skyburst, Cryo, Executioner, Shrapnel, Catalyst, Plasma and Snare Net fire projectiles that take time; fast enemies can dodge Nova rockets. Tesla, Lance, Focus, Quake, Gravitron and Jammer hit instantly.

### Traps

You build traps directly on free path tiles (not on the entry or the reactor). They trigger as soon as a ground enemy walks onto their tile, even a stealthed one. Flyers pass over them. After triggering they reload; a light shows when they are armed again. Traps have the five levels of the attack towers, but their trigger radius stays the same.

| Trap | Cost | Effect | Level 4 / 5 |
| --- | --- | --- | --- |
| <img src="docs/images/towers/mine.png" width="36" height="36" alt=""> Mine | 70 | Explosion with 80 damage in radius 1.1, 5 s reload | Radius 1.3 / 1.5 |
| <img src="docs/images/towers/spikes.png" width="36" height="36" alt=""> Caltrops | 60 | Bleed: for 4 s, 12 damage per further tile walked; held or pushed-back enemies do not bleed | 15 per tile / 18 per tile, 5 s |
| <img src="docs/images/towers/tar.png" width="36" height="36" alt=""> Tar Pit | 60 | Enemies walk at 45 % speed for 1.5 s | 40 % for 2 s / 30 % for 2.5 s |
| <img src="docs/images/towers/snare.png" width="36" height="36" alt=""> Bear Trap | 90 | Holds enemies for 1.5 s, then 2.5 s immune, 4 s reload | 1.8 s / 2.2 s, bigger grip |
| <img src="docs/images/towers/grill.png" width="36" height="36" alt=""> Flame Grate | 80 | Burn: three times the hit over 3 s | 3.5 times / 4 times over 4 s |
| <img src="docs/images/towers/spring.png" width="36" height="36" alt=""> Spring | 100 | Throws enemies back along the path, then 3 s immune; Berserkers resist | further / even further |
| <img src="docs/images/towers/limpet.png" width="36" height="36" alt=""> Sticky Mine | 90 | Attaches a bomb to the enemy: 70 damage in radius 1.2 after 2 s, or at once when the carrier dies; chain reactions possible | Radius 1.4 / 1.6, fuse 1.5 s |
| <img src="docs/images/towers/pit.png" width="36" height="36" alt=""> Pitfall | 120 | Swallows small enemies (Drone, Sprinter, Ice Strider, Phantom, Phase Runner, Packwolf, Jump Beetle, Rubble Swarm) at once, no matter how much HP; larger ones take 60 damage; 6 s to cover up | also Medic, Shield Bearer, Shard, Sludge, Prism Runner, Salamander, Martyr, Pioneer / also Tank, Null-Field Carrier |
| <img src="docs/images/towers/tripwire.png" width="36" height="36" alt=""> Tripwire | 110 | On triggering, instantly reloads all attack towers within radius 2.5; 6 s to re-tension | Radius 3 / 3.5 |
<!-- new towers: g3 (Traps) -->
| <img src="docs/images/towers/barricade.png" width="36" height="36" alt=""> Barricade | 100 | Blocks its tile: ground enemies halt and chew through 320 wall HP (bigger ones faster) while its spikes hit them; whole again after every wave; Berserkers smash through, flyers and burrowers pass | 720 HP / 950 HP (420 and 540 at levels 2 and 3) |
| <img src="docs/images/towers/warp.png" width="36" height="36" alt=""> Warp Pad | 130 | Sends a ground enemy up to Tank size 4 tiles back, once per enemy; Berserkers and Titans resist; 2.5 s to recharge | 5 tiles, up to Commander size / 6 tiles, up to Nautilus size |
| <img src="docs/images/towers/arc.png" width="36" height="36" alt=""> Arc Plate | 110 | Floor lightning: 24 damage to the walker, then 3 jumps within 1.6 tiles that also reach flyers and stealthed enemies | 4 jumps over 1.8 tiles / 5 jumps over 2 tiles, less loss |
| <img src="docs/images/towers/oil.png" width="36" height="36" alt=""> Oil Slick | 70 | Coats enemies in oil for 4 s: burns on them deal double and leap to oiled enemies within 1.2 tiles; Plasma pools set them alight | 2.3 times, 1.4 tiles / 2.6 times, 1.6 tiles, 5 s |
| <img src="docs/images/towers/grinder.png" width="36" height="36" alt=""> Grinder | 90 | Hits everything on its tile; enemies that stand still (held, stunned, pulled, blocked) take up to four times the damage | up to 4.5 times / up to 5 times |
| <img src="docs/images/towers/harpoon.png" width="36" height="36" alt=""> Harpoon | 120 | The only trap that hits flyers (and only them): pins a flyer for 1 s and nets it for 3 s, so ground towers and traps can hit it | 1.3 s pin, 3.5 s net / 1.6 s pin, 4 s net |
<!-- end g3 -->

**Attack towers** have five levels:

| Level | Cost (× build cost) | Damage | Range | Fire interval |
| --- | --- | --- | --- | --- |
| 2 | 0.9 | × 1.65 | + 0.3 | × 0.9 |
| 3 | 1.5 | × 2.72 | + 0.6 | × 0.81 |
| 4 | 3.0 | × 4.8 | + 0.8 | × 0.66 |
| 5 | 4.5 | × 7.0 | + 1.0 | × 0.6 |

Levels 4 and 5 are expensive, but bring more damage per credit than additional towers. Special towers also upgrade their effects:

| Tower | Level 4 | Level 5 |
| --- | --- | --- |
| Cryo | slows to 45 % speed, 2.3 s | 35 % speed, 2.8 s |
| Tesla | 4 jumps, 1.8 tiles | 5 jumps, 2 tiles |
| Lance | loses 10 % per pierce | 0 %, beam width 0.5 |
| Ember | burns for 3 times | 3.5 times, 3.5 s long |
| Stasis | 1 s, radius 1.1 | 1.2 s, radius 1.3 |
| Corrosion | +30 % damage | +40 %, radius 1 |
| Decay | 5 % of maximum HP | 6 % |
| Focus | +25 % per follow-up hit | +30 %, up to 12 stacks |
| Mortar | blast radius 1.5 | 1.7, dead zone 1.2 |
| Quake | 70 % at the edge | full force to the edge |
| Executioner | already below 30 % HP | 5 times damage below 35 % HP |
| Shrapnel | 4 targets per salvo | 5 targets |
| Catalyst | +60 % per effect | +75 %, counts up to 5 effects |
| Jammer | 3.5 s, radius 1.3 | 4.5 s, radius 1.5 |
| Snare Net | 3.5 s | 40 % slower, 4.5 s |
| Gravitron | radius 1.2, 1.8 times pull | radius 1.4, 2.2 times, 0.7 s |
| Plasma | radius 1, 5 s | radius 1.15, 6 s |
<!-- new towers: g1 (Attack+Control A) -->
| Orbital | strike radius 1.35 | 1.5, lands 1.1 s after the beacon |
| Mesmer | 1.7 s trance | 1.9 s, only 2.5 s immune |
| Amber | shatter +65 % | 2 s encased, +80 % |
| Magnetar | radius 1.9, drags 1 tile | radius 2.2, 1.2 tiles |
| Cyclone | radius 1.3, 1.9 times push | radius 1.5, 2.3 times, 0.7 s |
<!-- end g1 -->
<!-- new towers: g2 (Control B) -->
| Tether | 4 enemies, 3.5 s | 4 enemies within 1.7 tiles, 4.5 s |
| Shrink Ray | 5 s | 50 % size, 40 % armor kept, 5.5 s |
| Hex | echoes 45 % | 50 % after only 2.5 s |
| Siphon | 30 % slow, +7 % fire rate per enemy | +8 %, counts 6 enemies, feeds towers within 2.6 tiles |
<!-- end g2 -->

### Specializations (levels 6–8)

After level 5 every attack and control tower above offers three specializations. Buying the first tier commits that tower to the path; the other two are locked until you sell it. Each path has three tiers (levels 6, 7 and 8) costing 2.5, 4 and 6 times the build cost; a fully specialized Pulse costs 200 + 320 + 480 credits on top. Traps and support towers have no specializations. Tooltips show the final values of every tier.

| Tower | Path A | Path B | Path C |
| --- | --- | --- | --- |
| Pulse | Sharpshooter: +70 % against heavy targets | Overclock: 35 % less time between shots | Ricochet: every 2nd hit bounces for 65 % |
| Nova | Supernova: blast radius 2 | Siegebreaker: +60 % against armor | Chain Reaction: up to 3 kills explode again |
| Flak | Skyhunter: +70 % against heavy flyers | Flak Curtain: 3 extra flyers for 45 % | Wingclip: hit flyers 30 % slower |
| Skyburst | Cluster Warhead: up to 4 kills explode again | Shear Front: flyers in the burst 30 % slower | Downdraft: flyers in the burst netted for 1.8 s |
| Tesla | Storm Network: 8 jumps, 2.6 cells | Overload: +85 % on a lone enemy | Twin Arc: every 2nd salvo a second chain |
| Lance | Longshot: +2.3 cells range | Broadbeam: half-width 0.95 | Rail Penetrator: ignores 60 % of armor |
| Ember | Incinerator: 6× the hit over 4 s | Wildfire: burns spread on death | Searing Heat: +40 % against burning enemies |
| Decay | Entropy Beam: 7.5 % of max HP | Final Decay: 8 % below 55 % HP | Contagion: 3 nearby enemies take damage too |
| Focus | Deep Focus: +45 % per stack | Adaptive Lens: keeps 75 % of its stacks | Prism Beam: hits the enemy behind for 60 % |
| Mortar | Saturation: blast radius 2.3 | Bunker Buster: +75 % against armor | Mobile Artillery: no dead zone, 30 % faster |
| Quake | Fracture: hit enemies take +20 % for 3 s | Resonance: 35 % faster pulses | Aftershock: a second wave for 55 % |
| Executioner | Hunter's Mark: executes below 50 % HP | Guillotine: 8× execution damage | Blood Transfer: 60 % of the overkill jumps on |
| Catalyst | Volatile Mix: 2+ effects splash 65 % within 1.2 cells | Stabilizer: each hit makes effects last 0.6 s longer (up to 5 s) | Catalytic Core: +120 % per effect, up to 6 |
| Shrapnel | Scatterstorm: 8 targets | Tungsten Shards: ignore 60 % of armor | Concentrated Volley: unused shards hit the main target |
| Cryo | Permafrost: slows to 20 % speed | Brittle Ice: slowed enemies take +16 % | Frostburst: slows enemies around the target |
| Stasis | Deep Stasis: 1.8 s stun | Time Field: pulse radius 1.9 | Temporal Exposure: +20 % damage after a stun |
| Corrosion | Superacid: +55 % damage taken | Acid Fog: radius 1.6 | Armor Dissolver: corroded armor loses 30 % |
| Gravitron | Reverse Drive: 3.4× pull | Gravity Well: radius 2 | Compression: pulled enemies take +20 % |
| Jammer | Wideband: radius 2.1 | Blackout: 7 s disruption | Weak Signal: disrupted enemies take +16 % |
| Plasma | Searing Ground: armor loses 60 % in the pool | Quagmire: 60 % speed in the pool | Eruption: an expiring pool bursts for its whole burn |
| Snare Net | Anchor Net: netted flyers at 30 % speed | Net Cloud: catches 3 more flyers | Exposed Target: netted flyers take +20 % |
<!-- new towers: g1 (Attack+Control A) -->
| Orbital | Kill Sat: +80 % against heavy targets | Cluster Payload: 4 bomblets on enemies around the blast for 55 % | Rapid Lock: lands 0.25 s after the beacon, 30 % faster |
| Mesmer | Mass Hypnosis: the trance takes 3 more enemies | Deep Trance: 3.1 s backwards | Mind Break: hypnotised enemies take +30 % |
| Amber | Fossilize: 3.2 s encased | Fault Line: shatter +180 % | Resin Burst: shards hit enemies within 1.4 tiles for 65 % |
| Magnetar | Event Field: radius 3.1 | Crush Point: caught enemies take +20 % for 3 s | Lodestone: caught enemies at 50 % speed for 1.6 s |
| Cyclone | Tempest: radius 2.4 | Downburst: gusted flyers netted for 2.5 s | Shear Wind: gusted flyers take +20 % for 3 s |
<!-- end g1 -->
<!-- new towers: g2 (Control B) -->
| Tether | Chain Gang: links 7 enemies within 2.3 cells | Shared Pain: 40 % of a linked enemy's damage hits each other one | Whiplash: a linked enemy's death stuns the others for 1 s |
| Shrink Ray | Compactor: 35 % size, 10 % armor kept | Featherweight: every beam knocks a shrunk target 0.55 cells back | Brittle Frame: shrunk enemies take +25 % |
| Hex | Resonance: echoes 100 % | Plague Hex: the curse jumps to 3 uncursed enemies within 2.1 cells | Doom: an echo that leaves less than 20 % HP kills |
| Siphon | Overdrive: +11 % fire rate per enemy, counting 8 | Leech Field: the beam forks to 3 more enemies | Power Tap: fed towers +5 % damage per enemy |
<!-- end g2 -->

Damage-taken bonuses do not stack with each other or with Corrosion: the strongest one counts. Armor pierce and Armor Dissolver only weaken the armor trait, never shields, mirrors or other defences.

The **Refinery** has three levels and pays 25 / 40 / 60 credits per wave (upgrades cost 100 and 160 credits).

More support towers with three levels:

| Tower | Level 2 | Level 3 |
| --- | --- | --- |
| Bounty Beacon | +75 % · 90 | +100 %, radius 3 · 150 |
| Repair Dock | 2 energy per wave · 160 | 3 energy · 260 |
| Tracker | +20 %, radius 2.5 · 120 | +25 %, radius 2.8 · 200 |
<!-- new towers: g4 (Support A) -->
| Overclock | 4 s burst, radius 2.5 · 130 | 2.5 × fire rate, radius 2.8 · 220 |
| Fire Control | every 3rd shot · 120 | ×3, radius 2.6 · 200 |
| Armory | 65 % · 110 | 80 %, radius 2.6 · 180 |
| Skylink | 75 % · 140 | 90 %, radius 3 · 230 |
| Nexus | 5 %, radius 2.5 · 130 | 6 %, up to 7 types, radius 2.8 · 210 |
<!-- end g4 -->
<!-- new towers: g5 (Support B) -->
| Workshop | −25 %, radius 2.8 · 110 | −30 %, radius 3.2 · 180 |
| Vault | 7 %, cap 60 · 120 | 10 %, cap 90 · 200 |
| Shield Generator | absorbs 5 per wave · 150 | absorbs 8 · 240 |
| Recycler | 125 % of the overkill, 2.5 cells · 120 | 150 %, 3 cells, radius 3 · 200 |
<!-- end g5 -->

**The Aura** has no base bonus. With the first purchase you commit to one of three paths; the other two are then locked for that tower, and changing your mind means selling:

| Path | Level I | Level II | Level III |
| --- | --- | --- | --- |
| Damage | +25 % · 100 | +40 % · 180 | +55 % · 300 |
| Attack speed | +20 % · 120 | +35 % · 200 | +50 % · 320 |
| Range | +15 % · 100 | +25 % · 170 | +35 % · 280 |

If several Auras overlap, the largest bonus applies per stat. For several bonuses, build several Auras with different paths. Aura towers and Refineries are never strengthened.

### Target priorities

Every attack tower has its own target priority. You set it in the tower panel under "Target" or cycle it with `T`. It applies to all enemies in range that the tower can hit.

| Priority | Targets |
| --- | --- |
| First (default) | the enemy closest to the reactor |
| Last | the enemy furthest behind |
| Strongest | the enemy with the most current HP |
| Weakest | the enemy with the least current HP |
| Closest | the enemy closest to the tower |

On a tie, the enemy further ahead wins. The Lance still aims at the line with the most hits; priority only decides there on equal hit counts. The Catalyst likewise aims at the enemy with the most running effects; priority only decides between equally affected ones. If the target of a Pulse, Flak, Skyburst, Catalyst or Cryo projectile dies in flight, it picks the next enemy as before. Refinery, Detector and Aura have no target priority. In co-op you can only change the priority of your own towers.

## Enemies

Sector I uses five basic enemies, including the **Glider** from mission 02 on: fast, low HP and airborne. A pure Nova defense therefore loses every mission with Gliders. From sector II on, every sector adds further enemies with traits. The images show the enemies as the battlefield draws them, with the markers of their traits:

| Sector | New enemies |
| --- | --- |
| I Border Zone | <img src="docs/images/enemies/drone.png" width="24" height="24" alt=""> Drone, <img src="docs/images/enemies/runner.png" width="24" height="24" alt=""> Sprinter (fast), <img src="docs/images/enemies/tank.png" width="24" height="24" alt=""> Tank (slow, lots of HP), <img src="docs/images/enemies/boss.png" width="24" height="24" alt=""> Titan (boss), <img src="docs/images/enemies/glider.png" width="24" height="24" alt=""> Glider (flies, fast) |
| II Frost Belt | <img src="docs/images/enemies/splitter.png" width="24" height="24" alt=""> Shard (splits into Drones), <img src="docs/images/enemies/skater.png" width="24" height="24" alt=""> Ice Strider (immune to slow, nimble), <img src="docs/images/enemies/wolf.png" width="24" height="24" alt=""> Packwolf (faster in a pack) |
| III Acid Moor | <img src="docs/images/enemies/slime.png" width="24" height="24" alt=""> Sludge (regenerates), <img src="docs/images/enemies/mender.png" width="24" height="24" alt=""> Medic (heals others), <img src="docs/images/enemies/twin.png" width="24" height="24" alt=""> Twin Runner (shares damage with its kind), <img src="docs/images/enemies/veiler.png" width="24" height="24" alt=""> Veil Weaver (cloaks nearby enemies) |
| IV Orbital Deck | <img src="docs/images/enemies/aegis.png" width="24" height="24" alt=""> Shield Bearer (shield recharges), <img src="docs/images/enemies/phantom.png" width="24" height="24" alt=""> Phantom (stealthed, needs the Detector), <img src="docs/images/enemies/hopper.png" width="24" height="24" alt=""> Jump Beetle (regularly leaps forward), <img src="docs/images/enemies/hauler.png" width="24" height="24" alt=""> Convoy Hauler (armored, shares damage in the convoy), <img src="docs/images/enemies/nullbearer.png" width="24" height="24" alt=""> Null-Field Carrier (switches off support towers) |
| V Ruined City | <img src="docs/images/enemies/bulwark.png" width="24" height="24" alt=""> Bulwark (armor), <img src="docs/images/enemies/warlord.png" width="24" height="24" alt=""> Commander (strengthens nearby enemies), <img src="docs/images/enemies/bunker.png" width="24" height="24" alt=""> Pressure Bunker (withstands area damage), <img src="docs/images/enemies/decoy.png" width="24" height="24" alt=""> Decoy (towers must target it), <img src="docs/images/enemies/shade.png" width="24" height="24" alt=""> Shadow Colossus (armored, cloaks nearby enemies), <img src="docs/images/enemies/sapper.png" width="24" height="24" alt=""> Pioneer (defuses traps) |
| VI Singularity | <img src="docs/images/enemies/blinker.png" width="24" height="24" alt=""> Phase Runner (dodges every nth hit), <img src="docs/images/enemies/berserker.png" width="24" height="24" alt=""> Berserker (unstoppable, sprints at low HP), <img src="docs/images/enemies/warpdrone.png" width="24" height="24" alt=""> Warp Drone (flies, jumps ahead), <img src="docs/images/enemies/soulspark.png" width="24" height="24" alt=""> Soul Spark (flies, heals on death), <img src="docs/images/enemies/phasewing.png" width="24" height="24" alt=""> Phase Wing (switches between air and ground) |
| VII Dune Sea | <img src="docs/images/enemies/scarab.png" width="24" height="24" alt=""> Scarab (armored and nimble), <img src="docs/images/enemies/burrower.png" width="24" height="24" alt=""> Burrower (regularly dives; then only traps and area damage hit), <img src="docs/images/enemies/gapper.png" width="24" height="24" alt=""> Gap Jumper (briefly jumps forward), <img src="docs/images/enemies/pebble.png" width="24" height="24" alt=""> Rubble Swarm (withstands area damage, swarm), <img src="docs/images/enemies/raptor.png" width="24" height="24" alt=""> Storm Falcon (flies, faster in a pack), <img src="docs/images/enemies/mole.png" width="24" height="24" alt=""> Tunnel Mole (digs quickly underground) |
| VIII Deep Sea | <img src="docs/images/enemies/crab.png" width="24" height="24" alt=""> Armor Crab (hardens the more hurt it is), <img src="docs/images/enemies/jelly.png" width="24" height="24" alt=""> Jellyfish (flies and heals nearby enemies), <img src="docs/images/enemies/chainling.png" width="24" height="24" alt=""> Chain Jelly (flies, shares damage), <img src="docs/images/enemies/buoy.png" width="24" height="24" alt=""> Beacon Buoy (flies, shield, towers must target it) |
| IX Storm Front | <img src="docs/images/enemies/gale.png" width="24" height="24" alt=""> Gust Runner (races in bursts), <img src="docs/images/enemies/stormbird.png" width="24" height="24" alt=""> Stormbird (flies, shield and nimble), <img src="docs/images/enemies/airship.png" width="24" height="24" alt=""> Airship (heavily armored flyer, drops Gliders), <img src="docs/images/enemies/drafter.png" width="24" height="24" alt=""> Column Runner (faster in a cluster), <img src="docs/images/enemies/mirrorwing.png" width="24" height="24" alt=""> Mirror Wing (flies, deflects beams), <img src="docs/images/enemies/insulator.png" width="24" height="24" alt=""> Insulator (interrupts Tesla chains), <img src="docs/images/enemies/staticloud.png" width="24" height="24" alt=""> Disruption Cloud (flies, nearby towers fire slower) |
| X Jungle | <img src="docs/images/enemies/ant.png" width="24" height="24" alt=""> Swarm Ant (less damage in a pack), <img src="docs/images/enemies/colossus.png" width="24" height="24" alt=""> Jungle Colossus (armored, regenerates), <img src="docs/images/enemies/martyr.png" width="24" height="24" alt=""> Martyr (heals on death), <img src="docs/images/enemies/thornback.png" width="24" height="24" alt=""> Thornback (punishes nearby towers with cooldown) |
| XI Volcano Chain | <img src="docs/images/enemies/ember.png" width="24" height="24" alt=""> Ember Runner (speeds up the more HP it is missing), <img src="docs/images/enemies/ashwing.png" width="24" height="24" alt=""> Ash Wing (flies, armored, immune to slow), <img src="docs/images/enemies/salamander.png" width="24" height="24" alt=""> Salamander and <img src="docs/images/enemies/cinderwing.png" width="24" height="24" alt=""> Magma Moth (immune to burn and bleed), <img src="docs/images/enemies/flare.png" width="24" height="24" alt=""> Dazzler (reduces tower range) |
| XII Crystal Cave | <img src="docs/images/enemies/golem.png" width="24" height="24" alt=""> Crystal Warden (hardens against hits in rhythm, burn works in full), <img src="docs/images/enemies/moth.png" width="24" height="24" alt=""> Shard Moth (flies, splits into two Gliders), <img src="docs/images/enemies/prism.png" width="24" height="24" alt=""> Prism Runner (deflects beams), <img src="docs/images/enemies/monolith.png" width="24" height="24" alt=""> Monolith (no hit above 6 % of its HP) |
| XIII Circuit | <img src="docs/images/enemies/leaper.png" width="24" height="24" alt=""> Leap Spider (regularly leaps into the air), <img src="docs/images/enemies/warden.png" width="24" height="24" alt=""> Damper (makes itself and nearby enemies immune to slow, stun and pull), <img src="docs/images/enemies/sparkworm.png" width="24" height="24" alt=""> Spark Worm (briefly disables nearby towers on death), <img src="docs/images/enemies/molter.png" width="24" height="24" alt=""> Molter (armored down to half HP, then fast) |
| XIV Gearworks | <img src="docs/images/enemies/cog.png" width="24" height="24" alt=""> Cogwheel (speeds up the longer it circles), <img src="docs/images/enemies/piston.png" width="24" height="24" alt=""> Piston Tank (armored, takes less damage every lap), <img src="docs/images/enemies/broodmother.png" width="24" height="24" alt=""> Broodmother (armored, lays Swarm Ants along the way), <img src="docs/images/enemies/stormcell.png" width="24" height="24" alt=""> Thunder Cell (flies, shield, disables towers on death) |
| XV Moon Lake | <img src="docs/images/enemies/tidewing.png" width="24" height="24" alt=""> Spray Wing (flies, takes less damage every lap), <img src="docs/images/enemies/nautilus.png" width="24" height="24" alt=""> Nautilus (shield, speeds up the longer it circles), <img src="docs/images/enemies/hydra.png" width="24" height="24" alt=""> Hydra (regenerates, splits into two Hydra Heads), <img src="docs/images/enemies/hydraling.png" width="24" height="24" alt=""> Hydra Head (speeds up the more HP it is missing), <img src="docs/images/enemies/skimmer.png" width="24" height="24" alt=""> Diver (flies, regularly dives to the ground, nimble) |

One more enemy is finished but does not appear in any mission yet. The Enemy Codex lists it under "in no mission": <img src="docs/images/enemies/wisp.png" width="24" height="24" alt=""> Will-o'-Wisp (flies, stealthed, evades).

Stealthed enemies and carriers of a cloak field only appear in missions where the Detector can be built.

## Limits

- Fixed path, enemies cannot be redirected.
- No saved game or mission progress.
- In multiplayer, no reconnecting and no joining after the mission has started.
- The simulation is deterministic and needs no randomness. The maps use geometric markers instead of image assets.
