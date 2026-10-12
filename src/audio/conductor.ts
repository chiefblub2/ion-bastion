import type { ContentPack, GameEvent } from "../core/types";
import { Activity, silent } from "./activity";
import { nextSlot, stepAt, stepLength } from "./clock";
import type { Cue } from "./cues";
import { shotsByFamily, type Family } from "./families";
import { CALM_DOWN, ESCALATE, layersFor, tensionOffset, type Drum } from "./grooves";
import { climb, extentFor, type Color } from "./harmony";
import { REGISTER, type Instrument } from "./instruments";
import { colorOf, toneFor } from "./intensity";
import type { DroneId } from "./mood";
import { TIMING, type CueId } from "./recipes";
import { Score, type Note } from "./score";
import { schedule, type Parts } from "./sequencer";
import { STINGERS } from "./stingers";
// Turns the game into music: towers raise their family's activity, enemies set the drums, defense the harmony, the
// clear time the mood. Driven alike by the game (`app/audio.ts`), the sound board and the offline renderer.

/** What the conductor needs from the audio engine; tests pass a recorder. */
export interface Voices {
  play(note: Note): boolean;
  instrument(name: Instrument, hz: number, at: number, velocity: number, pan: number, bus?: "music" | "sfx"): boolean;
  duck(at: number): void;
  /** Music loudness from the fight's energy, 0–1. */
  energy(level: number): void;
  ambience: { chord(notes: readonly number[], at: number): void; tone(factor: number): void };
}
export interface Measure {
  threat: number;
  defense: number;
  clear: number;
  heavies: number;
  bosses: number;
  /** A wave is running, so the enemies' drums may play. */
  drums: boolean;
  /** In the game view and not paused. */
  playing: boolean;
}
interface Player {
  instrument: Instrument;
  pan: number;
  gain: number;
}
/** Each family's instrument, place in the stereo field and level. */
const PLAYERS: Record<Family, Player> = {
  rapid: { instrument: "pluck", pan: -0.35, gain: 0.6 },
  heavy: { instrument: "bass", pan: 0, gain: 0.8 },
  electric: { instrument: "bell", pan: 0.4, gain: 0.45 },
  control: { instrument: "swell", pan: 0, gain: 0.6 },
  fire: { instrument: "shaker", pan: 0.25, gain: 0.5 },
  traps: { instrument: "click", pan: -0.2, gain: 0.5 },
};
/** The enemies' kit: machines, not a drum set. */
const DRUMS: Record<Drum, Player> = {
  kick: { instrument: "thud", pan: 0, gain: 0.8 },
  snare: { instrument: "clank", pan: 0.05, gain: 0.6 },
  hat: { instrument: "tick", pan: 0.15, gain: 0.5 },
  hat16: { instrument: "tick", pan: -0.15, gain: 0.3 },
  stomp: { instrument: "slam", pan: 0, gain: 0.8 },
  fill: { instrument: "slam", pan: -0.1, gain: 0.6 },
  bass: { instrument: "grit", pan: 0, gain: 0.6 },
  bass8: { instrument: "grit", pan: 0, gain: 0.65 },
  crash: { instrument: "metal", pan: 0.1, gain: 0.7 },
  riser: { instrument: "riser", pan: 0, gain: 0.8 },
};
/** Its own short bell, so the 8th-note arpeggio never crowds out the electric part. */
const ARP: Player = { instrument: "chime", pan: -0.15, gain: 0.25 };
const SILENT = silent();

export class Conductor {
  readonly score = new Score();
  readonly activity = new Activity();
  private mood: Color = "drive";
  private escalated = false;
  private parts: Parts = { drums: [], arp: false, extent: 3, color: "drive", activity: SILENT, escalate: false, threat: 0 };
  /** Start times of each family's part notes, for the towers' visual pulse. */
  private started: Partial<Record<Family, number[]>> = {};
  constructor(private voices: Voices) {}
  get color() {
    return this.mood;
  }
  /** The top of a fight: entered at threat 0.85 or with a boss, left below 0.75. */
  get escalating() {
    return this.escalated;
  }
  theme(drone: DroneId, now: number) {
    if (this.score.theme(drone, now)) this.voices.ambience.chord(this.score.chordAt(now), now);
  }
  shots(events: readonly GameEvent[], content: ContentPack, now: number) {
    this.activity.update(shotsByFamily(events, content), now);
  }
  measure(m: Measure) {
    this.mood = colorOf(m.clear, this.mood);
    this.score.extent = extentFor(m.defense);
    const fighting = m.playing && m.drums,
      escalate = (this.escalated = fighting && (m.threat >= ESCALATE || m.bosses > 0 || (this.escalated && m.threat >= CALM_DOWN)));
    this.parts = {
      drums: fighting ? layersFor(m.threat, m.heavies, escalate) : [],
      arp: m.playing && m.defense >= 0.75,
      extent: this.score.extent,
      color: this.mood,
      activity: m.playing ? this.activity.levels : SILENT,
      escalate,
      threat: fighting ? m.threat : 0,
    };
    this.voices.energy(fighting ? Math.min(1, m.threat + (escalate ? 0.3 : 0)) : 0);
    this.voices.ambience.tone(toneFor(this.mood, m.defense));
  }
  /** A cue: a stinger on instruments when it has one, else its effect. */
  cue(id: CueId, now: number, voice = 0, gain = 1) {
    const stinger = STINGERS[id];
    if (!stinger) {
      this.voices.play(this.score.place({ id, voice, gain }, now));
      return;
    }
    const at = nextSlot(this.score.clock, now, TIMING[id].grid),
      step = stepLength(this.score.clock, 16),
      chord = this.score.chordAt(at);
    for (const [name, tone, offset, velocity] of stinger.notes) this.voices.instrument(name, pitch(name, chord, tone), at + offset * step, velocity * Math.min(1, gain), 0, "sfx");
    if (stinger.duck) this.voices.duck(at);
  }
  /** Seconds since each family's latest part note began (notes scheduled ahead do not count yet). */
  ages(now: number) {
    const out: Partial<Record<Family, number>> = {};
    for (const [family, times] of Object.entries(this.started) as [Family, number[]][]) {
      const kept = times.filter((t) => t > now - 1),
        begun = kept.filter((t) => t <= now);
      this.started[family] = kept;
      if (begun.length) out[family] = now - Math.max(...begun);
    }
    return out;
  }
  play(cues: readonly Cue[], now: number) {
    for (const c of cues) this.cue(c.id, now, c.voice, c.gain);
  }
  /** Sequencer window: pad chords, drums, the families' parts and the arpeggio due between `from` and `to`. */
  window(from: number, to: number) {
    for (const b of schedule(this.score.clock, this.score.music, this.parts, from, to)) {
      if (b.kind === "chord") this.voices.ambience.chord(b.notes, b.at);
      else if (b.kind === "part") {
        (this.started[b.family] ??= []).push(b.at);
        this.note(PLAYERS[b.family], b.voice, b.velocity, b.at);
        // Escalated, the rapid part doubles an octave up.
        if (b.family === "rapid" && this.parts.escalate) this.note(PLAYERS.rapid, b.voice, b.velocity * 0.5, b.at, 2);
      }
      else if (b.kind === "arp") this.note(ARP, b.voice, 1, b.at);
      else {
        // The enemies' bass grows dissonant with the threat: tritones, then minor seconds.
        const offset = b.drum === "bass" || b.drum === "bass8" ? tensionOffset(stepAt(this.score.clock, b.at), this.parts.threat) : 0;
        this.note(DRUMS[b.drum], 0, 1, b.at, 2 ** (offset / 12));
      }
    }
  }
  private note(player: Player, tone: number, velocity: number, at: number, ratio = 1) {
    this.voices.instrument(player.instrument, pitch(player.instrument, this.score.chordAt(at), tone) * ratio, at, velocity * player.gain, player.pan);
  }
}
/** A pitched instrument's chord tone around its register; unpitched instruments ignore it. */
const pitch = (name: Instrument, chord: readonly number[], tone: number) => {
  const register = REGISTER[name];
  return register ? climb(register, chord, tone) : 0;
};
