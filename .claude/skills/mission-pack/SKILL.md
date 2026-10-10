---
name: mission-pack
description: Add a whole mission pack (one or more new sectors with maps, waves, strategies, terrain theme and optionally new enemies/traits) to ION BASTION, using parallel Sonnet agents. Use when the user asks for new missions, a new sector, a mission pack or a new theme with missions.
---

# Mission pack

Playbook for adding new sectors fast. Your own job is the **design sheet** and the integration; Sonnet agents do the rest from the literal briefs below.

Last run: two sectors, 10 missions, 4 enemies and 2 traits.
- Foundation: about 2 min.
- Three parallel agents: about 7.5 min.
- Integration: about 3 min (`npm run test:full` about 5 s, visual check about 75 s for four missions).

Read CLAUDE.md ("Adding content") first.

## 0. Ask up front (one AskUserQuestion)

- **Themes:** they must differ from the existing `MapTheme`s (`core/types.ts`) in name *and* look. Read the obstacle comments of `THEMES` in `render/terrain.ts` first (e.g. `ember` is already basalt with glowing cracks, `shard` violet crystals, `volcano` ash and obsidian, `geode` quartz and amethyst). Suggest two with a clear look.
- **Missions and enemies:** 5 missions and 2 new enemies per sector is the convention.
- **Position:** before Kreislauf, which always stays the last sector.

## 1. Design sheet (you, about 5 min)

Fill this in once and paste it unchanged into every brief.

```
SECTOR <id> "<German name>", theme <theme>, after <previous sector>
  palette: backdrop 0x…, ground [0x…, 0x…], accent 0x…; look: <obstacles / decor / ambient in one line each>
  curve: credits <a>–<b>, hpGrowth <a>–<b>, waves <a>–<b>, finale <n> boss
  missions (ids must be new): <id> <Name>, … (mission 1 introduces enemy 1, mission 2 enemy 2, finale last)
ENEMY <id> "<German name>": <layer>, hp <>, speed <>, reward <>, leak <>, size <>, traits [<…>]; counters: <towers>
TRAIT <kind> { <params> }: <formula>; hook <speed|onDamage|isHidden|…>; flag <TraitFlags field>;
  tag "<LABEL>" / "<German title>"; render: <marker>
```

**Curve:** extrapolate from the existing sectors, don't guess. `npx vite-node scripts/mission-table.ts` prints credits, waves and HP growth per mission. Each sector is a bit harder than the one before. Example: the last two packs ran credits 680–780 and 720–820, waves 17–20.

**Enemies:**
- `npx vite-node scripts/mission-table.ts --enemies` prints the stat reference of all enemies.
- New trait enemies sit near existing ones with a similar role: a fast one about hp 45–110, a tank about 260–420.
- Every new enemy needs at least 2 counter towers from the existing roster.
- Flyers must be counterable with `flak`/`tesla`. Shielded flyers turned out to be the main danger of a sector.

**Traits:**
- Stateless only: derive them from `distance`, `hp`, `time` or the neighbourhood.
- References in `systems/traits.ts`:
  - `burrow`: hidden in a distance window
  - `harden`: `onDamage` from the HP share
  - `surge`: `speed` in a distance window
  - `swarm`: `onDamage` from neighbours
- If a trait really needs state, it gets an optional `Enemy` field, stays `undefined` in solo play, and goes into `stateHash`.

## 2. Phase 0: foundation (1 Sonnet agent, foreground)

```
Repo /Users/janic.wyslich/ion-bastion. Read CLAUDE.md. Implement the foundation for this mission pack, copying the
pattern of the existing traits burrow/harden/surge/swarm (core/types.ts, systems/traits.ts + traits.test.ts,
ui/wave-forecast.ts, render/enemies.ts, content/enemies.ts, render/terrain.ts, content/sectors/storm.ts):
<DESIGN SHEET>
1. core/types.ts: MapTheme values; Trait union members with doc comments.
2. systems/traits.ts: TRAITS entries (validate + hook), TraitFlags/traitFlags fields. Do not add new traits to DISRUPTABLE
   unless the design sheet says so.
3. systems/traits.test.ts: tests per trait (window/formula edges, validation).
4. ui/wave-forecast.ts TRAIT_TAGS; render/enemies.ts markers (visual extras via EnemyVisual fields, never d.id checks).
5. content/enemies.ts: the enemies exactly as specified, German one-line comment above each.
6. render/terrain.ts: placeholder THEMES entries with the palette (minimal obstacle/decor, empty ambient).
7. Stubs, NOT registered anywhere: content/sectors/<id>.ts exporting <CONST>: MissionSector (missions: []),
   core/strategies/<id>.ts exporting <ID>_STRATEGIES = {}.
Gate: npx tsc --noEmit; npx vitest run src/systems src/ui; npx vitest run src/core/replay (no -u; all shards). Then
`npx vite-node scripts/snapshot-diff.ts -- --expect ""` must exit 0 (no existing replay changed; new ones are fine).
"every enemy type appears in the campaign" fails until integration — expected. Do not commit.
Report: files changed, test results, any deviation from the design sheet.
```

## 3. Phase 1: parallel (Sonnet, `run_in_background`, all in one message)

### Sector agent (one per sector)

```
Repo /Users/janic.wyslich/ion-bastion. Read CLAUDE.md. You build sector <id> of this mission pack:
<DESIGN SHEET>
Files: ONLY src/content/sectors/<id>.ts (export <CONST>) and src/core/strategies/<id>.ts (export <ID>_STRATEGIES).
Style references: the latest sectors in src/content/sectors/ and src/core/strategies/.
Content: <N> missions in difficulty order with the design sheet's ids, curve and introductions; air enemies from
mission 2 on; one twist per mission (availableTowers restriction, 10 reactor energy, echo wave with hpMultiplier, …);
stealth only where detector is available, and then strategy A builds one. Strategy A = intended tactic using the new
enemies' counters, B = an alternative. Maps via parseMap(id, name, sketch, "<theme>") with a one-line English comment.
HP difficulty ONLY through mission.hpGrowth or a per-wave hpMultiplier — no helper functions that compute waves.
Loop: npx vite-node scripts/balance.ts -- src/content/sectors/<id>.ts src/core/strategies/<id>.ts --mission <missionId>
      --curve credits=<a>-<b>,waves=<a>-<b>   (add --why for leaks per enemy type / kills per tower)
      Once per mission when A and B first win: add --tune. It prints the HP factor window in which A/B still win and
      the thin/Nova defenses still lose (and the matching hpGrowth range). Set hpGrowth inside it rather than
      guessing; a margin under about 5 % on either side is fragile.
Done: final run without --mission shows no FAIL and no WARN (band, map, curve, id, hpGrowth).
Balance lessons:
- Upgrades beat tower count at hpGrowth ≈ 1; upgradeFirst is often right.
- The first 3 builds of A must be core towers (pulse/blast/flak/frost/tesla), or the 3-tower check wins.
  Traps, executioner and decay come after them.
- Dense maps (snakes and spirals, one tower covers two legs) work; loose maps cost whole iterations.
- Keep healers and tanks in separate waves.
- For swarm or splash fodder, unit count barely matters; tune HP per unit.
- hpMultiplier waves are cliff-sensitive (±2 flips a result); re-run after every change.
- Shielded or fast flyers leak first; give both strategies enough flak/tesla.
- If a strategy still loses after about 6 rounds, soften the waves.
Forbidden: editing any other file (enemy stats included — report instead), registering the sector, running
src/core/replay* / npm test / npm run build / -u, PENDING_BALANCE entries, temporary debug scripts. Ignore tsc errors in
other agents' files. Do not commit.
Report: table (id, name, twist, credits, hpGrowth, waves, energy) + final energy per strategy + deviations.
```

### Theme agent (one for all themes)

```
Repo /Users/janic.wyslich/ion-bastion. Read CLAUDE.md. Files: ONLY src/render/terrain.ts (+ small polish in
src/render/enemies.ts). Replace the placeholder THEMES entries <themes> with full themes in the quality of dune,
abyss, storm and jungle:
<look lines from the design sheet>
obstacle with soft shadow and 2 variants (the first rand() picks the variant so ambient can match it via hash), decor,
cheap ambient (flow along the path). No Math.random. Check: npx tsc --noEmit (ignore other agents' files).
Do not run tests or build, and do not commit.
```

## 4. Phase 2: integration (you)

Run the expensive checks once, after all edits. Agents' final balance runs count; do not re-run the balance script.

0. `git status`: files outside this pack mean another session works in the same tree. Leave them alone, and name them in the report.
1. Register the sectors. The order in both lists is the campaign order.
   - `content/missions.ts`: add `import { <CONST> } from "./sectors/<id>";` and put the constant in `SECTORS` before `KREISLAUF`.
   - `core/strategies/index.ts`: add `import { <ID>_STRATEGIES } from "./<id>";` and `...<ID>_STRATEGIES,` in `STRATEGIES`.
2. Text work, all before the test run:
   - `npx vite-node scripts/mission-table.ts --write` updates the README mission table and intro counts and keeps the existing short focus texts. Shorten the focus of the rows it lists by hand (style: "Nur 10 Reaktorenergie", "Finale: drei Titanen").
   - README enemy table: one row per new sector.
   - CLAUDE.md: the trait list under "Enemy", plus special rules of the new traits (e.g. an `isHidden` extension).
   - Player texts (mission `focus`, README) use the in-game tower names (`name` in `content/towers.ts`: Kryo, Glut, Teergrube, Stasis, Fangeisen …), never ids like frost or inferno. `grep -n "Frost\|Inferno\|Stase" src/content/sectors/<id>.ts` catches the usual slips.
3. One `npm run test:full` (about 5 s, input cache off; the campaign runs in `replay-N.test.ts` shards, new golden snapshots are written automatically). Then `npx vite-node scripts/snapshot-diff.ts -- --expect ""`: only "Neu", nothing changed or removed.
4. One `npm run build` (it already runs `tsc`; no separate `tsc`). Later edits to `focus` strings, README or CLAUDE.md need no new test run; only `.ts` changes the simulation reads do.
5. **Visual check, mandatory:**
   - `npm run dev` in the background, then
     `npx vite-node scripts/visual-check.ts -- <intro mission of each new enemy> --out <scratchpad>/vc`
     (it builds strategy A, plays at 2× to the first wave of each newly introduced enemy and screenshots terrain and that wave; missions run in parallel).
   - Read every PNG: terrain of each new theme, every new enemy body and trait marker.
   - If that is not possible, say so explicitly in the final report.
6. Stop the dev server (`lsof -ti:4173 -sTCP:LISTEN | xargs kill`).
7. Final report to the user:
   - the missions per sector
   - the new enemies and traits
   - test and build results
   - balance quirks
   - the visual check
   - nothing committed
