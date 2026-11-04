import type { Measure } from "./conductor";
import type { Cue } from "./cues";
import type { Family } from "./families";
import { pitchOf } from "./instruments";
import type { DroneId } from "./mood";
import type { CueId } from "./recipes";
import type { Note } from "./score";
import { STINGERS } from "./stingers";
// The game's sound without the soundtrack (`MUSIC_ENABLED` false): effects play at once at their recipe's own pitch,
// and stingers play their phrase from now on a fixed chord and tempo. There is no beat, so the towers never pulse.
// The soundtrack's `Conductor` (`music.ts`, loaded only with the music) takes over the same calls when it is on.

/** What `app/audio.ts` drives: the conductor with music, `Effects` without. */
export interface Director {
  theme(drone: DroneId, now: number): void;
  measure(m: Measure): void;
  cue(id: CueId, now: number, voice?: number, gain?: number, pan?: number): void;
  play(cues: readonly Cue[], now: number): void;
  /** Seconds since the latest beat began, per tower family; empty without a beat. */
  ages(now: number): Partial<Record<Family, number>>;
}
/** What `Effects` needs from the audio engine; tests pass a recorder. */
export interface EffectVoices {
  play(note: Note): boolean;
  instrument(name: Parameters<typeof pitchOf>[0], hz: number, at: number, velocity: number, pan: number, layer?: "sfx"): boolean;
  duck(at: number): void;
}
/** The stingers' chord without music: the menu theme's tonic, A minor (MIDI). */
export const NEUTRAL_CHORD: readonly number[] = [33, 36, 40];
/** A 16th note of the stingers' phrases without music (96 bpm). */
export const STINGER_STEP = 60 / 96 / 4;

export class Effects implements Director {
  constructor(private voices: EffectVoices) {}
  theme() {}
  measure() {}
  ages() {
    return {};
  }
  cue(id: CueId, now: number, _voice = 0, gain = 1, pan?: number) {
    const stinger = STINGERS[id];
    if (!stinger) {
      this.voices.play({ id, rate: 1, gain, at: now, pan });
      return;
    }
    for (const [name, tone, offset, velocity] of stinger.notes) this.voices.instrument(name, pitchOf(name, NEUTRAL_CHORD, tone), now + offset * STINGER_STEP, velocity * Math.min(1, gain), 0, "sfx");
    if (stinger.duck) this.voices.duck(now);
  }
  play(cues: readonly Cue[], now: number) {
    for (const c of cues) this.cue(c.id, now, c.voice, c.gain);
  }
}
