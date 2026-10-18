import { fnv } from "../core/hash";
import type { ContentPack, GameEvent, TowerId } from "../core/types";
import { FAMILIES, familyOf, type Family } from "./families";
import type { CueId } from "./recipes";
// Tower shots → quiet transients that stay pleasant however many towers fire. Each family may start only so many
// voices per second (a token bucket), a frame's shots of one family merge into one voice, and each voice's gain falls
// with the family's voice rate so the summed power stays about level: 3 towers and 40 towers sound equally loud,
// only denser. Pure: the engine plays the voices, `shotDensity` shades the bus.

export const SHOT_CUE: Record<Family, CueId> = { rapid: "shotRapid", heavy: "shotHeavy", electric: "shotElectric", control: "shotControl", fire: "shotFire", traps: "shotTrap" };
/** Voices a family may start per second, in real seconds (2× speed is not denser). */
export const BUDGET: Record<Family, number> = { rapid: 10, heavy: 4, electric: 6, control: 4, fire: 6, traps: 4 };
/** Voices per second up to which a voice plays at full gain; above it the gain falls as 1/√rate. */
const REFERENCE = 2,
  /** Time constant of the rate meter, seconds. */
  METER = 0.5,
  /** Shot voices one frame may start across all families; families that waited longest go first. */
  PER_FRAME = 3,
  /** Widest pan, so no shot sits hard in one ear. */
  WIDTH = 0.7;
export interface ShotVoice {
  id: CueId;
  family: Family;
  gain: number;
  /** Playback rate: each tower type keeps its own pitch, a step or two around the recipe's. */
  rate: number;
  pan: number;
}
/** A tower type's fixed offset of −2…+2 semitones. */
export const rateOf = (tower: TowerId) => 2 ** (((fnv(`shot:${tower}`) % 5) - 2) / 12);
/** Stereo position from a column on a board `columns` wide. */
export const panOf = (x: number, columns: number) => (columns > 1 ? Math.max(-WIDTH, Math.min(WIDTH, ((x / (columns - 1)) * 2 - 1) * WIDTH)) : 0);
/** Gain of one voice at a family's voice rate (voices per second). */
export const shotGain = (rate: number) => 1 / Math.sqrt(Math.max(1, rate / REFERENCE));

/** A rate meter: events per second, smoothed exponentially; events in a frame without audio time pass wait for the next. */
class Meter {
  value = 0;
  private pending = 0;
  add(n: number, dt: number, keep: number) {
    this.pending += n;
    if (dt <= 0) return;
    this.value = this.value * keep + (this.pending / dt) * (1 - keep);
    this.pending = 0;
  }
}
const perFamily = <T>(v: T) => Object.fromEntries(FAMILIES.map((f) => [f, v])) as Record<Family, T>;

export class ShotMixer {
  /** Voices started per second per family, smoothed. */
  private voices = Object.fromEntries(FAMILIES.map((f) => [f, new Meter()])) as Record<Family, Meter>;
  /** Shots fired per second over all families, smoothed (for the bus's density shading). */
  private shots = new Meter();
  private tokens = perFamily(1);
  private played = perFamily(-Infinity);
  private at: number | null = null;
  get fired() {
    return this.shots.value;
  }
  rate(family: Family) {
    return this.voices[family].value;
  }
  /** The shot voices for one frame's drained events at audio time `now`. */
  frame(events: readonly GameEvent[], content: ContentPack, columns: number, now: number): ShotVoice[] {
    const dt = this.at === null ? 0 : Math.max(0, now - this.at),
      keep = Math.exp(-dt / METER);
    this.at = now;
    const shots = new Map<Family, { n: number; x: number; tower: TowerId }>();
    let fired = 0;
    for (const e of events) {
      if (e.type !== "shot") continue;
      const family = familyOf(content.towers[e.tower]);
      if (!family) continue;
      fired++;
      const s = shots.get(family);
      if (s) {
        s.n++;
        s.x += e.from.x;
      } else shots.set(family, { n: 1, x: e.from.x, tower: e.tower });
    }
    this.shots.add(fired, dt, keep);
    for (const f of FAMILIES) this.tokens[f] = Math.min(1, this.tokens[f] + dt * BUDGET[f]);
    const ready = new Set([...shots.keys()].filter((f) => this.tokens[f] >= 1).sort((a, b) => this.played[a] - this.played[b]).slice(0, PER_FRAME)),
      out: ShotVoice[] = [];
    for (const family of FAMILIES) {
      const s = ready.has(family) ? shots.get(family)! : null;
      this.voices[family].add(s ? 1 : 0, dt, keep);
      if (!s) continue;
      this.tokens[family] -= 1;
      this.played[family] = now;
      out.push({ id: SHOT_CUE[family], family, gain: shotGain(this.voices[family].value), rate: rateOf(s.tower), pan: panOf(s.x / s.n, columns) });
    }
    return out;
  }
}
