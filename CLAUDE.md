# CLAUDE.md

Notes for agents working on ION BASTION. The player-facing overview (rules, missions, towers, multiplayer usage) is in README.md.

## Stack and commands

TypeScript (strict, ESM), Phaser 3.90, Vite 6, Vitest 3, `ws` for the relay. Node 22+.

PNGs under `assets-src/` and `public/assets/` live in Git LFS (`.gitattributes`); new art there is picked up automatically. A checkout without `git lfs pull` has pointer files instead of images, which breaks the art audits and the game's sprites. The Pages workflow caches `.git/lfs/objects`.

```sh
npm ci
npm run dev        # game on :4173 (--host 0.0.0.0)
npm run server     # multiplayer relay on :4174 (PORT=… overrides)
npm test           # vitest run: unit and content tests, about 1 s (no campaign simulations)
npm run build      # tsc --noEmit && vite build → dist/
npx vitest run src/core/match.test.ts     # single file
npx vite-node scripts/balance.ts -- src/content/sectors/frost.ts src/core/strategies/frost.ts
                                          # balance check for one sector (optional `--curve credits=680-780,waves=17-20[,growth=1.1-1.2]` adds WARNs); sector I: -- src/content/missions.ts src/core/strategies/index.ts 0
                                          # flags: --mission <id> (one mission), --why (leaks per enemy type, kills per tower),
                                          # --tune (HP factor window in which A/B win and thin/Nova/empty defenses lose, plus the hpGrowth range)
npx vite-node scripts/mission-table.ts    # README mission table from the content (stdout)
npx vite-node scripts/mission-table.ts --enemies
                                          # markdown reference table of all enemies (stats, traits) for designing new ones
npx vite-node scripts/mission-table.ts --write
                                          # rewrite the README table and intro counts in place (keeps shortened focus texts by mission name; prints "Shorten focus: <name>" for new missions)
npx vite-node scripts/visual-check.ts -- <missionId>... [--enemies a,b] [--out dir]
                                          # with `npm run dev` running: headless system Chrome (playwright-core) builds strategy A via the WebMCP
                                          # tools, opens the first wave of each new (or given) enemy directly via `&wave=<n>` and saves terrain + wave PNGs (about 2 s per mission; never play through to a wave, always skip to it)
npx vite-node scripts/readme-images.ts [-- --only towers|enemies|screens]
                                          # with `npm run dev` running: the README images in docs/images/. Icons are clipped from the dev-only
                                          # gallery page `/gallery.html` (`src/gallery.ts`, not part of `vite build`, draws every tower and enemy
                                          # with the battlefield's own draw functions); screenshots skip to a wave with `&wave=<n>&credits=<n>`
                                          # (the list is `SCREENS` in the script). Shared browser helpers live in `scripts/browser.ts`
                                          # Review sheets on the same page (`src/showcase.ts`, dev-only): `/gallery.html?showcase` draws every tower
                                          # at L1, firing, L5 and L8 per path; `?showcase=shots` every projectile in flight, muzzle flash, impact,
                                          # beam, chain and pulse (`&clock=<s>` picks another animation frame)
npx vite-node scripts/normalize-enemy-animations.ts
                                          # re-cuts the supplied animation pack (assets-src/enemy-animations/<id>.png, manifest.json v2: one 8×4 grid
                                          # per enemy, a clip per row) losslessly into public/assets/enemy-animations/<id>.png (256 px cells, 2048×1024):
                                          # frames cut at their real gaps, faint grid lines erased, clips aligned to idle, loops held still (unless
                                          # that makes a gallop jumpier); skips entries with `disabled`; repeatable (same bytes on every run)
npx vite-node scripts/audit-enemy-animations.ts [-- --write|--frames]
                                          # animation sheet audit (source grids vs manifest, identity of every source sheet against all static art,
                                          # stray files in public/, game grids vs registry: cells, blank frames, cut edges, pivot drift, loop seams,
                                          # texture memory per mission); `--write` regenerates src/render/enemy-animation-bounds.ts
npx vite-node scripts/enemy-anim-review.ts [-- --ids drone --clips idle,death --frame 3]
                                          # with `npm run dev` running: screenshots of the dev-only page `/gallery.html?anim` (`src/anim-review.ts`:
                                          # clip picker, play/pause, frame step, speed, cell bounds and pivot, game size at four headings vs static art, filmstrip)
npx vite-node scripts/audit-enemy-art.ts [-- --write|--fix]
                                          # enemy PNG audit without a browser: coverage of content/registry/files, alpha, visible bounds and centre,
                                          # residue islands, edges; `--write` regenerates src/render/enemy-art-bounds.ts
npx vite-node scripts/enemy-art-review.ts [-- --batch 6 --tiles 0,2,4 | --ids a,b | --stress 400 [--canvas]]
                                          # with `npm run dev` running: screenshots of the dev-only art QA page `/gallery.html?art`
                                          # (`src/art-review.ts`: every painted enemy through the real sprite path at four headings, a corner,
                                          # six terrains, overlays, hidden, burrowed, procedural fallback; `?art=lineup`, `?art=stress`) into
                                          # visual-check/art-review/ (git-ignored); SwiftShader WebGL unless `--canvas`
```

Always run `npm test` and `npm run build` before you finish. When missions, waves, enemies, towers or strategies changed, also run `scripts/balance.ts` for the touched sectors (it is the only check that strategies A/B win and weak defenses lose). The chunk-size warning from `vite build` is expected.

To see a change in the real app, run `npm run dev` (and `npm run server` for multiplayer) and open `http://localhost:4173`. Use `?server=ws://host:port` to point at another relay, and `?mission=<id>` (e.g. `?mission=korallengraben`) to open a mission directly; `&wave=<n>` starts it at wave n (the remaining waves keep their real HP; the HUD counts from 1). `&credits=<n>` replaces the starting credits. Without a valid `?mission=` the app opens on the start screen. `app/screens.ts` switches two views in one document (`<html data-view="menu|game">`, `#start-screen` / `#game-view`) through the History API: `/` is home, `/#missionen`, `/#mehrspieler`, `/#gegnerakte`, `/#turmakte` (Tower Codex, `ui/tower-codex.ts`; its icons are the README images in `docs/images/towers/`, bundled via `import.meta.glob`, glyph fallback), `/#spielhilfe` are its pages (the former dialogs, same element ids), `/?mission=<id>` is the game. Leaving the game pauses a solo wave and coming back resumes it; the battlefield refits on return (`Battlefield.fit`). The only persisted data is the last mission id (`app/progress.ts`, localStorage), which only ever offers "Restart Last Mission" from wave 1. The home page's primary button comes from the pure `homeAction` (`app/home-action.ts`: Start Playing / Resume Game / Restart Last Mission; a won or lost game is not resumable). Menu styles live in `src/menu.css` (tokens `--m-*`, scoped to `.start-screen`); the HUD stays in `style.css`. The mission page is the Sector Atlas (`ui/sector-atlas.ts`): a Campaign/Circuit mode toggle, a horizontal gallery of sector cards (one mode at a time, Circuit sectors never in the campaign gallery), the featured mission (a large battlefield preview beside its briefing with the one Start button) and a rail of the sector's missions; each region updates on its own (`selectSector`, `selectMission`), and picking a mission never launches it. Previews and card covers are the real terrain (`drawTerrain`) rendered to image URLs by `render/terrain-snapshot.ts`: one lazily created canvas-renderer Phaser game, asleep between jobs, cached per map, with `mapPreviewSvg` shown until the picture is ready (and kept if it fails). The multiplayer page splits Create Room / Join Room / lobby in the UI layer only (`app/coop.ts`; `app/room-code.ts` has the code normalisation and the clipboard helper). Multiplayer needs several tabs, one per player.

## Language

- Everything is English: code, comments, identifiers, these notes and all player-facing text (HTML in `ui/interface.ts`, texts in `ui/messages.ts`, `ui/players.ts`, `app/*.ts`, mode rules in `core/modes.ts`, content names, README.md). There is no i18n layer.
- The simulation returns language-neutral `MessageCode`s (`CommandResult.code`). `ui/messages.ts` maps every code to its text, and adding a code without a text fails `tsc`.
- Ids (mission, tower, enemy, map) stay as they are; only display names are English. The URL hashes `/#missionen`, `/#mehrspieler`, `/#gegnerakte`, `/#spielhilfe` and the map ids (e.g. `korallengraben`) are unchanged identifiers.

## Layout

| Path | Contents |
| --- | --- |
| `src/core/` | Pure simulation: no DOM, no Phaser. `game.ts` (`Game`, command `HANDLERS`, `tick`), `types.ts`, `economy.ts` (wallets), `upgrades.ts`, `validation.ts` (`ContentError` with paths like "Mission kernfestung › Wave 7 › Group 2"), `hash.ts` (`stateHash`, `fnv`), `modes.ts` (multiplayer mode registry), `match.ts` (versus engine), `strategies/` (test bots) |
| `src/systems/` | Tick systems on `Sim` (`{ state, mission, content }`): spawn, status, movement, detection, combat, waves, traits, auras. `attacks/` has one module per attack kind, `damage.ts` the single damage pipeline |
| `src/content/` | Towers, enemies, upgrades, maps, waves, missions; sectors II and later in `content/sectors/*.ts`. `content/index.ts` exports `DEFAULT_CONTENT` (`ContentPack`) |
| `src/render/` | Phaser scene (`scene.ts`, `Battlefield`, `LocalDriver`), draw registries (`towers.ts`, `enemies.ts`, `projectiles.ts`, `effects.ts`, `terrain.ts`), shared primitives (`shapes.ts`) and lighting helpers (`material.ts`), barrel geometry (`muzzles.ts`) and the projectile trail memory (`trails.ts`) |
| `src/ui/` | DOM HUD (`interface.ts`, all markup is one template string), messages, tooltips, wave forecast, live units, multiplayer HUD (`players.ts`) |
| `src/app/` | Input (`input.ts`), dialogs, multiplayer lobby/session (`coop.ts`), audio, fullscreen, WebMCP tools (`webmcp.ts`) |
| `src/net/` | `protocol.ts` (messages, `MAX_PLAYERS`, `PLAYER_COLORS`), `client.ts` (`RelayClient`, `relayUrl`), `lockstep.ts` (`LockstepDriver`, `coopSim`) |
| `server/` | `room.ts` (socket-free lockstep room, tested) and `relay.ts` (WebSocket server) |
| `src/main.ts` | Wiring: state → view → UI → battlefield → input |

## Rules that must hold

- **All state changes go through `Game.command`** (or `Match.command` in versus). Each `HANDLERS` entry has an optional `allowedIn` status guard. Render and UI code only read state.
- **The simulation is deterministic:** fixed step `FIXED_STEP = 1/30`, no `Math.random`, no wall-clock time, and stable iteration order. Multiplayer relies on it; `net/lockstep.test.ts` compares state hashes across clients every frame. The only randomness is `roomCode` on the server.
- **Graphics never change the simulation.** Events (`GameEvent` union) are drained after each render frame. Render-side memory (`render/trails.ts`) only reads the state.
- **Solo play is the baseline.** New optional fields on state, enemies or spawns must stay `undefined` in solo, so solo state and balance stay unchanged (example: `sentBy`).
- **Content is separate from runtime instances.** Upgrades never mutate definitions, and `Tower.upgrades: string[]` is the only source of upgrade progress.
- `Game` accepts its own `ContentPack` (`new Game(mission, content)`). Pure queries (`resolveUpgrades`, `effectiveTowerStats`, …) take `content` as the last, optional parameter. `resolveUpgrades` is cached per content pack and upgrade list.

## Rendering

- **Layers** (`scene.ts`), bottom to top, with explicit depths from `DEPTH` (`render/depths.ts`): terrain (baked), `ambient`, `hints` (build-mode cells, coverage overlay), `towerInk` + `towerGlow` (plus a `ghost` of the trap being placed), `enemyUnderlay`, `enemyBody`, enemy sprites, `enemyOverlay`, `ink` + `glow` (selection ring, shots, effects, portal pulse), income labels. Objects created mid-game (sprites) must set a depth; equal depths keep creation order. The glow layers blend additively and sit above their ink. Tower light lies below the enemies, so units and health bars are never lit.
- **Terrain** (`terrain.ts` `drawTerrain`, drawn once per mission): ground from `ground.ts` (smooth value-noise tone instead of a hard checkerboard, soft patches, a material grain per `GROUND_FAMILY` of the theme, contact darkening along obstacles and the path, and a bevelled pad on every buildable cell), decor at 0.7 alpha, a soft `contactShadow` (`landmark-art.ts`) under every obstacle, landmarks, the path with depth (cast shadow, lit and shaded lip, sunken bed, worn lanes, grit), entry and reactor, `drawBoardLight` (light pool from the upper left, vignette) and the labels. `drawTerrain` returns its objects; `Battlefield.bakeTerrain` draws them, hidden, into one RenderTexture at the camera zoom (re-baked when the zoom changes), so terrain detail costs nothing per frame. New randomness uses salted seeds (`groundRandom`, `hash01`), so the themes' own `cellRandom` rolls stay unchanged. **Landmarks:** `landmarkSpots` (`landmarks.ts`, pure) picks up to two 2×2 obstacle blocks, else single obstacle cells with the most obstacle neighbours; `landmark-art.ts` draws one set-piece per ground family there instead of the obstacles, and `landmarkLight` animates its light in `drawAmbient`. **Overlays:** with a trap armed and a cursor on the board, every path cell `canBuild` accepts gets a hint (cached per tower layout), the trap shows as a ghost and a blocked cell as a red ✕ (other towers keep the crosshair marker); hovering a built tower shows its range; `ViewState.coverage` (key C, `#coverage-btn`) draws every attack tower's range and a strip along the path from `pathCoverage` (`coverage.ts`, pure: red 0, amber 1, accent 2+ towers reaching ground units), shown dimmed while an attack tower is being placed.
- **Enemy stages** (`render/enemies.ts`): `enemyContext` is built once per enemy and frame; `drawEnemyUnderlay` (trait fields and trails, status rings, tentacles, then the shape's shadow), `drawEnemyBody` (the shape only, from `SHAPES[shape].body`) and `drawEnemyOverlay` (trait and status markers, HP bar; the shimmer of an unrevealed stealth unit) each draw one layer across all units. `drawEnemy` runs all three into one Graphics (gallery). Body art never draws its own shadow. **Enemy sprites:** `ENEMY_ART` (`render/enemy-art.ts`) maps an enemy id to a right-facing PNG in `public/assets/enemies/` (texture key; optional `scale`, the *visible* longest side in body diameters, default `ART_SCALE` 1.1, slender art ×`SLENDER_BOOST`; `angleOffset`; `shift`; `pose`) plus its measured visible `bounds` from the generated `render/enemy-art-bounds.ts` (`scripts/audit-enemy-art.ts -- --write`; `enemy-art.test.ts` fails when it is stale). `pose`: absent for top-down art (turned with the heading), `"profile"` for long side views (turned, mirrored instead of upside down when moving left; worms), `"upright"` for standing side or front views (never turned, mirrored left/right, keeping the last facing while moving up or down). `queueEnemyArt`/`sceneSpriteHost` (`render/enemy-art-scene.ts`) load and create them below the Vite base path for the battlefield and the art review page; `ART_FILTERING` (trilinear mipmaps, POT textures only) is in both game configs. `EnemySprites` (`render/enemy-sprites.ts`) keeps one Image per enemy id, reused across frames, placed by the pure `placeArt` (visible bounds centred on the position, the offset rotated and mirrored with the image; worm `shift` along the heading; `bodyLift` and hover), and `drawEnemyLayers` draws the procedural body only where `isRendering(id)` is false: no art, a texture that failed to load (warned once, never retried), a hidden stealth unit or a burrowed one. A sprite casts a rotated oval shadow sized from its visible footprint (`PAINTED_SHADOW`) instead of the shape's shadow. Images are destroyed with their enemy, on a new game state and on scene shutdown. The gallery stays procedural. Painted bodies skip the procedural tentacles in the underlay. New or changed art: `scripts/audit-enemy-art.ts` (alpha, bounds, residue islands; `--fix` erases reviewed residue boxes losslessly), then `/gallery.html?art` via `scripts/enemy-art-review.ts`.
- **Enemy animations** (render only): `ENEMY_ANIMATIONS` (`render/enemy-animations.ts`) registers idle, move, hurt and death clips for every type the source manifest `assets-src/enemy-animations/manifest.json` enables (16 so far; the registry imports it, so the manifest is the only list; an entry may override clip fields per state, drop a state with `null`, or carry `disabled: "<reason>"` to keep a reviewed but unsuitable source out of the game), all from one grid sheet per type (`sheetKey`; a clip is a row: `start` frame plus `frames`, `sheetFrame` gives the Phaser frame); static art tuning stays authoritative (`animationArt` swaps in the cells' `ANIMATION_BOUNDS`). `queueEnemyAnimations` loads one spritesheet per type; the battlefield passes `missionAnimationTypes` (wave types plus split/brood offspring), so a mission loads only its own sheets (each decodes to 8 MiB) and releases the others on the next mission change (`sheetPlan`); a type without a loaded sheet shows its static art. New sheets follow the project skill `.claude/skills/animation-pack/SKILL.md` (identity check before any rename, manifest entry, normalizer, audit and `-- --write`, review on `/gallery.html?anim` and in game; the first extra pack had ten sheets under each other's names). `EnemySprites` keeps one Image per enemy and sets the frame from `fxClock` via the pure `animate` (`render/enemy-animator.ts`: move/idle with hysteresis, one hurt clip per fresh hit with a gap, fallbacks move↔idle → static art → procedural); no Phaser animation definitions, so pause freezes everything. During a hurt clip the white flash is skipped. Deaths: `killedEnemies` takes only a `kill` event directly preceded by its victim's `damage` event at the same spot; `EnemySprites.retire` turns a visible animated body into a bounded (`MAX_DYING`) dying Image at its last placement. Codex previews (`ui/codex-preview.ts`) step the same sheets with `clipFrame` on a CSS background, one at a time, paused under reduced motion. DOM icons use painted art (`ui/enemy-art-icon.ts`) with the SVG as fallback. In dev builds `window.__enemySprites` exposes the manager for QA scripts.
- **Enemy feedback** (render only, never in the state, hash or network): `EnemyFeedback` (`render/enemy-feedback.ts`) reads the drained `damage` events (`consume`, the batch stays untouched) for bounded hit flashes and detects shield ripples from a falling `traits.shield` (a disruption reads 0 without a hit, so it never ripples); `observe` drops the state of enemies that left or whose id changed type. Times are on `fxClock` (stops while paused, same length at every speed). `enemy-appearance.ts` holds the pure tint priority (`resolveEnemyTint`: flash, stunned, burning, disrupted, slowed, vulnerable, faceted) and idle motion (`bodyMotion`); `EnemySprites.sync` applies them, a tint only when it changes. `drawEnemyAccents` draws the procedural hit highlight, the shield ripple and at most two status accents on `enemyOverlay` under the markers and HP bar; hidden and burrowed units get none. Phaser's canvas renderer ignores tints (headless Chrome uses it unless started with SwiftShader WebGL), so then the overlay draws the hit highlight on sprites too (`SpriteHost.canTint`). `themeGlow(map)` dims both glow layers on light ground. Draw functions take a `Pen { g, glow }`.
- **Primitives:** in tower, projectile and effect code use `disc`, `ring`, `arcBand`, `wedge`, `oval`, `chamferRect` and `strip` from `shapes.ts`. Don't use Phaser's `fillCircle`, `strokeCircle`, `arc`, `slice`, `fillRoundedRect` or `fillEllipse`: Phaser splits every arc into about 100 segments.
- **Jitter** comes from `hash01` over positions, ids and time steps, never `Math.random`, so frames and screenshots repeat.
- **Lighting** (`material.ts`): light comes from the upper left (`LIGHT`, `facing`). Helpers: `plate` (bevelled plate with a sunken deck), `litBar` (metal bar), `dome`, `rivets`, `led`, `halo`, `glowLine`. Glow caps: one halo ≤ 0.3 alpha, white on glow ≤ 0.35; hot white cores are opaque fills on `g`.
- **Tower levels:**
  - L2 adds a collar and an LED.
  - L4 adds chasing LEDs and an inlay ring.
  - L5 echoes the r14 ring on glow and adds hot barrel tips.
  - L6–8 put the path colour on the trims and echo the motif on glow.
- **Barrels:** `MUZZLES` (`muzzles.ts`) holds the barrel length, recoil and parallel or fanned barrels per turret. Turret drawings, muzzle flashes (`muzzleTips`) and projectile starting points all read it.
- **Projectiles:** `Trails` (`trails.ts`) keeps per projectile id:
  - the start at the barrel tip;
  - samples for the trail;
  - the arc of point-aimed shells whose look sets `arc` (Mortar);
  - landed shots, which fade out instead of popping.

  The scene resets it when `game.state` is swapped (restart).
- **Effects:** each effect captures an `EffectOrigin` when its event arrives: the firing tower's level and angle, the landed shot's heading and blast radius.
- **Pulse, chain and beam looks** are picked by the source tower's `visual.turret`. It is found from the event colour, so base tower colours must stay unique; a shared colour falls back to the default look.

## Simulation details

- Order of `Game.tick` (only runs while `status === "wave"` and not paused): spawn, status effects, move, detection, projectiles, attack, prune dead enemies, `settleWave`.
- Targeting follows `Tower.priority` (`TargetPriority`: first, last, strong, weak, close; set with `{ type: "target", id, priority }`). Absent means "first", the most path progress, and the handler deletes the field when "first" is chosen, so solo state stays unchanged. `compareTargets` (`systems/combat.ts`) orders candidates; ties fall back to path progress, then the stable id. An attack module's `choose` (Lance) receives the candidates in that order.
- Damage lands on impact. Projectiles are part of the state, fly at `projectile.speed` per tower, and still land after their tower is sold.
  - Homing shots (Pulse, Flak, Cryo) retarget within 1.5 cells when their target dies.
  - Nova rockets fly to a fixed point.
  - Tesla, Lance, Focus, Quake, Gravitron and Jammer hit instantly (`Impact.from`, `Impact.reach`). Quake centres its wave on `Impact.from`, the tower itself.
  - Shrapnel: a module's `volley` hook makes `attackEnemies` fire at that many different candidates per salvo, the chosen target first, then in priority order. Executioner judges its threshold on impact.
  - Mortar shells fly to a fixed point like Nova; its module's `minRange` hook makes `attackEnemies` skip enemies inside the dead zone.
  - Focus keeps its target through `choose` (which also receives the firing `Tower`) and stores its charge in `Tower.focus`, which is part of `stateHash`.
- Always deal damage through `applyDamage` (`systems/damage.ts`) and apply status effects through `applyStatus` (`systems/status.ts`).
- Status merge rules: for slow, burn and vulnerable, the stronger effect replaces the weaker one and an equal one extends it. Stun and pull (Gravitron) block further stuns or pulls until their recovery time ends. A pull is a negative speed factor, so it beats slow and stun; `moveEnemies` clamps `distance` at 0 on reactor maps. The stronger net (Snare Net) replaces a weaker one, and a disruption extends.
- `disrupted` (Jammer) hides the `DISRUPTABLE` traits (shield, regen, healer, leader, stealth, evade) from `traitsOf`, so every trait hook and `isHidden` follow it. `isHidden` also covers `burrow` (Burrower), which is stateless (derived from `distance`), not disruptable and not revealed by a detector; traps and area damage still hit. `netted` makes `canTarget` treat a flyer as air and ground.
- Passive support effects live in `systems/support.ts`: `bountyBonus` (Bounty Beacon, added to the kill reward in `applyDamage`), `markFactor` (Tracker, multiplied with `damageTaken` before armor) and `repairReactor` (Repair Dock, in `settleWave`). Like auras they are derived on every query and take the strongest overlapping tower. `availableTowers` drops `repair` towers on circle missions. Burn ticks every 0.5 s and credits the source tower even after a sale. Vulnerable applies before armor.
- Aura bonuses are derived from the current towers on every query, with no cache. Overlapping auras use the maximum bonus per stat. Cooldowns store the remaining fraction of a cycle, so a speed change never grants a free shot.
- Support towers are recognised by `aim: "none"` of their attack module (`isSupport`). They have no `targets`, no damage and no fire rate, are never buffed by auras, and only towers with an area (aura, detector, beacon, tracker) need a range. Their specs form `SupportAttack`, which `attackTower` excludes.

## Adding content

New towers and enemies need a README image: run `scripts/readme-images.ts -- --only towers` (or `enemies`) and add the `<img>` in front of the name in the README table, like the existing rows.

Whole mission packs (new sectors, themes, enemies) follow the project skill `.claude/skills/mission-pack/SKILL.md`: foundation agent, parallel sector and theme agents, integration checklist. New enemies or traits for the existing campaign follow `.claude/skills/enemy-pack/SKILL.md`. Supplied enemy animation sheets follow `.claude/skills/animation-pack/SKILL.md`.

- **Mission:** add a `MissionDefinition` to a sector in `content/missions.ts` (or `content/sectors/*.ts`).
  - The fields are map, waves, `startingCredits` and `reactorEnergy`.
  - Optional: `hpGrowth` (default 0.14 per wave) and `availableTowers`.
  - `SECTORS` groups missions, and `MISSIONS` is the flat list derived from it; position determines the mission number. Validation checks that the sectors contain exactly `missions`, in order.
- **Map:** `parseMap(id, name, sketch, theme)` in `content/maps.ts`.
  - The ASCII sketch is the only source of truth: `S` entry, `R` reactor, `=` path, `#` obstacle, `.` buildable.
  - Size and path order are derived from it. Branches, dead ends and loose path cells are rejected with their coordinates.
  - A new terrain style needs an entry in `THEMES` (`render/terrain.ts`) and a value in `MapTheme`.
- **Circle mission (Circuit mode: the trailing sectors `circle.ts`, `gear.ts`, `tide.ts` in `content/sectors/`; every circle sector comes after all campaign sectors):**
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
  - `visual`: `icon`, `turret`, `projectile`, `muzzle`, `impact`.
    - Projectile styles: tracer, shell, crystal, twin, ember, glob, orb, net, rocket, lob, glaive, shard.
    - A new look is one entry in `PROJECTILES` (`render/projectiles.ts`: body, optional trail and impact).
    - A new barrel is one entry in `MUZZLES`.
  - `targets`: the layers it can hit

  Menu, tooltips, detail values and validation are generated from the definition. The build menu has category tabs (Attack, Control, Traps, Support) once a mission offers `PAGED_FROM` towers; `pageOf` in `ui/tower-pages.ts` derives the tab from `placement` and the attack (traps, support towers, or `CONTROL_KINDS`). Menu order follows `towerOrder` (page by page). Hotkeys come from `hotkeyTowers(game, view.page)`: with tabs every tab numbers its towers from 1 (`TOWER_KEYS` in `ui/interface.ts`, 14 keys per tab; `t`, `f` and `n` are taken), and `Shift`+`1`–`4` (by `e.code`) opens a tab.
- **Trap:** use `trapTower` (`content/upgrades.ts`), which sets `placement: "path"` and keeps the trigger radius (`range`, about 0.45) at every level. Traps reuse the normal attack kinds.
  - `Game.canBuild(x, y, tower)` puts traps on free path cells (`isTrapCell`: not the entry and, with a reactor, not the reactor cell), everything else beside the path. The build fails with `trap-off-path`.
  - `attackEnemies` triggers traps with `canTarget` instead of `canAcquire`, so stealthed walkers set them off. Traps target ground only, so flyers pass over.
  - Trap-only kinds (`trapOnly` on the module, rejected elsewhere by validation): `bleed` (Caltrops: status `bleeding` costs `perCell` per cell walked, in `BURN_TICK` steps; standing or pushed back costs nothing), `charge` (Sticky Mine: status `charged` detonates at `until` or through the status `onDeath` hook, which `applyDamage` runs via `statusDeath`; a spent charge has `until = -Infinity`, so chains never repeat), `pit` (Pitfall: swallows enemies with `size` ≤ the spec and without `unstoppable` through an infinite hit, which `applyDamage` turns into the remaining HP) and `alarm` (Tripwire: sets `cooldown = 0` on attack towers in its radius, not on support towers or traps).
  - The scene draws traps flat (no shadow or turret rings) and suppresses their muzzle flash. A trap with `visual.impact` emits an `impact` event where it goes off.
- **Attack kind:** you need three pieces:
  - a module in `systems/attacks/` (`aim`, `projectile`, `params` with label, check and unit, `apply`)
  - an entry in `systems/attacks/index.ts`
  - a member of `AttackSpec` in `core/types.ts`

  Every `params` value can then be upgraded via `effects.attack` and shows up in the UI.
- **Status effect:** add a member of `StatusEffect` and an entry in `STATUSES` (`systems/status.ts`), with a merge rule and optional hooks.
- **Enemy:** add it to `content/enemies.ts`, with `layer` (`ground`/`air`), `visual` and optional `traits`. The available traits are armor, regen, splitOnDeath, slowImmune, shield, sprint, evade, healer, leader, stealth, unstoppable, swift, burrow, harden, surge, swarm, rage, facet, leap, dampen, brood, overload, molt, momentum, lap, refract, blastproof, insulated, heatshield, mirror, link, taunt, martyr, pack, cloakField, blink, tunnel, phase, blind, jam, defuse, suppress and retaliate. `momentum` raises speed with `distance` (a Gravitron pull takes it back); `lap` cuts damage per completed lap, `floor(distance / path.length)`, only on ring maps (always 0 with a reactor). `rage` raises speed with lost HP (`speed` hook); `facet` cuts non-dot hits in a window of the global `state.time`, so burn ticks and bleed pass while Decay (not a dot) is reduced. `leap` flips the layer in a distance window; `layerOf` (`systems/traits.ts`) is the current layer and `canTarget` uses it, so ground towers and traps miss a leaping walker and Flak misses a diving flyer. `dampen` (disruptable) makes it and enemies in its radius resist slow, stun and pull, checked in `resists`. `brood` (disruptable) lays its `type` every `every` cells (at most one per tick, never again after a pull-back); its count `Enemy.brood` stays `undefined` without the trait and is part of `stateHash`, and `tickTraits` iterates a snapshot so eggs tick from the next tick on. `overload` sets `cooldown = max(cooldown, cycles)` on attack towers (not support towers or traps) in its radius when it dies. `molt` reduces damage above an HP share and speeds up below it. Hit context: `applyDamage` takes an optional `Hit` (`systems/damage.ts`, built with `hitOf`: attack kind, `area`, `chain`, `instant`, source `tower`, Executioner `execution`); dots pass none. `refract` (instant hits), `blastproof` (area hits) and `mirror` (cap per hit, last damage stage; pit and execution pass) read it in `onDamage`, `retaliate` in `onHit`; `insulated` lives in the chain module. `link` splits a hit among same-type enemies in radius (shares cannot re-split, infinite hits are not split). `taunt` forces attack towers within its radius to pick it (`taunters` in `attackEnemies`, never traps). `cloakField` hides other enemies near it (`isHidden`, revealed by detectors, counted by `hasStealth`); `tunnel` extends `isBurrowed` with a speed bonus. `blink` jumps in `moveEnemies` (`blinkJump`, forward crossings only, clamped at the reactor). `phase` sets the layer from `state.time` in `layerOf`. `blind`/`jam` change attack-tower range/interval through the optional `sim` argument of `effectiveTowerStats` (`towerDebuffs`; previews without `sim` are unaffected), `defuse` stops traps (`isDefused`), `suppress` silences aura, detector, beacon and tracker (`isSuppressed`, not the dock). Area traits read their carriers from the incremental `withArea` lists in `systems/traits.ts`; none of them adds an `Enemy` field. DISRUPTABLE also covers link, taunt, martyr, cloakField, blink, blind, jam, defuse, suppress and retaliate. Enemies listed in `RESERVE_ENEMIES` (`core/mission-checks.ts`) exist but no mission uses them yet; remove an id when placing it (`core/missions.test.ts` checks both directions, and the README count skips them). A new trait is an entry in the `TRAITS` registry (`systems/traits.ts`), using the hooks `onDamage`, `onTick`, `onDeath` and `resists`. There is no inheritance tree and no global event bus. Stealth enemies and cloakField carriers may only appear in missions where the detector is buildable.
- **Upgrades:** `UpgradeDefinition` (`id`, `label`, `description`, `cost`, `requires`, optional `path`, `effects`) in `content/upgrades.ts`.
  - `attackTower` generates the five-level path.
  - `AURA_UPGRADES` defines the three exclusive aura paths.
  - Upgrades with different `path`s exclude each other on one tower.
  - Validation rejects duplicate ids, missing or cyclic requirements, and invalid costs or effects.
  - Every upgrade is bought with the same command, `{ type: "upgrade", id, upgrade }`.
  - `previewUpgrade` resolves a hypothetical purchase without changing state.
- **Specializations (levels 6–8):** `attackTower` appends three exclusive paths × three tiers from `content/specializations.ts` (`SPECIALIZATIONS` per tower id; ids `<slug>-<tier>`, tier I requires `level-5`, so a path may start from an upgrade without a path but never leave its path) and sets `visual.paths` (color, motif, name, role). Traps (`trapTower`) and support towers have none.
  - A tier holds final values: `effects.stats`/`effects.attack` as usual, plus `effects.specialization` (`SpecializationSpec` in `core/specialization-types.ts`, validated by `specializationError`), which `resolveUpgrades` replaces per tier.
  - `attackEnemies` snapshots it on `DamageSource.special` (and on the projectile), so it survives a sale; `hitOf` copies it to `Hit.special` for conditional damage (`deal`) and armor pierce (the armor trait). Secondary hits use `plain(src)`, so they never proc again. Fire-time procs travel as `Impact.proc` (Ricochet, Twin Arc via `Tower.specialShots`; Concentrated Volley). Overload's lone-target check happens at fire time.
  - `applyDamage` returns the primary `DamageOutcome` (Blood Transfer, Chain Reaction) and `applyStatus` whether the effect took hold (Brittle Ice, Compression, Weak Signal, Exposed Target; a rejected stun/pull merge is false). New status: `armorDissolved`; optional `stun.exposure` and `burn.spread`.
  - Aftershock waves queue in `GameState.pending`, fired by `fireAftershocks` between projectiles and attacks and cleared at wave end. `specialShots` and `pending` are hashed only when present.
  - `play()` never buys specializations, so the balance script ignores them.

## Tests

- Tests are pure Vitest with no DOM; they build a `Game` (or `Match`/`Room`) directly. Helpers in `core/test-helpers.ts`: `finishWave`, `play`, `makeEnemy`, `landProjectiles`. `play` lives in `core/play.ts` (no vitest import) so `scripts/balance.ts` can reuse it; the mission rules (air, stealth, buildability, thin defense, Nova-only, tutorial exemption) live in `core/mission-checks.ts` and are shared by `core/missions.test.ts` and the balance script.
- `core/missions.test.ts` keeps the campaign-wide content rules (ids, sector grouping, stealth only with a detector, every enemy appears). There are no golden replays or campaign simulations in the suite; mission balance is checked on demand with `scripts/balance.ts`.
- Keep tests lean: a few focused tests per new mechanic (the core formula, one edge, validation if it has params), no exhaustive matrices or snapshot tests.
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
