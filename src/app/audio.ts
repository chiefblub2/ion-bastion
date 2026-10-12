import { cuesFor, newlyEliminated, ReactorWatch } from "../audio/cues";
import { AudioEngine } from "../audio/engine";
import { layersFor, type Drum } from "../audio/grooves";
import { extentFor, type Color } from "../audio/harmony";
import { bossSpawned, colorOf, intensityOf, toneFor } from "../audio/intensity";
import { moodOf } from "../audio/mood";
import type { CueId } from "../audio/recipes";
import { Score } from "../audio/score";
import { schedule, Sequencer, type Parts } from "../audio/sequencer";
import { loadSettings, saveSettings, type SoundSettings } from "../audio/settings";
import { unlockOnGesture } from "../audio/unlock";
import type { Game } from "../core/game";
import type { Match } from "../core/match";
import type { GameEvent } from "../core/types";
// Render-side sound: reads drained events and state once per frame, never changes them. Cues land on the theme's
// beat grid (`Score`); enemies drive the drums, towers the harmony, and the sequencer schedules both ahead.

/** Seconds of audio time between two measurements of threat, defense and clear time. */
const MEASURE = 0.5;
/** A drum part's cue; 16th hats are the hat sound, softer. */
const DRUM_CUE: Record<Drum, { id: CueId; gain: number }> = {
  kick: { id: "kick", gain: 1 },
  snare: { id: "snare", gain: 1 },
  hat: { id: "hat", gain: 1 },
  hat16: { id: "hat", gain: 0.6 },
  stomp: { id: "stomp", gain: 1 },
  bass: { id: "bass", gain: 1 },
};
export class Audio {
  settings: SoundSettings = loadSettings();
  private engine: AudioEngine | null = null;
  private listeners = new Set<() => void>();
  private reactor = new ReactorWatch();
  private eliminated: readonly (number | null)[] = [];
  private score = new Score();
  private parts: Parts = { drums: [], arp: false, extent: 3, color: "drive" };
  private color: Color = "drive";
  private measured = -Infinity;
  get on() {
    return !this.settings.muted;
  }
  onChange(f: () => void) {
    this.listeners.add(f);
  }
  /** Creates or resumes the context; true once it runs. The first call must come from a user gesture. Throws without Web Audio. */
  async start() {
    if (!this.engine) {
      const engine = (this.engine = new AudioEngine(new AudioContext()));
      engine.volumes(this.settings);
      new Sequencer(() => engine.ctx.currentTime, (from, to) => this.window(from, to)).start();
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void this.engine?.ctx.suspend();
        else if (this.on) void this.engine?.ctx.resume();
      });
    }
    await this.engine.ctx.resume();
    return this.engine.ctx.state === "running";
  }
  /** A saved "on" waits for the visit's first gesture, because browsers keep a context silent until then. */
  armAutoStart() {
    // Turned off in the meantime: nothing to start, stop listening.
    if (this.on) unlockOnGesture(window, () => (this.on ? this.start() : Promise.resolve(true)));
  }
  /** Before the context runs, scheduled sounds would pile up at time 0 and all fire on resume. */
  private live() {
    return this.on && this.engine?.ctx.state === "running" ? this.engine : null;
  }
  async update(next: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    for (const f of this.listeners) f();
    if (this.on) await this.start();
    this.engine?.volumes(this.settings);
    if (!this.on) await this.engine?.ctx.suspend();
  }
  cue(id: CueId) {
    const engine = this.live();
    engine?.play(this.score.place({ id, voice: 0, gain: 1 }, engine.ctx.currentTime));
  }
  frame(events: readonly GameEvent[], game: Game, match: Match | null) {
    const engine = this.live();
    if (!engine) return;
    const now = engine.ctx.currentTime,
      view = document.documentElement.dataset.view === "menu" ? "menu" : "game",
      s = game.state,
      mood = moodOf({ view, theme: game.map.theme ?? "outpost", status: s.status, paused: s.paused, enemies: s.enemies.length });
    engine.ambience.set(mood);
    if (this.score.theme(mood.drone, now)) engine.ambience.chord(this.score.chordAt(now), now);
    if (now >= this.measured + MEASURE) {
      this.measured = now;
      const i = intensityOf(s, game.content, game.map.path.length),
        playing = view === "game" && !s.paused;
      this.color = colorOf(i.clear, this.color);
      this.score.extent = extentFor(i.defense);
      this.parts = {
        drums: playing && s.status === "wave" ? layersFor(i.threat, i.heavies) : [],
        arp: playing && i.defense >= 0.75,
        extent: this.score.extent,
        color: this.color,
      };
      engine.ambience.tone(toneFor(this.color, i.defense));
    }
    for (const c of cuesFor(events, game.content, view)) engine.play(this.score.place(c, now));
    if (bossSpawned(events, s, game.content)) this.cue("boss");
    if (this.reactor.crossed(s, game.mission.reactorEnergy)) this.cue("lowReactor");
    if (match && newlyEliminated(this.eliminated, match.eliminatedAt, match.fields.indexOf(game)).length) this.cue("eliminated");
    this.eliminated = match ? [...match.eliminatedAt] : [];
  }
  /** Sequencer window: pad chords, drum hits and arpeggio notes due between `from` and `to` on the audio clock. */
  private window(from: number, to: number) {
    const engine = this.live();
    if (!engine) return;
    for (const b of schedule(this.score.clock, this.score.music, this.parts, from, to)) {
      if (b.kind === "chord") engine.ambience.chord(b.notes, b.at);
      else if (b.kind === "arp") engine.play(this.score.noteAt("arp", b.voice, 1, b.at));
      else engine.play(this.score.noteAt(DRUM_CUE[b.drum].id, 0, DRUM_CUE[b.drum].gain, b.at));
    }
  }
}
