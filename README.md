# ION BASTION

Tower defense in the browser, built with TypeScript, Phaser 4 and Vite. <!-- counts:start -->73 missions in 15 sectors<!-- counts:end --> with their own maps, waves and terrain styles, sixty towers and <!-- counts:start -->72 enemy types<!-- counts:end --> on the ground and in the air. Play solo or with 2–4 players in co-op or versus mode.

![Mission 54 Ember Chamber in the Volcano Chain sector, first wave: Ember Runners in the windings and the first towers](docs/images/screens/glutkammer.png)

The game runs entirely in the browser; only multiplayer needs a small relay server. Saves live in memory on purpose: reloading restarts the current mission (it is in the address, `?mission=<id>`), and `/` leads to the start screen. The browser only remembers the last mission you started, which the start screen offers as "Restart Last Mission" (from wave 1; it is not a saved game), your best result per won mission, and your sound and graphics settings.

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
| `N` | Start the next wave (in versus: "Ready"). From wave 2 on it also starts by itself 3 s after the previous one ends. |
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

The start screen leads to Campaign and Circuit (the Sector Atlas: a world map with every sector as an island; pick a sector to fly into it, then a mission, then "Start Mission"), Run, Multiplayer, Training with the rules beside it, Enemy Codex and Tower Codex. Every win earns 1–3 stars (90 % reactor energy left for three, 50 % for two; on a ring, never more than half, or 80 %, of the limit alive at once); the atlas shows the best per mission.

The campaign unlocks as you play: it starts with the first mission, each win opens the next two missions of the sector (so one hard mission can be skipped), and a sector opens once all but one mission of the sector before it are won. Locked missions can still be looked at, and won missions always stay open. Circuit, Run and Multiplayer have no locks.

### Circuit

Circuit is its own game mode with its own tab in the mission picker, separate from the campaign. It has three sectors: Circuit, Gearworks and Moon Lake. Its missions play on closed rings without a reactor:

- You start the first wave yourself. After that a timer starts every further wave, even if the previous one is still running.
- Enemies circle until they fall. They deal no reactor damage.
- If more enemies are in the ring at once than the limit allows, the mission is lost. The "IN RING" display replaces reactor energy.
- With "Wave ▶" or `N` you call the next wave early. Every second saved pays credits; the button shows the bonus.
- Wave bonus and Refinery income arrive when the next wave starts.
- The mission is won when all waves have started and all enemies are defeated.

### Run

Run is a single-player roguelite mode on the home page: ten missions in three acts and a Final Stand, on campaign maps with waves generated from each map's own enemies. Act I plays on Vigil's maps, act II on Ashkar's, act III on Thessaly Prime's.

- You start with one of three starter packs of three towers (an anti-air tower, an area tower and a controller). Only your roster can be built, and it holds 6 towers in act I, 8 in act II and 10 from act III.
- Each act is a map: missions, camps (Shop, Forge, Repair, Event) and an act boss with a modifier, all visible from the start. Some missions are elites: tougher, but they pay a relic prize and a fourth draft card.
- Missions start short and grow with the run, as your roster and upgrades grow: 5 waves for the first two missions, 8 for the first act boss, up to 16 for the last act boss and 20 for the Final Stand (elites one more). They start a little way into their source mission with part of the credits you would have had there.
- The reactor carries its damage from mission to mission. Every win repairs a little, Repair nodes and shops more, and each act transition fully.
- Every win drafts a tower (towers that fit your roster come up more often, and a tower that answers a coming threat is always offered), pays Scrap for shops, and gives rank XP to the towers you fielded: kills for the towers that score them, a share of their neighbours' kills for Control, trap and Support towers. Ranks make a tower type stronger for the rest of the run; at rank 4 Blast, Tesla and Pulse also gain a mastery effect.
- Every second win offers a relic, elites and act transitions rarer ones. Offers skip relics that could no longer pay off, and one card always fits your roster; each card says which of your towers it works with. Some relics change combat itself: Thermal Fracture shatters slowed enemies with explosives, Kill Box makes traps hit held enemies harder, Singularity Protocol marks the toughest enemy for your precision towers, and the cursed Unstable Reactor trades reactor capacity for damage as the reactor drains.
- Rewards come one decision at a time: pick a card, read the details, then take it or skip it.
- Beating an act boss can leave its technology behind: each boss modifier has a signature relic (Armorbreaker Matrix, Swarm Replicator, Skyhunter Array, Titan Reactor Core, Spectral Scanner), offered at the act transition beside two legendary relics. The transition still pays one reward: a relic or a Doctrine, unless Master License grants both. Boss technology lasts for the run only.
- Levels 6–8 need a Doctrine: it unlocks one specialization path of one tower type for the rest of the run. The first is free after mission 2; more come from act transitions, Forges and events.
- One lost mission ends the run. A mission can be resumed after a reload, but never restarted. Every run has a six-character seed; typing it in plays the same map, offers and waves again.
- A short run (act I only) unlocks the full run and the daily run (the same seed for everyone, once per day). Each full run won unlocks the next of ten threat levels.

## Towers

Sixty towers sit on four tabs in the build menu: Attack, Control, Traps and Support. Every enemy moves on the ground or in the air, and every attack tower only hits certain layers. The Tower Codex and the tooltips show each tower's cost, targets, values per level and paths.

- **Traps** go on free path tiles (not the entry or the reactor) and trigger when a ground enemy walks onto them, even a stealthed one. Flyers pass over them; only the Harpoon catches flyers.
- **Levels:** attack towers and traps have five levels; levels 4 and 5 are expensive but bring more damage per credit than extra towers. Support towers and the Refinery have three.
- **Specializations (levels 6–8):** after level 5 every attack and control tower offers three paths. The first tier commits the tower to that path; the tiers cost 2.5, 4 and 6 times the build cost.
- **Aura:** its first purchase commits it to damage, attack speed or range. Overlapping Auras apply the largest bonus per stat.
- **Target priority:** First (default), Last, Strongest, Weakest or Closest, set in the tower card or cycled with `T`.

## Enemies

Sector I uses five basic enemies, including the **Glider** from mission 02 on: fast, low HP and airborne. A pure Nova defense therefore loses every mission with Gliders. From sector II on, every sector adds further enemies with traits (armor, shields, stealth, flying, burrowing, splitting and many more). The Enemy Codex shows every one with its stats and traits.

Stealthed enemies and carriers of a cloak field only appear in missions where the Detector can be built.

## Limits

- Fixed path, enemies cannot be redirected.
- No saved game: the browser keeps only the last mission, your best stars per mission and your settings.
- In multiplayer, no reconnecting and no joining after the mission has started.
- The simulation is deterministic and needs no randomness. Terrain and towers are drawn procedurally; enemies use painted sprites with animations.
