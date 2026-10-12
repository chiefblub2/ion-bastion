import { cuesFor, newlyEliminated, ReactorWatch } from "../audio/cues";
import { AudioEngine } from "../audio/engine";
import { moodOf } from "../audio/mood";
import type { CueId } from "../audio/recipes";
import { loadSettings, saveSettings, type SoundSettings } from "../audio/settings";
import { unlockOnGesture } from "../audio/unlock";
import type { Game } from "../core/game";
import type { Match } from "../core/match";
import type { GameEvent } from "../core/types";
// Render-side sound: reads drained events and state once per frame, never changes them.

export class Audio {
  settings: SoundSettings = loadSettings();
  private engine: AudioEngine | null = null;
  private listeners = new Set<() => void>();
  private reactor = new ReactorWatch();
  private eliminated: readonly (number | null)[] = [];
  get on() {
    return !this.settings.muted;
  }
  onChange(f: () => void) {
    this.listeners.add(f);
  }
  /** Creates or resumes the context; true once it runs. The first call must come from a user gesture. Throws without Web Audio. */
  async start() {
    if (!this.engine) {
      this.engine = new AudioEngine(new AudioContext());
      this.engine.volumes(this.settings);
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
    this.live()?.play({ id, pitch: 1, gain: 1 });
  }
  frame(events: readonly GameEvent[], game: Game, match: Match | null) {
    const engine = this.live();
    if (!engine) return;
    const view = document.documentElement.dataset.view === "menu" ? "menu" : "game",
      s = game.state;
    for (const c of cuesFor(events, game.content, view)) engine.play(c);
    if (this.reactor.crossed(s, game.mission.reactorEnergy)) this.cue("lowReactor");
    if (match && newlyEliminated(this.eliminated, match.eliminatedAt, match.fields.indexOf(game)).length) this.cue("eliminated");
    this.eliminated = match ? [...match.eliminatedAt] : [];
    engine.ambience.set(moodOf({ view, theme: game.map.theme ?? "outpost", status: s.status, paused: s.paused, enemies: s.enemies.length }));
  }
}
