import { Ambience } from "./ambience";
import { Conductor } from "./conductor";
import type { AudioEngine } from "./engine";
import { INSTRUMENTS } from "./music-instruments";
import { Sequencer } from "./sequencer";
// The soundtrack's entry point: everything only the music needs (conductor, sequencer, grooves, harmony, pad, its
// instruments) is reached from here, so the game loads it on demand (`app/audio.ts`, behind `MUSIC_ENABLED`) and the
// sound board and offline renderer import it directly.

export type MusicEngine = AudioEngine & { ambience: Ambience };
/** Gives the engine the soundtrack's instruments and its pad. */
export function withMusic(engine: AudioEngine): MusicEngine {
  engine.instruments = INSTRUMENTS;
  return Object.assign(engine, { ambience: new Ambience(engine.ctx, engine.pad) });
}
/** Starts the game's soundtrack on `engine`; the sequencer fills its windows only while `live`. */
export function startMusic(engine: AudioEngine, live: () => boolean) {
  const music = withMusic(engine),
    conductor = new Conductor(music);
  new Sequencer(
    () => engine.ctx.currentTime,
    (from, to) => {
      if (live()) conductor.window(from, to);
    },
  ).start();
  return { conductor, ambience: music.ambience };
}
