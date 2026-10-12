# Sound design — design spec

Date: 2026-10-12 · Status: draft for review

## Goal

Replace the six sine blips in `src/app/audio.ts` with a full synthesized sound design: combat effects, game-flow cues, menu/UI sounds and an ambient drone per map theme. Clean sci-fi synth aesthetic: soft, glassy, restrained, comfortable over a 20-wave mission.

## Decisions (agreed)

| Topic | Decision |
| --- | --- |
| Source | Fully synthesized, no audio files |
| Scope | Combat SFX, flow cues, menu/UI, ambience |
| Aesthetic | Clean sci-fi synth |
| Combat granularity | One recipe per attack kind, pitch/colour varied by tower id |
| Music | Ambient drone per `MapTheme`, swells during waves; separate menu bed |
| Versus | Own field only, plus cues for "opponent sent enemies" and "opponent eliminated" |
| Mixing | Voice caps per cue and global, burst merging, music ducking; pitch unchanged at 2× |
| Pause / hidden | Hidden tab suspends the context; paused or out of game: combat silent, ambience drops to a quiet bed |
| Controls | Master / effects / UI / music sliders and mute, saved in localStorage |
| Review | Dev-only `/gallery.html?sound` sound board with a feedback questionnaire |

## Constraints

- Render side only. Audio reads drained `GameEvent`s, `CommandResult.code` and state; it never changes the simulation, hash or network.
- No `AudioContext` before a user gesture; nothing audio-related runs at import time (Vitest runs in Node).
- Persisted settings are a second localStorage key next to `app/progress.ts`; every access in try/catch, defaults when it fails. CLAUDE.md's "only persisted data" sentence is updated.
- Files stay under 500 lines.

## Synthesis source

ZzFX (MIT, Frank Force, github.com/KilledByAPixel/ZzFX) is used for one-shot effects, because its parameter format has an established web designer (killedbyapixel.github.io/ZzFX) in which sounds are tuned by ear and copied out as arrays.

The npm package creates `new AudioContext` at import time, so it is **not** imported. Instead `src/audio/zzfx.ts` vendors only `buildSamples` (typed, licence header kept). Its only `Math.random` use is the frequency randomness, which moves to playback (`playbackRate` jitter, as ZzFX's own `ZZFXSound` does), so generation is deterministic. Buffers are rendered once per recipe on first use.

Ambience is a separate small Web Audio graph (ZzFX renders one-shots, not evolving drones).

## Modules (`src/audio/`)

| File | Job | Tested |
| --- | --- | --- |
| `zzfx.ts` | Vendored `buildSamples`, deterministic | Length and determinism |
| `recipes.ts` | `RECIPES: Record<CueId, ZzfxParams>` plus per-cue `{ bus, cap, priority, gap }` | Validation test: every cue has a recipe |
| `cues.ts` | Pure: `cuesFor(events, content, view) → Cue[]` (`{ id, pitch, priority }`). `shot` → tower id → attack kind → cue (every firing emits a `shot` with its tower id; chain, beam and pulse events only accompany it and stay silent); tower id → stable pitch offset (`fnv`). Merges bursts (n identical cues in one frame → one louder cue) | Yes |
| `mixer.ts` | Pure voice decisions: given active voices, caps and time, which cues play and which are dropped | Yes |
| `engine.ts` | `AudioContext`, buses (sfx, ui, music → master → `DynamicsCompressor` → destination), buffer cache, voice tracking, ducking (music gain dip on leak / end / low reactor) | No (no Web Audio in Node) |
| `ambience.ts` | `DRONES: Record<MapTheme, DroneSpec>` (root note, interval set, filter, noise colour, LFO rates) and the graph that plays one; crossfades on theme change; `intensity(0–1)` for wave swell | Spec table covered by a "every theme has a drone" test |
| `settings.ts` | Parse/serialize volumes and mute, clamped, with defaults | Yes |
| `ui-sounds.ts` | Delegated listener on `document` for button clicks and hovers (rate-limited) | No |

`src/app/audio.ts` becomes a thin adapter (`enable`, `play(events)`, `command(result)`, `setScene(menu|game, theme, paused)`), so `main.ts` and `input.ts` change little.

## Cue list

**Combat (sfx bus)**, one recipe per attack kind, grouped where the sound would be the same:
direct/pierce/volley (bolt), splash/mortar (thump + tail), chain (crackle), focus/beam (sustained hum, one voice per tower), pulse/quake (low swell), slow/net (glassy chime), burn/corrode/decay (hiss), stun/disrupt (zap), pull (falling sweep), execute (sharp crack), trap trigger (click + kind-specific tail), impact (soft hit), kill (short sparkle, reward-scaled pitch), evade (whiff), overload (power-down), leak (low thud + duck).

**Flow (sfx bus, own voice pool)**: build, sell, upgrade, wave start, wave end, win, lose, low reactor (once per crossing of 30 %), rejected command (from `CommandResult.code`), versus: enemies sent at you, opponent eliminated.

**UI (ui bus)**: click, hover tick, page change in the start screen.

Exact recipes are tuned on the sound board; the list above is the coverage contract.

## Mixing rules

- Per-cue `cap` (simultaneous voices) and `gap` (minimum seconds between starts); global cap 24 voices; a cue over cap drops the quietest/oldest same-cue voice only if its priority is higher, else is skipped.
- Burst merge: n identical cues in one frame become one voice with gain `min(1.5, 1 + 0.1·(n − 1))`.
- Speed: events per real second double at 2×; caps and gaps are in real time, so density stays bounded and pitch is untouched.
- Ducking: music bus dips to 40 % for 0.6 s on leak, end and low-reactor cues.
- Flow cues never get dropped by combat cues (separate cap pool).

## Lifecycle

- First enable (sound button or first gesture after a saved "on") creates the context and renders buffers.
- `visibilitychange` hidden → `context.suspend()`, visible → `resume()`.
- Game paused or menu view: combat cues ignored, ambience at bed level; menu uses the menu drone.
- Mission change: ambience crossfades to the new theme.
- Versus: only the local field's drained events reach audio (already true); "sent" and "eliminated" cues come from `Match` state diffs in the adapter.

## UI

The topbar `#sound-btn` stays (shows on/off) and gets a small popover mixer: mute toggle plus four sliders. Same control on the start screen. Keyboard: `M` toggles mute (unbound in `input.ts` today).

## Review tooling

`/gallery.html?sound` (`src/sound-board.ts`, dev-only like `?anim`):
- a button per cue, grouped as above, with its cap and gap shown;
- burst test: simulates a dense wave (configurable shots/sec) at 1× and 2×;
- ambience switcher per theme with an intensity slider;
- a questionnaire per cue (clarity, fit to the visual, annoyance after repetition, loudness vs. neighbours) whose answers are copied as text for the review.

Experiment notes and review results: `/Volumes/T7 Shield/Temp/ion-bastion-sound/`.

## Testing

Vitest for the pure modules only (`cues`, `mixer`, `settings`, `zzfx` determinism, recipe and drone coverage). A few focused tests each, no matrices. `npm test` and `npm run build` must pass. No balance run needed (simulation untouched).

## Out of scope

Recorded samples, adaptive melodic music, positional/panned audio per board position (could come later via `StereoPannerNode` from event x), haptics.

## Open risks

- Pure synthesis may sound thin for heavy weapons; mitigation: layered recipes (two buffers per cue) if the review says so.
- Mobile Safari: context must be resumed inside the gesture handler; covered by enabling from the button click.
