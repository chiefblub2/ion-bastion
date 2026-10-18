import { nextSlot, stepLength } from "./clock";
import type { Cue } from "./cues";
import { DRONES } from "./drones";
import type { Layer } from "./engine";
import type { Family } from "./families";
import { bassFor, CALM_DOWN, ESCALATE, layersFor, type Drum } from "./grooves";
import { climb, extentFor, rooted, type Color } from "./harmony";
import { REGISTER, type Instrument } from "./instruments";
import { colorOf, toneFor } from "./intensity";
import type { DroneId } from "./mood";
import { TIMING, type CueId } from "./recipes";
import { Score, type Note } from "./score";
import { schedule, stepsIn, type Parts } from "./sequencer";
import { STINGERS } from "./stingers";
// The synthwave soundtrack: the game's phase sets the arrangement, the enemies' threat the drums and the bass, the
// danger to the reactor the mood, the mission's progress the harmony. Towers never play into it. Driven alike by the
// game (`app/audio.ts`), the sound board and the offline renderer.

/** What the conductor needs from the audio engine; tests pass a recorder. */
export interface Voices {
  play(note: Note): boolean;
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number, layer?: Layer, length?: number): boolean;
  duck(at: number): void;
  /** Drum loudness from the fight's energy, 0–1. */
  energy(level: number): void;
  /** The sidechain dip on a kick. */
  pump(at: number, beat: number): void;
  /** The tempo, for the delay. */
  tempo(bpm: number): void;
  ambience: { chord(notes: readonly number[], at: number): void; tone(factor: number): void };
}
/** Where the game is: the menu, between waves, in a wave, paused, or the mission is over. */
export type Phase = "menu" | "build" | "wave" | "paused" | "over";
export interface Measure {
  phase: Phase;
  threat: number;
  danger: number;
  arc: number;
  heavies: number;
  bosses: number;
}
interface Player {
  instrument: Instrument;
  pan: number;
  gain: number;
  layer: Exclude<Layer, "sfx">;
}
/** The drum machine. */
const DRUMS: Record<Drum, Player> = {
  kick: { instrument: "kick", pan: 0, gain: 0.9, layer: "drums" },
  snare: { instrument: "snare", pan: 0.05, gain: 0.8, layer: "drums" },
  hat: { instrument: "hat", pan: 0.2, gain: 0.8, layer: "drums" },
  hat16: { instrument: "hat", pan: -0.2, gain: 0.45, layer: "drums" },
  stomp: { instrument: "tom", pan: -0.1, gain: 0.7, layer: "drums" },
  fill: { instrument: "tom", pan: 0.1, gain: 0.7, layer: "drums" },
  crash: { instrument: "crash", pan: 0.1, gain: 0.8, layer: "drums" },
  riser: { instrument: "riser", pan: 0, gain: 0.8, layer: "drums" },
};
/** The tom's pitch for a heavy enemy's stomp and down the fill's four 16ths. */
const STOMP_HZ = 95,
  FILL_HZ = [210, 175, 145, 118];
const BASS: Player = { instrument: "synthBass", pan: 0, gain: 0.8, layer: "bass" },
  ARP: Player = { instrument: "arp", pan: 0.3, gain: 0.7, layer: "keys" },
  LEAD: Player = { instrument: "lead", pan: -0.15, gain: 0.9, layer: "keys" };
/** The arpeggio's level per phase; in a wave it grows with the threat. */
const ARP_LEVEL: Record<Phase, number> = { menu: 0.55, build: 0.5, wave: 0.7, paused: 0, over: 0.5 };
const QUIET: Parts = { drums: [], bass: null, arp: 0, lead: null, extent: 3, color: "drive", escalate: false, threat: 0 };

export class Conductor {
  readonly score = new Score();
  private drone: DroneId = "menu";
  private mood: Color = "drive";
  private escalated = false;
  private phase: Phase = "menu";
  private level = 0;
  private parts: Parts = QUIET;
  /** Start times of the beats the towers pulse with (kicks, or quarter notes in a wave without drums). */
  private beats: number[] = [];
  constructor(private voices: Voices) {}
  get color() {
    return this.mood;
  }
  /** The top of a fight: entered at threat 0.85 or with a boss, left below 0.75. */
  get escalating() {
    return this.escalated;
  }
  theme(drone: DroneId, now: number) {
    if (!this.score.theme(drone, now)) return;
    this.drone = drone;
    this.voices.tempo(this.score.clock.bpm);
    this.voices.ambience.chord(this.score.chordAt(now), now);
  }
  measure(m: Measure) {
    this.mood = colorOf(m.danger, this.mood);
    this.score.extent = extentFor(m.arc);
    const fighting = m.phase === "wave",
      // Late waves start fuller: the mission's progress sets a floor under the threat.
      level = fighting ? Math.max(m.threat, 0.35 * m.arc) : 0,
      escalate = (this.escalated = fighting && (level >= ESCALATE || m.bosses > 0 || (this.escalated && level >= CALM_DOWN))),
      flavor = DRONES[this.drone];
    this.phase = m.phase;
    this.level = level;
    this.parts = {
      drums: fighting ? layersFor(level, m.heavies, escalate) : [],
      bass: m.phase === "menu" || m.phase === "paused" ? null : bassFor(fighting, level, flavor.bass, escalate),
      arp: m.phase === "paused" ? 0 : m.phase === "menu" ? 4 : escalate ? 2 : 3,
      lead: escalate ? flavor.lead : null,
      extent: this.score.extent,
      color: this.mood,
      escalate,
      threat: fighting ? m.threat : 0,
    };
    this.voices.energy(fighting ? Math.min(1, level + (escalate ? 0.3 : 0)) : 0);
    this.voices.ambience.tone(toneFor(this.mood, m.arc));
  }
  /** A cue: a stinger on instruments when it has one, else its effect. */
  cue(id: CueId, now: number, voice = 0, gain = 1, pan?: number) {
    const stinger = STINGERS[id];
    if (!stinger) {
      this.voices.play({ ...this.score.place({ id, voice, gain }, now), pan });
      return;
    }
    const at = nextSlot(this.score.clock, now, TIMING[id].grid),
      step = stepLength(this.score.clock, 16),
      chord = this.score.chordAt(at);
    for (const [name, tone, offset, velocity] of stinger.notes) this.voices.instrument(name, pitch(name, chord, tone), at + offset * step, velocity * Math.min(1, gain), 0, "sfx");
    if (stinger.duck) this.voices.duck(at);
  }
  play(cues: readonly Cue[], now: number) {
    for (const c of cues) this.cue(c.id, now, c.voice, c.gain);
  }
  /** Seconds since the latest beat began, the same for every family (beats scheduled ahead do not count yet); empty outside a wave. */
  ages(now: number): Partial<Record<Family, number>> {
    this.beats = this.beats.filter((t) => t > now - 1);
    const begun = this.beats.filter((t) => t <= now);
    if (!begun.length || this.phase !== "wave") return {};
    const age = now - begun[begun.length - 1];
    return { rapid: age, heavy: age, electric: age, control: age, fire: age, traps: age };
  }
  /** Sequencer window: pad chords, drums, bass, arpeggio and lead due between `from` and `to`. */
  window(from: number, to: number) {
    const clock = this.score.clock,
      beat = stepLength(clock, 4),
      sixteenth = stepLength(clock, 16);
    if (this.phase === "wave" && !this.parts.drums.includes("kick"))
      for (const { time, step } of stepsIn(clock, from, to)) if (step % 4 === 0) this.beats.push(time);
    for (const b of schedule(clock, this.score.music, this.parts, from, to)) {
      if (b.kind === "chord") this.voices.ambience.chord(b.notes, b.at);
      else if (b.kind === "hit") {
        const i = ((b.step % 16) + 16) % 16,
          hz = b.drum === "stomp" ? STOMP_HZ : b.drum === "fill" ? FILL_HZ[i - 12] : 0,
          // The riser ends on the next downbeat (half a bar), whatever the tempo.
          length = b.drum === "riser" ? 8 * sixteenth : undefined;
        this.sound(DRUMS[b.drum], hz, 1, b.at, length);
        if (b.drum === "kick") {
          this.voices.pump(b.at, beat);
          this.beats.push(b.at);
        }
      } else if (b.kind === "bass") {
        const whole = this.parts.bass === "whole",
          hz = rooted(REGISTER.synthBass!, this.score.chordAt(b.at), 0) * 2 ** b.octave * 2 ** (b.offset / 12);
        this.sound(BASS, hz, whole ? 0.6 : 0.85, b.at, whole ? 15.5 * sixteenth : undefined);
      } else if (b.kind === "arp") this.note(ARP, b.voice, ARP_LEVEL[this.phase] * (this.phase === "wave" ? 0.8 + 0.4 * this.level : 1), b.at);
      else this.note(LEAD, b.voice, 1, b.at, b.eighths * 2 * sixteenth * 0.95);
    }
  }
  /** A chord tone of the player's instrument at `at`. */
  private note(player: Player, tone: number, velocity: number, at: number, length?: number) {
    this.sound(player, pitch(player.instrument, this.score.chordAt(at), tone), velocity, at, length);
  }
  private sound(player: Player, hz: number, velocity: number, at: number, length?: number) {
    this.voices.instrument(player.instrument, hz, at, velocity * player.gain, player.pan, player.layer, length);
  }
}
/** A pitched instrument's chord tone around its register; unpitched instruments ignore it. */
const pitch = (name: Instrument, chord: readonly number[], tone: number) => {
  const register = REGISTER[name];
  if (!register) return 0;
  // The bass centres on the root, so a widening chord never drops it an octave.
  return (name === "synthBass" ? rooted : climb)(register, chord, tone);
};
