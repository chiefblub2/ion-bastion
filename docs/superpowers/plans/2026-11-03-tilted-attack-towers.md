# Attack towers in the 3/4 tilt, with cached turret pictures

Goal: give the remaining 13 Attack-tab towers the 3/4 tilt look of Pulse (Hex Sentinel, `tower-art/sentinel.ts`) and
Nova (Siege Cannon, `tower-art/siege.ts`), and stop redrawing tilted turrets every frame by caching their pictures per
aim angle. Control, Traps and Support stay flat for now.

## Where things stand

- The tilt kit (`tower-art/tilt.ts`) and the projection in `MUZZLES[turret].tilt` (`drop`, `squash`, `height`,
  `pitch`, `deck`) work for one centred barrel. `isTilted` means "has `MUZZLES[…].tilt`", so radial turrets (no
  `MUZZLES` entry) can't be tilted yet, and `muzzleTips` ignores `sides` and `fan` once `tilt` is set.
- The base of a tilted tower bakes (`TowerBodies`), but the turret is re-tessellated every frame: Nova's housing
  alone is ~40 polygons plus tubes. Today that's 2 towers. With all 15 attack towers tilted, a full late board is
  mostly tilted turrets.
- Effects that start at the tower centre (Tesla `chain`, the Decay orb, Quake's pulse) have no raised source point.

The 13 towers, grouped by what they need from the kit:

| Batch | Tower (turret style) | Shape idea (keeps today's identity) | Kit needs |
| --- | --- | --- | --- |
| A: barrel guns | Flak (`twin`) | Twin AA guns on a yoke, high pitch, ammo box at the back | tilted `sides` |
| | Shrapnel (`scatter`) | Squat housing with a fan of 3/5 short barrels | tilted `fan` |
| | Executioner (`blade`) | Glaive launcher: a long arm with the blade cradled at its tip | — |
| | Lance (`rail`) | Long twin rails on a low cradle, level, coils along the rails | — |
| B: launchers | Skyburst (`battery`) | Four-tube rocket rack on an elevating cradle | tilted `sides` + `pitch` |
| | Mortar (`mortar`) | Fat tube at a steep pitch in a bolted ring | steep `pitch` |
| | Catalyst (`flask`) | Launcher with a glass flask on top, fluid level = charge | — |
| | Orbital (`uplink`) | Uplink dish tilted at the sky on a mast | steep `pitch`, beam up |
| C: nozzles, optics | Ember (`flame`) | Squat flamethrower, fuel tanks behind, short nozzle | — |
| | Focus (`lens`) | Lens on a fork mount, beam from the lens centre | — |
| D: radial | Tesla (`coil`) | Tall coil on a pylon with a torus top; arcs from the torus | no barrel, raised `emit` point |
| | Decay (`prism`) | A prism floating above a pylon | no barrel, raised `emit` |
| | Quake (`hammer`) | Piston rig whose ram strikes the ground | no barrel, no aim |

## Status (2026-11-03)

- **Concepts:** all 13 drawn on `/gallery.html?concepts` (`src/concepts/`, throwaway), with Orbital, Focus, Quake and
  Shrapnel revised once.
- **Phases 0 and 1 done:** `TILTS` (with `sides`/`fan` projection and `emit`), the four-part `TiltedArt`
  (`base`/`below`/`turret`/`above`), `TurretCache`, Pulse and Nova on it. On top of that, baked bodies without light
  are no longer traced every frame (`bodyLight`). Same bench, 43 extra Pulse/Nova at L5:

  | | draw avg / p95 ms | render avg / p95 ms |
  | --- | --- | --- |
  | before (live turrets) | 13.1–13.8 / 22–24 | 8.4–9.0 / 16–17 |
  | now (cached) | 5.5–5.6 / 10 | 6.1 / 11 |
  | flat Flak + Lance, now | 7.5–8.1 / 13–14 | 6.5–7.0 / 11 |

  The frame rate under SwiftShader barely moves (~13.5 fps either way): there the GPU itself is emulated on the CPU and
  filling the turret pictures costs about what rasterising their triangles did. On a real GPU that part is cheap.
- **Phase 3 done:** all 13 concepts are real towers (`render/tower-art/<look>.ts`, registered in `TILTS`, `MUZZLES`
  and `TILTED`), each split into `base`/`below`/`turret`/`above`, the flat drawings deleted, the concept page turned
  into the review sheet `/gallery.html?tilt`, codex icons regenerated. Tesla's bolts and chains leave from its emit
  point. The still-checks now record only the corners a call uses (leftovers in the shared scratch buffers had made
  equal drawings look different). Bench with 43 extra towers mixed from the 13 new ones at L5:

  | | draw avg / p95 ms | render avg / p95 ms |
  | --- | --- | --- |
  | cached | 7.8–8.3 / 14–17 | 6.5–6.7 / 12–14 |
  | live (`--live-turrets`) | 11.6 / 18 | 9.7–10.8 / 19–21 |

- **Fixed after review:** Executioner's charged glaive hovers above the counterweight's roof, so nothing of the cached
  turret can stand in front of it; Ember, Focus and Quake use the kit's `disc`, `oval` and `drum` again. Shots of
  tilted turrets no longer dive from the raised muzzle to the ground within one barrel length: `Trails` splits the tip
  into its ground point (eased out within a barrel length) and its height above it (`rise`, faded over the whole
  flight), using `muzzleTips(…, flat)`.
- **Control, Traps and Support (2026-11-04):** 45 concepts drawn on a concept sheet, revised once for look-alikes (Tar
  Pit, Cyclone, Jammer, Stasis, Nexus, the rectangular traps, Gravitron, Tracker, Plasma, Snare Net; Overclock as the
  Overdrive Core), then moved into the game as `tower-art/models/` with the same four-part split and cache. Traps keep
  their path motif around them on the path. Every tower is now tilted.

## Phase 0: kit and measurement

1. **Tilt independent of barrels.** Move `Tilt` into its own table `TILTS: Partial<Record<TurretStyle, Tilt>>`
   (`render/tilts.ts`) and point `isTilted`, `towers.ts`, `muzzleTips` and `muzzleHeading` at it. A radial tower
   is then tilted without a fake barrel.
2. **Project every barrel layout.** `muzzleTips` runs `sides` and `fan` through the tilt (offsets across the aim
   on the ground plane, then the same `drop`/`squash`/`height`/`pitch`). Extend `muzzles.test.ts` with one case
   each.
3. **Raised source for radial towers.** `Tilt.emit?: number`, the height of the point chains, beams and shots
   leave from when there's no barrel. `effects.ts` (`chain`, `beam`) and `trails.ts` (shot start) use it through
   one helper `sourcePoint(turret, level, x, y, angle)`. Quake's ring stays on the ground.
4. **Benchmark first.** `frame-bench.ts --towers pulse,blast --fill 60` (new flag: fill with these types instead of
   the strategy's). Note avg/p95 of `draw` and `render` for flat vs tilted fills on this machine. This is the
   baseline for Phase 1.

## Measured (2026-11-03, SwiftShader, `lianenpfad` last wave, bloom off, 52 towers at L5)

| Fill (43 extra towers) | draw avg / p95 ms | render avg / p95 ms |
| --- | --- | --- |
| Pulse + Nova (tilted) | 13.1–13.8 / 22–24 | 8.4–9.0 / 16–17 |
| Flak + Lance (flat) | 6.8–8.1 / 12–15 | 5.7–6.3 / 11–14 |
| no fill (9 towers) | 4.2 / 9 | 5.2 / 11 |

The tilted turrets cost roughly twice what flat ones do: ~0.15 ms draw and ~0.06 ms render per tower here. A CPU
profile splits the main-thread cost about evenly between our geometry code (`block`, `disc`, `drum`, `turn`) and
Phaser's recording and earcut tessellation. Phaser re-tessellates every Graphics on every frame, so drawing less
often only helps if the result is kept as pixels.

Options weighed:

- **Turret pixels per angle (chosen).** Removes nearly all of both halves for the turret: one textured quad per
  tower. Costs memory, render-side angle snapping and a separate depth layer. A shared atlas keyed by look × angle
  beats one texture per tower because fast trackers (Flak) revisit the same angles: after warm-up they never bake
  again, while a per-tower texture would re-bake on every bucket change.
- **Thinner geometry (do it as well, first).** Seams, lips and 0.6 px lines that vanish at board zoom, fewer drum
  segments, no tuple allocations in hot helpers (`P(...)` in siege). Cheap and helps the bake, the live parts and
  the flat towers too. Expect tens of percent, not the factor the cache gives.
- **Only redraw on change, without pixels.** Saves only our half; Phaser still re-tessellates. Rejected.
- **Real 3D (vertex buffer + shader rotating the turret).** Continuous angles and tiny memory, but a custom
  Phaser render node and per-vertex lighting instead of our Graphics drawing kit. Too large a departure for now.

## Phase 1: turret cache (before any new tower)

Building the cache before converting towers means every new drawing is split the right way from the start, rather
than retrofitting 15 modules later.

**Split every tilted tower into three parts:**

- `base(ctx)`: still. Baked already.
- `turret(ctx)`: ink on `g` only. Depends only on type, level, colour, maxed, path, **angle** and **kick**. No
  clock, charge, id or glow.
- `live(ctx)`: everything else, drawn every frame. Lights, charge indicators (Nova's loading shell and vent slats),
  smoke, heat glow, and the glow layer.

**`TurretCache` (`render/turret-cache.ts`)**, modelled on `TowerBodies`:

- Key: `bodyKey` + angle bucket + kick bucket.
- Angles snap to 64 buckets (5.6°). Kick snaps to 4 steps (0, ⅓, ⅔, 1); kick only runs for the first 30 % of a cycle.
- The snapped angle is render-only. `TurretAim` already owns the drawn angle, so it hands out the snapped value.
  Flashes, beams and shot starts read the same angle, so they stay on the drawn muzzle. `Tower.angle` and the
  simulation are untouched.
- Frames live as cells in shared DynamicTexture atlas pages, at 2× zoom like the bodies. Filled lazily, at most
  ~8 bakes per frame so a new board doesn't hitch; an un-baked frame draws live meanwhile. LRU-capped (start at
  512 frames), reset on zoom change like `TowerBodies.setZoom`.
- One Image per tower at a new `DEPTH.towerTurrets` between `towerBodies` and `towerInk`. Within the layer, depth
  rises slightly with the tower's row, so the north-first overlap (`northFirst`) still holds.
- `live` parts, level bars and badges move to the ink above them. Otherwise a tower's own image would cover them.
  Known trade-off: a north tower's lamp can sit over the tip of the south tower's turret where the two overlap.
  Check this on the showcase; if it shows, give each row its own depth band.

**Guard, like `stillBody`:**

- `stillTurret` records `turret(ctx)` twice at the same angle/kick with different clock, charge and id. Towers whose
  two recordings differ fall back to drawing live.
- A test in `tower-bodies.test.ts` asserts that all tilted towers pass, so a stray `clock` in a turret drawing fails
  CI instead of quietly costing frames.

**Done when:** Pulse and Nova are split and cached and look the same on `/gallery.html?showcase` (flash on the
muzzle at all 8 headings, recoil visible). The Phase 0 bench shows `draw` clearly below the live-drawn baseline.

## Phase 2: look review before code

For each tower, a concept from the table above at L1, L5, L8 per path and 8 headings on a dev review sheet
(`/gallery.html?showcase=tilt`, extending `src/showcase.ts`). Screenshots go to `visual-check/`. Check silhouette,
size inside the cell (the tilt reaches into the cell above), level language (lamps, plates, chasing lights like
Siege's notches) and that base colours stay unique (`sourceOf`). Agree on a batch's looks before polishing it.

## Phase 3: convert in four batches (A → D)

Per tower:

1. A module `tower-art/<name>.ts` with `base`, `turret`, `live` on the tilt kit. Keep the existing palette and motifs
   so the codex icon still reads as the same tower.
2. A `TILTS` entry (`drop`, `height`, `pitch`, `deck`, `emit`), `MUZZLES` reach/recoil checked against the new barrel.
3. Swap the entries in `BASES` and `ATTACK_TURRETS`. Delete the flat drawing.
4. Check effects: flash heading, beam/chain start, the projectile's first trail sample, the Mortar/Skyburst arc start.
5. `scripts/readme-images.ts -- --only towers` for the codex icon. Then `visual-check.ts` on a mission that builds it.

Batches A and B mostly reuse Pulse/Nova parts (`tube`, `endFace`, `block`, `drum`). D needs the new `emit` point,
and Quake has no aim, so it caches a single angle bucket. After Phase 1 the batches don't depend on each other, so
each one can run as a parallel agent with this plan, the kit, and Sentinel/Siege as reference.

## Phase 4: wrap-up

- Final `frame-bench.ts` with `--fill 60` of mixed attack towers at L5 and at L8 with paths, with and without bloom.
- Update CLAUDE.md "Tilted towers" (all attack towers, `TILTS`, the three-part split, `TurretCache`, `emit`).
- `npm test`, `npm run build`. No balance run needed: rendering never touches the simulation.

## Risks

- **Mixed board.** Tilted attack towers next to flat Control/Support towers. Pulse and Nova already set this
  precedent; the other tabs can follow later with the same kit and cache.
- **Cache misses on fast-turning towers** (Flak tracking air). They fall back to live drawing until the frame is
  baked. LRU size and bakes per frame are the knobs.
- **Memory.** One frame at 72 px × zoom 1.5 × 2 is ~216² × 4 B ≈ 190 KB. 512 frames ≈ 95 MB is too much at high
  zoom, so cap by bytes (e.g. 48 MB) rather than frame count, and use a smaller `BOX` for turrets (they don't need
  the shadow's reach).
