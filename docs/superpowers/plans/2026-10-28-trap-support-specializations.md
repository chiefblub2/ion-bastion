# Trap and Support Specializations Plan

**Goal:** Every tower, not only the 30 attack and control towers, gets exclusive upgrade paths: three paths × three tiers. Traps branch after level 5 (levels 6–8, like the attack towers). Support towers branch after level 3 (levels 4–6) and their paths **reshape** the tower instead of raising its numbers. The purchase rules, UI, looks and Run Doctrines stay the same as the attack towers'.

## Where things stand

| Group | Factory | Levels today | After the last level |
| --- | --- | --- | --- |
| Attack + Control (30) | `attackTower` (`content/upgrades.ts`) | 2–5 (`ATTACK_LEVELS`) | 3 paths × 3 tiers from `SPECIALIZATIONS` (`content/specializations.ts`) |
| Traps (15) | `trapTower` → `attackUpgrades(…, growsRange = false)` | 2–5 | nothing |
| Support (14) | `supportUpgrades`, `REFINERY_UPGRADES`, `DETECTOR_UPGRADES` | 2–3 | nothing |
| Aura (1) | `AURA_UPGRADES` | none: 3 exclusive tracks × 3 tiers (`path` without `level`) | — (already pathed) |

How specializations work today, and what that means here:

- A tier is an `UpgradeDefinition` with `path`, `effects.level` and optionally `effects.specialization` (`SpecializationSpec`, validated by `specializationError`). `isSpecialization` is `path && level`. Tier I requires `level-5`.
- The ability reaches the simulation through `resolveUpgrades(...).specialization`, snapshotted on `DamageSource.special` in `attackEnemies` (`systems/combat.ts`) and read in `deal`, the attack modules and the kill hooks.
- **Traps fire through `attackEnemies`**, so the whole pipeline already works for them. There are two exceptions: a trap's trigger radius must never grow (`growsRange = false`), and dots (Caltrops bleed, burn ticks) carry no `Hit`, so damage specs never touch them.
- **Support towers never fire.** Their effects are calculated per query in `systems/support.ts` (`strongest`, `reaching`), `systems/auras.ts`, `systems/workshop.ts`, `systems/recycler.ts` and the wave settlement. A support ability is read there, from `resolveUpgrades(t)`, not from a damage source.
- The UI (`ui/tower-card.ts`, `upgrade-tooltip.ts`, `tower-details.ts`, `specialization-text.ts`), Run Doctrines (`lockSpecializations`, `pathsOf`, `doctrinePaths`), the codex and the render looks key on `isSpecialization` and `visual.paths`, so most of them pick up new paths unchanged. Places that assume "levels 6–8" (render trims at `level >= 6` in `render/towers.ts`, the Doctrine and shop texts in `run/`) need a path-based check instead.
- `play()` never buys specializations, and the strategies name the levels they buy, so `scripts/balance.ts` results don't change unless strategies are edited. The Run bot does buy Doctrine tiers, so `scripts/run-balance.ts` results will move.

## Decisions

1. **Traps: levels 6–8**, appended by `trapTower` exactly like `attackTower` (tier I requires `level-5`). Most trap paths reuse existing kinds.
2. **Support: paths are levels 4–6** and tier I requires `level-3`. No plain levels 4–5 are added: they would be exactly the number inflation the paths are meant to avoid. Max level is 6 for support towers and 8 for everything else.
3. **`isSpecialization` stays `path && level`.** Support tiers carry levels 4–6, so they count, and the Run gates them behind Doctrines like any path. Aura's tracks carry no level, so they keep working unchanged in the Run.
4. **`specializationUpgrades(id, cost, base, from)`** takes the level it branches from (5 for attack and trap towers, 3 for support) and numbers the tiers `from + 1 … from + 3`. Support path data lives in a new `content/support-specializations.ts`, so `specializations.ts` (554 lines) doesn't double.
5. **A separate `SupportSpecialization` union** in `core/specialization-types.ts`. It is stored in the same `effects.specialization` slot and validated through the same `FIELDS` table. Validation rejects a support kind on an attack tower or trap, and the reverse.
6. **Aura is left out.** Its tracks are already its paths. A later pass could give each track one rider tier (see open questions).

## Support design rules

Support effects overlap by "only the strongest counts" and multiply a whole cluster of towers, and the economy towers compound over a mission. Plain number increases on them are therefore far stronger than the same increase on one attack tower. The Bounty Beacon is the clearest case: level 3 already pays double credits for kills within 3 cells, the bonus scales with every kill in the busiest part of the path, stacks with the Run's Bounty Contract relic and pays off on every later wave.

Rules every support path follows:

1. **No ceiling goes up.** A path never raises the tower's level-3 headline value (bonus share, income, interest cap, discount, absorb, mark, crit multiplier, pierce) in general. It may exceed it only under a narrower condition, and then the common case pays less.
2. **Every tier I is a trade-off:** the path gains one thing and gives up another, named on the card ("+… · −…"). Tiers II and III mostly **shrink the drawback** or widen the condition; the gain moves little.
3. **Economy paths convert credits; they don't add them.** Beacon, Refinery, Vault, Workshop, Dock and Shield Generator paths turn credits into timing, risk, reactor energy or combat, or tie them to a condition. Their expected income in a reference mission stays at or below level 3 (checked by the script in phase 5).
4. **Hard caps per wave** on anything that pays credits or energy, so a crowded wave or a Run relic can't snowball.
5. **Deterministic and derived.** Effects are calculated per query like today. Any new per-tower counter stays `undefined` until it's used, so `stateHash` and solo state are unchanged for boards without one. `isSuppressed` silences a path like the base effect. Credits go through `earn`/`credit`, so co-op splits stay exact.
6. **Overlap rule per path:** two different paths of the same tower in reach each apply their own effect, but only the strongest tower of each path counts. This keeps "build two different Armories" from doubling one stat while still allowing combinations.

## Path designs

### Traps (levels 6–8)

♻ = existing `SpecializationSpec` kind or plain attack/stat override; ✚ = new kind. The values per tier are final values, tuned in phase 6.

| Trap | Path A | Path B | Path C |
| --- | --- | --- | --- |
| Mine (splash) | Shaped Charge: +dmg vs armored ♻ | Cluster Field: bomblets on nearby enemies ♻ `cluster` | Quick Rearm: shorter reload ♻ |
| Caltrops (bleed) | Serrated: `perCell` up ♻ | Hamstring: bleeding enemies are slowed ✚ `hamstring` | Open Wounds: bleeding enemies take +x% from every source ✚ (a `bleeding` vulnerability) |
| Tar Pit (slow) | Brittle Tar ♻ `brittle-ice` | Spreading Bog: also slows neighbours ♻ `frostburst` | Flammable Tar: tarred enemies count as oiled ✚ `tar-oil` |
| Bear Trap (stun) | Exposure ♻ `temporal-exposure` | Double Jaw: wider grab, longer hold ♻ | Hair Trigger: shorter reset and recovery ♻ |
| Flame Grate (burn) | Wildfire ♻ | Scorch: +dmg vs burning ♻ `conditional-damage burning` | Blast Furnace: `ratio`/`duration` up ♻ |
| Spring (pull) | Compression ♻ | Catapult: `strength` up ♻ | Concussion: thrown enemies are stunned on landing ✚ `landing-stun` |
| Sticky Mine (charge) | Chain Reaction ♻ | Breaching Charge: +dmg vs armored ♻ | Contact Fuse: `fuse` and `radius` ♻ |
| Pitfall (pit) | Abyss: `size` up (never Berserker or Titan) ♻ | Spike Bed: big enemies take max-HP damage ♻ `max-hp-execute` | Quick Cover: shorter cover time ♻ |
| Tripwire (alarm) | Full Alert: `radius` up ♻ | Volley Signal: alerted towers' next shot +x% ✚ `alarm-volley` | Flare: reveals stealth in radius for d s ✚ `flare` (only where the Detector is buildable, like stealth itself) |
| Barricade (block) | Bulwark: wall `hp` up ♻ | Thorn Wall: much stronger spikes ♻ stats | Choke Point: enemies held at the wall take +x% ✚ `held-exposure` |
| Warp Pad (warp) | Long Fold: `cells` up ♻ | Disorient: warped enemies are confused for d s ✚ `warp-daze` (reuses Mesmer's `confuse`) | Mass Warp: `size` up, faster recharge ♻ |
| Arc Plate (chain) | Storm Floor: `jumps`/`falloff` ♻ | Twin Arc ♻ | Overcharge: +dmg vs heavy ♻ |
| Oil Slick (oil) | Naphtha: `boost` up ♻ | Wide Spill: `radius`/`duration` up ♻ | Slick: oiled enemies are slowed ♻ `frostburst` |
| Grinder (grind) | Meat Mill: `bonus` up ♻ | Shredder ♻ `armor-pierce` | Bonesaw ♻ `max-hp-execute` |
| Harpoon (harpoon) | Whaler: `pin`/`duration` ♻ | Exposed Target ♻ | Net Cloud ♻ |

Eight new trap kinds: `hamstring`, bleeding vulnerability, `tar-oil`, `landing-stun`, `alarm-volley`, `flare`, `held-exposure`, `warp-daze`.

### Support (levels 4–6)

Each cell gives the **gain · drawback** at tier I, then what tiers II–III change. "L3" means the tower's level-3 value.

**Economy**

| Tower (L3) | Path A | Path B | Path C |
| --- | --- | --- | --- |
| **Bounty Beacon** (+100% kill credits, radius 3) | **Big Game:** bonus only on heavy enemies (1,000+ max HP) and bosses, +150% · ordinary kills pay no bonus. II–III: the HP threshold falls (800, 600). | **War Bonds:** the wave's bonus is held and paid at wave end only if nothing leaked · a leak forfeits it. II–III: a leak forfeits half, then a quarter. Bonus stays +100%. | **Requisition:** bonus falls to +40%; every 10 kills in radius give towers in radius +25% fire rate for 3 s. II–III: the surge comes every 8, then 6 kills. |
| **Refinery** (60 per wave) | **Futures:** pays at wave start instead of wave end · 45 instead of 60. II–III: 50, 55. | **Compounding:** starts at 35 and gains +5 for every wave it has stood · capped at 60. II–III: starts at 40, then 45. Only built early does it reach L3. | **Core Tap:** 25 credits, +1 reactor energy every 3 waves (never above the start value; not on circle missions). II–III: every 2 waves, then 30 credits. |
| **Vault** (10% interest, cap 90) | **Insured:** interest only after a wave without a leak · cap 110. II–III: a leak halves it instead of voiding it, cap stays. | **Treasury:** interest counts credits spent on upgrades during the wave as if unspent · rate 6%, cap 70. II–III: 7%, 8%, cap stays. Rewards spending instead of hoarding. | **Reserve Cells** *(tentative, open question 3)*: no credits · interest is paid as reactor energy, 1 per 30 credits it would have paid, max 2 per wave, never above the start value (not on circle missions). II–III: 1 per 25, then 20. |
| **Workshop** (−30% upgrades, radius 3.2) | **Prefab:** builds in radius −20% · upgrades only −15%. II–III: builds −25%. | **Field Forge:** only path tiers (levels 4–8) in radius −35% · plain levels at full price. II–III: also level 5, then level 4. | **Refit:** towers in radius sell for 85% of spent instead of 70% · no upgrade discount. II–III: 90%, 95%; never more than spent. |
| **Repair Dock** (+3 reactor per wave) | **Triage:** no repair after the wave · the first leaks of each wave are refunded right away, up to 3. II–III: up to 4, 5. | **Emergency Crew:** repairs only below 50% reactor energy, then +5. II–III: below 60%, 70%. | **Salvage:** repair drops to 2 · each point it can't repair at full energy pays 8 credits, max 16 per wave. II–III: 10, 12 per point. |
| **Shield Generator** (absorbs 8 per wave) | **Recharge:** absorbs 3 · refills every 15 s of the wave. II–III: 4, then every 12 s. | **Shockwave:** absorbs 5 · each absorbed hit stuns ground enemies within 1.5 cells of the reactor for 0.5 s. II–III: absorb 6, stun 0.7 s. | **Overcharge:** absorbs 12 · costs 12 credits upkeep after every wave (skipped if the owner can't pay; then it absorbs nothing next wave). II–III: upkeep 9, 6. |

**Combat**

| Tower (L3) | Path A | Path B | Path C |
| --- | --- | --- | --- |
| **Tracker** (+25%, radius 2.8) | **Weak Point:** mark +15% · marked enemies also lose 30% of their armor reduction. II–III: 40%, 50%. | **Hunter's Mark:** only the strongest enemy in radius is marked, +45% · the rest get nothing. II–III: the mark moves 0.5 s faster after a kill; +50%. | **Wide Bearing:** radius 4 · mark +15%. II–III: radius 4.5, +18%. |
| **Overclock** (×2.5 for 4 of 10 s) | **Redline:** ×3.5 for 2.5 s · towers then fire 25% slower for 2 s (overheat). II–III: overheat 1.5 s, 1 s. | **Steady Clock:** no burst · a permanent +25% fire rate. II–III: +30%, +35% (still far below the L3 burst average of +60%). | **Ambush:** the burst opens when an enemy enters the radius after 5 s with none · ×2.5 for 3 s. II–III: after 4 s, 3 s. |
| **Fire Control** (every 3rd ×3) | **Penetrator:** every 3rd ×2.5 · crits ignore armor. | **Rapid Ranging:** every 2nd ×1.8. II–III: ×1.9, ×2 (average gain stays at L3's). | **Coup de Grâce:** crits only on targets below 50% HP · ×4. II–III: below 55%, 60%. |
| **Armory** (80% pierce) | **Shred:** pierce 50% · hits strip 20% armor for 2 s for every tower (status `armorDissolved`). II–III: 25%, 30%. | **Hollow Points:** pierce 40% · unarmored targets take +12%. II–III: +15%, +18%. | **Tungsten Core:** pierce 100% · radius shrinks to 1.8. II–III: radius 2, 2.2. |
| **Skylink** (90%, radius 3) | **Downlink:** factor 75% · held flyers are slowed by 20%. II–III: 25%, 30%. | **Wide Net:** radius 4 · factor 70%. II–III: 75%, 80%. | **Ground Lock:** factor 110% · only the strongest flyer in radius is held. II–III: the two strongest, then three. |
| **Nexus** (+6% per type, cap 7) | **Resonance:** counts types for range instead of damage, +3% range per type. | **Monoculture:** counts towers of the most common type in radius instead of distinct types, +4% each, cap 5 · mixed builds gain less. | **Lattice:** radius +1 · +4% per type. II–III: +4.5%, +5%. |
| **Detector** (reveals in radius 5) | **Exposure Scan:** revealed enemies take +10% · radius 4. II–III: +12%, +15%. | **Static Pulse:** every 6 s disrupts the strongest revealed enemy for 1.5 s · radius 4. II–III: every 5 s, 4 s. | **Wide Array:** radius 6.5 · an enemy is revealed only after 1 s in range. II–III: 0.7 s, 0.4 s. |
| **Recycler** (150% overkill, reach 3) | **Cascade:** 100%, then a second jump at 50%. II–III: 110%/55%, 120%/60%. | **Meltdown:** overkill becomes a burn on the nearest enemy, 130% over 3 s (no jump). II–III: 140%, 150%. | **Scrap Yard:** no jump · 1 credit per 40 overkill, max 12 per wave. II–III: per 35, 30; cap stays. |

The new support kinds go into `SupportSpecialization`: about 30, most of them small conditions on existing support code.

## Phases

Each phase ends with `npm test` and `npm run build`; phase 6 adds the balance runs.

### Phase 1 — Framework
- `specializationUpgrades(id, cost, base, from)` with the branch level (5 or 3); tier ids stay `<slug>-<tier>`.
- `trapTower` appends the trap paths and `visual.paths`. Validation: a trap tier never sets `range`.
- `SupportSpecialization` union, `FIELDS` entries and `specializationError`; validation keeps the two unions apart.
- Path cards show "gain · drawback": add an optional `tradeoff` text to path data, rendered by `ui/tower-card.ts` and `upgrade-tooltip.ts`.
- Replace the test "leaves traps and support towers as they were (T-009)" with: traps have 3 paths × 3 tiers and max level 8, support towers (without Aura) 3 × 3 and max level 6, trap tiers never change `range`, and Aura is unchanged.

### Phase 2 — Trap paths
- Fill `SPECIALIZATIONS` for the 15 traps. Reused kinds need only a test that each one fires through a trap.
- Implement the eight new kinds in their system files (`status.ts`, `systems/attacks/<kind>.ts`, `traits.ts` for the flare reveal), with 1–2 focused tests each.

### Phase 3 — Support framework and combat paths
- Riders read in `systems/support.ts`, `auras.ts`, `systems/recycler.ts` and the detection step, with the per-path overlap rule (design rule 6) in `strongest`/`reaching`.
- Work packages: Tracker, Detector, Recycler · Overclock, Fire Control, Armory · Skylink, Nexus.

### Phase 4 — Support economy paths
- Beacon, Refinery, Vault, Workshop, Dock and Shield Generator. Credits only through `earn`/`credit` with a per-wave cap. Extend `core/coop.test.ts` with War Bonds and Treasury, and `net/lockstep.test.ts` with one specialized economy tower.

### Phase 5 — Strength check (new)
- `scripts/support-check.ts`: for a few reference missions per sector, play strategy A plus one support tower at level 3, then again with each path at tier III on the same cell. Report credits earned, reactor left, kills and leaks per variant.
- Flag a WARN when an economy path earns more than level 3 + 5%, or when a combat path changes the strategy's result (reactor left, waves won) by more than an agreed band. The script runs under the same "only on demand" rule as `balance.ts`; the CLAUDE.md commands section gets one line for it.

### Phase 6 — Looks, UI, Run, balance
- **Render:** traps are drawn flat (`render/towers.ts` `trap`), so their L6–8 look needs a flat equivalent: path-colour trims on the plate and the motif on glow. Support turrets (`tower-art/turrets-support.ts`) get path trims and motifs as Aura has them. Base the trims on `towerPath` instead of `level >= 6`. Check that `stillBody` still bakes support bodies.
- **Showcase:** `/gallery.html?showcase` draws every path's last tier for traps and support; review there.
- **UI:** verify the path choice on a trap and a support tower, the codex path list and `specialization-text.ts` for every new kind.
- **Run:** Doctrines pick up the new paths through `pathsOf`. Fix texts that say "levels 6–8" (`run/shop.ts`, `run/transform.ts` comment, rank text), check `doctrinePaths`, `tags.ts`, the bot in `scripts/bot.ts` (it may now pick a support tower's Doctrine) and Doctrine prices in `tuning.ts`. Check the Bounty Contract relic and Logistics Hub against the Beacon and Workshop paths.
- **Balance:** trap tiers should return about what attack-tower tiers return per credit. Support tiers must pass `support-check.ts`. Run `scripts/run-balance.ts` (`--seeds 30`, full and short) before and after.
- **Docs:** update the CLAUDE.md lines "Traps (`trapTower`) and support towers have none" and "levels 6–8 of attack towers".

## Risks

- **Overlap:** the per-path overlap rule changes `strongest`, which every support query uses. It must keep today's results exactly for boards without paths (a test with two level-3 towers of the same kind).
- **Co-op and versus:** economy paths that hold, forfeit or protect credits must stay per owner and per field. War Bonds and Overcharge upkeep need a defined owner in co-op (the tower's `owner`).
- **Complexity:** about 30 support kinds is a lot of text for a player. Tier I says the whole trade-off on one line; tiers II–III only change numbers.
- **Run journal:** new upgrade ids leave existing hashes alone, so old journals for missions that bought nothing new replay unchanged.

## Open questions

1. Should Aura get one rider tier per track later, or stay as it is?
2. Should the balance strategies buy the new tiers, or stay baselines as today?
3. Vault path C: interest as reactor energy (1 per 30 credits, max 2 per wave), or a different idea?
