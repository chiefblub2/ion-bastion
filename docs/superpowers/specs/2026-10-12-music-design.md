# Music from game sounds — design spec

Date: 2026-10-12 · Status: draft for review · Builds on: `2026-10-12-sound-design-design.md`

## Goal

Make the game's sounds play together as music. Tower fire becomes the rhythm and melody over a pulse: every combat sound waits for the next beat subdivision and is pitched to the current chord, the theme drone becomes bass and pad following a chord loop, and a drum layer grows with the pressure of a wave. Model: Rez (player actions quantized to the music).

## Decisions (agreed)

| Topic | Decision |
| --- | --- |
| Sync | Sound only. Towers fire as today; only their sounds are delayed to the beat grid. Simulation, balance, hash and multiplayer untouched |
| Grid | Per cue: fast weapons 1/32, most 1/16, heavy and slow weapons 1/8 or the beat, flow cues on the bar; interface clicks and the reject cue stay instant |
| Music | Tempo, key, mode and a 4-bar chord loop per theme; pitched cues snap to chord tones; kills climb an arpeggio; drums by wave pressure; the drone retunes to each chord |
| Speed 2× | Tempo stays; denser events merge in the mixer |
| Menu | Slow pad only, no drums |
| Paused, between waves | No drums; pad at its quiet bed |

## Constraints

- Everything from the base spec holds (render side only, no `AudioContext` before a gesture, files < 500 lines, pure modules tested in Node).
- Pitched cues snap to the nearest octave (playback rate 0.7–1.42), except the arpeggio and kill plucks, which keep their direction through the chord in one octave around their pitch (rate 0.45–2.2), so a rising or falling line stays audible.
- Lag between a muzzle flash and its sound is bounded by the cue's grid: ≤ 1 grid step (1/32 at 120 BPM = 62.5 ms, 1/16 = 125 ms, 1/8 = 250 ms).
- Scheduling follows the lookahead pattern of Chris Wilson's "A Tale of Two Clocks": a 25 ms timer schedules everything due in the next 100 ms on the audio clock; nothing is timed with `setTimeout` alone.

## Units

| File | Job | Tested |
| --- | --- | --- |
| `audio/clock.ts` (pure) | `Clock { origin, bpm }`: `nextSlot(now, grid)`, `barAt(time)`, `stepAt(time)` (1/16 steps), `rebase(now, bpm)` (new tempo starting at the next bar of the old one) | Yes |
| `audio/harmony.ts` (pure) | `MUSIC: Record<DroneId, ThemeMusic>` (`bpm`, `root` MIDI note, `mode`, `progression` of 4 scale degrees, `groove`); `chordOf(music, bar)` → MIDI notes of the triad (7th on degree 0 and 4); `snap(targetHz, chord)` → nearest chord tone in the octave closest to `targetHz`; `voiceOf(tower)` → chord-tone index from `fnv` | Yes |
| `audio/grooves.ts` (pure) | Three 16-step patterns (straight, half-time, broken) for kick, snare and hat; `layersFor(pressure)` → which parts play | Yes |
| `audio/sequencer.ts` | Lookahead loop: per 1/16 step in the window, schedules drum hits and, on each bar line, the chord change for the ambience; pure helper `stepsIn(from, to, clock)` | Helper yes |
| `audio/recipes.ts` (change) | `CueSpec` gains `grid: Grid` and `pitched: boolean`; new drum cues `kick`, `snare`, `hat` in a `drums` pool | Coverage test updated |
| `audio/cues.ts` (change) | `Cue` carries a target frequency instead of a random tower pitch: pitched cues get `snap(base, chord)` with the tower's voice; kills step an arpeggio counter | Yes |
| `audio/engine.ts` (change) | `play(cue, at)` schedules at audio time `at`; voices are admitted by their scheduled start; `playbackRate = targetHz / recipeHz` | No |
| `audio/ambience.ts` (change) | `chord(notes, at)` retunes the drone: bass on the chord root, pad on the chord tones an octave up, gliding 80 ms at `at` | No |
| `app/audio.ts` (change) | Owns the clock and sequencer; on theme change rebases the clock; quantizes each cue with `clock.nextSlot(now, grid)` | No |

## Theme music (starting values, tuned by ear)

The root is the existing drone root. Progressions are scale degrees (0 = tonic), one per bar.

| Drone | BPM | Root | Mode | Progression | Groove |
| --- | --- | --- | --- | --- | --- |
| menu | 84 | A1 | aeolian | 0 5 2 6 | none |
| outpost | 112 | A1 | aeolian | 0 5 2 6 | straight |
| lock | 108 | A♯1 | dorian | 0 3 0 6 | straight |
| shard | 118 | B1 | lydian | 0 1 4 0 | broken |
| ember | 124 | G1 | phrygian | 0 1 0 6 | broken |
| core | 120 | A1 | harmonic minor | 0 5 3 4 | straight |
| frost | 100 | C2 | dorian | 0 3 6 4 | half |
| toxic | 116 | G♯1 | phrygian | 0 1 6 0 | broken |
| orbit | 96 | D2 | lydian | 0 1 0 4 | half |
| ruin | 104 | F♯1 | aeolian | 0 3 5 4 | half |
| rift | 126 | E1 | phrygian | 0 1 3 1 | broken |
| dune | 110 | A1 | dorian | 0 6 3 0 | straight |
| abyss | 92 | D1 | aeolian | 0 5 6 0 | half |
| storm | 128 | G1 | aeolian | 0 6 5 4 | broken |
| jungle | 114 | B1 | mixolydian | 0 6 3 0 | straight |
| volcano | 122 | F1 | harmonic minor | 0 5 1 4 | straight |
| geode | 106 | C♯2 | lydian | 0 4 1 0 | half |
| gear | 120 | A♯1 | mixolydian | 0 6 3 4 | straight |
| tide | 102 | G♯1 | ionian | 0 5 3 4 | half |

## Cue timing and pitch

| Cue | Grid | Pitched |
| --- | --- | --- |
| bolt, crackle, zap, evade, impact | 1/32 | bolt, crackle, zap yes; evade, impact no |
| chime, beam, trap, hiss, crack, lob, kill, income | 1/16 | chime, beam, trap, lob, kill, income yes; hiss, crack no |
| blast, sweep, repair, leak | 1/8 | sweep, repair yes; blast, leak no |
| swell, overload, lowReactor, incoming | beat | swell, overload yes (chord root); others no |
| build, sell, upgrade | 1/16 | yes |
| waveStart, waveEnd, won, lost, eliminated | bar | yes (won/waveEnd resolve to the root, lost to the minor root) |
| reject, click, hover | instant | no |
| kick, snare, hat | sequencer steps | no |

Pitch: a pitched cue's target is the chord tone (tower voice index, or the arpeggio step for kills) in the octave nearest the recipe's base frequency (`params[2]`), so `playbackRate` stays within about 0.7–1.4 and the timbre is kept. Unpitched cues keep `playbackRate` 1 plus the recipe's jitter.

## Drums

Pressure `p = min(1, enemies / 30)` during a wave (the mood's input). Layers: hat from the wave's start, kick at `p ≥ 0.25`, snare at `p ≥ 0.5`. No drums in the menu, while paused or between waves. Drum voices have their own pool (cap 6) so combat never drowns the beat.

## Clock lifecycle

- The clock starts when the context first runs; theme changes rebase it at the next bar of the current tempo, so the music never stumbles mid-bar.
- Hidden tab: the context is suspended (audio time stops), so the clock stays consistent on return.
- Cues scheduled into the past (a long frame) play at the next slot after `now`.

## Review

The sound board gets a Music panel: theme picker showing BPM, key and the current chord; a simulated wave with three tower mixes (rapid fire, heavy, mixed) and a pressure slider; drums on/off. The review sheet adds "feels in time" and "lag noticeable" (1–5). Notes go to `/Volumes/T7 Shield/Temp/ion-bastion-sound/`.

## Testing

Vitest for `clock`, `harmony`, `grooves`, `stepsIn`, the updated `cuesFor` and the recipe coverage. Browser check: cues are scheduled no earlier than `now` and no later than one grid step after it; a mission change rebases the tempo; no page errors.

## Out of scope

Towers firing on the beat (gameplay change), melodic sections per wave, boss variations, recorded instruments.

## Risks

- A dense wave may still be a wall of notes; mitigations are the per-cue caps, the drums pool and the review's density test.
- Lag on 1/8 and beat cues (up to 250–500 ms) and on bar stingers (up to one bar, 2 s at 120 BPM after pressing N) may feel disconnected; the review's "lag noticeable" criterion decides whether those cues move to a finer grid.

## Two parts: enemies and towers (agreed after review)

The music is a tug-of-war. **Enemies play the rhythm section, towers play harmony and melody**, and the balance between them colours the mood. Shots stay the lead on the beat grid; the theme's chord loop stays the backbone.

Three measures, pure (`audio/intensity.ts`), refreshed every 0.5 s of audio time, never stored in game state:

| Measure | Definition | Drives |
| --- | --- | --- |
| Threat 0–1 | Σ per enemy: weight `clamp(baseHp / 100, 0.5, 4)` × `(0.5 + 0.5 · progress along the path)`, full at 30 | Drum layers: hat (wave start), kick ≥ 0.25, snare ≥ 0.5, 16th hats and an 8th-note bass ≥ 0.75 (replaces the enemy-count pressure above) |
| Defense 0–1 | Σ per tower `1 + upgrades bought`, full at 40 | Harmony: triads, 7ths ≥ 0.25, 9ths ≥ 0.5; arpeggiator in 1/16ths ≥ 0.75 (in game, not paused, also between waves); pad brightness `× (1 + 0.5 · defense)` |
| Clear time (s) | remaining enemy HP ÷ the towers' damage per second (`effectiveTowerStats`, attack towers only) | Mood colour with hysteresis: bright < 3 s (leave at 4), dark > 10 s (leave at 8), else driving. Bright: pad × 1.5, arpeggio rises. Driving: arpeggio up and down. Dark: pad × 0.6, a minor-second tension note in the pad, arpeggio falls |

Enemy voices (data-driven from base HP): heavy (≥ 300 HP, about ten types) → a low stomp on beats 1 and 3 while any is on the field; boss (≥ 1000 HP, only `boss` today) → a motif on the bar when it spawns.

New cues: `stomp`, `bass` (pitched to the chord root), `arp` (pitched pluck) in the drums pool (cap raised to 10, music bus), `boss` (flow, bar, pitched, ducks). Shots snap to the harmonic chord without the tension note. Pad voicing puts the bass on the root and fills the other voices from the top of the chord down (9th, 7th, 5th …), the tension note first.

Deferred: a counter-melody at very high defense (clutter risk next to shots and arpeggio; revisit after the listening review).

The sound board gets sliders for threat, defense and clear time, a heavy toggle and a boss button, so every stage can be heard directly.

## Revision 2: instrument tracks (after the first listening)

Listening result: bearable only up to about 10 shots/s, "too busy, too loud, noisy, not music — a stressful Mario soundtrack". Cause: one note per shot (note count grows with fire rate), raw ZzFX chiptune timbres, no space, 110–128 BPM. Agreed redesign:

- **Towers are instrument tracks.** Shots no longer play notes. Each tower family has an instrument and a composed 16-step part; shots raise the family's activity (0–1, +0.06 per shot, half-life 1.5 s), which unlocks the part's steps by rank (1 = core steps, 4 = full figure) and sets its velocity. At most 8 notes per family per bar at any fire rate. The rapid part starts within a beat of its first shot (rank-1 steps on every beat); heavy, electric, control and trap parts within half a bar or a bar.

| Family | Attack kinds | Instrument | Pan |
| --- | --- | --- | --- |
| rapid | direct, volley, pierce | pluck (triangle into a closing low-pass) | −0.35 |
| heavy | splash, mortar, quake, execute | warm bass | 0 |
| electric | chain, stun, disrupt, focus | FM bell | +0.4 |
| control | slow, net, pull | glassy swell | 0 |
| fire | burn, corrode, decay | filtered-noise shaker | +0.25 |
| traps | every path tower | wood click | −0.2 |

- **Effects that stay ZzFX:** heavy blasts on the beat (one per beat), a kill sparkle (one per ~beat), evade, overload, income, repair, alerts (leak, low reactor, incoming, eliminated, reject) and interface clicks. Shots of musical families and all other impacts are silent.
- **Stingers on instruments:** build, sell, upgrade, wave start/end, win, loss and the boss motif are short instrument phrases on the grid (win, loss and boss duck the music).
- **Calmer rhythm section:** no drums below threat 0.25; then kick on 1 and 3, a backbeat from 0.5, 8th hats and a bass pulse from 0.75; heavy enemies add a low tom stomp. Synthesized, soft kit.
- **Calm, tense, spacious mood:** all themes 84–104 BPM, minor-leaning modes; the arpeggio (defense ≥ 0.75) is a quiet bell in 8ths.
- **Professional sound:** plain Web Audio instruments with filter and amplitude envelopes (parameters after Tone.js's MonoSynth/FMSynth defaults, no dependency), a generated stereo reverb (decaying-noise impulse, as Tone.Reverb does) with sends from music and effects, fixed stereo places per family, a gentle compressor and a limiter. ZzFX remains for short effects only.
- **Listening without effort:** `scripts/render-music.ts` renders 8-bar WAV clips offline (headless Chrome, `OfflineAudioContext`) for each tower mix at 5–80 shots/s plus calm and climax scenes, with peak and RMS in dBFS and an `index.html` to play them back to back. The engine accepts any `BaseAudioContext` for this.
- **Architecture:** a `Conductor` (pure apart from the engine it is given) owns score, activity, parts and mood; the game adapter, the sound board and the renderer all drive it, so what is rendered is what is played.

## Revision 3: menace and connection (after the second listening)

Listening result: "the enemy sounds are not threatening at all; everything is too pretty; the drums are too clean; tower shots and their sounds feel disconnected". Agreed:

- **Industrial enemy kit** (plain Web Audio, a shared tanh saturation curve): thud (saturated sub sweep + click) for the kick, clank (inharmonic FM hit + noise) for the snare, tick (tiny metallic ring) for hats, slam (saturated low tom + clank) for stomp and fills, grit bass (saw + square through saturation and a resonant low-pass) for the bass pulse, metal crash (inharmonic FM, long tail). Towers keep their bright, glassy instruments.
- **Dissonance with threat:** the grit bass enters at threat 0.5 (steps 0, 6, 10, 14) with a tritone on step 6; from 0.75 also minor-second stabs on steps 10 and 14; escalated (straight 8ths) also a tritone on step 12. The pad carries the b9 tension note from threat 0.6 or when losing.
- **Per-shot transient:** each family has a very short, quiet, unpitched ZzFX tick or thump played immediately (grid instant), at most one per family per ~0.12 s, well below the music.
- **Visual pulse:** when a family's part note sounds, its towers flash a soft glow halo on the glow layer (core ≤ 0.3 alpha) that fades over 0.25 s. The audio reports per family how long ago its last note started on the audio clock; the scene reads it through a battlefield hook. Render-only; no pulses with sound off.

## Climax escalation (agreed after the second listening, recorded with revision 3)

Listening result: "climax does not sound very climax-like". Agreed: an escalation layer, losing tense rather than muffled, about 12 dB from calm to climax.

- **Escalation** is entered at threat 0.85 or while a boss is on the field, and left only below 0.75 (hysteresis). It plays the full groove whatever the measured threat: 16th ticks, a straight 8th-note grit bass, a crash on each 4-bar phrase, a riser in the second half of the 4th bar and a tom-like slam fill on its last beat, and the rapid part doubled an octave up.
- **Losing** keeps its tension note but the pad's filter stays open (supersedes "Dark: pad × 0.6" above).
- **Energy gain** on the music bus follows the fight: about −2 dB calm to +6 dB at the climax (threat, +0.3 while escalated); measured calm −33 vs climax −19 dBFS RMS.
