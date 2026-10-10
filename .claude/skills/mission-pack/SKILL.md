---
name: mission-pack
description: Add a whole mission pack (one or more new sectors with maps, waves, strategies, terrain theme and optionally new enemies/traits) to ION BASTION, using parallel Sonnet agents. Use when the user asks for new missions, a new sector, a mission pack or a new theme with missions.
---

# Mission pack

How to add new sectors fast. Last run: two sectors with 10 missions, 4 enemies and 2 traits took about 15 min of wall time, with one foundation agent and three parallel agents. Read CLAUDE.md ("Adding content") first.

## 0. Ask up front (one AskUserQuestion)

- **Themes:** suggest ones that differ from the existing `MapTheme`s: outpost, lock, shard, ember, core, frost, toxic, orbit, ruin, rift, dune, abyss.
- **Position:** normally before Kreislauf, which stays the last sector. The test `SECTORS.at(-1)` is circle.
- **Missions per sector:** 5 is the convention.
- **New enemies:** two per sector is the convention, usually one with a new trait and one combining existing traits.

## Difficulty curve (extrapolate from it, do not guess)

| Sector | Credits | hpGrowth | Waves |
| --- | --- | --- | --- |
| I Grenzzone | 240–400 | 0.14–0.65 | 10–15 |
| II Frostgürtel | 380–460 | 0.58–0.75 | 13–15 |
| III Säuremoor | 420–500 | 0.70–0.88 | 13–15 |
| IV Orbitaldeck | 290–540 | 0.80–0.90 | 14–16 |
| V Ruinenstadt | 480–560 | 0.80–0.92 | 15–16 |
| VI Singularität | 520–650 | 0.90–1.10 | 16–20 |
| VII Dünenmeer | 600–700 | 1.02–1.12 | 16–19 |
| VIII Tiefsee | 650–750 | 1.10 | 17–20 |
| IX Kreislauf (ring) | 400–500 | 0.30–0.45 | 8–10 |

`npx vite-node scripts/mission-table.ts` prints the current numbers.

## Phase 0: foundation (1 Sonnet agent, sequential, about 2 min)

1. `core/types.ts`: add the new `MapTheme` values. New traits go into the `Trait` union, with doc comments.
2. `systems/traits.ts`: one `TRAITS` entry per trait. Extend `TraitFlags`/`traitFlags` when the trait should be visible.
   - **Prefer stateless traits**, derived from `distance`, `hp` or `time`, like `burrow` and `harden`. A trait that needs a new `Enemy` field must keep it `undefined` in solo play and add it to `stateHash`.
   - Untargetable states go through `isHidden`, which also covers picking and the HUD.
3. Tests for each trait in `systems/traits.test.ts`.
4. Add `TRAIT_TAGS` in `ui/wave-forecast.ts` (German; `tsc` enforces it). Add markers in `render/enemies.ts`. Visual extras come from `EnemyVisual` fields, never `d.id === …`.
5. Add the enemies to `content/enemies.ts` (German comment). Their stats are fixed after Phase 0.
6. Add a placeholder entry to `THEMES` (`render/terrain.ts`), palette only, so the `Record` compiles.
7. Stub files:
   - `content/sectors/<id>.ts` exports `<NAME>: MissionSector` with `missions: []`
   - `core/strategies/<id>.ts` exports `<ID>_STRATEGIES = {}`
   - **Register neither of them.** Validation rejects empty sectors, and an import of a half-finished sector file breaks every other agent at load time (`parseMap` throws).
8. Gate:
   - `npx tsc --noEmit`
   - `npx vitest run src/systems src/ui`
   - `npx vitest run src/core/replay.test.ts` with no snapshot diff

## Phase 1: parallel (Sonnet, `run_in_background`, one message)

### Sector agent (one per sector)

Brief template, in addition to the sector's specifics:

- **Files:** only `content/sectors/<id>.ts` and `core/strategies/<id>.ts`. Use `sectors/rift.ts` and `strategies/rift.ts` as the style template.
- **Content:**
  - N missions, ordered by difficulty, with credits, hpGrowth and wave counts from the curve above
  - mission 1 introduces enemy 1, mission 2 introduces enemy 2
  - air enemies from mission 2 on
  - one twist per mission, for example `availableTowers`, 10 reactor energy, or an echo wave with `hpMultiplier`
  - stealth only where `detector` is available, and then strategy A builds one
- **Loop:** `npx vite-node scripts/balance.ts -- src/content/sectors/<id>.ts src/core/strategies/<id>.ts --mission <missionId>`. Add `--why` for leaks per enemy type and kills per tower. **No temporary debug scripts.**
- **Done means:**
  - no FAIL and no band WARN (trivial, too easy, fragile)
  - map line with ≥ 6 double cells
  - finally one run without `--mission`
- **Forbidden:**
  - `replay.test.ts` (parallel agents would write the same `.snap`), `-u`, `npm test`, `npm run build`
  - registration
  - editing other files, enemy stats included; report instead
  - `PENDING_BALANCE`
- **Balance lessons:**
  - Upgrades beat tower count when hpGrowth is around 1, so `upgradeFirst` is often the right choice.
  - The first 3 builds of A are core towers; traps come after them.
  - Dense maps work best: snakes and spirals where one tower covers two legs. Loose maps cost whole iterations.
  - Keep healers (Sanitäter, Qualle) in separate waves from tanks, otherwise healing cancels the damage.
  - Slow down unit count before you slow down HP: count matters little compared with HP per unit.
  - If a strategy still loses after about 6 rounds, soften the waves instead of tuning on.
- **Report:** a mission table (id, name, twist, credits, hpGrowth, waves, energy) and the final balance output.

### Theme agent (one for all themes)

- **Files:** only `render/terrain.ts`, plus `render/enemies.ts` for polish.
- **Content:** build out each placeholder in the style of `rift` and `ruin`: `obstacle` with shadow and variants (the first `rand()` picks the variant so `ambient` can read it via `hash`), `decor`, and a cheap `ambient` (`flow` along the path).
- **Rules:** no `Math.random`.
- **Check:** `npx tsc --noEmit`.

## Phase 2: integration (yourself)

1. Register in `SECTORS` (`content/missions.ts`, before `KREISLAUF`) and in `STRATEGIES` (`core/strategies/index.ts`).
2. Update the sector sizes in `core/missions.test.ts` ("are grouped into …").
3. `npm test`: new snapshots are written automatically. `git diff --numstat src/core/__snapshots__` must show only additions (`N 0`).
4. `npm run build`.
5. README (German):
   - intro counts
   - `npx vite-node scripts/mission-table.ts` → mission table; shorten the focus column by hand
   - enemy table
   - renumber Kreislauf, if it shifted
6. CLAUDE.md: sector range, Kreislauf number, trait list, special rules of new traits.
7. Look at it: `npm run dev`, then `http://localhost:4173/?mission=<id>` for one mission per new theme. Use the `run` skill for screenshots, and check the theme and every new enemy.
