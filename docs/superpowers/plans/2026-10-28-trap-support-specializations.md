# Trap and Support Specializations Plan

**Goal:** Every tower, not only the 30 attack and control towers, can grow past level 5: three exclusive paths × three tiers (levels 6–8) for the 15 traps and the 15 support towers, with the same purchase rules, UI, looks and Run Doctrines the attack towers already have.

## Where things stand

| Group | Factory | Levels today | After level 5 |
| --- | --- | --- | --- |
| Attack + Control (30) | `attackTower` (`content/upgrades.ts`) | 2–5 (`ATTACK_LEVELS`) | 3 paths × 3 tiers from `SPECIALIZATIONS` (`content/specializations.ts`) |
| Traps (15) | `trapTower` → `attackUpgrades(…, growsRange = false)` | 2–5 | nothing |
| Support (14) | `supportUpgrades`, `REFINERY_UPGRADES`, `DETECTOR_UPGRADES` | 2–3 only | nothing |
| Aura (1) | `AURA_UPGRADES` | none: 3 exclusive tracks × 3 tiers (`path` without `level`) | nothing |

How levels 6–8 work today, and what that means here:

- A tier is an `UpgradeDefinition` with `path`, `effects.level` 6–8 and optionally `effects.specialization` (`SpecializationSpec`, validated by `specializationError`). `isSpecialization` = `path && level`. Tier I requires `level-5`.
- The ability reaches the simulation through `resolveUpgrades(...).specialization`, snapshotted on `DamageSource.special` in `attackEnemies` (`systems/combat.ts`) and read in `deal`, the attack modules and the kill hooks.
- **Traps fire through `attackEnemies`**, so the whole pipeline already works for them. Two exceptions: a trap's trigger radius must never grow (`growsRange = false`), and dots (Caltrops bleed, burn ticks) carry no `Hit`, so damage specs never touch them.
- **Support towers never fire.** Their effects are derived per query in `systems/support.ts` (`strongest`, `reaching`) and `systems/auras.ts`. A support ability has to be read there, from `resolveUpgrades(t).specialization`, not from a damage source.
- UI (`ui/tower-card.ts`, `upgrade-tooltip.ts`, `tower-details.ts`, `specialization-text.ts`), Run Doctrines (`lockSpecializations`, `pathsOf`, `doctrinePaths`), the codex and the render level looks all key on `isSpecialization` and `visual.paths`, so most of them pick new paths up without changes.
- `play()` never buys specializations, and the strategies name the levels they buy, so `scripts/balance.ts` stays unchanged as long as strategies are not edited. The Run bot does buy Doctrine tiers, so `scripts/run-balance.ts` will move.

## Decisions (recommended, open to change)

1. **Max level 8 for every tower.** Support towers first get levels 4 and 5 (plain numeric steps, like their levels 2–3), then branch. This keeps one rule everywhere: "after level 5, pick a path", and keeps the Run's Doctrine and rank texts true without special cases.
2. **Traps reuse `SPECIALIZATIONS`.** `trapTower` appends `specializationUpgrades` like `attackTower`. Most trap paths use existing kinds; only a few new ones are needed.
3. **Support gets its own spec union**, `SupportSpecialization` in `core/specialization-types.ts`, stored in the same `effects.specialization` slot (the union widens) and validated through the same `FIELDS` table. Support tiers lean on attack-param overrides (`effects.attack`, final values) and use a rider only where a number can't express the idea.
4. **Aura keeps its tracks as its paths.** Tiers I–III become levels 2–4, a plain tier IV is level 5, and tiers V–VII on the same track are levels 6–8 with a rider. `isSpecialization` becomes `path !== undefined && (level ?? 0) >= 6`, so the Run keeps Aura's existing tracks and gates only the new tiers behind a Doctrine. (Alternative: leave Aura out; see open questions.)
5. **Costs** follow `SPECIALIZATION_COSTS` (2.5 / 4 / 6 × build cost) for traps. Support towers pay off over the whole mission, so their tiers use flat cost tables in the style of `supportUpgrades` (about 1.6× / 2.4× / 3.4× the level-3 price) instead of build-cost multiples.

## Path designs

♻ = existing `SpecializationSpec` kind or plain attack/stat override; ✚ = new kind. Values per tier are final values, tuned in phase 6.

### Traps

| Trap | Path A | Path B | Path C |
| --- | --- | --- | --- |
| Mine (splash) | Shaped Charge: +dmg vs armored ♻ | Cluster Field: bomblets on nearby enemies ♻ `cluster` | Quick Rearm: shorter reload ♻ |
| Caltrops (bleed) | Serrated: `perCell` up ♻ | Hamstring: bleeding enemies are slowed ✚ `hamstring` | Open Wounds: bleeding enemies take +x% from every source ✚ (extend `vulnerability` to a `bleeding` status) |
| Tar Pit (slow) | Brittle Tar ♻ `brittle-ice` | Spreading Bog: slows neighbours too ♻ `frostburst` | Flammable Tar: tarred enemies count as oiled ✚ `tar-oil` |
| Bear Trap (stun) | Exposure ♻ `temporal-exposure` | Double Jaw: wider grab, longer hold ♻ | Hair Trigger: shorter reset and recovery ♻ |
| Flame Grate (burn) | Wildfire ♻ | Scorch: +dmg vs burning ♻ `conditional-damage burning` | Blast Furnace: `ratio`/`duration` up ♻ |
| Spring (pull) | Compression ♻ | Catapult: `strength` up ♻ | Concussion: thrown enemies are stunned on landing ✚ `landing-stun` |
| Sticky Mine (charge) | Chain Reaction ♻ | Breaching Charge: +dmg vs armored ♻ | Contact Fuse: `fuse` and `radius` ♻ |
| Pitfall (pit) | Abyss: `size` up (never Berserker/Titan) ♻ | Spike Bed: big enemies take max-HP damage ♻ `max-hp-execute` | Quick Cover: shorter cover time ♻ |
| Tripwire (alarm) | Full Alert: `radius` up ♻ | Volley Signal: alerted towers' next shot +x% ✚ `alarm-volley` | Flare: reveals stealth in radius for d s ✚ `flare` (allowed only where the Detector is buildable, like stealth itself) |
| Barricade (block) | Bulwark: wall `hp` up ♻ | Thorn Wall: much stronger spikes ♻ stats | Choke Point: enemies held at the wall take +x% ✚ `held-exposure` |
| Warp Pad (warp) | Long Fold: `cells` up ♻ | Disorient: warped enemies are confused d s ✚ `warp-daze` (reuses Mesmer's `confuse` status) | Mass Warp: `size` up, faster recharge ♻ |
| Arc Plate (chain) | Storm Floor: `jumps`/`falloff` ♻ | Twin Arc ♻ | Overcharge: +dmg vs heavy ♻ |
| Oil Slick (oil) | Naphtha: `boost` up ♻ | Wide Spill: `radius`/`duration` up ♻ | Slick: oiled enemies are slowed ♻ `frostburst` |
| Grinder (grind) | Meat Mill: `bonus` up ♻ | Shredder ♻ `armor-pierce` | Bonesaw ♻ `max-hp-execute` |
| Harpoon (harpoon) | Whaler: `pin`/`duration` ♻ | Exposed Target ♻ | Net Cloud ♻ |

Eight new trap kinds: `hamstring`, bleeding vulnerability, `tar-oil`, `landing-stun`, `alarm-volley`, `flare`, `held-exposure`, `warp-daze` (Open Wounds may fold into the existing `vulnerability` helper).

### Support

| Tower | Path A | Path B | Path C |
| --- | --- | --- | --- |
| Aura | Damage track V–VII + armor pierce for supported hits ✚ | Speed track V–VII + first shot after a target switch is instant ✚ | Range track V–VII + aura radius grows ♻ |
| Refinery | Compounding: +N per wave it has stood, capped ✚ | Futures: part of the income paid at wave start ✚ | Core Tap: less income, +1 reactor every N waves ✚ (not on circle missions) |
| Detector | Wide Scan: radius ♻ | Exposure Scan: revealed enemies take +x% ✚ | Static Pulse: disrupts revealed enemies for d s every N s ✚ |
| Bounty Beacon | Head Money: `bonus` up ♻ | Tally: every Nth kill in radius pays double ✚ (deterministic counter on the tower) | War Chest: heavy kills pay a flat bonus ✚ |
| Repair Dock | Shipyard: `amount` up ♻ | Triage: the first leak of each wave is refunded ✚ | Salvage Dock: repairs beyond the cap pay credits ✚ |
| Tracker | Target Lock: `amount` up ♻ | Weak Point: marked enemies lose armor ✚ (reuses `armorDissolved`) | Hunter's Mark: the strongest enemy in radius takes extra ✚ |
| Overclock | Redline: `boost` up ♻ | Sustained: longer `window`, lower boost ♻ | Capacitor: the first shot of each window deals +x% ✚ |
| Fire Control | Fire Solution: `multiplier` up ♻ | Rapid Ranging: `every` down ♻ | Penetrator: crits ignore armor ✚ |
| Armory | Tungsten: `fraction` to 100% ♻ | Shred: hits dissolve armor for d s ✚ | Hollow Points: +x% vs unarmored ✚ |
| Skylink | Full Uplink: `factor` up ♻ | Wide Net: radius ♻ | Downlink: held flyers are slowed ✚ |
| Nexus | Lattice: `bonus` up ♻ | Mosaic: `cap` up ♻ | Resonance: +range per tower type ✚ |
| Workshop | Assembly Line: `amount` up ♻ | Refit: towers in radius sell for more ✚ | Prefab: builds in radius cost less ✚ |
| Vault | Compound: `rate` up ♻ | Deep Reserve: `cap` up ♻ | Insured: interest doubles after a wave without a leak ✚ |
| Shield Generator | Bastion: `amount` up ♻ | Recharge: refills mid-wave every N s ✚ | Feedback: each absorbed point pays credits ✚ (generator already dropped on circle missions) |
| Recycler | Reclaimer: `share` up ♻ | Cascade: overkill jumps twice ✚ | Meltdown: overkill becomes a burn ✚ |

Rules every support rider keeps: derived per query like the existing support effects (strongest overlapping tower wins), no randomness, any new per-tower counter (`Tally`, `Capacitor`) stays `undefined` until it is used so solo state and `stateHash` are unchanged for boards without it, and `isSuppressed` silences riders like the base effect.

## Phases

Each phase ends with `npm test` and `npm run build`; phase 6 adds the balance runs.

### Phase 1 — Framework
- `isSpecialization` → `path !== undefined && (level ?? 0) >= 6` (`core/upgrades.ts`); check every caller (`run/transform.ts`, `ui/tower-card.ts`, `specialization-text.ts`, render).
- `trapTower`: append `specializationUpgrades(definition.id, definition.cost, l5)` and `visual.paths`, like `attackTower`. Validation: a trap tier must not set `range`.
- `SupportSpecialization` union + `FIELDS` entries; `specializationError` accepts it; validation rejects a support kind on an attack tower and vice versa.
- `supportSpecializationUpgrades(id, costs)` in `content/specializations.ts` (or a new `content/support-specializations.ts` to keep the file size sane), tier I requiring `level-5`.
- Replace the "leaves traps and support towers as they were (T-009)" test with: every tower has 3 paths × 3 tiers, max level 8, trap tiers never change `range`.

### Phase 2 — Trap paths
- Fill `SPECIALIZATIONS` for the 15 traps (table above); reused kinds need no sim work beyond a test that each fires through a trap.
- Implement the new trap kinds in their system files (`status.ts`, `systems/attacks/<kind>.ts`, `traits.ts` for reveal), each with 1–2 focused tests.

### Phase 3 — Support levels 4 and 5
- Extend `supportUpgrades` tables, `REFINERY_LEVELS` and `DETECTOR_LEVELS` to level 5. Strategies don't name them, so `balance.ts` is unaffected; note them in the Run rank text (`run/ranks.ts` discounts levels 2–3 only, which stays right).

### Phase 4 — Support paths
- Per tower: path data, attack overrides, riders read in `systems/support.ts` / `auras.ts` / `systems/workshop.ts` / `systems/recycler.ts` / `economy` settle. Split into the existing g4 (Support A) and g5 (Support B) groups plus a group for the base support towers (Refinery, Detector, Beacon, Dock, Tracker) — three independent work packages.

### Phase 5 — Aura
- Level numbers on tiers I–III (2–4), tier IV (5), tiers V–VII (6–8) with riders. Check the Aura codex text and `turrets-support.ts`, which already draws Aura path options.

### Phase 6 — Looks, UI, Run, balance
- **Render:** traps are drawn flat (`render/towers.ts` `trap`), so L6–8 needs a flat equivalent: path-colour trims on the plate and the motif echoed on glow. Support turrets (`tower-art/turrets-support.ts`) get path trims and motifs the way Aura has them. Check `stillBody` still bakes support bodies.
- **Showcase:** `/gallery.html?showcase` draws L8 per path for traps and support; review there.
- **UI:** tower card and tooltips should work unchanged; verify the path choice on a trap and a support tower, the codex path list, and `specialization-text.ts` for every new kind (`MessageCode`/text coverage fails `tsc` if one is missing).
- **Run:** Doctrines pick the new paths up through `pathsOf`; check `doctrinePaths` offers, `tags.ts`, the bot in `scripts/bot.ts` (buys Doctrine tiers for its best tower; it may now choose a support tower) and Doctrine prices in `tuning.ts`.
- **Balance:** tune trap tiers so a tier costs about what the attack towers' tiers return per credit; tune support tiers against a second copy of the same tower (stacking rules: only the strongest counts, so a tier must beat building another). Run `scripts/run-balance.ts` (`--seeds 30`, full and short) before and after. `scripts/balance.ts` is only needed if strategies are edited to buy the new tiers.
- **Docs:** CLAUDE.md lines that say "Traps (`trapTower`) and support towers have none" and "levels 6–8 of attack towers"; `readme-images.ts -- --only towers` is not needed (icons don't change).

## Risks

- **Support stacking:** support effects take only the strongest tower, so riders that add a second dimension (e.g. Armory Shred) need a clear "strongest" rule per rider, or two different paths in reach must combine per rider.
- **Economy riders** (Refinery, Vault, Workshop, Beacon, Dock, Shield Generator) change co-op splits; pay through `earn`/`credit` so `splitCursor` stays exact, and extend `core/coop.test.ts` for one of them.
- **Versus:** riders touching income must stay inside one field; `lockstep.test.ts` should run one board with a specialized trap and support tower.
- **Run journal:** new upgrade ids change no existing hash, but old journals for a run mission that bought nothing new replay unchanged.

## Open questions

1. Levels 4–5 for support before the paths (recommended), or branch support towers straight after level 3?
2. Aura: renumber its tracks into levels (recommended), or leave Aura as it is?
3. Should the balance strategies start buying the new tiers, or stay level-5 baselines as today?
