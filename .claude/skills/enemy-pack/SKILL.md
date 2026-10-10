---
name: enemy-pack
description: Add one or more new enemies (optionally with new traits or visual extras) to ION BASTION and work them into existing missions, with Sonnet agents only where they pay off. Use when the user asks for new enemies, a new enemy type, a new trait or enemy ability ("neue Gegner", "Gegnertyp", "Eigenschaft", "Fähigkeit") without asking for new missions or sectors. For new missions or sectors use the mission-pack skill instead; it includes enemies.
---

# Enemy pack

Playbook for adding enemies to the existing campaign. Your own job is the **enemy sheet**, the placement and the integration.

Read CLAUDE.md ("Adding content", "Enemy", "Status merge rules") first. If the user also wants new missions, use `.claude/skills/mission-pack/SKILL.md` instead.

Every new enemy must appear in at least one existing mission ("every enemy type appears in the campaign"), so those missions' golden replays change on purpose. Keep the set of touched missions small.

## 0. Ask up front (one AskUserQuestion)

- **Count and role:** how many enemies, and the role of each (fast runner, tank, flyer, support, gimmick). Suggest roles the roster lacks, based on `npx vite-node scripts/mission-table.ts --enemies`.
- **Trait:** existing traits only, or a new trait. Suggest one concrete mechanic per new trait.
- **Placement:** which sector(s). Default: the sector whose theme fits, in its last 2–3 missions. Never sector I (`"sector I keeps the base roster"`) and never stealth outside detector missions.

## 1. Pick the path

| Request | Path |
| --- | --- |
| 1–2 enemies, existing traits only, one sector | **Small:** no agents. Write the enemies, place them, run the balance loop (section 4) yourself, integrate. |
| New trait(s), one sector | **Trait:** Phase 0 agent for the trait, then place and balance yourself or with one background agent. |
| Enemies in several sectors | **Wide:** Phase 0, then one balance agent per sector in parallel. |

Enemies that only use existing traits need no Phase 0: write them into `content/enemies.ts` yourself and start their placement right away, in parallel with a Phase 0 agent for the trait enemies.

## 2. Enemy sheet (you, about 5 min)

Fill this in once and paste it unchanged into every brief.

```
ENEMY <id> "<German name>": <layer>, hp <>, speed <>, reward <>, leak <>, size <>, color 0x…,
  visual { shape <polygon|glider>, sides <>, rotation <> [, <new EnemyVisual field>] }, traits [<…>]
  role: <one line>; counters: <≥2 existing towers>; resists: <towers>
  placement: <missionId> waves <n,…> (replace/add groups: g("<id>", count, interval, delay))
TRAIT <kind> { <params with ranges> }: <formula>; hook <speed|onDamage|onTick|onDeath|resists|isHidden>;
  disruptable <yes/no>; flag <TraitFlags field>; tag "<LABEL>" / "<German title>"; render: <marker, below/above body>
```

**Stats:** start from the nearest enemy with the same role in the `--enemies` table and adjust from there.
- Ranges: fast about hp 45–110 / speed 1.2–1.6, tank about hp 260–420 / speed 0.7–0.9, flyer hp 60–140.
- `reward`: the neighbour's reward plus 2–6 per trait. In Belagerung, sending costs 4× reward (`sendCost`), so a cheap but dangerous enemy breaks versus.
- `leak` 1 for fodder, 2 for tanks and flyers, 3+ only for bosses.
- `size` decides Fallgrube: it swallows `size` ≤ 0.2, at level 4 ≤ 0.25, at level 5 ≤ 0.28 (`content/towers.ts`, pit). Note in the sheet which threshold the enemy falls under.
- At least 2 counter towers from the existing roster. Flyers must be counterable with `flak`/`tesla`.

**Traits:**
- Prefer a combination of existing traits; a new trait must add a decision for the player.
- Stateless only: derive it from `distance`, `hp`, `state.time` or the neighbourhood. References in `systems/traits.ts`: `burrow` (hidden in a distance window), `harden` (`onDamage` from the HP share), `surge` (`speed` in a distance window), `swarm` (`onDamage` from neighbours).
- If a trait really needs state, it gets an optional `Enemy` field, stays `undefined` without the trait, and goes into `stateHash`.
- Only add it to `DISRUPTABLE` if the sheet says so.

## 3. Phase 0: trait implementation (1 Sonnet agent, foreground)

```
Repo /Users/janic.wyslich/ion-bastion. Read CLAUDE.md. Implement these traits and enemies, copying the pattern of the
existing traits harden/surge/swarm (core/types.ts, systems/traits.ts + traits.test.ts, ui/wave-forecast.ts,
render/enemies.ts, content/enemies.ts):
<ENEMY SHEET>
1. core/types.ts: Trait union members with doc comments (ranges, statelessness); new EnemyVisual fields if any.
2. systems/traits.ts: TRAITS entries (validate with German messages + hook), helper with a one-line doc comment,
   TraitFlags/traitFlags fields. DISRUPTABLE only if the sheet says so.
3. systems/traits.test.ts: tests per trait (formula and window edges, validation rejects bad params).
4. ui/wave-forecast.ts TRAIT_TAGS (German label and title with the params' numbers); render/enemies.ts TRAIT_COLORS
   entry and marker (visual extras via EnemyVisual fields, never d.id checks).
5. content/enemies.ts: the enemies exactly as specified, German one-line comment above each (trait + counters).
Do NOT touch missions or strategies.
Gate: npx tsc --noEmit; npx vitest run src/systems src/ui; npx vitest run src/core/replay (no -u, all shards, must pass
unchanged). "every enemy type appears in the campaign" fails until placement — expected. Do not commit.
Report: files changed, test results, deviations from the sheet.
```

## 4. Placement and balance (you, or Sonnet with `run_in_background`, one agent per sector, all in one message)

```
Repo /Users/janic.wyslich/ion-bastion. Read CLAUDE.md. The new enemies exist already (content/enemies.ts); work them
into sector src/content/sectors/<file>.ts:
<ENEMY SHEET>
Files: ONLY src/content/sectors/<file>.ts and src/core/strategies/<file>.ts, only the missions on the placement lines.
0. Baseline FIRST, before any edit: npx vite-node scripts/balance.ts -- src/content/sectors/<file>.ts
   src/core/strategies/<file>.ts   — keep the output.
1. Put the enemies into the listed waves. Replace groups of a similar role rather than only adding, so wave length and
   difficulty stay close. Introduce each enemy in a light wave (small count, no other trait enemies), then mix it in.
2. Adjust strategies only if needed (counters to the new enemies: flak/tesla for flyers, detector for stealth). The first
   3 builds of A stay core towers (pulse/blast/flak/frost/tesla).
Loop: the baseline command plus --mission <missionId> --why. Once per mission, after placing the enemies: add --tune
      (HP factor window in which A/B still win and the thin/Nova defenses still lose; aim the waves into it instead of
      guessing in ±2 steps; it WARNs when the window is not monotonic).
Done: a final run without --mission shows no FAIL and no WARN that the baseline did not have; --why shows the new enemies
dying, not only leaking.
Balance lessons:
- Shielded or fast flyers leak first; give both strategies enough flak/tesla.
- Keep healers and tanks in separate waves.
- hpMultiplier waves are cliff-sensitive (±2 flips a result); re-run after every change.
- If a strategy still loses after about 6 rounds, lower the new enemy's count before touching other groups.
- If the enemy itself is the problem (unkillable, trivial), stop and report a stat proposal instead of hiding it in waves.
Forbidden: editing enemy stats, traits or any other file, missions not on the placement lines, running src/core/replay* /
npm test / npm run build / -u, PENDING_BALANCE entries, temporary debug scripts. Do not commit.
Report: baseline vs. final output, per mission the wave changes (before → after), stat proposals.
```

Stat proposals: apply them yourself in `content/enemies.ts` and re-run the loop of every sector that uses the enemy (or send the change to its agent via SendMessage).

## 5. Integration (you)

Run the expensive checks once, after all edits. `git status` first: files outside this pack mean another session works in the same tree; leave them alone and name them in the report.

1. Run `npx vitest run src/core/replay -u` (all shards, a few seconds; unchanged missions come from the input cache), then
   `npx vite-node scripts/snapshot-diff.ts -- --expect <placement mission ids, comma-separated>`
   (per changed replay the first diverging wave and the final trace; exit 1 on any other mission).
   Only missions on the placement lines may appear. Any other mission means the trait leaks into solo state (an optional field that is not `undefined`, a changed iteration order): fix it, don't accept it.
2. Text work, before the final test run:
   - `npx vite-node scripts/mission-table.ts --write` (enemy count in the README intro, mission table if waves changed).
   - README "Gegner": add the enemies to their sector's row (`Name (Eigenschaft kurz)`), or a sentence below the table if they join several sectors.
   - Fallgrube, if a new enemy is under a pit threshold: the level descriptions in `content/towers.ts` and the README trap row both name the swallowed enemies.
   - CLAUDE.md: the trait list under "Enemy", plus special rules of new traits (an `isHidden` extension, a new `Enemy` field in `stateHash`, DISRUPTABLE).
   - Player texts use the in-game tower names (`name` in `content/towers.ts`: Kryo, Glut, Teergrube …), never ids like frost or inferno.
3. One `npm run test:full` (cache off, about 5 s) and one `npm run build` (it already runs `tsc`). Later edits to texts, README or CLAUDE.md need no new run.
4. **Visual check, mandatory:**
   - `npm run dev` in the background, then
     `npx vite-node scripts/visual-check.ts -- <placement mission> --enemies <id>[,<id>] --out <scratchpad>/vc`
     (builds strategy A, plays at 2× to the first wave with each enemy, screenshots terrain and the field with the forecast).
   - Read every PNG: the body and the trait marker (a damaged enemy shows HP-driven markers). For a changing state (window, HP share) run it twice or compare two enemies.
   - If that is not possible, say so explicitly in the final report. Stop the dev server afterwards.
5. Final report to the user:
   - the new enemies (stats, traits, counters) and traits
   - where they appear (mission, waves) and which snapshots changed
   - test and build results
   - balance quirks and stat changes
   - the visual check
   - nothing committed
