/** Shared pieces of the tower drawings: the drawing context, the scratch polygon and small helpers. */
import type { Tower, TowerDefinition, TurretStyle } from "../../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, facing, halo, led, plate, sunken, type Shape } from "../material";
import { MUZZLES } from "../muzzles";
import { arcBand, chamferRect, disc, hash01, ring, shade, strip, type Ink } from "../shapes";
export interface TurretContext {
  g: Ink;
  /** Additive light: energy cores, hot metal, glowing parts. */
  glow: Ink;
  x: number;
  y: number;
  tower: Tower;
  definition: Readonly<TowerDefinition>;
  clock: number;
  /** Level for attack towers, number of purchases for support towers. */
  level: number;
  maxed: boolean;
  /** Display colour; the path colour once a path is chosen. Trim (collar, lamps, inlay) uses it, bodies keep `definition.color`. */
  color: number;
  /** Chosen upgrade path, if any. */
  path?: string;
  /** 1 right after a shot, fading to 0 within the first 30 % of the attack cycle. */
  kick: number;
  /** Progress of the attack cycle, 1 when ready to fire. */
  charge: number;
  /** Colour of the muzzle's last 3 px: hot from level 5, the path colour once specialized. */
  tip?: number;
  /** Extra glow alpha of energy parts from level 5. */
  energy: number;
  /** Highest glow alpha of a light at the centre, so it stays within 0.6 on top of the maxed halo. */
  peak: number;
}
export type Drawing = (ctx: TurretContext) => void;
export const TAU = Math.PI * 2,
  CORNERS = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const,
  OCTAGON = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
/** Scratch corners for the outlines and polylines below; Phaser copies them, so one buffer serves every call. */
export const PTS = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));
export function put(i: number, x: number, y: number) {
  PTS[i].x = x;
  PTS[i].y = y;
}
export const at = (x: number, y: number, a: number, r: number) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
/** Point `d` along the direction (`ca`, `sa`) and `side` across it (positive at the angle + π/2). */
export const point = (x: number, y: number, ca: number, sa: number, d: number, side: number) => ({ x: x + ca * d - sa * side, y: y + sa * d + ca * side });
// Batched parts: `quad` and `pip` add triangles in the current fill style, so a row of equal studs, ticks or vents
// costs one style change and no polygon triangulation.
/** Quad along (`ca`, `sa`) from `d0` to `d1`, with the offsets `a0`/`b0` across at the start and `a1`/`b1` at the end. */
export function quad(g: Ink, x: number, y: number, ca: number, sa: number, d0: number, d1: number, a0: number, b0: number, a1: number, b1: number) {
  const x0 = x + ca * d0,
    y0 = y + sa * d0,
    x1 = x + ca * d1,
    y1 = y + sa * d1;
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * a1, y1 + ca * a1, x1 - sa * b1, y1 + ca * b1);
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * b1, y1 + ca * b1, x0 - sa * b0, y0 + ca * b0);
}
/** Radial tick from `r0` to `r1` at angle `a`, `w` wide. */
export const tick = (g: Ink, x: number, y: number, a: number, r0: number, r1: number, w: number) => quad(g, x, y, Math.cos(a), Math.sin(a), r0, r1, -w / 2, w / 2, -w / 2, w / 2);
/** Small octagonal dot. */
export function pip(g: Ink, x: number, y: number, r: number) {
  for (let i = 1; i < 7; i++) g.fillTriangle(x + r, y, x + OCTAGON[i][0] * r, y + OCTAGON[i][1] * r, x + OCTAGON[i + 1][0] * r, y + OCTAGON[i + 1][1] * r);
}
/** Flat tapered bar along `a` from distance `from` to `to` with half widths `w0` and `w1`, for energy strips and light. */
export function bar(g: Ink, x: number, y: number, a: number, from: number, to: number, w0: number, w1: number, color: number, alpha = 1, side = 0) {
  strip(g, x, y, Math.cos(a), Math.sin(a), from, to, side - w0, side + w0, side - w1, side + w1, color, alpha);
}
/** Small parts lit from the upper left: every body in a shaded tone, then the halves that face the light. */
export function fins(g: Ink, x: number, y: number, angles: readonly number[], from: number, to: number, w0: number, w1: number, color: number) {
  for (const lit of [false, true]) {
    g.fillStyle(shade(color, lit ? 0.22 : -0.3));
    for (const a of angles) {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        side = facing(a + Math.PI / 2) < 0 ? -1 : 1;
      if (lit) quad(g, x, y, ca, sa, from, to, 0, side * w0, 0, side * w1);
      else quad(g, x, y, ca, sa, from, to, -w0, w0, -w1, w1);
    }
  }
}
/** Ring of at least 16 segments for small radii, where `ring` turns visibly polygonal. */
export function loop(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha = 1) {
  if (alpha <= 0.01) return;
  const n = Math.max(16, Math.ceil(r * 2)),
    r0 = Math.max(0, r - w / 2),
    r1 = r + w / 2;
  g.fillStyle(color, alpha);
  for (let i = 0; i < n; i++) {
    const c0 = Math.cos((i * TAU) / n),
      s0 = Math.sin((i * TAU) / n),
      c1 = Math.cos(((i + 1) * TAU) / n),
      s1 = Math.sin(((i + 1) * TAU) / n);
    g.fillTriangle(x + c0 * r1, y + s0 * r1, x + c1 * r1, y + s1 * r1, x + c1 * r0, y + s1 * r0);
    g.fillTriangle(x + c0 * r1, y + s0 * r1, x + c1 * r0, y + s1 * r0, x + c0 * r0, y + s0 * r0);
  }
}
/** Box turned to angle `a`: half length `hl` along it, half width `hw` across, corners cut by `cut`. */
export function block(g: Ink, x: number, y: number, a: number, hl: number, hw: number, cut: number, color: number) {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    k = Math.min(cut, hl, hw),
    u = [-hl + k, hl - k, hl, hl, hl - k, -hl + k, -hl, -hl],
    v = [-hw, -hw, -hw + k, hw - k, hw, hw, hw - k, -hw + k];
  for (let i = 0; i < 8; i++) put(i, x + ca * u[i] - sa * v[i], y + sa * u[i] + ca * v[i]);
  g.fillStyle(color);
  g.fillPoints(PTS, true, false, 8);
}
/** Regular polygon cut into one triangle per edge, each shaded by how much its edge faces the light. */
export function facets(g: Ink, x: number, y: number, r: number, n: number, rot: number, color: number, depth: number) {
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n,
      a1 = a0 + TAU / n;
    g.fillStyle(shade(color, depth * facing((a0 + a1) / 2)));
    g.fillTriangle(x, y, x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  }
}
/** Round housing: a shaded rim, a face nudged towards the light and a lit upper-left edge. */
export function boss(g: Ink, x: number, y: number, r: number, color: number) {
  disc(g, x, y, r, shade(color, -0.45));
  disc(g, x - 0.4, y - 0.4, r - 1, color);
  arcBand(g, x - 0.4, y - 0.4, r - 1.5, 0.9, LIGHT - 1, LIGHT + 1, shade(color, 0.3), 0.85);
}
/** Soft round light in two discs; the centre reaches `alpha`. */
export function glowDot(glow: Ink, x: number, y: number, r: number, color: number, alpha: number) {
  disc(glow, x, y, r, color, alpha * 0.45);
  disc(glow, x, y, r * 0.5, color, alpha * 0.55);
}
/** Engraved line just inside a plate outline. */
export function inlay(g: Ink, x: number, y: number, s: Shape, r: number, color: number, alpha = 1) {
  if (s === "disc") return ring(g, x, y, r, 0.8, color, alpha);
  let n = 8;
  if ("cut" in s) {
    const k = s.cut * r,
      u = [-r + k, r - k, r, r, r - k, -r + k, -r, -r],
      v = [-r, -r, -r + k, r - k, r, r, r - k, -r + k];
    for (let i = 0; i < 8; i++) put(i, x + u[i], y + v[i]);
  } else {
    n = s.n;
    for (let i = 0; i < n; i++) put(i, x + Math.cos((s.rot ?? 0) + (i * TAU) / n) * r, y + Math.sin((s.rot ?? 0) + (i * TAU) / n) * r);
  }
  g.lineStyle(0.8, color, alpha);
  g.strokePoints(PTS, true, true, n);
}
/** Raised base plate with a sunken deck (`deckShape`, by default the plate's own); from level 4 an inlay follows the outline. */
export function base(ctx: TurretContext, s: Shape, r: number, deck: number, deckShape: Shape = s) {
  const { g, x, y } = ctx;
  plate(g, x, y, s, r, PLATE);
  sunken(g, x, y, deckShape, deck, DARK);
  if (ctx.level >= 4) inlay(g, x, y, s, r - 1.6, shade(ctx.color, -0.35));
}
/** Recoil and barrel end from the shared muzzle table, so the drawn tip meets the flash and the shot. */
export function reach({ kick, level }: TurretContext, turret: TurretStyle) {
  const m = MUZZLES[turret]!,
    back = -kick * m.recoil;
  return { back, end: back + m.reach(level) };
}
/** Centre bolt: a dark head with a lit upper-left rim; white-hot with a small halo on a fully upgraded tower. */
export function bolt({ g, glow, x, y, color, maxed }: TurretContext, r = 2.6) {
  disc(g, x, y, r, maxed ? shade(color, 0.8) : DARK);
  arcBand(g, x, y, r - 0.6, 0.9, LIGHT - 1.1, LIGHT + 1.1, maxed ? 0xffffff : shade(PLATE, 0.45), 0.9);
  if (maxed) disc(glow, x, y, r * 1.6, color, 0.2);
}
/** Light at the barrel tip right after a shot, around a small hot core; the flash itself is an effect. */
export function muzzleGlow({ g, glow, x, y, tower: t, definition: d, kick }: TurretContext, distance: number, size: number) {
  if (kick <= 0) return;
  const p = at(x, y, t.angle, distance);
  halo(glow, p.x, p.y, size * (1.3 + kick), d.color, 0.3 * kick);
  disc(g, p.x, p.y, size * 0.35 * (0.5 + kick), shade(d.color, 0.75));
}
/** Half size of the frame of each framed trap; the ready light sits in its upper-right corner. */
export const FRAMES: Partial<Record<TurretStyle, number>> = { mine: 15, spikes: 19, snare: 18, grill: 19, spring: 16, limpet: 14 };
/** Traps lie flat on the path: a sunken chamfered frame with screws in three corners and the ready light in the fourth. */
export function trapFrame({ g, x, y, definition: d, level }: TurretContext, size: number) {
  const s = size - 3.4;
  chamferRect(g, x, y, size + 1, size + 1, size * 0.28 + 0.4, OUTLINE, 0.6);
  chamferRect(g, x, y, size, size, size * 0.28, shade(PLATE, -0.1));
  sunken(g, x, y, { cut: 0.28 }, size - 2.4, DARK);
  if (level >= 5) inlay(g, x, y, { cut: 0.28 }, size - 1.2, d.color, 0.5);
  g.fillStyle(shade(d.color, -0.35));
  for (const [sx, sy] of CORNERS) if (sx < 0 || sy > 0) pip(g, x + sx * s, y + sy * s, 1.6);
  g.fillStyle(shade(PLATE, 0.45), 0.8);
  for (const [sx, sy] of CORNERS) if (sx < 0 || sy > 0) pip(g, x + sx * s - 0.5, y + sy * s - 0.5, 0.6);
}
/** Ready light of a trap: lit once it has re-armed, dark while it reloads; dimmed so trap light stays faint. */
export function armedLed(ctx: TurretContext) {
  const s = (FRAMES[ctx.definition.visual.turret] ?? 17.4) - 3.4;
  led(ctx, ctx.x + s, ctx.y - s, ctx.definition.color, ctx.tower.cooldown === 0 ? 0.7 : 0);
}
/** Short jagged spark between two radii on the glow layer; `seed` picks its shape. */
export function crackle(glow: Ink, x: number, y: number, a: number, r0: number, r1: number, color: number, alpha: number, seed: number) {
  for (let i = 0; i <= 3; i++) {
    const r = r0 + ((r1 - r0) * i) / 3,
      off = i === 0 || i === 3 ? 0 : (hash01(seed, i) - 0.5) * 3.2;
    put(i, x + Math.cos(a) * r - Math.sin(a) * off, y + Math.sin(a) * r + Math.cos(a) * off);
  }
  glow.lineStyle(1.3, color, alpha);
  glow.strokePoints(PTS, false, false, 4);
}
/** Hexagon outline with a corner at `rot`. */
export function hexLine(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha: number, rot = 0) {
  for (let i = 0; i < 6; i++) put(i, x + Math.cos(rot + (i * Math.PI) / 3) * r, y + Math.sin(rot + (i * Math.PI) / 3) * r);
  g.lineStyle(w, color, alpha);
  g.strokePoints(PTS, true, true, 6);
}
