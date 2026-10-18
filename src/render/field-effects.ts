import type { ContentPack, Point, TurretStyle } from "../core/types";
import type { VisualEvent } from "./effects";
import { halo, SHADOW } from "./material";
import { arcBand, CELL, disc, hash01, polygon, px, ring, shade, strip, type Pen } from "./shapes";
// Effects of Orbital, Mesmer, Amber, Magnetar and Cyclone: the strike column, the amber shatter, the magnetic drag,
// Cyclone's gust and Mesmer's spreading trance. Each lasts the default effect lifetime.
const WHITE = 0xffffff,
  TAU = Math.PI * 2,
  LIFE = 0.45;
const TURRETS = new WeakMap<ContentPack, Map<number, TurretStyle>>();
/** Turret of the tower with this base colour; base colours are unique, so pulse and chain events find their source. */
function turretOf(content: ContentPack, color: number) {
  let map = TURRETS.get(content);
  if (!map) {
    map = new Map(Object.values(content.towers).map((d) => [d.color, d.visual.turret]));
    TURRETS.set(content, map);
  }
  return map.get(color);
}
const grow = (age: number, time: number) => 1 - Math.pow(1 - Math.min(1, age / time), 3);
/** Orbital: a column of light slams down from above, a white flash, a shock ring and debris, over a scorch mark. */
function strike({ g, glow }: Pen, x: number, y: number, R: number, color: number, age: number) {
  const k = Math.min(1, age / LIFE),
    fade = 1 - k,
    flash = Math.max(0, 1 - age / 0.12),
    w = Math.max(3, R * 0.45) * fade;
  disc(g, x, y, R * 0.85, SHADOW, 0.3 * fade);
  strip(glow, x, y, 0, -1, 0, 260, -w, w, -w * 0.6, w * 0.6, color, 0.3 * fade);
  strip(g, x, y, 0, -1, 0, 260, -w * 0.25, w * 0.25, -w * 0.12, w * 0.12, WHITE, fade);
  if (flash > 0) {
    disc(g, x, y, R * 0.45 * flash + 2, WHITE, flash);
    halo(glow, x, y, R * 1.2, color, 0.3 * flash);
  }
  const r = R * grow(age, 0.25);
  ring(g, x, y, r, 3 * fade + 0.6, shade(color, 0.3), 0.9 * fade);
  ring(glow, x, y, r, 7, color, 0.2 * fade);
  for (let i = 0; i < 8; i++) {
    const a = ((i + hash01(x, y, i)) / 8) * TAU,
      d = r * (0.6 + 0.5 * hash01(y, i, x));
    disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d - 10 * k, 1.8 * fade + 0.4, shade(color, 0.4 - 0.6 * k), fade);
  }
}
/** Amber: the resin bursts into spinning shards around a warm flash. */
function shatter({ g, glow }: Pen, x: number, y: number, color: number, age: number) {
  const k = Math.min(1, age / LIFE),
    fade = 1 - k,
    out = grow(age, 0.3);
  halo(glow, x, y, 18, color, 0.3 * Math.max(0, 1 - age / 0.2));
  ring(g, x, y, 6 + 22 * out, 1.5, shade(color, 0.35), 0.8 * fade);
  for (let i = 0; i < 9; i++) {
    const a = ((i + hash01(x, i, y)) / 9) * TAU,
      d = 5 + 26 * out * (0.7 + 0.3 * hash01(i, x)),
      size = 3.6 * fade + 0.6;
    polygon(g, x + Math.cos(a) * d, y + Math.sin(a) * d + 8 * k * k, size, 3, i % 2 ? color : shade(color, 0.45), a + age * 9, fade);
  }
  disc(g, x, y, 3 * Math.max(0, 1 - age / 0.1), WHITE, 1);
}
/** Magnetar: a bowed field line from every dragged enemy to the target, a bead riding it, and a ring closing in. */
function gather({ g, glow }: Pen, at: Point, from: readonly Point[], color: number, age: number) {
  const x = px(at.x),
    y = px(at.y),
    fade = 1 - Math.min(1, age / LIFE),
    ride = grow(age, 0.3);
  for (const [n, f] of from.entries()) {
    const fx = px(f.x),
      fy = px(f.y),
      len = Math.hypot(x - fx, y - fy) || 1,
      bow = (n % 2 ? 1 : -1) * Math.min(10, len * 0.25),
      nx = -(y - fy) / len,
      ny = (x - fx) / len,
      points = Array.from({ length: 9 }, (_, i) => {
        const u = i / 8,
          off = bow * Math.sin(Math.PI * u);
        return { x: fx + (x - fx) * u + nx * off, y: fy + (y - fy) * u + ny * off };
      });
    glow.lineStyle(3, color, 0.3 * fade);
    glow.strokePoints(points, false);
    g.lineStyle(1, shade(color, 0.45), 0.8 * fade);
    g.strokePoints(points, false);
    const bead = points[Math.min(8, Math.round(ride * 8))];
    disc(g, bead.x, bead.y, 1.8, WHITE, fade);
  }
  ring(g, x, y, 6 + 26 * (1 - ride), 1.6, shade(color, 0.35), 0.85 * fade);
  halo(glow, x, y, 12, color, 0.3 * fade);
}
/** Cyclone: a gust whirls outwards in swept arms over a faint disc, wind streaks riding its rim. */
function gust({ g, glow }: Pen, x: number, y: number, R: number, color: number, age: number) {
  const fade = Math.max(0, 1 - age / 0.4),
    r = R * (0.3 + 0.7 * grow(age, 0.25));
  disc(g, x, y, r, color, 0.06 * fade);
  ring(glow, x, y, r, 6, color, 0.18 * fade);
  for (let i = 0; i < 5; i++) {
    const s = -age * 9 + (i * TAU) / 5;
    for (let j = 0; j < 3; j++) arcBand(g, x, y, r * (0.45 + 0.2 * j), 1.6 - 0.4 * j, s + j * 0.35, s + j * 0.35 + 0.9, shade(color, 0.35), 0.85 * fade);
  }
  for (let i = 0; i < 6; i++) {
    const a = -age * 6 + (i * TAU) / 6 + hash01(x, y, i);
    arcBand(glow, x, y, r + 4, 1.2, a, a + 0.4, color, 0.3 * fade);
  }
}
/** Mesmer's Mass Hypnosis: a wavering violet thread with a little swirl where it takes hold. */
function trance({ g, glow }: Pen, fx: number, fy: number, tx: number, ty: number, color: number, age: number) {
  const fade = Math.max(0, 1 - age / 0.4),
    len = Math.hypot(tx - fx, ty - fy) || 1,
    nx = -(ty - fy) / len,
    ny = (tx - fx) / len,
    points = Array.from({ length: 15 }, (_, i) => {
      const u = i / 14,
        off = 3 * Math.sin(u * Math.PI * 5 - age * 20) * Math.sin(Math.PI * u);
      return { x: fx + (tx - fx) * u + nx * off, y: fy + (ty - fy) * u + ny * off };
    });
  glow.lineStyle(3, color, 0.3 * fade);
  glow.strokePoints(points, false);
  g.lineStyle(1.1, shade(color, 0.4), fade);
  g.strokePoints(points, false);
  arcBand(g, tx, ty, 7, 1.4, age * 12, age * 12 + 4, shade(color, 0.4), fade);
}
/** Draws the effect if it belongs to one of these towers; false leaves it to `drawEffect`. */
export function drawFieldEffect(pen: Pen, e: VisualEvent, age: number, content: ContentPack): boolean {
  switch (e.type) {
    case "strike":
      strike(pen, px(e.at.x), px(e.at.y), e.radius * CELL, e.color, age);
      return true;
    case "shatter":
      shatter(pen, px(e.at.x), px(e.at.y), e.color, age);
      return true;
    case "gather":
      gather(pen, e.at, e.from, e.color, age);
      return true;
    case "pulse":
      if (turretOf(content, e.color) !== "fan") return false;
      gust(pen, px(e.at.x), px(e.at.y), e.radius * CELL, e.color, age);
      return true;
    case "chain":
      if (turretOf(content, e.color) !== "spiral") return false;
      trance(pen, px(e.from.x), px(e.from.y), px(e.to.x), px(e.to.y), e.color, age);
      return true;
    default:
      return false;
  }
}
