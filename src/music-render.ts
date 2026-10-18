import { Conductor, type Phase } from "./audio/conductor";
import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { familyOf, type Family } from "./audio/families";
import { MUSIC } from "./audio/harmony";
import { moodOf, type DroneId } from "./audio/mood";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { ShotMixer } from "./audio/shots";
import { encodeWav, levels } from "./audio/wav";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only (`/gallery.html?render`): renders a scene offline through the real engine, conductor and shot mixer, for
// scripts/render-music.ts.

export interface Scenario {
  theme: DroneId;
  phase: Phase;
  threat: number;
  danger: number;
  arc: number;
  heavies: number;
  bosses: number;
  /** Shot storm: this many towers of these families, spread over a 16-column board, each firing `rate` shots per second. */
  towers: number;
  families: readonly Family[];
  rate: number;
  /** False renders the effects alone (music bus at 0). */
  music: boolean;
  bars: number;
}
const RATE = 44100,
  TAIL = 2,
  COLUMNS = 16;

export async function renderMusic(s: Scenario) {
  const seconds = (s.bars * 4 * 60) / MUSIC[s.theme].bpm,
    ctx = new OfflineAudioContext(2, Math.ceil((seconds + TAIL) * RATE), RATE),
    engine = new AudioEngine(ctx),
    conductor = new Conductor(engine),
    shots = new ShotMixer(),
    shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => {
      const f = familyOf(d);
      return f !== null && s.families.includes(f);
    });
  engine.volumes({ ...DEFAULT_SETTINGS, muted: false, music: s.music ? DEFAULT_SETTINGS.music : 0 });
  engine.ambience.set(moodOf({ view: s.phase === "menu" ? "menu" : "game", theme: s.theme === "menu" ? "outpost" : s.theme, status: s.phase === "wave" ? "wave" : "ready", paused: s.phase === "paused", enemies: Math.round(s.threat * 30) }));
  conductor.theme(s.phase === "menu" ? "menu" : s.theme, 0);
  // Each tower fires on its own phase, so shots spread over the frames like on a real board.
  const owed = Array.from({ length: s.towers }, (_, i) => i / Math.max(1, s.towers));
  let kills = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    const events: GameEvent[] = [];
    owed.forEach((_, i) => {
      for (owed[i] += s.rate / 30; owed[i] >= 1; owed[i]--) {
        const d = shooters[i % shooters.length],
          from = { x: (i * 7) % COLUMNS, y: 0 };
        events.push({ type: "shot", tower: d.id as TowerId, from, to: from, color: d.color });
        if (++kills % 5 === 0) events.push({ type: "kill", at: from, color: d.color, reward: 5 });
      }
    });
    conductor.measure({ phase: s.phase, threat: s.threat, danger: s.danger, arc: s.arc, heavies: s.heavies, bosses: s.bosses });
    for (const v of shots.frame(events, DEFAULT_CONTENT, COLUMNS, t)) engine.play({ id: v.id, rate: v.rate, gain: v.gain, at: t, pan: v.pan });
    engine.shotDensity(shots.fired);
    conductor.play(cuesFor(events, DEFAULT_CONTENT, "game"), t);
    conductor.window(t, t + 1 / 30);
  }
  const buffer = await ctx.startRendering(),
    channels = [buffer.getChannelData(0), buffer.getChannelData(1)],
    bytes = encodeWav(channels, RATE);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { wav: btoa(binary), ...levels(channels) };
}
