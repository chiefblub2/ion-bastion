import { barAt, nextSlot, rebase, type Clock } from "./clock";
import type { Cue } from "./cues";
import { chordOf, climb, MUSIC, snap, type Extent, type ThemeMusic } from "./harmony";
import type { DroneId } from "./mood";
import { RECIPES, TIMING, type CueId } from "./recipes";
// Puts each cue on the theme's beat grid and pitches it to the chord playing when it lands.

export interface Note {
  id: CueId;
  /** Playback rate of the recipe's buffer (1 = its own pitch). */
  rate: number;
  gain: number;
  /** Audio time to start at. */
  at: number;
}
export class Score {
  clock: Clock = { origin: 0, bpm: MUSIC.menu.bpm };
  music: ThemeMusic = MUSIC.menu;
  /** Chord size from the defense (`extentFor`). */
  extent: Extent = 3;
  private drone: DroneId | null = null;
  private kills = 0;
  /** Switches the theme's music; a new tempo starts on the next bar line. True when the theme changed. */
  theme(drone: DroneId, now: number) {
    if (drone === this.drone) return false;
    this.music = MUSIC[drone];
    this.clock = this.drone === null ? { origin: now, bpm: this.music.bpm } : rebase(this.clock, now, this.music.bpm);
    this.drone = drone;
    return true;
  }
  /** The harmonic chord at `time` (without the pad's tension note, so shots stay in tune). */
  chordAt(time: number) {
    return chordOf(this.music, barAt(this.clock, time), this.extent);
  }
  noteAt(id: CueId, voice: number, gain: number, at: number): Note {
    if (!TIMING[id].pitched) return { id, rate: 1, gain, at };
    const base = RECIPES[id].params[2] ?? 220,
      // Arpeggio and kills keep their direction through the chord; other cues take the nearest octave.
      pitch = id === "arp" || id === "kill" ? climb(base, this.chordAt(at), voice) : snap(base, this.chordAt(at), voice);
    return { id, rate: pitch / base, gain, at };
  }
  /** When and at which rate a cue sounds; kills climb the chord one tone per kill. */
  place(cue: Cue, now: number): Note {
    const at = nextSlot(this.clock, now, TIMING[cue.id].grid);
    return this.noteAt(cue.id, cue.id === "kill" ? this.kills++ : cue.voice, cue.gain, at);
  }
}
