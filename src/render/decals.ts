import type { ContentPack, GameEvent } from "../core/types";
import { CELL, hash01, oval, px, type Pen } from "./shapes";
/** Seconds a scorch mark stays on the ground (it fades over the last part). */
export const SCORCH_LIFE = 14;
/** Most marks kept at once; the oldest goes first. */
export const MAX_SCORCHES = 40;
interface Scorch {
  x: number;
  y: number;
  /** Pixel radius. */
  r: number;
  born: number;
  seed: number;
}
/** Splash shells and mines leave marks, so do orbital strikes; flyer bursts and pools do not. */
function scorchOf(e: GameEvent, content: ContentPack): { at: { x: number; y: number }; radius: number } | undefined {
  if (e.type === "strike") return { at: e.at, radius: e.radius };
  if (e.type !== "impact") return undefined;
  const attack = content.towers[e.tower].attack;
  return attack.kind === "splash" || attack.kind === "mortar" ? { at: e.at, radius: attack.radius } : undefined;
}
/**
 * Scorch marks of heavy impacts (render only, on `fxClock`): a sooty oval and blots that fade out, with a short
 * ember glow at first. Bounded by `MAX_SCORCHES`, so a long wave never piles them up.
 */
export class Scorches {
  private marks: Scorch[] = [];
  consume(events: readonly GameEvent[], content: ContentPack, now: number) {
    for (const e of events) {
      const s = scorchOf(e, content);
      if (!s) continue;
      this.marks.push({ x: px(s.at.x), y: px(s.at.y), r: Math.min(1.4, s.radius) * CELL * 0.42, born: now, seed: hash01(s.at.x, s.at.y, now) });
      if (this.marks.length > MAX_SCORCHES) this.marks.shift();
    }
    if (this.marks.length && now - this.marks[0].born > SCORCH_LIFE) this.marks = this.marks.filter((m) => now - m.born <= SCORCH_LIFE);
  }
  draw({ g, glow }: Pen, now: number) {
    for (const m of this.marks) {
      const age = now - m.born,
        fade = Math.min(1, (SCORCH_LIFE - age) / (SCORCH_LIFE * 0.5)),
        tilt = m.seed * Math.PI;
      if (fade <= 0) continue;
      oval(g, m.x, m.y, m.r, m.r * 0.78, 0x0a0806, 0.22 * fade, tilt);
      oval(g, m.x, m.y, m.r * 0.62, m.r * 0.5, 0x050302, 0.22 * fade, tilt + 0.6);
      for (let i = 0; i < 4; i++) {
        const a = tilt + i * 1.7 + hash01(m.seed, i) * 0.8,
          d = m.r * (0.55 + 0.4 * hash01(i, m.seed));
        oval(g, m.x + Math.cos(a) * d, m.y + Math.sin(a) * d, m.r * 0.18, m.r * 0.1, 0x050302, 0.18 * fade, a);
      }
      // Embers cool down over the first two seconds.
      const ember = 1 - age / 2;
      if (ember > 0) oval(glow, m.x, m.y, m.r * 0.5, m.r * 0.4, 0xff8a3c, 0.16 * ember * ember, tilt);
    }
  }
  reset() {
    this.marks = [];
  }
}
