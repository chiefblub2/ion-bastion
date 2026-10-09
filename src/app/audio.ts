import type { GameEvent } from "../core/types";
/** Start and end pitch of a short blip per event type; other events are silent. */
const TONES: Partial<Record<GameEvent["type"], [number, number]>> = {
  shot: [430, 180],
  income: [990, 1320],
  build: [660, 180],
  leak: [140, 60],
  waveEnd: [880, 180],
  end: [880, 180],
};
export class Audio {
  enabled = false;
  private context: AudioContext | null = null;
  private lastShot = 0;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      await this.context.resume();
    }
    return this.enabled;
  }
  play(events: GameEvent[]) {
    if (!this.enabled || !this.context) return;
    for (const e of events) {
      const tone = TONES[e.type];
      if (!tone) continue;
      if (e.type === "shot" && this.context.currentTime - this.lastShot < 0.09) continue;
      this.lastShot = this.context.currentTime;
      const o = this.context.createOscillator(),
        v = this.context.createGain(),
        t = this.context.currentTime;
      o.type = "sine";
      o.frequency.setValueAtTime(tone[0], t);
      o.frequency.exponentialRampToValueAtTime(tone[1], t + 0.11);
      v.gain.setValueAtTime(0.035, t);
      v.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(v);
      v.connect(this.context.destination);
      o.start(t);
      o.stop(t + 0.13);
    }
  }
}
