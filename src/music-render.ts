import { Conductor } from "./audio/conductor";
import { cuesFor } from "./audio/cues";
import { AudioEngine } from "./audio/engine";
import { familyOf, type Family } from "./audio/families";
import { MUSIC } from "./audio/harmony";
import type { DroneId } from "./audio/mood";
import { DEFAULT_SETTINGS } from "./audio/settings";
import { encodeWav, levels } from "./audio/wav";
import { DEFAULT_CONTENT } from "./content";
import type { GameEvent, TowerId } from "./core/types";
// Dev-only (`/gallery.html?render`): renders a music scene offline through the real engine and conductor, for
// scripts/render-music.ts.

export interface Scenario {
  theme: DroneId;
  families: readonly Family[];
  rate: number;
  threat: number;
  defense: number;
  clear: number;
  heavies: number;
  bars: number;
}
const RATE = 44100,
  TAIL = 2,
  at = { x: 0, y: 0 };

export async function renderMusic(s: Scenario) {
  const seconds = (s.bars * 4 * 60) / MUSIC[s.theme].bpm,
    ctx = new OfflineAudioContext(2, Math.ceil((seconds + TAIL) * RATE), RATE),
    engine = new AudioEngine(ctx),
    conductor = new Conductor(engine),
    shooters = Object.values(DEFAULT_CONTENT.towers).filter((d) => {
      const f = familyOf(d);
      return f !== null && s.families.includes(f);
    });
  engine.volumes({ ...DEFAULT_SETTINGS, muted: false });
  engine.ambience.set({ drone: s.theme, level: 0.7 });
  conductor.theme(s.theme, 0);
  let owed = 0,
    next = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    const events: GameEvent[] = [];
    for (owed += s.rate / 30; owed >= 1; owed--, next++) {
      const d = shooters[next % shooters.length];
      events.push({ type: "shot", tower: d.id as TowerId, from: at, to: at, color: d.color });
      if (next % 5 === 0) events.push({ type: "kill", at, color: d.color, reward: 5 });
    }
    conductor.shots(events, DEFAULT_CONTENT, t);
    conductor.measure({ threat: s.threat, defense: s.defense, clear: s.clear, heavies: s.heavies, bosses: 0, drums: true, playing: true });
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
