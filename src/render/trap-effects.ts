import type { GameEvent } from "../core/types";
import { glowLine, halo, SHADOW } from "./material";
import { arcBand, disc, hash01, oval, px, ring, shade, strip, type Ink, type Pen } from "./shapes";
const WHITE = 0xffffff;
/** Seconds a warp or breach effect lasts. */
export const TRAP_EFFECT_LIFE = 0.55;
type TrapEvent = Extract<GameEvent, { type: "warp" | "breach" }>;
/**
 * Warp Pad: the enemy implodes into a point where it stood and bursts out of a ring where it lands, a faint
 * streak tying both. Barricade breach: splinters fly and a ring of dust spreads.
 */
export function drawTrapEffect(pen: Pen, e: TrapEvent, age: number) {
  const { g, glow } = pen,
    k = Math.min(1, age / TRAP_EFFECT_LIFE),
    fade = 1 - k;
  if (fade <= 0) return;
  const x = px(e.at.x),
    y = px(e.at.y);
  if (e.type === "warp") {
    const tx = px(e.to.x),
      ty = px(e.to.y),
      shrink = Math.min(1, age / 0.2);
    ring(g, x, y, 16 * (1 - shrink) + 1, 2, e.color, 0.9 * (1 - shrink));
    disc(g, x, y, 3 * (1 - shrink), WHITE, 1 - shrink);
    glowLine(glow, x, y, tx, ty, e.color, 1.2, 0.25 * fade);
    const open = 1 - Math.pow(1 - k, 3);
    ring(g, tx, ty, 4 + 16 * open, 2.5 * fade + 0.5, shade(e.color, 0.3), fade);
    ring(glow, tx, ty, 4 + 16 * open, 6, e.color, 0.2 * fade);
    halo(glow, tx, ty, 12, e.color, 0.45 * fade);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + age * 6;
      disc(g, tx + Math.cos(a) * (6 + 14 * open), ty + Math.sin(a) * (6 + 14 * open), 1.3 * fade + 0.3, WHITE, fade);
    }
    return;
  }
  ring(g, x, y + 3, 6 + 20 * k, 6 * fade, 0x8e8478, 0.3 * fade);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + hash01(e.at.x, e.at.y, i),
      d = 4 + 22 * Math.min(1, age / 0.35) * (0.6 + 0.4 * hash01(i, e.at.x)),
      lift = 10 * Math.sin(Math.PI * k),
      sx = x + Math.cos(a) * d,
      sy = y + Math.sin(a) * d - lift,
      spin = a + age * 12;
    oval(g, sx + 0.8, y + Math.sin(a) * d + 1.5, 2.6, 1.2, SHADOW, 0.3 * fade);
    strip(g, sx, sy, Math.cos(spin), Math.sin(spin), -3, 3, -1, 1, -0.8, 0.8, shade(e.color, (i % 3) * 0.2 - 0.2), fade);
  }
  arcBand(g, x, y, 10 + 8 * k, 2, -2.2, -0.9, WHITE, 0.6 * fade);
}
/** An oiled enemy: a dark, glossy coat around its feet with a slow rainbow sheen and drips left behind. */
export function drawOilCoat(g: Ink, x: number, y: number, r: number, heading: number, clock: number, id: number) {
  oval(g, x, y + r * 0.35, r + 4, (r + 4) * 0.55, 0x1b1426, 0.55);
  for (const [i, hue] of [0xff7ad9, 0x7affd4, 0xffe27a].entries()) {
    const a = clock * 0.8 + id + i * 2.1;
    arcBand(g, x, y + r * 0.35, r + 1 + i * 1.4, 1, a, a + 1.1, hue, 0.3);
  }
  for (let i = 0; i < 2; i++) {
    const k = (clock * 1.2 + i / 2 + id * 0.13) % 1;
    disc(g, x - Math.cos(heading) * (r + 3 + k * 7), y - Math.sin(heading) * (r + 3 + k * 7) + r * 0.3, 1.8 * (1 - 0.5 * k), 0x2a1f3d, 0.8 * (1 - k));
  }
}
