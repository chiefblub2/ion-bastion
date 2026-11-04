import type { Ambience } from "../audio/ambience";
import type { Phase } from "../audio/conductor";
import { cuesFor, newlyEliminated, ReactorWatch } from "../audio/cues";
import { Effects, type Director } from "../audio/effects";
import { AudioEngine } from "../audio/engine";
import { bossSpawned, intensityOf } from "../audio/intensity";
import { moodOf } from "../audio/mood";
import type { CueId } from "../audio/recipes";
import { ShotMixer } from "../audio/shots";
import { loadSettings, MUSIC_ENABLED, saveSettings, type SoundSettings } from "../audio/settings";
import { unlockOnGesture } from "../audio/unlock";
import type { Game } from "../core/game";
import type { Match } from "../core/match";
import type { GameEvent } from "../core/types";
// Render-side sound: reads drained events and state once per frame, never changes them. The director plays the cues:
// without the soundtrack (`MUSIC_ENABLED` false) `Effects` plays them at once; with it the conductor (`audio/music.ts`,
// loaded on demand) turns the game's state (never the towers) into music and places the cues on its beat. The shot
// mixer keeps the towers' shots level however many fire.

/** Seconds of audio time between two measurements of threat, danger and the mission's progress. */
const MEASURE = 0.5;
interface Sound {
  ctx: AudioContext;
  engine: AudioEngine;
  director: Director;
  /** The soundtrack's pad, once the music has loaded. */
  ambience?: Ambience;
  shots: ShotMixer;
}
export class Audio {
  settings: SoundSettings = loadSettings();
  private sound: Sound | null = null;
  private listeners = new Set<() => void>();
  private reactor = new ReactorWatch();
  private eliminated: readonly (number | null)[] = [];
  private measured = -Infinity;
  get on() {
    return !this.settings.muted;
  }
  onChange(f: () => void) {
    this.listeners.add(f);
  }
  /** Creates or resumes the context; true once it runs. The first call must come from a user gesture. Throws without Web Audio. */
  async start() {
    if (!this.sound) {
      const ctx = new AudioContext(),
        engine = new AudioEngine(ctx),
        sound: Sound = { ctx, engine, director: new Effects(engine), shots: new ShotMixer() };
      this.sound = sound;
      engine.volumes(this.settings);
      if (MUSIC_ENABLED)
        void import("../audio/music").then(({ startMusic }) => {
          const music = startMusic(engine, () => this.live() !== null);
          sound.director = music.conductor;
          sound.ambience = music.ambience;
        });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) void ctx.suspend();
        else if (this.on) void ctx.resume();
      });
    }
    await this.sound.ctx.resume();
    return this.sound.ctx.state === "running";
  }
  /** A saved "on" waits for the visit's first gesture, because browsers keep a context silent until then. */
  armAutoStart() {
    // Turned off in the meantime: nothing to start, stop listening.
    if (this.on) unlockOnGesture(window, () => (this.on ? this.start() : Promise.resolve(true)));
  }
  /** Before the context runs, scheduled sounds would pile up at time 0 and all fire on resume. */
  private live() {
    return this.on && this.sound?.ctx.state === "running" ? this.sound : null;
  }
  async update(next: Partial<SoundSettings>) {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    for (const f of this.listeners) f();
    if (this.on) await this.start();
    this.sound?.engine.volumes(this.settings);
    if (!this.on) await this.sound?.ctx.suspend();
  }
  /** Seconds since the music's latest beat began, per tower family (the same for all); empty while sound is off or outside a wave. */
  pulses() {
    const s = this.live();
    return s ? s.director.ages(s.ctx.currentTime) : {};
  }
  cue(id: CueId) {
    const s = this.live();
    s?.director.cue(id, s.ctx.currentTime);
  }
  frame(events: readonly GameEvent[], game: Game, match: Match | null) {
    const s = this.live();
    if (!s) return;
    const now = s.ctx.currentTime,
      view = document.documentElement.dataset.view === "menu" ? "menu" : "game",
      state = game.state,
      mood = moodOf({ view, theme: game.map.theme ?? "outpost", status: state.status, paused: state.paused, enemies: state.enemies.length });
    s.ambience?.set(mood);
    s.director.theme(mood.drone, now);
    if (MUSIC_ENABLED && now >= this.measured + MEASURE) {
      this.measured = now;
      s.director.measure({ ...intensityOf(state, game.content, game.mission), phase: phaseOf(view, state) });
    }
    if (view === "game") {
      for (const v of s.shots.frame(events, game.content, game.map.columns, now)) s.engine.play({ id: v.id, rate: v.rate, gain: v.gain, at: now, pan: v.pan });
      s.engine.shotDensity(s.shots.fired);
    }
    s.director.play(cuesFor(events, game.content, view), now);
    if (bossSpawned(events, state, game.content)) this.cue("boss");
    if (this.reactor.crossed(state, game.mission.reactorEnergy)) this.cue("lowReactor");
    if (match && newlyEliminated(this.eliminated, match.eliminatedAt, match.fields.indexOf(game)).length) this.cue("eliminated");
    this.eliminated = match ? [...match.eliminatedAt] : [];
  }
}
function phaseOf(view: "menu" | "game", state: Game["state"]): Phase {
  if (view === "menu") return "menu";
  if (state.status === "won" || state.status === "lost") return "over";
  if (state.paused) return "paused";
  return state.status === "wave" ? "wave" : "build";
}
