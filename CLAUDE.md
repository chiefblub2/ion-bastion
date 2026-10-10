# CLAUDE.md

Notes for agents working on ION BASTION. The player-facing overview (rules, missions, towers, multiplayer usage) is in README.md.

## Stack and commands

TypeScript (strict, ESM), Phaser 3.90, Vite 6, Vitest 3, `ws` for the relay. Node 22+.

```sh
npm ci
npm run dev        # game on :4173 (--host 0.0.0.0)
npm run server     # multiplayer relay on :4174 (PORT=… overrides)
npm test           # vitest run, all tests
npm run build      # tsc --noEmit && vite build → dist/
npx vitest run src/core/match.test.ts     # single file
npx vitest run -u                         # update snapshots (golden replays: only on purpose, review the diff)
npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts
                                          # balance check for one sector (optional `--curve credits=680-780,waves=17-20[,growth=1.1-1.2]` adds WARNs); sector I: -- src/content/missions.ts src/core/strategies/index.ts 0
                                          # flags: --mission <id> (one mission), --why (leaks per enemy type, kills per tower)
npx vite-node scripts/mission-table.ts    # README mission table from the content (stdout)
npx vite-node scripts/mission-table.ts --enemies
                                          # markdown reference table of all enemies (stats, traits) for designing new ones
npx vite-node scripts/mission-table.ts --write
                                          # rewrite the README table and intro counts in place (keeps shortened focus texts by mission name; prints "Schwerpunkt kürzen: <name>" for new missions)
```

Always run `npm test` and `npm run build` before you finish. The chunk-size warning from `vite build` is expected.

To see a change in the real app, run `npm run dev` (and `npm run server` for multiplayer) and open `http://localhost:4173`. Use `?server=ws://host:port` to point at another relay, and `?mission=<id>` (e.g. `?mission=korallengraben`) to open a mission directly. Multiplayer needs several tabs, one per player.

## Language

- Code, comments, identifiers and these notes are in English.
- Everything the player sees is in German. That covers HTML in `ui/interface.ts`, texts in `ui/messages.ts`, `ui/players.ts`, `app/*.ts` and mode rules in `core/modes.ts`. README.md is German too.
- The simulation returns language-neutral `MessageCode`s (`CommandResult.code`). `ui/messages.ts` maps every code to German text, and adding a code without a text fails `tsc`.

## Layout

| Path | Contents |
| --- | --- |
| `src/core/` | Pure simulation: no DOM, no Phaser. `game.ts` (`Game`, command `HANDLERS`, `tick`), `types.ts`, `economy.ts` (wallets), `upgrades.ts`, `validation.ts` (`ContentError` with paths like "Mission kernfestung › Welle 7 › Gruppe 2"), `hash.ts` (`stateHash`, `fnv`), `modes.ts` (multiplayer mode registry), `match.ts` (versus engine), `strategies/` (test bots) |
| `src/systems/` | Tick systems on `Sim` (`{ state, mission, content }`): spawn, status, movement, detection, combat, waves, traits, auras. `attacks/` has one module per attack kind, `damage.ts` the single damage pipeline |
| `src/content/` | Towers, enemies, upgrades, maps, waves, missions; sectors II and later in `content/sectors/*.ts`. `content/index.ts` exports `DEFAULT_CONTENT` (`ContentPack`) |
| `src/render/` | Phaser scene (`scene.ts`, `Battlefield`, `LocalDriver`) and draw registries (`towers.ts`, `enemies.ts`, `projectiles.ts`, `effects.ts`, `terrain.ts`) |
| `src/ui/` | DOM HUD (`interface.ts`, all markup is one template string), messages, tooltips, wave forecast, live units, multiplayer HUD (`players.ts`) |
| `src/app/` | Input (`input.ts`), dialogs, multiplayer lobby/session (`coop.ts`), audio, fullscreen, WebMCP tools (`webmcp.ts`) |
| `src/net/` | `protocol.ts` (messages, `MAX_PLAYERS`, `PLAYER_COLORS`), `client.ts` (`RelayClient`, `relayUrl`), `lockstep.ts` (`LockstepDriver`, `coopSim`) |
| `server/` | `room.ts` (socket-free lockstep room, tested) and `relay.ts` (WebSocket server) |
| `src/main.ts` | Wiring: state → view → UI → battlefield → input |

## Rules that must hold

- **All state changes go through `Game.command`** (or `Match.command` in versus). Each `HANDLERS` entry has an optional `allowedIn` status guard. Render and UI code only read state.
- **The simulation is deterministic:** fixed step `FIXED_STEP = 1/30`, no `Math.random`, no wall-clock time, and stable iteration order. Multiplayer relies on it, as do the golden replays. The only randomness is `roomCode` on the server.
- **Graphics never change the simulation.** Events (`GameEvent` union) are drained after each render frame.
- **Golden replays** (`core/replay.test.ts` + `__snapshots__`) record every mission × strategy. If a snapshot changes, the simulation changed. Update with `-u` only when that is intended.
- **Solo play is the baseline.** New optional fields on state, enemies or spawns must stay `undefined` in solo, so the snapshots stay unchanged (example: `sentBy`).
- **Content is separate from runtime instances.** Upgrades never mutate definitions, and `Tower.upgrades: string[]` is the only source of upgrade progress.
- `Game` accepts its own `ContentPack` (`new Game(mission, content)`). Pure queries (`resolveUpgrades`, `effectiveTowerStats`, …) take `content` as the last, optional parameter. `resolveUpgrades` is cached per content pack and upgrade list.

## Simulation details

- Order of `Game.tick` (only runs while `status === "wave"` and not paused): spawn, status effects, move, detection, projectiles, attack, prune dead enemies, `settleWave`.
- Targeting follows `Tower.priority` (`TargetPriority`: first, last, strong, weak, close; set with `{ type: "target", id, priority }`). Absent means "first", the most path progress, and the handler deletes the field when "first" is chosen, so solo replays stay unchanged. `compareTargets` (`systems/combat.ts`) orders candidates; ties fall back to path progress, then the stable id. An attack module's `choose` (Lanze) receives the candidates in that order.
- Damage lands on impact. Projectiles are part of the state, fly at `projectile.speed` per tower, and still land after their tower is sold.
  - Homing shots (Impuls, Flak, Kryo) retarget within 1.5 cells when their target dies.
  - Nova shells fly to a fixed point.
  - Tesla, Lanze, Fokus, Beben, Gravitron and Störsender hit instantly (`Impact.from`, `Impact.reach`). Beben centres its wave on `Impact.from`, the tower itself.
  - Schrapnell: a module's `volley` hook makes `attackEnemies` fire at that many different candidates per salvo, the chosen target first, then in priority order. Henker judges its threshold on impact.
  - Mörser shells fly to a fixed point like Nova; its module's `minRange` hook makes `attackEnemies` skip enemies inside the dead zone.
  - Fokus keeps its target through `choose` (which also receives the firing `Tower`) and stores its charge in `Tower.focus`, which is part of `stateHash`.
- Always deal damage through `applyDamage` (`systems/damage.ts`) and apply status effects through `applyStatus` (`systems/status.ts`).
- Status merge rules: for slow, burn and vulnerable, the stronger effect replaces the weaker one and an equal one extends it. Stun and pull (Gravitron) block further stuns or pulls until their recovery time ends. A pull is a negative speed factor, so it beats slow and stun; `moveEnemies` clamps `distance` at 0 on reactor maps. The stronger net (Fangnetz) replaces a weaker one, and a disruption extends.
- `disrupted` (Störsender) hides the `DISRUPTABLE` traits (shield, regen, healer, leader, stealth, evade) from `traitsOf`, so every trait hook and `isHidden` follow it. `isHidden` also covers `burrow` (Gräber), which is stateless (derived from `distance`), not disruptable and not revealed by a detector; traps and area damage still hit. `netted` makes `canTarget` treat a flyer as air and ground.
- Passive support effects live in `systems/support.ts`: `bountyBonus` (Prämienbake, added to the kill reward in `applyDamage`), `markFactor` (Peilsender, multiplied with `damageTaken` before armor) and `repairReactor` (Reparaturdock, in `settleWave`). Like auras they are derived on every query and take the strongest overlapping tower. `availableTowers` drops `repair` towers on circle missions. Burn ticks every 0.5 s and credits the source tower even after a sale. Vulnerable applies before armor.
- Aura bonuses are derived from the current towers on every query, with no cache. Overlapping auras use the maximum bonus per stat. Cooldowns store the remaining fraction of a cycle, so a speed change never grants a free shot.
- Support towers are recognised by `aim: "none"` of their attack module (`isSupport`). They have no `targets`, no damage and no fire rate, are never buffed by auras, and only towers with an area (aura, detector, beacon, tracker) need a range. Their specs form `SupportAttack`, which `attackTower` excludes.

## Adding content

Whole mission packs (new sectors, themes, enemies) follow the project skill `.claude/skills/mission-pack/SKILL.md`: foundation agent, parallel sector and theme agents, integration checklist. New enemies or traits for the existing campaign follow `.claude/skills/enemy-pack/SKILL.md`.

- **Mission:** add a `MissionDefinition` to a sector in `content/missions.ts` (or `content/sectors/*.ts`).
  - The fields are map, waves, `startingCredits` and `reactorEnergy`.
  - Optional: `hpGrowth` (default 0.14 per wave) and `availableTowers`.
  - `SECTORS` groups missions, and `MISSIONS` is the flat list derived from it; position determines the mission number. Validation checks that the sectors contain exactly `missions`, in order.
- **Map:** `parseMap(id, name, sketch, theme)` in `content/maps.ts`.
  - The ASCII sketch is the only source of truth: `S` entry, `R` reactor, `=` path, `#` obstacle, `.` buildable.
  - Size and path order are derived from it. Branches, dead ends and loose path cells are rejected with their coordinates.
  - A new terrain style needs an entry in `THEMES` (`render/terrain.ts`) and a value in `MapTheme`.
- **Circle mission (Kreislauf, the last sector, in `content/sectors/circle.ts`):**
  - A map sketch without `R` is a closed ring (`MapDefinition.loop`). `S` sits on the ring, and enemies leave it in the first free direction (right, down, left, up).
  - The mission sets `circle: { interval, limit, earlyBonus }`; validation requires `circle` and `loop` together.
  - `systems/circle.ts` replaces `settleWave`. The status stays `"wave"` from the first start to the end.
    - The timer (`state.circle.next`) starts overlapping waves.
    - `start` calls the next wave early for `earlyBonus` credits per second saved.
    - More than `limit` alive enemies loses; all waves started and an empty ring wins.
  - Overlapping spawns carry `Spawn.wave` for their HP scale. Versus rejects circle missions (`circle-versus`), so they run solo or in co-op.
- **Waves:** use the helpers `g(type, count, interval, delay)` and `wave(bonus, ...groups)` from `content/waves.ts`. An optional per-wave `hpMultiplier` replaces the linear growth.
- **Tower:** add it to `content/towers.ts`. Fields:
  - `attack`: kind plus values, e.g. `{ kind: "slow", factor: 0.55, duration: 1.9 }`
  - `visual`: `icon`, `turret`, `projectile`, `muzzle`, `impact`
  - `targets`: the layers it can hit

  Menu, tooltips, detail values and validation are generated from the definition. The build menu has category tabs (Angriff, Kontrolle, Fallen, Unterstützung) once a mission offers `PAGED_FROM` towers; `pageOf` in `ui/tower-pages.ts` derives the tab from `placement` and the attack (traps, support towers, or `CONTROL_KINDS`). Menu order follows `towerOrder` (page by page). Hotkeys come from `hotkeyTowers(game, view.page)`: with tabs every tab numbers its towers from 1 (`TOWER_KEYS` in `ui/interface.ts`, 14 keys per tab; `t`, `f` and `n` are taken), and `Shift`+`1`–`4` (by `e.code`) opens a tab.
- **Trap:** use `trapTower` (`content/upgrades.ts`), which sets `placement: "path"` and keeps the trigger radius (`range`, about 0.45) at every level. Traps reuse the normal attack kinds.
  - `Game.canBuild(x, y, tower)` puts traps on free path cells (`isTrapCell`: not the entry and, with a reactor, not the reactor cell), everything else beside the path. The build fails with `trap-off-path`.
  - `attackEnemies` triggers traps with `canTarget` instead of `canAcquire`, so stealthed walkers set them off. Traps target ground only, so flyers pass over.
  - Trap-only kinds (`trapOnly` on the module, rejected elsewhere by validation): `bleed` (Krähenfüße: status `bleeding` costs `perCell` per cell walked, in `BURN_TICK` steps; standing or pushed back costs nothing), `charge` (Haftmine: status `charged` detonates at `until` or through the status `onDeath` hook, which `applyDamage` runs via `statusDeath`; a spent charge has `until = -Infinity`, so chains never repeat), `pit` (Fallgrube: swallows enemies with `size` ≤ the spec and without `unstoppable` through an infinite hit, which `applyDamage` turns into the remaining HP) and `alarm` (Alarmdraht: sets `cooldown = 0` on attack towers in its radius, not on support towers or traps).
  - The scene draws traps flat (no shadow or turret rings) and suppresses their muzzle flash. A trap with `visual.impact` emits an `impact` event where it goes off.
- **Attack kind:** you need three pieces:
  - a module in `systems/attacks/` (`aim`, `projectile`, `params` with label, check and unit, `apply`)
  - an entry in `systems/attacks/index.ts`
  - a member of `AttackSpec` in `core/types.ts`

  Every `params` value can then be upgraded via `effects.attack` and shows up in the UI.
- **Status effect:** add a member of `StatusEffect` and an entry in `STATUSES` (`systems/status.ts`), with a merge rule and optional hooks.
- **Enemy:** add it to `content/enemies.ts`, with `layer` (`ground`/`air`), `visual` and optional `traits`. The available traits are armor, regen, splitOnDeath, slowImmune, shield, sprint, evade, healer, leader, stealth, unstoppable, swift, burrow, harden, surge, swarm, rage and facet. `rage` raises speed with lost HP (`speed` hook); `facet` cuts non-dot hits in a window of the global `state.time`, so burn ticks and bleed pass while Zerfall (not a dot) is reduced. A new trait is an entry in the `TRAITS` registry (`systems/traits.ts`), using the hooks `onDamage`, `onTick`, `onDeath` and `resists`. There is no inheritance tree and no global event bus. Stealth enemies may only appear in missions where the detector is buildable.
- **Upgrades:** `UpgradeDefinition` (`id`, `label`, `description`, `cost`, `requires`, optional `path`, `effects`) in `content/upgrades.ts`.
  - `attackTower` generates the five-level path.
  - `AURA_UPGRADES` defines the three exclusive aura paths.
  - Upgrades with different `path`s exclude each other on one tower.
  - Validation rejects duplicate ids, missing or cyclic requirements, and invalid costs or effects.
  - Every upgrade is bought with the same command, `{ type: "upgrade", id, upgrade }`.
  - `previewUpgrade` resolves a hypothetical purchase without changing state.

## Tests

- Tests are pure Vitest with no DOM; they build a `Game` (or `Match`/`Room`) directly. Helpers in `core/test-helpers.ts`: `finishWave`, `play`, `makeEnemy`, `landProjectiles`. `play` lives in `core/play.ts` (no vitest import) so `scripts/balance.ts` can reuse it; the mission rules (air, stealth, buildability, thin defense, Nova-only, tutorial exemption) live in `core/mission-checks.ts` and are shared by `missions.test.ts` and the balance script.
- `core/missions.test.ts` plays each mission with two deterministic strategies (`core/strategies/`) to a win. It also checks that missions are lost without towers, with only three towers from mission 02 on, and with a Nova-only defense against gliders. `PENDING_BALANCE` lists strategies that do not win yet (currently Frostwall A/B); their win tests are skipped.
- Multiplayer tests:
  - `core/coop.test.ts`: co-op economy
  - `core/match.test.ts`: versus rules
  - `server/room.test.ts`: seats and frames
  - `net/lockstep.test.ts`: N in-memory clients on one `Room`, asserting identical hashes every frame in every mode
  - `ui/players.test.ts`: HUD strings

## Multiplayer internals

- **Model:** deterministic lockstep through a relay that has no game logic.
  - `Room` collects commands and emits numbered frames, 30 per second, or two per tick at 2× speed.
  - The relay stamps each command with the sender's seat.
  - Clients apply each frame's commands in order, then call `tick()` exactly once.
  - Every `HASH_INTERVAL` (30) frames, clients report a hash, and the relay broadcasts `desync` on a mismatch.
- **Seats** are always `0..players-1` and double as wallet and field indices. When someone leaves, later seats move down (so a leaving host hands over seat 0) and the relay re-sends `room` messages. Leaving a running mission stops the clock, and the new host can relaunch. There is no reconnect and no late join.
- **Modes** (`core/modes.ts`, `MODES`): `coop`, `race`, `siege`, each 2–4 players. The host sends `launch { missionId, mode }`, the relay checks `fitsMode`, and every client gets `launched { missionId, mode, players }`. Frame 1 always contains the `mission` command.
- **Co-op:** a single shared `Game` with `setPlayers(n)`, driven through `coopSim(game)`. `earn` splits shared income and rotates indivisible remainders via `splitCursor`. Towers carry an `owner`. `hostOnly` and `ownTower` in `game.ts` guard restart/mission and sell/upgrade.
- **Versus:** a `Match` holds one solo `Game` per player, and every client simulates all of them. `fields[localSeat]` is the app's existing `game` instance, so the scene, HUD and dialogs render it unchanged.
  - **Commands:** `MatchCommand` adds `ready` and `send` to `Command`. `build`, `sell` and `upgrade` go to the sender's field. `mission` and `restart` are host-only and apply to every field. `pause` is rejected.
  - **Wave clock:** shared. The next wave starts on all alive fields when everyone is ready or after `READY_COUNTDOWN` ticks.
  - **Sends:** they go to the next alive opponent (`target`) and cost `sendCost` (4× reward). During a wave they are queued behind the target's current wave time; between waves they are buffered in `pending`. Sent enemies carry `sentBy` and pay no reward, and split fragments inherit it.
  - **Result:** a field with status `lost` is eliminated. The match ends with ≤1 survivor or when every survivor has status `won`. Ranking: alive, lives, elimination tick, kills.
  - **Events:** only the local field's events are drained by the scene, so `Match.tick` drains the others.
- **Adding a mode:**
  - Add an entry to `MODES`.
  - Put its rules in `Match` (versus) or behind the `Game` handlers (shared map).
  - Show its HUD in `ui/players.ts`.
  - Extend the parametrised lockstep test so every client stays in sync.
- **Desync safety:** new per-player or per-match state must be included in `stateHash` or `Match.hash`, otherwise desyncs go undetected.
