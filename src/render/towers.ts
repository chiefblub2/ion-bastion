import type { PathMotif, Tower, TowerDefinition, TurretStyle } from "../core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, facing, glowLine, halo, led, litBar, plate, rivets, sunken, type Shape } from "./material";
import { MUZZLES } from "./muzzles";
import { wallShareOf } from "../systems/barricade";
import { arcBand, chamferRect, disc, hash01, oval, polygon, ring, shade, star, strip, wedge, type Ink, type Pen } from "./shapes";
interface TurretContext {
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
type Drawing = (ctx: TurretContext) => void;
const TAU = Math.PI * 2,
  CORNERS = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const,
  OCTAGON = Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)]);
/** Scratch corners for the outlines and polylines below; Phaser copies them, so one buffer serves every call. */
const PTS = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));
function put(i: number, x: number, y: number) {
  PTS[i].x = x;
  PTS[i].y = y;
}
const at = (x: number, y: number, a: number, r: number) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
/** Point `d` along the direction (`ca`, `sa`) and `side` across it (positive at the angle + π/2). */
const point = (x: number, y: number, ca: number, sa: number, d: number, side: number) => ({ x: x + ca * d - sa * side, y: y + sa * d + ca * side });
// Batched parts: `quad` and `pip` add triangles in the current fill style, so a row of equal studs, ticks or vents
// costs one style change and no polygon triangulation.
/** Quad along (`ca`, `sa`) from `d0` to `d1`, with the offsets `a0`/`b0` across at the start and `a1`/`b1` at the end. */
function quad(g: Ink, x: number, y: number, ca: number, sa: number, d0: number, d1: number, a0: number, b0: number, a1: number, b1: number) {
  const x0 = x + ca * d0,
    y0 = y + sa * d0,
    x1 = x + ca * d1,
    y1 = y + sa * d1;
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * a1, y1 + ca * a1, x1 - sa * b1, y1 + ca * b1);
  g.fillTriangle(x0 - sa * a0, y0 + ca * a0, x1 - sa * b1, y1 + ca * b1, x0 - sa * b0, y0 + ca * b0);
}
/** Radial tick from `r0` to `r1` at angle `a`, `w` wide. */
const tick = (g: Ink, x: number, y: number, a: number, r0: number, r1: number, w: number) => quad(g, x, y, Math.cos(a), Math.sin(a), r0, r1, -w / 2, w / 2, -w / 2, w / 2);
/** Small octagonal dot. */
function pip(g: Ink, x: number, y: number, r: number) {
  for (let i = 1; i < 7; i++) g.fillTriangle(x + r, y, x + OCTAGON[i][0] * r, y + OCTAGON[i][1] * r, x + OCTAGON[i + 1][0] * r, y + OCTAGON[i + 1][1] * r);
}
/** Flat tapered bar along `a` from distance `from` to `to` with half widths `w0` and `w1`, for energy strips and light. */
function bar(g: Ink, x: number, y: number, a: number, from: number, to: number, w0: number, w1: number, color: number, alpha = 1, side = 0) {
  strip(g, x, y, Math.cos(a), Math.sin(a), from, to, side - w0, side + w0, side - w1, side + w1, color, alpha);
}
/** Small parts lit from the upper left: every body in a shaded tone, then the halves that face the light. */
function fins(g: Ink, x: number, y: number, angles: readonly number[], from: number, to: number, w0: number, w1: number, color: number) {
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
function loop(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha = 1) {
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
function block(g: Ink, x: number, y: number, a: number, hl: number, hw: number, cut: number, color: number) {
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
function facets(g: Ink, x: number, y: number, r: number, n: number, rot: number, color: number, depth: number) {
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n,
      a1 = a0 + TAU / n;
    g.fillStyle(shade(color, depth * facing((a0 + a1) / 2)));
    g.fillTriangle(x, y, x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r);
  }
}
/** Round housing: a shaded rim, a face nudged towards the light and a lit upper-left edge. */
function boss(g: Ink, x: number, y: number, r: number, color: number) {
  disc(g, x, y, r, shade(color, -0.45));
  disc(g, x - 0.4, y - 0.4, r - 1, color);
  arcBand(g, x - 0.4, y - 0.4, r - 1.5, 0.9, LIGHT - 1, LIGHT + 1, shade(color, 0.3), 0.85);
}
/** Soft round light in two discs; the centre reaches `alpha`. */
function glowDot(glow: Ink, x: number, y: number, r: number, color: number, alpha: number) {
  disc(glow, x, y, r, color, alpha * 0.45);
  disc(glow, x, y, r * 0.5, color, alpha * 0.55);
}
/** Engraved line just inside a plate outline. */
function inlay(g: Ink, x: number, y: number, s: Shape, r: number, color: number, alpha = 1) {
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
function base(ctx: TurretContext, s: Shape, r: number, deck: number, deckShape: Shape = s) {
  const { g, x, y } = ctx;
  plate(g, x, y, s, r, PLATE);
  sunken(g, x, y, deckShape, deck, DARK);
  if (ctx.level >= 4) inlay(g, x, y, s, r - 1.6, shade(ctx.color, -0.35));
}
/** Recoil and barrel end from the shared muzzle table, so the drawn tip meets the flash and the shot. */
function reach({ kick, level }: TurretContext, turret: TurretStyle) {
  const m = MUZZLES[turret]!,
    back = -kick * m.recoil;
  return { back, end: back + m.reach(level) };
}
/** Centre bolt: a dark head with a lit upper-left rim; white-hot with a small halo on a fully upgraded tower. */
function bolt({ g, glow, x, y, color, maxed }: TurretContext, r = 2.6) {
  disc(g, x, y, r, maxed ? shade(color, 0.8) : DARK);
  arcBand(g, x, y, r - 0.6, 0.9, LIGHT - 1.1, LIGHT + 1.1, maxed ? 0xffffff : shade(PLATE, 0.45), 0.9);
  if (maxed) disc(glow, x, y, r * 1.6, color, 0.2);
}
/** Light at the barrel tip right after a shot, around a small hot core; the flash itself is an effect. */
function muzzleGlow({ g, glow, x, y, tower: t, definition: d, kick }: TurretContext, distance: number, size: number) {
  if (kick <= 0) return;
  const p = at(x, y, t.angle, distance);
  halo(glow, p.x, p.y, size * (1.3 + kick), d.color, 0.3 * kick);
  disc(g, p.x, p.y, size * 0.35 * (0.5 + kick), shade(d.color, 0.75));
}
/** Half size of the frame of each framed trap; the ready light sits in its upper-right corner. */
const FRAMES: Partial<Record<TurretStyle, number>> = { mine: 15, spikes: 19, snare: 18, grill: 19, spring: 16, limpet: 14 };
/** Traps lie flat on the path: a sunken chamfered frame with screws in three corners and the ready light in the fourth. */
function trapFrame({ g, x, y, definition: d, level }: TurretContext, size: number) {
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
function armedLed(ctx: TurretContext) {
  const s = (FRAMES[ctx.definition.visual.turret] ?? 17.4) - 3.4;
  led(ctx, ctx.x + s, ctx.y - s, ctx.definition.color, ctx.tower.cooldown === 0 ? 0.7 : 0);
}
/** Short jagged spark between two radii on the glow layer; `seed` picks its shape. */
function crackle(glow: Ink, x: number, y: number, a: number, r0: number, r1: number, color: number, alpha: number, seed: number) {
  for (let i = 0; i <= 3; i++) {
    const r = r0 + ((r1 - r0) * i) / 3,
      off = i === 0 || i === 3 ? 0 : (hash01(seed, i) - 0.5) * 3.2;
    put(i, x + Math.cos(a) * r - Math.sin(a) * off, y + Math.sin(a) * r + Math.cos(a) * off);
  }
  glow.lineStyle(1.3, color, alpha);
  glow.strokePoints(PTS, false, false, 4);
}
/** Hexagon outline with a corner at `rot`. */
function hexLine(g: Ink, x: number, y: number, r: number, w: number, color: number, alpha: number, rot = 0) {
  for (let i = 0; i < 6; i++) put(i, x + Math.cos(rot + (i * Math.PI) / 3) * r, y + Math.sin(rot + (i * Math.PI) / 3) * r);
  g.lineStyle(w, color, alpha);
  g.strokePoints(PTS, true, true, 6);
}
/** Base plates by `visual.turret`: the raised plate with its deck, studs and trim. */
const BASES: Record<TurretStyle, Drawing> = {
  barrel: (ctx) => {
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 3, Math.PI / 6, shade(ctx.definition.color, -0.45));
  },
  heavy: (ctx) => {
    const { g, x, y } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 18);
    // Seams between the armour panels.
    g.fillStyle(OUTLINE, 0.75);
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4, 18.6, 23, 1.2);
  },
  twin: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    // Outrigger legs under the plate.
    g.fillStyle(shade(d.color, -0.6));
    for (let i = 0; i < 4; i++) tick(g, x, y, Math.PI / 4 + (i * Math.PI) / 2, 12, 20, 3.2);
    base(ctx, { n: 4 }, 23, 17);
  },
  coil: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      bells = [0, 1, 2, 3, 4, 5].map((i) => at(x, y, (i * Math.PI) / 3, 19.3));
    base(ctx, "disc", 21, 17);
    // Insulator bells on the rim; their glass glows with the stored charge.
    g.fillStyle(shade(d.color, -0.55));
    for (const p of bells) pip(g, p.x, p.y, 2.7);
    g.fillStyle(shade(d.color, -0.05));
    for (const p of bells) pip(g, p.x - 0.5, p.y - 0.5, 1.4);
    glow.fillStyle(d.color, 0.1 + 0.2 * charge);
    for (const p of bells) pip(glow, p.x, p.y, 2.4);
  },
  crystal: (ctx) => {
    const { g, x, y, level, color } = ctx;
    // Six facets, each shaded by where its edge faces.
    polygon(g, x, y, 24.2, 6, OUTLINE, 0, 0.85);
    facets(g, x, y, 23, 6, 0, PLATE, 0.32);
    sunken(g, x, y, { n: 6 }, 18, DARK);
    if (level >= 4) inlay(g, x, y, { n: 6 }, 21.4, shade(color, -0.35));
  },
  rail: (ctx) => {
    base(ctx, { n: 6 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 2, 0, shade(ctx.definition.color, -0.55));
  },
  flame: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, energy } = ctx,
      heat = 0.75 + 0.25 * Math.sin(clock * 13 + t.id * 1.7),
      vents = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2);
    base(ctx, { n: 8, rot: Math.PI / 8 }, 23, 19);
    // Heat vents with the furnace glowing behind them.
    g.fillStyle(OUTLINE);
    for (const a of vents) tick(g, x, y, a, 16.5, 21, 2.8);
    g.fillStyle(shade(d.color, -0.25), 0.45 + 0.35 * heat);
    for (const a of vents) tick(g, x, y, a, 17.2, 20.3, 1.2);
    glow.fillStyle(d.color, 0.1 + 0.1 * heat + energy);
    for (const a of vents) tick(glow, x, y, a, 16.8, 20.7, 2.2);
  },
  emitter: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      nodes = [0, 1, 2].map((i) => at(x, y, -Math.PI / 2 + (i * TAU) / 3, 20));
    base(ctx, "disc", 22, 18);
    g.fillStyle(shade(d.color, -0.55));
    for (const p of nodes) pip(g, p.x, p.y, 3);
    g.fillStyle(d.color, 0.9);
    for (const p of nodes) pip(g, p.x - 0.3, p.y - 0.3, 1.4);
  },
  vat: (ctx) => {
    base(ctx, { cut: 0.3 }, 21, 17);
    rivets(ctx.g, ctx.x, ctx.y, 22.4, 4, Math.PI / 4, shade(ctx.definition.color, -0.55));
  },
  prism: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 12 }, 23, 19);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * TAU) / 3,
        p = at(x, y, a, 21);
      polygon(g, p.x, p.y, 2.6, 3, shade(d.color, -0.35 + 0.2 * facing(a)), a);
    }
  },
  refinery: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.12 }, 22, 18, { cut: 0.35 });
    // Hazard plates in the corners.
    for (const [sx, sy] of CORNERS) {
      put(0, x + sx * 19.4, y + sy * 11.8);
      put(1, x + sx * 19.4, y + sy * 17.4);
      put(2, x + sx * 17.4, y + sy * 19.4);
      put(3, x + sx * 11.8, y + sy * 19.4);
      g.fillStyle(shade(d.color, -0.3 + 0.16 * facing(Math.atan2(sy, sx))));
      g.fillPoints(PTS, true, false, 4);
    }
  },
  // Round plate with bearing ticks.
  radar: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    g.fillStyle(shade(d.color, -0.35));
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4, 18.8, 21.5, 1.5);
  },
  // Octagon with four lens mounts.
  lens: (ctx) => {
    base(ctx, { n: 8 }, 23, 19);
    rivets(ctx.g, ctx.x, ctx.y, 21, 4, 0, shade(ctx.definition.color, -0.5));
  },
  // Round plate with an orbit track.
  gravity: (ctx) => {
    base(ctx, "disc", 22, 18);
    ring(ctx.g, ctx.x, ctx.y, 20, 1, shade(ctx.definition.color, -0.4), 0.9);
  },
  // Heavy square emplacement: a notched turntable and stacked sandbags in the corners.
  mortar: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      c = d.color;
    base(ctx, { cut: 0.32 }, 22, 18, "disc");
    g.fillStyle(OUTLINE, 0.8);
    for (let i = 0; i < 8; i++) tick(g, x, y, (i * Math.PI) / 4 + Math.PI / 8, 14.8, 17.2, 1);
    for (const [sx, sy] of CORNERS) {
      const rot = (-sx * sy * Math.PI) / 4;
      oval(g, x + sx * 17.6 + 0.6, y + sy * 17.6 + 1, 5.4, 3.3, shade(c, -0.6), 1, rot);
      oval(g, x + sx * 17.2 - 0.4, y + sy * 17.2 - 0.6, 4.4, 2.5, shade(c, -0.2), 1, rot);
    }
  },
  mine: (ctx) => trapFrame(ctx, 15),
  spikes: (ctx) => trapFrame(ctx, 19),
  tar: ({ g, x, y, definition: d, level }) => {
    oval(g, x, y, 20, 17, shade(d.color, -0.6), 0.9);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
  },
  snare: (ctx) => trapFrame(ctx, 18),
  grill: (ctx) => trapFrame(ctx, 19),
  spring: (ctx) => trapFrame(ctx, 16),
  limpet: (ctx) => trapFrame(ctx, 14),
  // A dug shaft in a rim of stones: its inner wall is shaded on the upper left and lit on the lower right.
  pit: ({ g, x, y, definition: d, level }) => {
    const c = d.color;
    disc(g, x, y, 19.5, shade(c, -0.5), 0.9);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, c, 0.5);
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4,
        p = at(x, y, a, 17);
      polygon(g, p.x, p.y, 3.7, 5, shade(c, -0.12 + 0.3 * facing(a)), a);
    }
    disc(g, x, y, 15, shade(c, -0.72));
    arcBand(g, x, y, 13.6, 2.8, Math.PI / 4 - 1.3, Math.PI / 4 + 1.3, shade(c, -0.3));
    disc(g, x - 1, y - 1, 11.6, 0x020506);
  },
  // Two posts on the path edge.
  tripwire: ({ g, x, y, definition: d, level }) => {
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
    g.fillStyle(SHADOW, 0.4);
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 2, y - 2.5, 6, 8);
    g.fillStyle(shade(d.color, -0.55));
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 3, y - 4, 6, 8);
    g.fillStyle(shade(d.color, -0.3));
    for (const sx of [-1, 1]) g.fillRect(x + sx * 16 - 3, y - 4, 6, 1.4);
  },
  // Cracked stone slab.
  hammer: (ctx) => {
    const { g, x, y } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 20);
    // Each crack is a dark split with a lit lip along its lower-right edge.
    for (const lip of [0.7, 0]) {
      g.lineStyle(lip ? 0.9 : 1.5, lip ? shade(DARK, 0.4) : OUTLINE, lip ? 0.85 : 0.9);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        g.moveTo(x + Math.cos(a) * 12.5 + lip, y + Math.sin(a) * 12.5 + lip);
        g.lineTo(x + Math.cos(a + 0.16) * 16.2 + lip, y + Math.sin(a + 0.16) * 16.2 + lip);
        g.lineTo(x + Math.cos(a + 0.05) * 19.8 + lip, y + Math.sin(a + 0.05) * 19.8 + lip);
      }
      g.strokePath();
    }
  },
  // Narrow diamond plate.
  blade: (ctx) => {
    base(ctx, { n: 4 }, 25, 20);
    rivets(ctx.g, ctx.x, ctx.y, 21.5, 4, 0, shade(ctx.definition.color, -0.45));
  },
  // Round plate with vents for the fragments; they glow after a shot.
  scatter: (ctx) => {
    const { g, glow, x, y, definition: d, kick } = ctx,
      vents = [0, 1, 2, 3, 4].map((i) => at(x, y, -Math.PI / 2 + (i * TAU) / 5, 20));
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE);
    for (const p of vents) pip(g, p.x, p.y, 1.8);
    if (kick > 0) {
      glow.fillStyle(d.color, 0.3 * kick);
      for (const p of vents) pip(glow, p.x, p.y, 3);
    }
  },
  // Triangle mast base.
  antenna: (ctx) => {
    base(ctx, { n: 3, rot: -Math.PI / 2 }, 25, 20);
    rivets(ctx.g, ctx.x, ctx.y, 19, 3, -Math.PI / 2, shade(ctx.definition.color, -0.4));
  },
  // Chamfered square emplacement with a stud in each corner.
  battery: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.3 }, 23, 18, "disc");
    g.fillStyle(shade(d.color, -0.55));
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 16.5, y + sy * 16.5, 1.8);
    g.fillStyle(shade(PLATE, 0.45), 0.8);
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 16.5 - 0.5, y + sy * 16.5 - 0.5, 0.7);
  },
  // Hexagonal bench with three spare vials in a rack, their reagent glowing as the next dart brews.
  flask: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      spares = [0, 1, 2].map((i) => at(x, y, Math.PI / 6 + (i * TAU) / 3, 19));
    base(ctx, { n: 6 }, 23, 18);
    g.fillStyle(OUTLINE);
    for (const p of spares) pip(g, p.x, p.y, 3);
    g.fillStyle(shade(d.color, -0.15));
    for (const p of spares) pip(g, p.x - 0.3, p.y - 0.3, 1.9);
    glow.fillStyle(d.color, 0.08 + 0.14 * charge);
    for (const p of spares) pip(glow, p.x, p.y, 2.6);
  },
  // Octagonal casemate with four coolant vents; the vents glow from the plasma reservoir below.
  caster: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx,
      vents = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2);
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    g.fillStyle(OUTLINE);
    for (const a of vents) tick(g, x, y, a, 18.6, 22.4, 3.4);
    g.fillStyle(shade(d.color, -0.2));
    for (const a of vents) tick(g, x, y, a, 19.2, 21.8, 1.4);
    glow.fillStyle(d.color, 0.12 + energy);
    for (const a of vents) tick(glow, x, y, a, 18.8, 22.2, 2.6);
  },
  // Square rack with crossed straps.
  launcher: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 4, rot: Math.PI / 4 }, 25, 20);
    g.fillStyle(shade(d.color, -0.45), 0.8);
    for (const a of [Math.PI / 4, -Math.PI / 4]) quad(g, x, y, Math.cos(a), Math.sin(a), -17, 17, -0.5, 0.5, -0.5, 0.5);
  },
  // Round plate with a coin rim; the bounty radius shimmers faintly.
  beacon: (ctx) => {
    const { g, x, y, definition: d, clock } = ctx;
    base(ctx, "disc", 22, 18);
    ring(g, x, y, 20, 2, shade(d.color, -0.3), 0.6 + 0.3 * Math.sin(clock * 2));
  },
  // Rounded dock with clamps, lit on top.
  dock: (ctx) => {
    const { g, x, y, definition: d } = ctx,
      clamps = [0, 1, 2, 3].map((i) => at(x, y, (i * Math.PI) / 2, 20));
    base(ctx, { cut: 0.42 }, 22, 18);
    g.fillStyle(shade(d.color, -0.5));
    for (const p of clamps) g.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
    g.fillStyle(shade(d.color, -0.15));
    for (const p of clamps) g.fillRect(p.x - 2.5, p.y - 2.5, 5, 1.2);
  },
  // Hexagon with a scale of bearing ticks.
  tracker: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 19);
    g.fillStyle(shade(d.color, -0.35));
    for (let i = 0; i < 12; i++) tick(g, x, y, (i * Math.PI) / 6, 16, i % 3 ? 17.5 : 19, 1.5);
  },
  aura: (ctx) => {
    const { g, x, y, color: c, path, level, clock } = ctx;
    base(ctx, "disc", 22, 18);
    // Dim until a path is chosen; the speed path spins faster with every tier.
    const spin = path === "speed" ? 0.3 * (1 + level) : 0.3;
    for (let i = 0; i < 12; i++) {
      const a = clock * spin + (i * Math.PI) / 6;
      arcBand(g, x, y, 24, 2, a, a + 0.3, c, path ? 0.45 : 0.2);
    }
    // Three pylons, lit one per purchase.
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, -Math.PI / 6 + (i * TAU) / 3, 20);
      led(ctx, p.x, p.y, c, i < level ? 1 : 0);
    }
  },
  // ── new towers: g1 (Attack+Control A) ──
  // Square uplink pad on a round deck: a targeting scale round the deck and four corner pylons whose lamps blink in turn.
  uplink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock } = ctx,
      lit = Math.floor(clock * 2 + t.id) % 4;
    base(ctx, { cut: 0.22 }, 23, 18, "disc");
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 16; i++) tick(g, x, y, (i * TAU) / 16, 15.4, i % 4 ? 16.6 : 17.8, 1);
    CORNERS.forEach(([sx, sy], i) => {
      const cx = x + sx * 18.4,
        cy = y + sy * 18.4;
      polygon(g, cx, cy, 3.3, 4, OUTLINE, Math.PI / 4, 0.9);
      polygon(g, cx - 0.4, cy - 0.4, 2.5, 4, shade(PLATE, 0.18), Math.PI / 4);
      disc(g, cx, cy, 1.1, i === lit ? shade(d.color, 0.3) : shade(d.color, -0.6));
      if (i === lit) disc(glow, cx, cy, 3.4, d.color, 0.28);
    });
  },
  // Round plate with a spiral groove cut into its deck and three violet eyes staring out of the rim.
  spiral: (ctx) => {
    const { g, glow, x, y, definition: d, charge } = ctx,
      eyes = [0, 1, 2].map((i) => -Math.PI / 2 + (i * TAU) / 3);
    base(ctx, "disc", 22, 18);
    g.lineStyle(0.9, shade(d.color, -0.45), 0.8);
    g.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = k * 0.55,
        r = 12.5 + k * 0.22;
      if (k) g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.strokePath();
    for (const a of eyes) {
      const p = at(x, y, a, 20);
      oval(g, p.x, p.y, 3.4, 2.1, OUTLINE, 1, a + Math.PI / 2);
      oval(g, p.x - 0.2, p.y - 0.2, 2.6, 1.4, shade(d.color, 0.55), 1, a + Math.PI / 2);
      disc(g, p.x, p.y, 1, OUTLINE);
      disc(glow, p.x, p.y, 2.8, d.color, 0.08 + 0.18 * charge);
    }
  },
  // Hexagonal plate with honeycomb cells of set resin round the rim, each lit by where it faces.
  resin: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { n: 6 }, 23, 18);
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * TAU) / 6,
        p = at(x, y, a, 19.6);
      polygon(g, p.x, p.y, 3, 6, OUTLINE, 0, 0.9);
      polygon(g, p.x - 0.3, p.y - 0.3, 2.1, 6, shade(d.color, -0.25 + 0.25 * facing(a)));
      if (energy) disc(glow, p.x, p.y, 2.6, d.color, energy);
    }
  },
  // Round plate ringed by eight pole pieces, alternately polarised: tower-blue and bare steel.
  magnet: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE, 0.9);
    for (let i = 0; i < 8; i++) tick(g, x, y, Math.PI / 8 + (i * Math.PI) / 4, 17.4, 21.8, 3.8);
    for (const steel of [false, true]) {
      g.fillStyle(steel ? shade(PLATE, 0.4) : shade(d.color, 0.1));
      for (let i = steel ? 1 : 0; i < 8; i += 2) tick(g, x - 0.3, y - 0.3, Math.PI / 8 + (i * Math.PI) / 4, 17.9, 21.2, 2.4);
    }
  },
  // Round intake with angled vent slats all round, like the cowling of a turbine.
  fan: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    for (const [color, w] of [[OUTLINE, 1], [shade(d.color, -0.3), 0.55]] as const) {
      g.fillStyle(color, 0.9);
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        quad(g, x, y, Math.cos(a), Math.sin(a), 17.6, 21.4, -0.7 * w, 0.7 * w, 1.6 - 0.9 * w, 1.6 + 0.9 * w);
      }
    }
  },
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // Chamfered mooring deck: four bollards at the corners, a chain run between them that lights up link by link as the grapple reloads.
  tether: (ctx) => {
    const { g, glow, x, y, definition: d, charge, energy } = ctx,
      c = d.color;
    base(ctx, { cut: 0.3 }, 22, 17);
    for (const [sx, sy] of CORNERS) {
      const bx = x + sx * 17.2,
        by = y + sy * 17.2;
      disc(g, bx + 0.8, by + 1.2, 3.4, SHADOW, 0.4);
      disc(g, bx, by, 3.2, shade(PLATE, -0.35));
      disc(g, bx - 0.4, by - 0.4, 2.3, shade(PLATE, 0.2));
      disc(g, bx, by, 1, OUTLINE);
    }
    // Chain links along the lower and right edges: alternating flat and edge-on links.
    const links = 8,
      lit = Math.floor(charge * links);
    for (let i = 0; i < links; i++) {
      const f = (i + 0.5) / links,
        p = i < links / 2 ? { x: x - 13 + f * 2 * 26, y: y + 19.6 } : { x: x + 19.6, y: y + 13 - (f - 0.5) * 2 * 26 },
        horizontal = i < links / 2;
      if (i % 2) chamferRect(g, p.x, p.y, horizontal ? 2.2 : 0.8, horizontal ? 0.8 : 2.2, 0.4, shade(c, -0.45));
      else {
        ring(g, p.x, p.y, 1.8, 0.9, shade(c, -0.2));
      }
      if (i < lit) disc(glow, p.x, p.y, 2.4, c, Math.min(0.3, 0.12 + energy));
    }
  },
  // Hexagonal emitter deck with three capacitor cells; their charge drains down as the next beam builds.
  shrinker: (ctx) => {
    const { g, glow, x, y, definition: d, charge, energy } = ctx,
      c = d.color,
      cells = [0, 1, 2].map((i) => at(x, y, Math.PI / 2 + (i * TAU) / 3, 19));
    base(ctx, { n: 6, rot: Math.PI / 6 }, 23, 18);
    for (const p of cells) {
      chamferRect(g, p.x, p.y, 3.4, 3.4, 1.1, OUTLINE, 0.9);
      chamferRect(g, p.x, p.y, 2.6, 2.6, 0.8, shade(c, -0.6));
      // The cell's fill is a bar rising from the bottom.
      const h = 5.2 * charge;
      if (h > 0.2) {
        g.fillStyle(shade(c, -0.1), 0.9);
        g.fillRect(p.x - 2, p.y + 2.6 - h, 4, h);
      }
      disc(glow, p.x, p.y, 3.6, c, Math.min(0.3, 0.05 + 0.15 * charge + energy));
    }
  },
  // A round ritual plate: an engraved circle and five rune studs that kindle one by one as the next shard forms.
  sigil: (ctx) => {
    const { g, glow, x, y, definition: d, charge, clock, tower: t } = ctx,
      c = d.color,
      lit = charge * 5;
    base(ctx, "disc", 22, 18);
    ring(g, x, y, 15.5, 0.8, shade(c, -0.35), 0.8);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5,
        p = at(x, y, a, 19.6),
        on = Math.max(0, Math.min(1, lit - i)),
        flicker = 0.85 + 0.15 * Math.sin(clock * 7 + i * 1.3 + t.id);
      polygon(g, p.x, p.y, 2.6, 4, OUTLINE, a);
      polygon(g, p.x - 0.3, p.y - 0.3, 1.7, 4, shade(c, -0.6 + 0.6 * on), a);
      if (on > 0) disc(glow, p.x, p.y, 3.4, c, 0.28 * on * flicker);
    }
  },
  // Round intake plate with four slotted vents that breathe in as the beam drains.
  siphon: (ctx) => {
    const { g, glow, x, y, definition: d, clock, tower: t, kick, energy } = ctx,
      c = d.color,
      vents = [0, 1, 2, 3].map((i) => Math.PI / 4 + (i * Math.PI) / 2),
      breath = 0.5 + 0.5 * Math.sin(clock * 3 + t.id);
    base(ctx, "disc", 22, 18);
    g.fillStyle(OUTLINE);
    for (const a of vents) for (const off of [-3, 0, 3]) tick(g, x + Math.cos(a + Math.PI / 2) * off, y + Math.sin(a + Math.PI / 2) * off, a, 16.4, 20.6, 1.4);
    glow.fillStyle(c, Math.min(0.3, 0.06 + 0.12 * breath + 0.15 * kick + energy));
    for (const a of vents) tick(glow, x, y, a, 16.6, 20.4, 7.4);
  },
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  // Trampled ground under the wall, with stakes driven in at the corners.
  barricade: ({ g, x, y, definition: d, level }) => {
    oval(g, x, y, 20, 18, shade(d.color, -0.72), 0.75);
    if (level >= 5) ring(g, x, y, 20.5, 0.8, d.color, 0.5);
    for (const [sx, sy] of CORNERS) {
      disc(g, x + sx * 15 + 0.8, y + sy * 15 + 1.2, 2.2, SHADOW, 0.45);
      disc(g, x + sx * 15, y + sy * 15, 2, shade(d.color, -0.45));
      disc(g, x + sx * 15 - 0.5, y + sy * 15 - 0.5, 0.9, shade(d.color, 0.1));
    }
  },
  // A round pad in a ring of six emitter bolts.
  warp: ({ g, x, y, definition: d, level }) => {
    plate(g, x, y, "disc", 19, PLATE);
    sunken(g, x, y, "disc", 16.4, DARK);
    rivets(g, x, y, 17.8, 6, Math.PI / 6, shade(d.color, -0.45));
    if (level >= 5) inlay(g, x, y, "disc", 20.4, d.color, 0.5);
  },
  plate: (ctx) => trapFrame(ctx, 17),
  // A dark spill on the path; small splashes around it.
  slick: ({ g, x, y, definition: d, level }) => {
    oval(g, x + 1, y + 1, 20, 16.5, shade(d.color, -0.8), 0.85, 0.2);
    oval(g, x - 9, y + 8, 6, 4.5, shade(d.color, -0.75), 0.8, -0.4);
    oval(g, x + 11, y - 9, 5, 3.5, shade(d.color, -0.75), 0.8, 0.6);
    if (level >= 5) oval(g, x + 1, y + 1, 20.5, 17, d.color, 0.15, 0.2);
  },
  grinder: (ctx) => trapFrame(ctx, 18),
  // A sunken launch hatch.
  harpoon: ({ g, x, y, definition: d, level }) => {
    plate(g, x, y, { cut: 0.34 }, 18, PLATE);
    sunken(g, x, y, "disc", 14.4, DARK);
    g.fillStyle(shade(d.color, -0.5));
    for (const [sx, sy] of CORNERS) pip(g, x + sx * 14.6, y + sy * 14.6, 1.6);
    if (level >= 5) inlay(g, x, y, { cut: 0.34 }, 16.8, d.color, 0.5);
  },
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  // Octagon with a clock dial on its deck: twelve hour ticks, the quarters long and lit.
  clock: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 12; i++) if (i % 3) tick(g, x, y, (i * Math.PI) / 6, 16, 17.8, 1.2);
    g.fillStyle(shade(d.color, 0.1));
    for (let i = 0; i < 12; i += 3) tick(g, x, y, (i * Math.PI) / 6, 15.2, 18.6, 2.2);
    glow.fillStyle(d.color, 0.1 + energy);
    for (let i = 0; i < 12; i += 3) tick(glow, x, y, (i * Math.PI) / 6, 15, 18.8, 3);
    rivets(ctx.g, x, y, 21.2, 4, Math.PI / 4);
  },
  // Chamfered square with four crosshair notches cut into its rim.
  director: (ctx) => {
    const { g, glow, x, y, definition: d, energy } = ctx;
    base(ctx, { cut: 0.3 }, 23, 19, "disc");
    g.fillStyle(OUTLINE);
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 15.5, 22, 3.6);
    g.fillStyle(shade(d.color, -0.15));
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 16.2, 21, 1.2);
    glow.fillStyle(d.color, 0.1 + energy);
    for (let i = 0; i < 4; i++) tick(glow, x, y, (i * Math.PI) / 2, 16, 21.5, 2.4);
  },
  // Square magazine plate: racks of cartridges along two sides, brass bodies with tips in the tower colour.
  armory: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.22 }, 23, 17.5);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const cx = x + (i - 2) * 5.2,
          cy = y + side * 20.3;
        disc(g, cx + 0.5, cy + 0.8, 2.1, SHADOW, 0.5);
        disc(g, cx, cy, 2, 0xb08a3a);
        disc(g, cx - 0.4, cy - 0.4, 1.1, shade(d.color, 0.25));
      }
    }
    rivets(g, x, y, 20.3, 2, 0);
  },
  // Round plate with three lit struts bracing the dish.
  skylink: (ctx) => {
    const { g, x, y, definition: d, level } = ctx,
      struts = [0, 1, 2].map((i) => -Math.PI / 2 + (i * TAU) / 3);
    base(ctx, "disc", 23, 18, { n: 6 });
    for (const a of struts) litBar(g, x, y, a, 12, 21, 2.2, 1.6, shade(PLATE, 0.1));
    struts.forEach((a, i) => {
      const p = at(x, y, a, 21);
      led(ctx, p.x, p.y, d.color, i < level ? 1 : 0.15);
    });
  },
  // Hexagon with a socket at every corner and the lattice engraved between them.
  nexus: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 6 }, 24, 19);
    hexLine(g, x, y, 15.5, 0.9, shade(d.color, -0.3), 0.8);
    g.fillStyle(OUTLINE);
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, (i * Math.PI) / 3, 20.5);
      pip(g, p.x, p.y, 2.4);
    }
    g.fillStyle(shade(d.color, -0.2));
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, (i * Math.PI) / 3, 20.5);
      pip(g, p.x, p.y, 1.3);
    }
  },
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  // Chamfered workbench with a tool rack of four wrenches along its edges.
  workshop: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { cut: 0.22 }, 23, 18, { cut: 0.3 });
    for (const [sx, sy] of CORNERS) {
      const a = Math.atan2(sy, sx);
      litBar(g, x + sx * 15.5, y + sy * 15.5, a + Math.PI / 2, -3.2, 3.2, 0.9, 0.9, shade(d.color, -0.3), { shadow: false });
    }
    g.fillStyle(shade(d.color, -0.45));
    for (let i = 0; i < 4; i++) tick(g, x, y, (i * Math.PI) / 2, 18.4, 22, 2.4);
  },
  // Octagonal strongroom frame held by eight bolts.
  vault: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, { n: 8, rot: Math.PI / 8 }, 24, 19, "disc");
    rivets(g, x, y, 21.4, 8, Math.PI / 8, shade(d.color, -0.55));
  },
  // Hexagonal pad with three capacitor cells that glow with the stored shield.
  shieldgen: (ctx) => {
    const { g, glow, x, y, definition: d, clock, tower: t } = ctx,
      cells = [0, 1, 2].map((i) => at(x, y, Math.PI / 2 + (i * TAU) / 3, 19.5)),
      hum = 0.5 + 0.5 * Math.sin(clock * 2.4 + t.id);
    base(ctx, { n: 6 }, 23, 18);
    g.fillStyle(OUTLINE);
    for (const p of cells) pip(g, p.x, p.y, 3.2);
    g.fillStyle(shade(d.color, -0.1));
    for (const p of cells) pip(g, p.x - 0.3, p.y - 0.3, 2);
    glow.fillStyle(d.color, 0.08 + 0.1 * hum);
    for (const p of cells) pip(glow, p.x, p.y, 3);
  },
  // Round hopper with the recycling chevrons engraved around its rim.
  recycler: (ctx) => {
    const { g, x, y, definition: d } = ctx;
    base(ctx, "disc", 22, 18);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3,
        p = at(x, y, a, 20);
      polygon(g, p.x, p.y, 2.8, 3, shade(d.color, -0.35 + 0.25 * facing(a)), a + Math.PI / 2);
    }
  },
  // ── end g5 ──
};
/** Turret drawings by `visual.turret`. A new look is one entry here. */
const TURRETS: Record<TurretStyle, Drawing> = {
  // A barrel with a muzzle brake on a domed mount; a slot in the dome glows as the next shot charges.
  barrel: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "barrel"),
      w = level >= 3 ? 0.5 : 0;
    litBar(g, x, y, a, back + 3, end - 3.5, 3.5 + w, 2.7 + w, c, { bands: level >= 3 ? [0.45, 0.6] : undefined });
    litBar(g, x, y, a, end - 4, end, 4 + w, 4 + w, shade(c, -0.3), { bands: [0.5], tip });
    const bore = at(x, y, a, end - 1.2);
    disc(g, bore.x, bore.y, 1.6, OUTLINE);
    dome(g, x, y, 9, c);
    bar(g, x, y, a, -7.4, -3.6, 1.4, 1.4, OUTLINE, 0.9);
    bar(g, x, y, a, -7, -4, 0.6, 0.6, shade(c, 0.45), 0.3 + 0.6 * charge);
    bar(glow, x, y, a, -7.4, -3.6, 1.3, 1.3, c, Math.min(0.6, 0.2 + 0.4 * charge + energy));
    bolt(ctx);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A wide launch tube: the next rocket's nose slides out as it loads, and the rear vents puff on a shot.
  heavy: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "heavy"),
      w = level >= 3 ? 0.8 : 0,
      out = 5 * Math.min(1, Math.max(0, (charge - 0.3) / 0.7));
    if (out > 0.3) {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        lit = facing(a + Math.PI / 2) < 0 ? -1 : 1;
      strip(g, x, y, ca, sa, end - 2, end + out, -3.3, 3.3, -0.7, 0.7, shade(c, 0.35));
      strip(g, x, y, ca, sa, end - 2, end + out, 0, lit * 3.3, 0, lit * 0.7, shade(c, 0.6));
    }
    litBar(g, x, y, a, back + 4, end - 3, 5.5 + w, 5 + w, c, { bands: level >= 3 ? [0.25, 0.4, 0.75] : [0.3] });
    litBar(g, x, y, a, end - 3, end, 6.5 + w, 6.5 + w, shade(c, -0.25), { tip });
    boss(g, x, y, 10, shade(c, -0.05));
    // Rear vents; they glow and puff smoke right after a shot.
    const vents = [-1, 1].map((sign) => a + Math.PI + sign * 0.6);
    g.fillStyle(shade(c, -0.7));
    for (const va of vents) tick(g, x, y, va, 5.5, 8.5, 1.6);
    if (kick > 0) {
      glow.fillStyle(c, 0.3 * kick);
      for (const va of vents) tick(glow, x, y, va, 5, 9, 3);
      g.fillStyle(0x8f989e, 0.5 * kick);
      for (const va of vents) pip(g, x + Math.cos(va) * (9 + 7 * (1 - kick)), y + Math.sin(va) * (9 + 7 * (1 - kick)), 1.5 + 3 * (1 - kick));
    }
    bolt(ctx, 3.2);
    muzzleGlow(ctx, end + 2, 6);
  },
  // Twin guns on a chamfered yoke, fed from an ammo box on the left.
  twin: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "twin"),
      sides = MUZZLES.twin!.sides!;
    block(g, x + 0.5, y + 0.8, a, 7.5, 8.5, 3, shade(c, -0.62));
    block(g, x - 0.3, y - 0.3, a, 6.8, 7.8, 2.6, shade(c, -0.35));
    strip(g, x, y, ca, sa, -4.5, 4.5, -12.2, -6.8, -12.2, -6.8, shade(c, -0.6));
    strip(g, x, y, ca, sa, -4, 4, -11.7, -9.6, -11.7, -9.6, shade(c, -0.35));
    g.fillStyle(shade(c, 0.2), 0.9);
    for (const k of [-2.5, 0, 2.5]) quad(g, x, y, ca, sa, k - 0.5, k + 0.5, -11.3, -7.7, -11.3, -7.7);
    for (const side of sides) {
      litBar(g, x, y, a, back + 2, end - 3, 1.8, 1.5, c, { side, bands: level >= 3 ? [0.45, 0.6] : undefined });
      bar(g, x, y, a, end - 3.5, end, 2.4, 2.4, tip ?? shade(c, -0.3), 1, side);
    }
    g.fillStyle(OUTLINE);
    for (const side of sides) {
      const v = point(x, y, ca, sa, end - 1.8, side);
      pip(g, v.x, v.y, 0.75);
    }
    bolt(ctx);
    muzzleGlow(ctx, end + 1.5, 4);
  },
  // A Tesla coil: metal toroids around a domed top ball that crackles when charged and flashes white on a discharge.
  coil: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy, peak } = ctx,
      c = d.color;
    // Insulator spokes turning slowly under the rings.
    g.fillStyle(shade(c, -0.45));
    for (let i = 0; i < 4; i++) {
      const b = clock * 0.5 + t.id + (i * Math.PI) / 2;
      quad(g, x, y, Math.cos(b), Math.sin(b), 9, 15.5, -1.6, 1.6, -1.1, 1.1);
    }
    for (const r of level >= 3 ? [12, 9, 6] : [10, 7]) {
      loop(g, x, y, r, 3, shade(c, -0.55));
      loop(g, x - 0.3, y - 0.3, r, 1.2, c);
    }
    glowDot(glow, x, y, 10, c, Math.min(peak, 0.15 + 0.35 * charge + energy));
    dome(g, x, y, 4.5, shade(c, 0.85 * kick));
    // Sparks jump to the rings once charged: one past 60 %, two past 90 %, re-rolled 20 times a second.
    const seed = Math.floor(clock * 20) + t.id * 7;
    for (let i = 0; i < (charge > 0.9 ? 2 : charge > 0.6 ? 1 : 0); i++)
      crackle(glow, x, y, hash01(seed, i) * TAU, 5, level >= 3 ? 13.5 : 11.5, shade(c, 0.5), 0.35, seed + i * 13);
    if (kick > 0) ring(glow, x, y, 10 + (1 - kick) * 8, 2, shade(c, 0.5), 0.35 * kick);
  },
  // An ice crystal of four facets, re-lit as it spins so its highlight stays on the upper left; motes drift away.
  crystal: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, maxed, energy } = ctx,
      c = d.color,
      spin = clock * 0.8 + t.id;
    disc(glow, x, y, 13 + 2 * charge, c, 0.05 + 0.07 * charge + energy * 0.5);
    polygon(g, x, y, 11.5, 4, shade(c, -0.6), spin);
    facets(g, x, y, 10, 4, spin, c, 0.5);
    polygon(g, x, y, 3.6, 4, maxed ? 0xffffff : shade(c, 0.45), spin);
    disc(glow, x, y, 5, c, Math.min(0.45, 0.12 + 0.13 * charge + energy));
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.45 + i / 3 + t.id * 0.13) % 1,
        p = at(x, y, t.id + i * 2.1 + phase * 0.5, 9 + phase * 11);
      polygon(g, p.x, p.y, 1.4, 4, shade(c, 0.6), spin * 2, 1 - phase);
    }
    // Orbiting shards from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.2));
      for (let i = 0; i < 2; i++) {
        const s = at(x, y, -spin * 1.5 + i * Math.PI, 15),
          ca = Math.cos(spin),
          sa = Math.sin(spin);
        g.fillTriangle(s.x - ca * 2.5, s.y - sa * 2.5, s.x - sa * 2.5, s.y + ca * 2.5, s.x + ca * 2.5, s.y + sa * 2.5);
        g.fillTriangle(s.x - ca * 2.5, s.y - sa * 2.5, s.x + sa * 2.5, s.y - ca * 2.5, s.x + ca * 2.5, s.y + sa * 2.5);
      }
    }
    if (kick > 0) ring(glow, x, y, 12 + (1 - kick) * 6, 1.5, 0xffffff, 0.35 * kick);
  },
  // Twin rails on a capacitor block: three lamps per side fill with the charge, and the rails' fronts flare on a shot.
  rail: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "rail"),
      length = end - back;
    litBar(g, x, y, a, -9, 8, 7, 6, shade(c, -0.65));
    for (let i = 0; i < 3; i++) {
      const on = Math.min(1, Math.max(0, charge * 3 - i));
      g.fillStyle(on > 0 ? shade(c, -0.75 * (1 - on)) : OUTLINE);
      for (const side of [-5.6, 5.6]) {
        const p = point(x, y, ca, sa, -8.2 + i * 2.8, side);
        pip(g, p.x, p.y, 1.1);
      }
    }
    for (const side of [-3.5, 3.5]) {
      litBar(g, x, y, a, back, end, 1.7, 1.3, shade(c, -0.2), { side, tip, bands: level >= 3 ? [0.45, 0.6] : undefined });
      if (kick > 0) bar(g, x, y, a, end - 0.3 * length, end, 1.7, 1.3, shade(c, 0.6), kick, side);
    }
    if (kick > 0) bar(glow, x, y, a, end - 0.3 * length, Math.min(end, 26), 5.5, 5, c, 0.5 * kick);
    // The charge runs along the rails until the next shot.
    const run = back + 2 + (length - 4) * charge;
    bar(g, x, y, a, back + 2, run, 0.9, 0.9, c, 0.3 + 0.7 * charge);
    bar(glow, x, y, a, back + 2, Math.min(run, 26), 1.8, 1.8, c, Math.min(0.5, 0.12 + 0.25 * charge + energy));
    boss(g, x, y, 5, shade(c, -0.45));
    bolt(ctx, 2.2);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A flamethrower: a scorched nozzle with a pilot flame over a furnace whose window flickers.
  flame: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "flame"),
      flicker = 0.75 + 0.25 * Math.sin(clock * 13 + t.id * 1.7);
    litBar(g, x, y, a, back + 2, end - 3, 4, 5.6, shade(c, -0.45), { bands: level >= 3 ? [0.45, 0.62] : undefined });
    litBar(g, x, y, a, end - 3, end, 6.5, 6.5, shade(c, -0.72), { tip });
    const mouth = at(x, y, a, end + 1.2);
    bar(g, x, y, a, end - 0.5, end + 1 + 4 * flicker, 1.7, 0, shade(c, 0.3));
    disc(glow, mouth.x, mouth.y, 3.2, c, 0.25);
    boss(g, x, y, 10, shade(c, -0.55));
    disc(g, x, y, 7, OUTLINE);
    disc(g, x, y, 5.6 * flicker, c);
    disc(g, x, y, 2.8 * flicker, shade(c, 0.6));
    glowDot(glow, x, y, 12, c, Math.min(peak, 0.18 + 0.12 * flicker + energy));
    // Embers circling the core from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.3), 0.5 + 0.5 * flicker);
      for (let i = 0; i < 3; i++) {
        const p = at(x, y, clock * 2 + t.id + (i * TAU) / 3, 12);
        pip(g, p.x, p.y, 1.4);
      }
    }
    muzzleGlow(ctx, end + 2, 5);
  },
  // A stubby tube that recoils hard, a shell nose in its bore once loaded; the dead zone is drawn with the range preview.
  mortar: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "mortar");
    boss(g, x, y, 11, shade(c, -0.55));
    litBar(g, x, y, a, back - 2, end, 6.5, 7, shade(c, -0.2), { bands: level >= 3 ? [0.3, 0.42] : [0.36], tip });
    const mouth = at(x, y, a, end - 4.2);
    disc(g, mouth.x, mouth.y, 4.4, OUTLINE);
    if (charge > 0.85) dome(g, mouth.x, mouth.y, 2.5, shade(c, 0.1));
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 1, 6);
  },
  // A domed mine: the reload arc closes into a ring once armed, and the fuse blinks.
  mine: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge } = ctx,
      c = d.color;
    boss(g, x, y, 10, shade(c, -0.5));
    disc(g, x - 0.3, y - 0.3, 6.6, shade(c, -0.15), 0.4 + 0.6 * charge);
    g.fillStyle(shade(c, -0.3));
    for (let i = 0; i < 4; i++) {
      const p = at(x, y, (i * Math.PI) / 2 + Math.PI / 4, 11);
      pip(g, p.x, p.y, 1.9);
    }
    arcBand(g, x, y, 8.3, 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * charge, c, 0.85);
    if (charge >= 1) {
      ring(glow, x, y, 8.3, 2.6, c, 0.18);
      disc(g, x, y, 1.8, 0xffffff, 0.5 + 0.5 * Math.sin(clock * 6));
    }
    armedLed(ctx);
  },
  // Rows of spikes that shoot up on each strike; each is lit on its left face.
  spikes: (ctx) => {
    const { g, x, y, definition: d, kick } = ctx,
      c = d.color,
      h = 3 + 5 * kick;
    for (const half of [-1, 1]) {
      g.fillStyle(half < 0 ? shade(c, 0.1 + 0.4 * kick) : shade(c, -0.5 + 0.3 * kick));
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          const sx = x + i * 11,
            sy = y + j * 11 + 3;
          g.fillTriangle(sx + half * 3, sy, sx, sy, sx, sy - h);
        }
    }
    armedLed(ctx);
  },
  // Bubbling tar with a glossy sheen.
  tar: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock } = ctx,
      c = d.color;
    oval(g, x, y, 15, 12.5, shade(c, -0.35), 0.9);
    oval(g, x - 5.4, y - 6, 6.5, 1.8, shade(c, 0.5), 0.45, -0.55);
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.7 + i / 3 + t.id * 0.2) % 1;
      loop(g, x - 7 + i * 7, y - 2 + (i % 2) * 5, 1 + phase * 4, 1.2, shade(c, 0.4), 1 - phase);
    }
  },
  // Open jaws with two-tone teeth that snap shut and spring back open while re-arming.
  snare: (ctx) => {
    const { g, x, y, definition: d, charge } = ctx,
      c = d.color,
      open = 3 + 9 * charge;
    // Hinge springs at both ends of the jaws.
    g.lineStyle(1, shade(c, -0.2));
    g.beginPath();
    for (const sx of [-1, 1])
      for (let k = 0; k <= 6; k++) {
        const kx = x + sx * (13.2 + (k % 2 ? 1.2 : -1.2)),
          ky = y - open + (k * open) / 3;
        if (k) g.lineTo(kx, ky);
        else g.moveTo(kx, ky);
      }
    g.strokePath();
    loop(g, x, y, 5, 1.5, shade(c, -0.3));
    for (const side of [-1, 1]) {
      const jy = y + side * open;
      for (const half of [-1, 1]) {
        g.fillStyle(half < 0 ? shade(c, 0.3) : shade(c, -0.35));
        for (let i = 0; i < 5; i++) {
          const tx = x - 10 + i * 5;
          g.fillTriangle(tx + half * 1.8, jy, tx, jy, tx, jy - side * 4);
        }
      }
      g.fillStyle(c);
      g.fillRect(x - 12, jy - 1.5, 24, 3);
      g.fillStyle(shade(c, 0.4));
      g.fillRect(x - 12, jy - 1.5, 24, 1);
    }
    armedLed(ctx);
  },
  // A grate: heat glows in the slots between the bars, and embers rise from it.
  grill: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      heat = 0.55 + 0.25 * Math.sin(clock * 5 + t.id) + 0.2 * kick;
    g.fillStyle(c, 0.3 + 0.5 * heat);
    for (let i = -2; i < 2; i++) g.fillRect(x - 13, y + i * 6 + 1.5, 26, 3);
    glow.fillStyle(c, 0.1 + 0.12 * Math.min(1, heat));
    for (let i = -2; i < 2; i++) glow.fillRect(x - 13, y + i * 6 + 1, 26, 4);
    g.fillStyle(shade(c, -0.62));
    for (let i = -2; i <= 2; i++) g.fillRect(x - 14, y + i * 6 - 1.5, 28, 3);
    g.fillStyle(shade(c, -0.35));
    for (let i = -2; i <= 2; i++) g.fillRect(x - 14, y + i * 6 - 1.5, 28, 1);
    for (let i = 0; i < 2; i++) {
      const phase = (clock * 0.8 + i * 0.5 + t.id * 0.27) % 1;
      disc(g, x - 6 + i * 11 + Math.sin(clock * 3 + i) * 2, y + 4 - phase * 16, 0.9, shade(c, 0.5), 1 - phase);
    }
  },
  // A coil spring under a launch plate, compressed while it re-arms; the near strands catch the light.
  spring: (ctx) => {
    const { g, x, y, definition: d, charge, kick } = ctx,
      c = d.color,
      h = 4 + 6 * charge + 6 * kick,
      top = y + 6 - h;
    for (const front of [false, true]) {
      g.lineStyle(front ? 1.6 : 1.4, shade(c, front ? 0.3 : -0.4));
      for (let i = 0; i < 4; i++) {
        const y0 = y + 8 - (i * h) / 4;
        if (front) g.lineBetween(x - 7, y0, x + 7, y0 - h / 8);
        else g.lineBetween(x + 7, y0 - h / 8, x - 7, y0 - h / 4);
      }
    }
    chamferRect(g, x, top - 2, 10, 2.2, 1, shade(c, -0.1));
    chamferRect(g, x - 0.3, top - 2.9, 9.4, 1, 0.6, shade(c, 0.35));
    armedLed(ctx);
  },
  // A magnetic disc carrying the next bomb, with field lines turning around it; empty until it re-arms.
  limpet: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge } = ctx,
      c = d.color;
    ring(g, x, y, 11, 1.5, shade(c, -0.3));
    for (let i = 0; i < 3; i++) {
      const b = clock * 0.8 + (i * TAU) / 3;
      arcBand(glow, x, y, 12.6, 1, b, b + 0.9, c, 0.1 + 0.08 * charge);
    }
    if (charge >= 1) {
      boss(g, x, y, 7, shade(c, -0.4));
      led(ctx, x, y - 3, c, 0.7 * (0.5 + 0.5 * Math.sin(clock * 8)));
    }
    armedLed(ctx);
  },
  // Planks slide over the shaft while it re-arms and open once it is ready.
  pit: (ctx) => {
    const { g, x, y, definition: d, charge } = ctx,
      c = d.color,
      cover = 1 - charge;
    if (cover > 0) {
      g.fillStyle(shade(c, 0.1));
      for (let i = -1; i <= 1; i++) g.fillRect(x - 15, y + i * 9 - 3.5, 30 * cover, 7);
      g.fillStyle(shade(c, 0.35));
      for (let i = -1; i <= 1; i++) g.fillRect(x - 15, y + i * 9 - 3.5, 30 * cover, 1.2);
    }
    armedLed(ctx);
  },
  // The wire between the posts: taut and glowing when armed, with a glint running along it.
  tripwire: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color,
      sag = (1 - charge) * 6 + kick * 4;
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      put(i, x - 15 + 30 * f, y + Math.sin(f * Math.PI) * sag + (charge >= 1 ? Math.sin(clock * 30 + i) * 0.4 : 0));
    }
    glow.lineStyle(3, c, 0.06 + 0.14 * charge);
    glow.strokePoints(PTS, false, false, 7);
    g.lineStyle(1.5, c, 0.4 + 0.6 * charge);
    g.strokePoints(PTS, false, false, 7);
    if (charge >= 1) {
      const gx = x - 15 + 30 * ((clock * 0.8 + t.id * 0.37) % 1);
      disc(glow, gx, y, 3, c, 0.2);
      disc(g, gx, y, 1, 0xffffff, 0.9);
    }
    g.fillStyle(c);
    pip(g, x - 16, y, 2.2);
    pip(g, x + 16, y, 2.2);
    armedLed(ctx);
  },
  // A piston plate that rises while charging and slams down on the shot; its shadow falls further the higher it is.
  hammer: (ctx) => {
    const { g, glow, x, y, definition: d, kick, charge, energy } = ctx,
      c = d.color,
      lift = charge * 4 * (1 - kick);
    boss(g, x, y, 12, shade(c, -0.55));
    chamferRect(g, x + 1 + 0.6 * lift, y + 1.5 + 0.6 * lift, 8, 8, 3, SHADOW, 0.45);
    plate(g, x, y - lift, { cut: 0.35 }, 8, shade(c, -0.15));
    g.fillStyle(c, 0.4 + 0.6 * charge);
    g.fillRect(x - 5, y - 2 - lift, 10, 4);
    glow.fillStyle(c, Math.min(0.5, 0.12 + 0.2 * charge + energy));
    glow.fillRect(x - 6, y - 3 - lift, 12, 6);
    if (kick > 0) {
      g.fillStyle(shade(c, 0.25), 0.55 * kick);
      for (let i = 0; i < 4; i++) {
        const p = at(x, y, Math.PI / 4 + (i * Math.PI) / 2, 10 + 9 * (1 - kick));
        pip(g, p.x, p.y, 1.8 + 2.4 * (1 - kick));
      }
      ring(g, x, y, 10 + (1 - kick) * 16, 1 + 2 * kick, shade(c, 0.4), 0.8 * kick);
    }
  },
  // A long single blade with a dark fuller and a glowing edge; a glaive waits at the hilt once charged.
  blade: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "blade");
    litBar(g, x, y, a, back - 4, end, 3.5, 0.6, shade(c, -0.1), { tip });
    bar(g, x, y, a, back + 1, end - 8, 0.8, 0.35, shade(c, -0.6));
    strip(glow, x, y, ca, sa, back - 2, end - 1, 3.4, 2.2, 0.7, 0.2, shade(c, 0.4), Math.min(0.5, 0.2 * charge + energy));
    const guard = at(x, y, a, back + 7.4);
    litBar(g, guard.x, guard.y, a + Math.PI / 2, -5, 5, 1.2, 1.2, shade(c, -0.35));
    boss(g, x, y, 7, shade(c, -0.55));
    if (charge >= 0.95) {
      // A small glaive of three curved blades, ready to be thrown.
      const spin = clock * 1.5 + t.id;
      disc(glow, x, y, 6, c, 0.25);
      g.fillStyle(shade(c, 0.25));
      for (let k = 0; k < 3; k++) {
        const b = spin + (k * TAU) / 3,
          p0 = at(x, y, b, 1.2),
          p1 = at(x, y, b + 0.35, 4.2),
          p2 = at(x, y, b + 1.05, 6.2),
          p3 = at(x, y, b + 0.7, 3.4);
        g.fillTriangle(p0.x, p0.y, p1.x, p1.y, p3.x, p3.y);
        g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
      disc(g, x, y, 1.6, shade(c, -0.4));
    } else bolt(ctx, 2.4);
    muzzleGlow(ctx, end, 4);
  },
  // A fan of short barrels, more of them with each upgrade, fed by a rear drum that turns one chamber per shot.
  scatter: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "scatter"),
      { count, step } = MUZZLES.scatter!.fan!(level);
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * step;
      litBar(g, x, y, a + o, back + 4, end, 2, 1.6, shade(c, -0.2), { tip, shadow: i === 0 || i === count - 1, bands: level >= 3 ? [0.5] : undefined });
    }
    const drum = at(x, y, a, -3);
    disc(g, drum.x + 0.6, drum.y + 1, 7, SHADOW, 0.4);
    disc(g, drum.x, drum.y, 6.5, shade(c, -0.55));
    disc(g, drum.x - 0.4, drum.y - 0.4, 5.6, shade(c, -0.25));
    g.fillStyle(OUTLINE);
    for (let k = 0; k < 6; k++) {
      const p = at(drum.x, drum.y, a + charge * (Math.PI / 3) + (k * Math.PI) / 3, 3.5);
      pip(g, p.x, p.y, 1.2);
    }
    bolt({ ...ctx, x: drum.x, y: drum.y }, 1.6);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A lattice mast with a glowing tip ball; signal rings radiate while it charges and glitch pixels flicker around it.
  antenna: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy } = ctx,
      c = d.color;
    g.lineStyle(1.3, shade(c, -0.35));
    g.beginPath();
    g.moveTo(x - 2.4, y + 8);
    g.lineTo(x - 0.9, y - 12);
    g.moveTo(x + 2.4, y + 8);
    g.lineTo(x + 0.9, y - 12);
    g.strokePath();
    for (let k = 0; k <= 5; k++) put(k, x + (k % 2 ? 1.6 : -1.6) * (1 - k * 0.1), y + 8 - k * 4);
    g.lineStyle(0.8, shade(c, -0.5));
    g.strokePoints(PTS, false, false, 6);
    litBar(g, x, y - 4, 0, -6.5, 6.5, 1, 1, shade(c, -0.3));
    for (let i = 0; i < (level >= 3 ? 3 : 2); i++) {
      const phase = (clock * (0.6 + charge) + i / 3) % 1;
      arcBand(glow, x, y - 12, 4 + phase * 9, 1.5, -Math.PI * 0.85, -Math.PI * 0.15, c, (1 - phase) * Math.min(0.5, 0.15 + 0.25 * charge + energy));
    }
    glowDot(glow, x, y - 12, 6, c, Math.min(0.5, 0.2 + 0.25 * charge + energy));
    disc(g, x, y - 12, 2.6, c);
    disc(g, x - 0.8, y - 12.8, 0.9, 0xffffff, 0.8);
    // Glitch pixels, re-rolled 20 times a second.
    const seed = Math.floor(clock * 20) + t.id * 97;
    for (let i = 0; i < 4; i++) {
      g.fillStyle(hash01(seed, i, 3) < 0.3 ? 0xffffff : c, 0.85);
      g.fillRect(x - 12 + hash01(seed, i, 1) * 24, y - 16 + hash01(seed, i, 2) * 24, 1.6, 1.6);
    }
    if (kick > 0) ring(glow, x, y, 8 + (1 - kick) * 14, 2, shade(c, 0.5), 0.35 * kick);
  },
  // A twin-tube net launcher with a hatched net pack at the rear; weights wait in the mouth once loaded.
  launcher: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "launcher");
    strip(g, x + 0.6, y + 1, ca, sa, -12.5, -3.5, -6.5, 6.5, -6.5, 6.5, SHADOW, 0.45);
    strip(g, x, y, ca, sa, -12.5, -3.5, -6.5, 6.5, -6.5, 6.5, shade(c, -0.45));
    g.lineStyle(0.8, shade(c, 0.05), 0.9);
    g.beginPath();
    for (const dir of [-1, 1])
      for (let k = 0; k <= 4; k++) {
        const p = point(x, y, ca, sa, -12 + k * 2, dir * (k % 2 ? 6 : -6));
        if (k) g.lineTo(p.x, p.y);
        else g.moveTo(p.x, p.y);
      }
    g.strokePath();
    boss(g, x, y, 10, shade(c, -0.55));
    for (const side of MUZZLES.launcher!.sides!) litBar(g, x, y, a, back, end, 2.6, 3.2, shade(c, -0.15), { side, tip, bands: level >= 3 ? [0.45, 0.6] : undefined });
    const mouth = at(x, y, a, end);
    ring(g, mouth.x, mouth.y, 5, 1.1, c, 0.8);
    if (charge > 0.7) {
      g.fillStyle(shade(c, -0.25));
      for (let k = 0; k < 4; k++) {
        const p = at(mouth.x, mouth.y, a + Math.PI / 4 + (k * Math.PI) / 2, 5);
        pip(g, p.x, p.y, 1.3);
      }
    }
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A four-tube missile pod on a turntable with a search radar spinning at its rear; warhead noses return as it reloads.
  battery: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, tip } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "battery"),
      sides = MUZZLES.battery!.sides!;
    boss(g, x, y, 10, shade(c, -0.55));
    // Pod housing under the tubes, with its cast shadow.
    strip(g, x + 0.6, y + 1, ca, sa, back - 6, end - 4, -8, 8, -8, 8, SHADOW, 0.45);
    block(g, x, y, a, 8, 8.2, 2, shade(c, -0.5));
    for (const side of sides) litBar(g, x, y, a, back - 2, end, 1.6, 1.6, shade(c, -0.1), { side, tip, bands: level >= 3 ? [0.5] : undefined });
    // Warhead noses in the mouths, one per quarter of the reload.
    sides.forEach((side, i) => {
      const p = point(x, y, ca, sa, end - 1.2, side);
      disc(g, p.x, p.y, 1.3, OUTLINE);
      if (charge >= 0.25 * (i + 1)) disc(g, p.x - 0.2, p.y - 0.2, 0.9, shade(c, 0.45));
    });
    // Search radar: a dish turning on the rear of the pod.
    const r = point(x, y, ca, sa, -8.5, 0),
      spin = clock * 3 + t.id;
    disc(g, r.x, r.y, 3.6, OUTLINE);
    oval(g, r.x, r.y, 3.2, 1.2 + 1.8 * Math.abs(Math.cos(spin)), shade(c, 0.15), 1, spin);
    disc(g, r.x, r.y, 0.9, shade(c, -0.4));
    if (level >= 2) disc(glow, r.x, r.y, 2.6, c, 0.12 + 0.1 * Math.max(0, Math.sin(spin * 2)));
    bolt(ctx, 2);
    muzzleGlow(ctx, end + 1.5, 6);
  },
  // A round-bottomed flask: its neck is the barrel, the reagent inside rises with the charge and bubbles; a
  // copper coil wraps the neck from level 3.
  flask: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, maxed } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "flask");
    litBar(g, x, y, a, back + 5, end, 2.8, 2.4, shade(c, -0.55), { tip, bands: level >= 3 ? [0.35, 0.55, 0.75] : undefined });
    litBar(g, x, y, a, back + 6, end - 1, 1.6, 1.3, shade(c, -0.1), { shadow: false });
    disc(g, x + 1, y + 1.6, 10.6, SHADOW, 0.4);
    disc(g, x, y, 10.4, shade(c, -0.6));
    disc(g, x, y, 9.2, shade(DARK, 0.15));
    // Reagent level: a chord that rises with the charge, drawn as a wedge from below.
    const fill = 0.25 + 0.75 * charge,
      spread = Math.acos(1 - 2 * fill);
    wedge(g, x, y, 8.6, Math.PI / 2 - spread, Math.PI / 2 + spread, c, 0.9);
    disc(g, x, y + 8.6 * (1 - fill) * 0.4, 8.6 * Math.sqrt(fill) * 0.7, c, 0.75);
    disc(glow, x, y, 9, c, Math.min(0.3, 0.08 + 0.14 * charge + energy));
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 1.1 + i / 3 + t.id * 0.27) % 1;
      disc(g, x - 3 + i * 3, y + 6 - phase * 10 * fill, 1.1, shade(c, 0.6), (1 - phase) * 0.9);
    }
    arcBand(g, x, y, 8.2, 1.6, LIGHT - 0.7, LIGHT + 0.6, 0xffffff, 0.4);
    disc(g, x - 3.4, y - 3.6, 1.2, 0xffffff, 0.7);
    if (kick > 0) ring(glow, x, y, 10 + (1 - kick) * 6, 1.4, shade(c, 0.4), 0.3 * kick);
    if (maxed) bolt(ctx, 1.4);
    muzzleGlow(ctx, end + 1.5, 4);
  },
  // A short wide-bore launcher: a plasma canister glows in the breech once loaded, coils ring the tube, and the
  // bore spills light after a shot.
  caster: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "caster");
    boss(g, x, y, 11.5, shade(c, -0.6));
    litBar(g, x, y, a, back - 4, end, 6, 6.8, shade(c, -0.45), { tip });
    // Field coils around the tube; they light up as the canister charges.
    const coils = level >= 3 ? [0.35, 0.55, 0.75] : [0.45, 0.7];
    for (const f of coils) {
      const dd = back - 4 + (end - back + 4) * f;
      strip(g, x, y, ca, sa, dd - 1, dd + 1, -7.6, 7.6, -7.6, 7.6, shade(c, -0.15));
      strip(glow, x, y, ca, sa, dd - 0.6, dd + 0.6, -7, 7, -7, 7, c, Math.min(0.3, 0.06 + 0.2 * charge + energy));
    }
    const mouth = point(x, y, ca, sa, end - 3.5, 0);
    disc(g, mouth.x, mouth.y, 4.6, OUTLINE);
    if (charge > 0.8) {
      disc(g, mouth.x, mouth.y, 3, shade(c, 0.25));
      disc(glow, mouth.x, mouth.y, 4.4, c, 0.25 * (charge - 0.8) * 5);
    }
    if (kick > 0) halo(glow, mouth.x, mouth.y, 9 * (0.6 + kick), c, 0.3 * kick);
    bolt(ctx, 2.4);
    muzzleGlow(ctx, end + 1, 6);
  },
  // A gold coin turning slowly: its rim shows as it turns, and its face glints towards the viewer.
  beacon: (ctx) => {
    const { g, x, y, definition: d, level, clock } = ctx,
      c = d.color,
      face = Math.cos(clock * 1.6),
      w = Math.abs(face) * 9 + 2;
    oval(g, x, y + 3, 10, 4.5, shade(c, -0.5));
    oval(g, x + Math.sin(clock * 1.6) * 2.2, y - 2, w + 0.3, 9, shade(c, -0.4));
    oval(g, x, y - 2, w, 9, c);
    oval(g, x, y - 2, w * 0.55, 5.5, shade(c, 0.45), 0.8);
    const shine = Math.max(0, (Math.abs(face) - 0.85) / 0.15);
    if (shine > 0) star(g, x - 3, y - 6, 3.4, 0.7, 4, 0xffffff, 0, shine);
    g.fillStyle(c, 0.8);
    for (let i = 0; i < level; i++) {
      const p = at(x, y, clock + (i * TAU) / Math.max(1, level), 14);
      pip(g, p.x, p.y, 1.6);
    }
  },
  // A raised repair cross with a welding spark orbiting it.
  dock: (ctx) => {
    const { g, glow, x, y, definition: d, level, clock } = ctx,
      c = d.color;
    boss(g, x, y, 11, shade(c, -0.55));
    g.fillStyle(SHADOW, 0.45);
    g.fillRect(x - 7, y - 1.5, 16, 5);
    g.fillRect(x - 1.5, y - 7, 5, 16);
    g.fillStyle(c, 0.95);
    g.fillRect(x - 8, y - 2.5, 16, 5);
    g.fillRect(x - 2.5, y - 8, 5, 16);
    g.fillStyle(shade(c, 0.5));
    g.fillRect(x - 8, y - 2.5, 16, 1.2);
    g.fillRect(x - 2.5, y - 8, 1.2, 16);
    const p = at(x, y, clock * (1.5 + level * 0.3), 13),
      flick = 0.6 + 0.4 * Math.sin(clock * 20);
    star(glow, p.x, p.y, 5, 1, 4, shade(c, 0.6), clock * 3, 0.3 * flick);
    disc(glow, p.x, p.y, 3, c, 0.25 * flick);
    disc(g, p.x, p.y, 1.2, 0xffffff, 0.8 + 0.2 * flick);
  },
  // A sweeping laser dish.
  tracker: (ctx) => {
    const { g, glow, x, y, definition: d, level, clock } = ctx,
      c = d.color,
      tip = at(x, y, clock * 1.2, 13 + level);
    ring(g, x, y, 11, 1, c, 0.35);
    glowLine(glow, x, y, tip.x, tip.y, c, 1, 0.3);
    g.lineStyle(0.8, shade(c, 0.6), 0.9);
    g.lineBetween(x, y, tip.x, tip.y);
    boss(g, x, y, 6, shade(c, -0.5));
    disc(g, x, y, 2.5, c);
    disc(glow, tip.x, tip.y, 2.6, c, 0.3);
    disc(g, tip.x, tip.y, 1, shade(c, 0.7));
  },
  // The lens glows brighter with every consecutive hit on the locked target; a gauge around the core shows the heat.
  lens: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      heat = Math.min(1, (t.focus?.stacks ?? 0) / 10),
      { end } = reach(ctx, "lens");
    ring(g, x, y, 11, 1.6, OUTLINE, 0.7);
    if (heat > 0) arcBand(g, x, y, 11, 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * heat, c);
    litBar(g, x, y, a, 2, end, 4.5, 2.2, shade(c, -0.45), { bands: level >= 3 ? [0.45, 0.6] : undefined, tip });
    bar(g, x, y, a, 4, end - 1.5, 1.4, 1, c, 0.4 + 0.6 * heat);
    bar(glow, x, y, a, 4, end - 1.5, 1.6, 1.2, c, Math.min(0.5, 0.1 + 0.3 * heat + energy));
    const lens = at(x, y, a, end - 0.5);
    disc(g, lens.x, lens.y, 1.9, shade(c, 0.45));
    glowDot(glow, lens.x, lens.y, 5, c, Math.min(0.6, 0.15 + 0.35 * Math.max(heat, kick) + energy));
    boss(g, x, y, 9, shade(c, -0.55));
    disc(g, x, y, 4 + 3 * heat, c, 0.35 + 0.65 * heat);
    disc(glow, x, y, 5 + 3 * heat, c, 0.1 + 0.25 * heat);
    bolt(ctx, 1.5);
  },
  // Rings collapse towards a black core while charging, thickening as they shrink; masses orbit with light trails.
  gravity: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy, peak } = ctx,
      c = d.color;
    for (let i = 0; i < 2 + (level >= 3 ? 1 : 0); i++) {
      const r = Math.max(4, 15 - ((charge * 10 + i * 4) % 11));
      loop(g, x, y, r, 1 + (15 - r) * 0.16, c, 0.25 + 0.6 * charge);
    }
    const spin = -clock * (0.8 + charge) + t.id;
    for (let i = 0; i < 3; i++) {
      const b = spin + (i * TAU) / 3;
      arcBand(glow, x, y, 11, 1.4, b, b + 0.6, c, 0.22);
    }
    g.fillStyle(shade(c, 0.35));
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, spin + (i * TAU) / 3, 11);
      pip(g, p.x, p.y, 1.8);
    }
    disc(g, x, y, 5.5, 0x05070f);
    loop(g, x, y, 5.6, 0.7, shade(c, 0.3), 0.5 + 0.4 * charge);
    loop(glow, x, y, 6, 1.8, c, Math.min(peak, 0.2 + 0.25 * charge + energy));
    if (kick > 0) ring(glow, x, y, 8 + (1 - kick) * 14, 2, shade(c, 0.5), 0.35 * kick);
  },
  // Three turning arms with glowing tips around a hex core; a hex dial's hand sweeps round with the charge.
  emitter: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, energy } = ctx,
      c = d.color,
      arms = [0, 1, 2].map((i) => clock * 0.4 + t.id + (i * TAU) / 3);
    fins(g, x, y, arms, 6, 13, 2.4, 1, c);
    glow.fillStyle(c, Math.min(0.5, 0.15 + 0.3 * charge + energy));
    for (const b of arms) pip(glow, x + Math.cos(b) * 13, y + Math.sin(b) * 13, 2.6);
    hexLine(g, x, y, 10, 1.5, c, 0.3 + 0.6 * charge, Math.PI / 6);
    if (level >= 3) hexLine(g, x, y, 12.5, 1, c, 0.25 + 0.5 * charge, Math.PI / 6);
    const hand = at(x, y, -Math.PI / 2 + TAU * charge, 9.5);
    g.lineStyle(1.6, shade(c, 0.45), 0.95);
    g.lineBetween(x, y, hand.x, hand.y);
    polygon(g, x, y, 5.5, 6, shade(c, -0.5), Math.PI / 6);
    polygon(g, x - 0.4, y - 0.4, 4.3, 6, c, Math.PI / 6, 0.45 + 0.55 * charge);
    disc(glow, x, y, 6.5, c, Math.min(0.5, 0.12 + 0.2 * charge + energy));
    if (kick > 0) hexLine(glow, x, y, 8 + (1 - kick) * 12, 2, shade(c, 0.5), 0.35 * kick, Math.PI / 6);
  },
  // A glass tank of acid with rising bubbles; a drip at the nozzle grows with the charge and falls on a shot.
  vat: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, kick, charge, clock, maxed, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "vat");
    litBar(g, x, y, a, back + 4, end - 3, 2.6, 2.2, shade(c, -0.35), { bands: level >= 3 ? [0.4, 0.6] : undefined });
    litBar(g, x, y, a, end - 3, end, 3.4, 3.4, shade(c, -0.1), { tip });
    const drip = at(x, y, a, end + 1);
    disc(g, drip.x, drip.y, 0.8 + 1.2 * charge, c);
    if (kick > 0) disc(g, drip.x, drip.y + (1 - kick) * 7, 2, c, kick);
    boss(g, x, y, 10, shade(c, -0.6));
    disc(g, x, y, 7.5, c, 0.85);
    disc(glow, x, y, 8, c, 0.12 + energy);
    for (let i = 0; i < 2; i++) {
      const phase = (clock * 0.9 + i * 0.5 + t.id * 0.3) % 1;
      disc(g, x - 2 + i * 4, y + 3 - phase * 7, 1.3, shade(c, 0.6), 1 - phase);
    }
    arcBand(g, x, y, 5.6, 1.6, LIGHT - 0.7, LIGHT + 0.7, 0xffffff, 0.35);
    if (maxed) bolt(ctx, 1.5);
    muzzleGlow(ctx, end + 2, 4);
  },
  // A three-facet prism with a void core hovers over its shadow; motes spiral into it.
  prism: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, kick, charge, maxed, energy } = ctx,
      c = d.color,
      spin = clock * 0.6 + t.id,
      lift = Math.sin(clock * 2 + t.id) * 1.5,
      cy = y - lift;
    polygon(g, x + 2, y + 4, 10.5 - 0.4 * lift, 3, SHADOW, spin, 0.35 - 0.04 * lift);
    disc(glow, x, cy, 13, c, 0.05 + 0.1 * charge + energy * 0.5);
    polygon(g, x, cy, 11.5, 3, shade(c, -0.55), spin);
    facets(g, x, cy, 10.2, 3, spin, c, 0.45);
    polygon(g, x, cy, 3.8, 3, maxed ? 0xffffff : shade(c, -0.6), -spin);
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.5 + i / 3 + t.id * 0.11) % 1,
        p = at(x, cy, -clock * 1.2 + t.id + (i * TAU) / 3 + phase * 2.4, 16 - phase * 12);
      disc(glow, p.x, p.y, 1.6, shade(c, 0.4), 0.3 * Math.min(1, phase * 3));
    }
    // Orbiting shards from level 3.
    if (level >= 3) {
      g.fillStyle(shade(c, 0.2));
      for (let i = 0; i < 3; i++) {
        const s = at(x, cy, -spin * 1.4 + (i * TAU) / 3, 15),
          p0 = at(s.x, s.y, spin, 2.2),
          p1 = at(s.x, s.y, spin + TAU / 3, 2.2),
          p2 = at(s.x, s.y, spin - TAU / 3, 2.2);
        g.fillTriangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
      }
    }
    if (kick > 0) ring(glow, x, cy, 11 + (1 - kick) * 7, 1.5, 0xffffff, 0.35 * kick);
  },
  // A gear with lit teeth that turns faster with every level, and a chimney that puffs.
  refinery: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      spin = clock * (0.4 + 0.4 * level) + t.id,
      phase = (clock * 0.6 + t.id * 0.3) % 1;
    chamferRect(g, x + 12, y - 12, 2.8, 2.8, 0.8, shade(PLATE, -0.15));
    chamferRect(g, x + 12.3, y - 11.7, 1.8, 1.8, 0.5, OUTLINE);
    disc(g, x + 12.5 + 2 * phase, y - 13 - 8 * phase, 1.6 + 2.6 * phase, 0x9aa3a8, 0.45 * (1 - phase));
    const teeth = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => spin + (i * Math.PI) / 4);
    fins(g, x, y, teeth, 7, 12.5, 2.3, 1.8, c);
    boss(g, x, y, 9, shade(c, -0.2));
    disc(g, x, y, 6, c);
    bolt(ctx, 2.4);
  },
  // A sweeping scan fan of light and a dish that turns with it; faster with every level.
  radar: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      a = clock * (1.2 + 0.4 * level) + t.id;
    wedge(glow, x, y, 17, a - 0.72, a, c, 0.1);
    wedge(glow, x, y, 17, a - 0.26, a, c, 0.12);
    ring(g, x, y, 9, 1, c, 0.35);
    litBar(g, x, y, a, 0, 13, 1.5, 1, c);
    litBar(g, x, y, a, 8, 11, 6, 6, shade(c, -0.2));
    disc(g, x, y, 4.5, c);
    bolt(ctx, 2);
  },
  aura: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, color: c, path, level } = ctx,
      motif = path ? d.visual.paths?.[path]?.motif : undefined;
    ring(g, x, y, 19, 2, c, motif ? 0.55 : 0.3);
    if (!motif) {
      // Undecided: one dimmed dot per path colour hints at the choice.
      Object.values(d.visual.paths ?? {}).forEach((option, i, all) => {
        const p = at(x, y, clock * 0.4 + (i * TAU) / all.length - Math.PI / 2, 13);
        disc(g, p.x, p.y, 2.5, option.color, 0.55);
      });
      disc(g, x, y, 4, c, 0.5);
      bolt(ctx, 2);
      return;
    }
    MOTIFS[motif](ctx, Math.max(1, level), clock + t.id);
    disc(g, x, y, 5, c);
    bolt(ctx, 2);
    loop(g, x, y, 8 + Math.sin(clock * 2) * 2, 1.5, c, 0.75);
  },
  // ── new towers: g1 (Attack+Control A) ──
  // A satellite dish on a yoke tracks the target, a designator laser along its feed arm. A countdown arc on the deck
  // fills with the charge, and the red beacon on the dish blinks faster as the next strike nears.
  uplink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "uplink");
    arcBand(g, x, y, 15.6, 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * charge, shade(c, -0.1), 0.75);
    if (charge >= 1) ring(glow, x, y, 15.6, 2, c, 0.1 + 0.06 * Math.sin(clock * 6 + t.id));
    boss(g, x, y, 8.5, shade(c, -0.62));
    litBar(g, x, y, a, back, end, 1.9, 1.3, shade(PLATE, 0.1), { tip, bands: level >= 3 ? [0.55, 0.7] : [0.6] });
    bar(glow, x, y, a, back + 4, end, 0.6, 0.5, c, Math.min(0.4, 0.1 + 0.25 * charge + energy));
    // The dish: an oval across the aim behind the centre, its bowl lit on the side that faces the light.
    const dx = x - ca * (3 + kick * 1.5),
      dy = y - sa * (3 + kick * 1.5);
    oval(g, dx + 0.8, dy + 1.4, 5.2, 12.6, SHADOW, 0.4, a);
    oval(g, dx, dy, 5, 12.2, shade(PLATE, -0.3), 1, a);
    oval(g, dx + ca * 1.2, dy + sa * 1.2, 3.8, 10.8, shade(PLATE, 0.2 + 0.15 * facing(a)), 1, a);
    oval(g, dx + ca * 1.9, dy + sa * 1.9, 2.4, 8.4, shade(c, -0.6), 1, a);
    g.fillStyle(OUTLINE, 0.8);
    for (const side of [-7, 0, 7]) {
      const p = point(dx, dy, ca, sa, 1.2, side);
      pip(g, p.x, p.y, 0.8);
    }
    // Struts to the feed horn at the focus.
    g.lineStyle(0.9, shade(PLATE, 0.3), 0.9);
    for (const side of [-8, 8]) {
      const p = point(dx, dy, ca, sa, 1.6, side),
        q = point(x, y, ca, sa, 4, 0);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    const horn = point(x, y, ca, sa, 4, 0);
    disc(g, horn.x, horn.y, 2.2, shade(PLATE, 0.35));
    disc(g, horn.x, horn.y, 1.1, c);
    const beacon = point(dx, dy, ca, sa, -2.4, 0),
      blink = Math.sin(clock * (3 + 9 * charge) + t.id) > 0.3 ? 1 : 0.15;
    led(ctx, beacon.x, beacon.y, c, blink);
    if (kick > 0) halo(glow, horn.x, horn.y, 8 * (0.5 + kick), c, 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A hypnotic disc: spiral arms in violet on black turn ever faster with the charge round an eye that follows the
  // target; a short emitter prong points at it. A third arm joins from level 3.
  spiral: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      { back, end } = reach(ctx, "spiral"),
      arms = level >= 3 ? 3 : 2,
      spin = clock * (1.2 + 3 * charge) + t.id;
    litBar(g, x, y, a, back + 6, end, 2.4, 1.2, shade(c, -0.55), { tip });
    disc(g, x + 1, y + 1.6, 11.6, SHADOW, 0.4);
    disc(g, x, y, 11.4, OUTLINE);
    disc(g, x, y, 10.4, shade(c, -0.72));
    for (const [ink, w, alpha] of [[glow, 3.4, Math.min(0.3, 0.08 + 0.15 * charge + energy)], [g, 1.8, 0.95]] as const) {
      ink.lineStyle(w, c, alpha);
      for (let i = 0; i < arms; i++) {
        for (let k = 0; k < 12; k++) {
          const b = spin + (i * TAU) / arms + k * 0.42,
            r = 1.6 + k * 0.74;
          put(k, x + Math.cos(b) * r, y + Math.sin(b) * r);
        }
        ink.strokePoints(PTS, false, false, 12);
      }
    }
    arcBand(g, x, y, 10.6, 0.9, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.35), 0.7);
    // The eye looks along the aim.
    oval(g, x, y, 2.6, 4, shade(c, 0.75), 1, a);
    const pupil = at(x, y, a, 0.9);
    disc(g, pupil.x, pupil.y, 1.5, OUTLINE);
    glowDot(glow, x, y, 6, c, Math.min(peak, 0.15 + 0.3 * charge + energy));
    if (kick > 0) ring(glow, x, y, 11 + (1 - kick) * 9, 1.6, shade(c, 0.4), 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A faceted amber gem in a three-claw clamp, glowing deeper as the resin gathers; the nozzle in front drips with the
  // charge. A fossil insect hangs in the gem from level 3.
  resin: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "resin");
    litBar(g, x, y, a, back + 4, end, 3.2, 2.4, shade(PLATE, -0.1), { tip, bands: level >= 3 ? [0.5, 0.75] : [0.65] });
    if (charge > 0.5) {
      const drip = point(x, y, ca, sa, end - 0.5, 0);
      disc(g, drip.x, drip.y + (charge - 0.5) * 4, 0.8 + 1.6 * (charge - 0.5), shade(c, 0.15), 0.95);
    }
    fins(g, x, y, [a + Math.PI, a + Math.PI / 3, a - Math.PI / 3], 6.5, 12.5, 2.6, 1.2, shade(PLATE, 0.05));
    disc(g, x + 1, y + 1.6, 9.8, SHADOW, 0.35);
    polygon(g, x, y, 10, 6, OUTLINE, a + Math.PI / 6, 0.9);
    facets(g, x, y, 9, 6, a + Math.PI / 6, shade(c, -0.2), 0.42);
    polygon(g, x, y, 5.4, 6, shade(c, 0.3), a + Math.PI / 6, 0.45 + 0.45 * charge);
    if (level >= 3) {
      oval(g, x + 1.4, y + 1.2, 1.9, 0.9, shade(c, -0.75), 0.85, t.id);
      g.lineStyle(0.5, shade(c, -0.75), 0.7);
      g.lineBetween(x + 0.2, y + 0.2, x + 2.6, y + 2.4);
    }
    disc(glow, x, y, 8, c, Math.min(peak * 0.5, 0.08 + 0.18 * charge + energy));
    disc(g, x - 3, y - 3.4, 1.2, 0xffffff, 0.7);
    if (kick > 0) halo(glow, x, y, 10 * (0.6 + kick), c, 0.3 * kick);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A horseshoe magnet turned at the target: two pole arms wound with copper on a steel yoke. Field lines arc between
  // the bright pole tips, more of them as the pulse charges, and a ring snaps away from the poles on a pulse.
  magnet: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, tip, energy, peak } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      len = 12 + Math.min(level, 5) * 0.5,
      yoke = point(x, y, ca, sa, -3, 0),
      lines = 1 + Math.round(charge * (level >= 3 ? 3 : 2));
    for (let i = 0; i < lines; i++) {
      const bulge = 3.5 + i * 2.8 + Math.sin(clock * 4 + i + t.id) * 0.6;
      for (let k = 0; k <= 8; k++) {
        const u = k / 8,
          p = point(x, y, ca, sa, len + Math.sin(Math.PI * u) * bulge, (u * 2 - 1) * 5.5);
        put(k, p.x, p.y);
      }
      glow.lineStyle(1.2, c, Math.min(0.35, 0.1 + 0.2 * charge + energy) * (1 - i * 0.18));
      glow.strokePoints(PTS, false, false, 9);
    }
    arcBand(g, yoke.x + 0.8, yoke.y + 1.2, 5.5, 3.8, a + Math.PI / 2, a + 1.5 * Math.PI, SHADOW, 0.4);
    arcBand(g, yoke.x, yoke.y, 5.5, 3.8, a + Math.PI / 2, a + 1.5 * Math.PI, shade(PLATE, 0.1));
    arcBand(g, yoke.x, yoke.y, 6.6, 1, a + Math.PI / 2, a + 1.5 * Math.PI, shade(PLATE, 0.45), 0.6);
    for (const side of [-5.5, 5.5]) litBar(g, x, y, a, -3, len, 1.9, 1.9, shade(c, -0.25), { side, bands: [0.3, 0.42, 0.54] });
    g.fillStyle(0xb8743a);
    for (const side of [-5.5, 5.5])
      for (const f of [0.3, 0.42, 0.54]) {
        const p = point(x, y, ca, sa, -3 + (len + 3) * f, side);
        pip(g, p.x, p.y, 1.2);
      }
    for (const side of [-5.5, 5.5]) {
      const p = point(x, y, ca, sa, len, side);
      disc(g, p.x, p.y, 2.1, tip ?? shade(PLATE, 0.55));
      glowDot(glow, p.x, p.y, 3.6, c, Math.min(peak, 0.12 + 0.3 * charge + energy));
    }
    boss(g, x, y, 3.6, shade(c, -0.5));
    if (kick > 0) {
      const q = point(x, y, ca, sa, len + 3, 0);
      ring(glow, q.x, q.y, 3 + (1 - kick) * 10, 1.6, shade(c, 0.5), 0.35 * kick);
    }
  },
  // A ducted fan: a round shroud with swept blades that spin up as the gust charges and blur after a blast, a domed
  // hub, and wind streaks curling round the rim in light. Six blades from level 3.
  fan: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, charge, kick, energy, peak } = ctx,
      c = d.color,
      blades = level >= 3 ? 6 : 5,
      spin = clock * (1.5 + 6 * charge) + kick * 4 + t.id;
    disc(g, x + 1, y + 1.6, 13, SHADOW, 0.4);
    ring(g, x, y, 12.4, 3, OUTLINE, 0.9);
    ring(g, x, y, 12, 1.8, shade(PLATE, 0.05));
    arcBand(g, x, y, 12.2, 1, LIGHT - 1, LIGHT + 1, shade(PLATE, 0.5), 0.8);
    disc(g, x, y, 10.6, shade(DARK, -0.25));
    for (let i = 0; i < blades; i++) {
      const b = spin + (i * TAU) / blades;
      g.fillStyle(shade(c, -0.15 + 0.3 * facing(b + Math.PI / 2)));
      quad(g, x, y, Math.cos(b), Math.sin(b), 3, 10.2, -1.1, 1.5, 0.4, 3.6);
    }
    if (charge > 0.6 || kick > 0) ring(glow, x, y, 7, 6, c, Math.min(0.25, 0.1 * charge + 0.2 * kick + energy));
    dome(g, x, y, 3.4, shade(c, -0.25));
    for (let i = 0; i < 3; i++) {
      const s = clock * (2 + 2 * charge) + (i * TAU) / 3 + t.id;
      arcBand(glow, x, y, 15.2, 1, s, s + 0.7, c, Math.min(peak * 0.5, 0.08 + 0.15 * charge + energy));
    }
    if (kick > 0) ring(glow, x, y, 12 + (1 - kick) * 12, 2, shade(c, 0.5), 0.3 * kick);
  },
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // A grapple gun: a winch drum with wound chain at the rear, a barrel with a three-pronged claw that flies off on a
  // shot and is wound back in as the grapple reloads; the chain between drum and claw lights up from level 3.
  tether: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "tether");
    boss(g, x, y, 10.5, shade(c, -0.6));
    // Winch drum across the rear, turning while it winds the chain back in.
    const drum = point(x, y, ca, sa, -7.5, 0);
    block(g, drum.x + 0.6, drum.y + 1, a, 3.4, 8.4, 1.2, SHADOW);
    block(g, drum.x, drum.y, a, 3.4, 8.4, 1.2, shade(c, -0.45));
    const turn = (charge < 1 ? clock * 9 : 0) + t.id;
    g.fillStyle(shade(c, 0.2));
    for (let k = -3; k <= 3; k++) {
      const wobble = 0.6 * Math.sin(turn + k * 1.7),
        p = point(drum.x, drum.y, ca, sa, wobble, k * 2.2);
      pip(g, p.x, p.y, 1);
    }
    litBar(g, x, y, a, back - 2, end - 3, 2.8, 2.4, shade(c, -0.25), { tip, bands: level >= 3 ? [0.4, 0.62] : undefined });
    // The claw: three prongs at the tip once wound back in, absent right after a shot.
    const home = Math.min(1, Math.max(0, (charge - 0.35) / 0.4));
    if (home > 0) {
      const claw = point(x, y, ca, sa, end - 3 + (1 - home) * -6, 0);
      disc(g, claw.x, claw.y, 2.3, shade(c, -0.5), home);
      for (const off of [-0.85, 0, 0.85]) {
        const b = a + off,
          p = at(claw.x, claw.y, b, 4.8);
        g.lineStyle(1.4, shade(c, 0.3), home);
        g.lineBetween(claw.x, claw.y, p.x, p.y);
        disc(g, p.x, p.y, 0.8, shade(c, 0.55), home);
      }
    }
    // Chain links along the barrel from the drum: they light up one by one as the claw comes home.
    const links = 5;
    for (let i = 0; i < links; i++) {
      const f = i / (links - 1),
        p = point(x, y, ca, sa, -4 + f * (end - 6), 0);
      if (i % 2) chamferRect(g, p.x, p.y, 1.1, 1.1, 0.4, shade(c, 0.15));
      else ring(g, p.x, p.y, 1.4, 0.8, shade(c, 0.35));
      if (level >= 3 && f <= home) disc(glow, p.x, p.y, 2.2, c, Math.min(0.3, 0.1 + 0.12 * home + energy));
    }
    bolt(ctx, 2.2);
    muzzleGlow(ctx, end + 1, 4);
    if (kick > 0) glowLine(glow, x, y, x + ca * (end + 10 * (1 - kick)), y + sa * (end + 10 * (1 - kick)), c, 1.2, 0.3 * kick);
  },
  // A classic ray gun: a stepped cone of rings narrowing to a lens; pulses of light run down the cone and shrink
  // as the next beam builds, and the lens brightens with the charge.
  shrinker: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock, maxed } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "shrinker");
    boss(g, x, y, 10, shade(c, -0.6));
    // The cone: a tapered body and three collar rings, each narrower than the last.
    litBar(g, x, y, a, back - 3, end - 2, 6.2, 2.2, shade(c, -0.5), { tip });
    const collars = level >= 3 ? [0.2, 0.42, 0.64, 0.84] : [0.25, 0.55, 0.82];
    for (const f of collars) {
      const dd = back - 3 + (end - 2 - back + 3) * f,
        w = 6.2 + (2.2 - 6.2) * f + 1.2;
      strip(g, x, y, ca, sa, dd - 0.9, dd + 0.9, -w, w, -w, w, shade(c, -0.15));
      strip(g, x, y, ca, sa, dd - 0.9, dd - 0.2, -w, w, -w, w, shade(c, 0.35), 0.8);
    }
    // Light pulses travelling to the lens, shrinking on their way.
    for (let i = 0; i < 2; i++) {
      const k = (clock * (0.8 + charge) + i / 2 + t.id * 0.17) % 1,
        dd = back - 2 + (end - back) * k,
        w = 5.6 * (1 - 0.7 * k);
      strip(glow, x, y, ca, sa, dd - 0.6, dd + 0.6, -w, w, -w, w, c, Math.min(0.3, (0.08 + 0.18 * charge + energy) * (1 - k * 0.5)));
    }
    const lens = point(x, y, ca, sa, end - 1, 0);
    disc(g, lens.x, lens.y, 2.4, OUTLINE);
    disc(g, lens.x, lens.y, 1.7, shade(c, -0.3 + 0.7 * charge));
    disc(g, lens.x - 0.5, lens.y - 0.5, 0.6, 0xffffff, 0.4 + 0.5 * charge);
    glowDot(glow, lens.x, lens.y, 5, c, Math.min(0.5, 0.1 + 0.3 * Math.max(charge * charge, kick) + energy));
    // Gauge on the housing: a ring segment that closes with the charge.
    if (charge > 0.02) arcBand(g, x, y, 8.2, 1.2, a + Math.PI - Math.PI * 0.6 * charge, a + Math.PI + Math.PI * 0.6 * charge, c, 0.85);
    if (maxed) bolt(ctx, 1.6);
    else bolt(ctx, 2);
    muzzleGlow(ctx, end + 1, 4);
  },
  // A turning pentagram floats over the plate; its points kindle with the charge, and a cursed shard grows in the
  // point that faces the target. Rune marks orbit it from level 3.
  sigil: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, clock, energy, peak, maxed } = ctx,
      a = t.angle,
      c = d.color,
      lift = Math.sin(clock * 2.2 + t.id) * 1.2,
      cy = y - lift,
      { end } = reach(ctx, "sigil");
    oval(g, x + 1.5, y + 3, 11 - 0.3 * lift, 7, SHADOW, 0.35);
    // Star: one point on the aim, so the shard forms there.
    star(g, x, cy, 13, 5.4, 5, shade(c, -0.55), a);
    star(g, x - 0.4, cy - 0.4, 11.6, 4.6, 5, shade(c, -0.15 + 0.2 * charge), a);
    for (let i = 0; i < 5; i++) {
      const p = at(x, cy, a + (i * TAU) / 5, 11),
        on = Math.max(0, Math.min(1, charge * 5 - ((i + 4) % 5)));
      if (on > 0) disc(glow, p.x, p.y, 3, c, Math.min(0.3, 0.25 * on + energy * 0.5));
    }
    // Inner pentagon, engraved.
    for (let i = 0; i < 5; i++) put(i, x + Math.cos(a + Math.PI + (i * TAU) / 5) * 4.4, cy + Math.sin(a + Math.PI + (i * TAU) / 5) * 4.4);
    g.lineStyle(0.9, shade(c, 0.4), 0.7);
    g.strokePoints(PTS, true, true, 5);
    // The cursed shard at the leading point, growing with the charge, gone right after a shot.
    const grow = Math.max(0, (charge - 0.3) / 0.7) * (1 - kick);
    if (grow > 0) {
      const p = at(x, cy, a, end - 2),
        hl = 3.6 * grow,
        hw = 1.6 * grow;
      block(g, p.x, p.y, a, hl, hw, hw * 0.9, shade(c, 0.35));
      block(g, p.x - 0.3, p.y - 0.3, a, hl * 0.6, hw * 0.5, hw * 0.4, 0xffffff);
      glowDot(glow, p.x, p.y, 5, c, Math.min(peak, 0.15 + 0.3 * grow + energy));
    }
    if (level >= 3) {
      g.fillStyle(shade(c, 0.3), 0.8);
      for (let i = 0; i < 3; i++) {
        const p = at(x, cy, -clock * 0.9 + t.id + (i * TAU) / 3, 16);
        tick(g, p.x, p.y, -clock * 0.9 + (i * TAU) / 3, -1.6, 1.6, 1.1);
      }
    }
    disc(g, x, cy, 2.6, maxed ? shade(c, 0.8) : DARK);
    disc(glow, x, cy, 4, c, Math.min(peak, 0.12 + 0.2 * charge + energy));
    if (kick > 0) ring(glow, x, cy, 9 + (1 - kick) * 9, 1.6, shade(c, 0.4), 0.32 * kick);
  },
  // A flared drain nozzle feeding a glass reservoir: the drained fluid swirls in it and sinks as the beam reloads,
  // and three feed lines carry it out to the towers around (lit from level 3).
  siphon: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, charge, kick, tip, energy, clock, maxed } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      { back, end } = reach(ctx, "siphon");
    // Feed lines from the reservoir to the plate rim, opposite the nozzle.
    for (const off of [-0.9, 0, 0.9]) {
      const b = a + Math.PI + off,
        flow = (clock * 1.4 + off + t.id * 0.3) % 1;
      litBar(g, x, y, b, 7, 15, 1.2, 1.2, shade(c, -0.45), { shadow: false });
      if (level >= 3) {
        const p = at(x, y, b, 7 + 8 * flow);
        disc(glow, p.x, p.y, 2, c, Math.min(0.3, 0.12 + energy) * (1 - flow));
      }
    }
    // The nozzle: wide mouth, narrow neck.
    litBar(g, x, y, a, back + 4, end, 1.8, 4.6, shade(c, -0.4), { tip, bands: level >= 3 ? [0.5] : undefined });
    const mouth = point(x, y, ca, sa, end - 0.8, 0);
    strip(g, x, y, ca, sa, end - 1.6, end, -4.2, 4.2, -4.2, 4.2, OUTLINE, 0.9);
    strip(glow, x, y, ca, sa, end - 1.4, end, -3.6, 3.6, -3.6, 3.6, c, Math.min(0.3, 0.06 + 0.2 * Math.max(kick, charge * 0.5) + energy));
    // Reservoir: a glass bulb whose fluid level falls after a drain shot and rises back.
    disc(g, x + 0.8, y + 1.2, 9.6, SHADOW, 0.4);
    disc(g, x, y, 9.4, shade(c, -0.65));
    disc(g, x, y, 8.2, shade(DARK, 0.15));
    const fill = 0.3 + 0.6 * charge,
      spread = Math.acos(1 - 2 * fill);
    wedge(g, x, y, 7.6, Math.PI / 2 - spread, Math.PI / 2 + spread, c, 0.85);
    // A swirl in the fluid.
    const swirl = clock * 2.4 + t.id;
    arcBand(g, x, y, 4.2, 1.1, swirl, swirl + 2, shade(c, 0.5), 0.7);
    arcBand(g, x, y, 2.2, 0.9, -swirl * 1.3, -swirl * 1.3 + 2, shade(c, 0.6), 0.6);
    disc(glow, x, y, 8, c, Math.min(0.3, 0.06 + 0.12 * charge + energy));
    arcBand(g, x, y, 7.4, 1.4, LIGHT - 0.7, LIGHT + 0.6, 0xffffff, 0.35);
    if (kick > 0) ring(glow, mouth.x, mouth.y, 3 + (1 - kick) * 6, 1.2, shade(c, 0.4), 0.3 * kick);
    if (maxed) bolt(ctx, 1.4);
    muzzleGlow(ctx, end + 1, 4);
  },
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  // A steel hedgehog of three crossed beams with spiked ends. It darkens and cracks as enemies chew on it, its HP
  // pips run down above it, and a breached one lies in pieces until the wave ends.
  barricade: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      share = wallShareOf(t, d);
    if (share <= 0) {
      for (let i = 0; i < 6; i++) {
        const a = hash01(t.id, i) * TAU,
          r = 3 + 11 * hash01(i, t.id, 1);
        litBar(g, x + Math.cos(a) * r, y + Math.sin(a) * r, a + i * 1.3, -4, 4, 1.5, 1.2, shade(c, -0.35));
      }
      led(ctx, x + 14, y - 14, 0xff4d4d, Math.sin(clock * 8) > 0 ? 0.8 : 0.1);
      return;
    }
    const worn = 1 - share,
      jolt = kick * Math.sin(clock * 70) * 0.8,
      beams = [Math.PI / 6, Math.PI / 2, (5 * Math.PI) / 6];
    for (const [i, a] of beams.entries()) {
      litBar(g, x + jolt, y, a, -15, 15, 2.8, 2.8, shade(c, -0.1 - 0.45 * worn * (i === 1 ? 1.2 : 1)), { bands: [0.3, 0.7] });
      // Spiked ends in bright steel.
      g.fillStyle(shade(PLATE, 0.55));
      for (const end of [-1, 1]) {
        const ca = Math.cos(a) * end,
          sa = Math.sin(a) * end,
          tx = x + jolt + ca * 15,
          ty = y + sa * 15;
        g.fillTriangle(tx - sa * 2.4, ty + ca * 2.4, tx + sa * 2.4, ty - ca * 2.4, tx + ca * 4.5, ty + sa * 4.5);
      }
    }
    // Cracks open as the wall weakens.
    if (worn > 0.33) {
      g.lineStyle(1.1, OUTLINE, 0.9);
      g.beginPath();
      for (let k = 0; k < (worn > 0.66 ? 3 : 1); k++) {
        const p = at(x, y, beams[k], 6 + 3 * k);
        g.moveTo(p.x - 2, p.y - 2.5);
        g.lineTo(p.x + 1, p.y);
        g.lineTo(p.x - 1, p.y + 2.5);
      }
      g.strokePath();
    }
    dome(g, x + jolt, y, 3.6, shade(PLATE, 0.2));
    // HP pips across the top: lit while the wall holds, the last one blinking when it is about to give.
    const pips = 5,
      lit = Math.ceil(share * pips);
    for (let i = 0; i < pips; i++) {
      const left = x - 12 + i * 5,
        on = i < lit && !(i === lit - 1 && share < 0.25 && Math.sin(clock * 10) < 0);
      g.fillStyle(OUTLINE, 0.9);
      g.fillRect(left - 0.6, y - 21.6, 4.2, 3.2);
      g.fillStyle(on ? (share > 0.5 ? shade(c, 0.45) : 0xff6a3d) : DARK);
      g.fillRect(left, y - 21, 3, 2);
    }
  },
  // A portal: spiral arms turn over a black core, faster once it is charged; it flashes when it folds an enemy back.
  warp: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color,
      ready = charge >= 1,
      spin = clock * (ready ? 3.2 : 0.9) + t.id;
    disc(g, x, y, 13.6, OUTLINE);
    disc(g, x, y, 12.4, 0x04060f);
    if (ready) disc(glow, x, y, 12, c, 0.12 + 0.05 * Math.sin(clock * 4 + t.id));
    for (const ink of ready ? [glow, g] : [g]) {
      const light = ink === glow;
      ink.lineStyle(light ? 3.2 : 1.4, light ? c : shade(c, 0.35), light ? 0.22 : ready ? 0.95 : 0.45);
      ink.beginPath();
      for (let arm = 0; arm < 3; arm++)
        for (let k = 0; k < 8; k++) {
          const a = spin + (arm * TAU) / 3 + k * 0.32,
            r = 11.5 - k * 1.3;
          if (k) ink.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ink.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
      ink.strokePath();
    }
    arcBand(g, x, y, 15.4, 1.4, -Math.PI / 2, -Math.PI / 2 + TAU * charge, c, 0.85);
    disc(g, x, y, 1.6, ready ? 0xffffff : shade(c, -0.3), ready ? 0.85 : 0.6);
    if (kick > 0) {
      ring(glow, x, y, 4 + 14 * (1 - kick), 2, shade(c, 0.4), 0.45 * kick);
      disc(g, x, y, 5 * kick, 0xffffff, 0.7 * kick);
    }
    armedLed(ctx);
  },
  // A square copper coil set into the floor around a terminal; sparks crawl over it once it is charged.
  plate: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, charge, kick } = ctx,
      c = d.color;
    for (let k = 0; k < 10; k++) {
      const [sx, sy] = CORNERS[k % 4],
        r = 12 - k * 1.05;
      put(k, x + sx * r, y + sy * r);
    }
    g.lineStyle(2.4, OUTLINE, 0.9);
    g.strokePoints(PTS, false, false, 10);
    g.lineStyle(1.3, shade(c, -0.45 + 0.35 * charge), 1);
    g.strokePoints(PTS, false, false, 10);
    if (charge >= 1) {
      glow.lineStyle(2.6, c, 0.12 + 0.06 * Math.sin(clock * 9 + t.id));
      glow.strokePoints(PTS, false, false, 10);
      const step = Math.floor(clock * 14);
      for (let i = 0; i < 2; i++) crackle(glow, x, y, hash01(t.id, step, i) * TAU, 3, 12, shade(c, 0.3), 0.55, step + i);
    }
    dome(g, x, y, 3.4, shade(c, -0.25));
    if (kick > 0) {
      halo(glow, x, y, 16, c, 0.4 * kick);
      disc(g, x, y, 3 * kick, 0xffffff, kick);
    }
    armedLed(ctx);
  },
  // A glossy oil spill with a slow rainbow sheen; a drum on its side keeps it topped up, and fresh oil ripples out.
  slick: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color;
    oval(g, x, y + 1, 15, 11.5, shade(c, -0.55), 0.95, 0.2);
    oval(g, x - 1, y, 13, 9.5, shade(c, -0.35), 0.9, 0.2);
    for (const [i, hue] of [0xff7ad9, 0x7affd4, 0xffe27a].entries()) {
      const a = clock * 0.35 + t.id + i * 2.1;
      arcBand(g, x - 1, y, 6 + i * 2.2, 1.2, a, a + 1.4, hue, 0.22);
    }
    oval(g, x - 5.5, y - 4.5, 4.5, 1.4, 0xffffff, 0.35, -0.5);
    chamferRect(g, x + 12.6, y - 12, 5.4, 3.6, 1, shade(c, -0.6));
    chamferRect(g, x + 12.2, y - 12.6, 5, 2.6, 1, shade(c, -0.15));
    g.fillStyle(shade(c, -0.6));
    g.fillRect(x + 9.6, y - 15, 1, 6);
    g.fillRect(x + 14.6, y - 15, 1, 6);
    const drip = (clock * 1.3 + t.id * 0.3) % 1;
    disc(g, x + 8, y - 9 + drip * 5, 1.1, shade(c, -0.2), 1 - drip);
    if (kick > 0) loop(g, x, y, 4 + 11 * (1 - kick), 1.2, shade(c, 0.4), 0.7 * kick);
  },
  // Two toothed rollers turning against each other; they jerk on every bite.
  grinder: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick, level } = ctx,
      c = d.color,
      turn = clock * 3 + t.id + kick * 0.6;
    for (const side of [-1, 1]) {
      const gx = x + side * 6.6,
        rot = side * turn;
      star(g, gx + 0.8, y + 1.2, 8.4, 6.4, 10, SHADOW, rot, 0.5);
      star(g, gx, y, 8.4, 6.4, 10, shade(c, -0.35), rot);
      disc(g, gx - 0.3, y - 0.3, 6, shade(c, -0.05));
      arcBand(g, gx, y, 5.4, 1, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.4), 0.85);
      g.fillStyle(shade(c, -0.45));
      for (let i = 0; i < 3; i++) tick(g, gx, y, rot + (i * TAU) / 3, 1.5, 5.2, 1);
      disc(g, gx, y, 1.7, OUTLINE);
    }
    // The nip between the rollers, hot after a bite on a fully upgraded grinder.
    g.fillStyle(OUTLINE);
    g.fillRect(x - 0.8, y - 7, 1.6, 14);
    if (kick > 0 && level >= 5) bar(glow, x, y, Math.PI / 2, -7, 7, 1.2, 1.2, c, 0.35 * kick);
    armedLed(ctx);
  },
  // A launcher tube aiming up the flight line inside a coil of rope; the barbed head shows once it is loaded.
  harpoon: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, charge, kick } = ctx,
      a = t.angle,
      c = d.color,
      ca = Math.cos(a),
      sa = Math.sin(a),
      // The rope coil pays out with a shot and winds back up as the trap reloads.
      coil = 8.5 + 3 * charge;
    loop(g, x, y, coil, 2.2, 0x8a6d45, 0.95);
    loop(g, x, y, coil - 0.7, 0.6, 0xc8a46b, 0.8);
    litBar(g, x, y, a, -6, 9, 3.6, 3, shade(c, -0.2), { bands: [0.35, 0.7] });
    if (charge >= 1) {
      const tip = point(x, y, ca, sa, 13.5, 0),
        neck = point(x, y, ca, sa, 9, 0);
      g.fillStyle(shade(PLATE, 0.6));
      g.fillTriangle(neck.x - sa * 3.4, neck.y + ca * 3.4, neck.x + sa * 3.4, neck.y - ca * 3.4, tip.x, tip.y);
      g.fillStyle(shade(PLATE, 0.2));
      g.fillTriangle(neck.x + sa * 3.4, neck.y - ca * 3.4, neck.x, neck.y, tip.x, tip.y);
      halo(glow, tip.x, tip.y, 4, c, 0.18);
    } else disc(g, x + ca * 9, y + sa * 9, 2.2, OUTLINE);
    if (kick > 0) halo(glow, x + ca * 10, y + sa * 10, 7, c, 0.3 * kick);
    dome(g, x, y, 4, shade(c, -0.3));
    armedLed(ctx);
  },
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  // A gear ring around a dial whose hand ticks round once a second-step at a time; the hand grows with each level.
  clock: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      gear = clock * 0.35 + t.id,
      teeth = Array.from({ length: 10 }, (_, i) => gear + (i * TAU) / 10);
    fins(g, x, y, teeth, 10, 13.5, 2.4, 1.6, shade(c, -0.2));
    boss(g, x, y, 11, shade(c, -0.5));
    disc(g, x, y, 8.6, DARK);
    g.fillStyle(shade(c, 0.2), 0.9);
    for (let i = 0; i < 12; i++) tick(g, x, y, (i * Math.PI) / 6, 6.6, i % 3 ? 7.6 : 8.3, 0.9);
    // The hand ticks: it rests, then snaps to the next mark.
    const step = Math.floor(clock * 2 + t.id),
      snap = Math.min(1, ((clock * 2 + t.id) % 1) * 6),
      a = -Math.PI / 2 + ((step + snap) * TAU) / 12,
      tip = at(x, y, a, 5.5 + level * 0.7);
    g.lineStyle(1.6, shade(c, 0.55), 1);
    g.lineBetween(x, y, tip.x, tip.y);
    glowLine(glow, x, y, tip.x, tip.y, c, 1, 0.22 + energy);
    disc(g, tip.x, tip.y, 1, 0xffffff, 0.85);
    bolt(ctx, 2);
  },
  // A rangefinder bar with a lens at each end, slowly scanning, over a reticle that tightens with each level.
  director: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      a = clock * 0.45 + t.id,
      gap = 0.5 - level * 0.08;
    for (let i = 0; i < 4; i++) {
      const q = (i * Math.PI) / 2 + Math.PI / 4;
      arcBand(g, x, y, 13, 1.4, q - Math.PI / 4 + gap, q + Math.PI / 4 - gap, shade(c, -0.1), 0.8);
    }
    litBar(g, x, y, a, -13, 13, 3, 3, shade(PLATE, 0.15), { bands: [0.3, 0.7] });
    for (const end of [-1, 1]) {
      const p = at(x, y, a, end * 12.5);
      boss(g, p.x, p.y, 3.6, shade(c, -0.5));
      disc(g, p.x, p.y, 2.2, c);
      disc(g, p.x - 0.6, p.y - 0.6, 0.8, 0xffffff, 0.8);
      glowDot(glow, p.x, p.y, 5, c, 0.25 + energy);
    }
    dome(g, x, y, 6, shade(c, -0.35));
    // A crosshair glints on the dome.
    g.lineStyle(0.8, shade(c, 0.6), 0.9);
    g.lineBetween(x - 3.5, y, x + 3.5, y);
    g.lineBetween(x, y - 3.5, x, y + 3.5);
  },
  // A revolving ammunition drum: it indexes one chamber at a time, every cartridge tipped in the tower colour.
  armory: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      beat = clock * 0.8 + t.id * 0.37,
      turn = (Math.floor(beat) + Math.min(1, (beat % 1) * 4)) * (TAU / 6);
    boss(g, x, y, 13, shade(PLATE, -0.1));
    ring(g, x, y, 12.2, 0.8, OUTLINE, 0.7);
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, turn + (i * TAU) / 6, 8);
      disc(g, p.x, p.y, 3.3, DARK);
      disc(g, p.x, p.y, 2.5, 0xb08a3a);
      disc(g, p.x, p.y, 1.5, i < level * 2 ? shade(c, 0.35) : shade(c, -0.25));
      disc(g, p.x - 0.5, p.y - 0.6, 0.6, 0xffffff, 0.7);
    }
    for (let i = 0; i < level * 2; i++) {
      const p = at(x, y, turn + (i * TAU) / 6, 8);
      disc(glow, p.x, p.y, 2.6, c, 0.2 + energy);
    }
    boss(g, x, y, 4, shade(c, -0.4));
    bolt(ctx, 2);
  },
  // A dish tipped skywards with a feed horn; chevrons of light rise from it, one more per level.
  skylink: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color;
    oval(g, x + 1, y + 2.5, 12, 9, SHADOW, 0.4);
    oval(g, x, y, 12, 9, shade(c, -0.5));
    oval(g, x - 0.5, y - 0.6, 10.8, 7.8, shade(PLATE, 0.25));
    oval(g, x - 0.3, y + 0.4, 8, 5.6, shade(PLATE, -0.15));
    arcBand(g, x, y, 10.5, 1, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.5), 0.7);
    litBar(g, x, y, -Math.PI / 2, 0, 9, 1.2, 0.9, shade(PLATE, 0.2), { shadow: false });
    disc(g, x, y - 9, 2.2, c);
    disc(glow, x, y - 9, 4, c, 0.3 + energy);
    for (let i = 0; i < level + 1; i++) {
      const k = (clock * 0.8 + t.id * 0.21 + i / (level + 1)) % 1,
        cy = y - 10 - k * 12,
        fade = Math.sin(k * Math.PI);
      g.lineStyle(1.6, shade(c, 0.4), 0.85 * fade);
      g.beginPath();
      g.moveTo(x - 4, cy + 3);
      g.lineTo(x, cy);
      g.lineTo(x + 4, cy + 3);
      g.strokePath();
      glow.lineStyle(3, c, 0.22 * fade);
      glow.beginPath();
      glow.moveTo(x - 4, cy + 3);
      glow.lineTo(x, cy);
      glow.lineTo(x + 4, cy + 3);
      glow.strokePath();
    }
  },
  // A core node with six satellites turning round it on a lattice; a pulse runs from satellite to satellite.
  nexus: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock, energy } = ctx,
      c = d.color,
      spin = clock * 0.25 + t.id,
      nodes = Array.from({ length: 6 }, (_, i) => at(x, y, spin + (i * Math.PI) / 3, 12)),
      lit = Math.floor((clock * 3 + t.id) % 6);
    hexLine(g, x, y, 12, 1, shade(c, -0.2), 0.7, spin);
    g.lineStyle(0.9, shade(c, -0.1), 0.6);
    for (const p of nodes) g.lineBetween(x, y, p.x, p.y);
    nodes.forEach((p, i) => {
      const on = i < level * 2;
      disc(g, p.x, p.y, 3, OUTLINE);
      disc(g, p.x, p.y, 2.1, on ? c : shade(c, -0.55));
      if (on && i === lit % (level * 2)) {
        disc(g, p.x, p.y, 1, 0xffffff, 0.9);
        glowDot(glow, p.x, p.y, 6, c, 0.4);
      }
    });
    dome(g, x, y, 5.5, shade(c, -0.15));
    halo(glow, x, y, 10, c, 0.12 + energy);
  },
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  // An anvil and a hammer that rises and strikes on its own rhythm; every blow throws sparks, more with each level.
  workshop: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      phase = (clock / 1.4 + t.id * 0.37) % 1,
      // Slow lift, fast blow: the head sits on the anvil at phase 0.
      lift = phase < 0.75 ? Math.sin((phase / 0.75) * Math.PI * 0.5) : 1 - (phase - 0.75) / 0.25,
      blow = phase < 0.18 ? 1 - phase / 0.18 : 0,
      arm = -Math.PI * 0.15 - lift * 0.9,
      pivot = { x: x + 9, y: y + 3 };
    // Anvil: horn to the left, a lit face and a dark foot.
    chamferRect(g, x - 1, y + 5.5, 6, 2.2, 1, shade(PLATE, -0.35));
    chamferRect(g, x - 1, y + 1, 8, 3.4, 1.4, shade(PLATE, 0.05));
    g.fillStyle(shade(PLATE, 0.05));
    g.fillTriangle(x - 9, y - 2.4, x - 14, y - 0.6, x - 9, y + 1.6);
    strip(g, x - 9, y - 2.4, 1, 0, 0, 16, 0, 1, 0, 1, shade(PLATE, 0.45));
    // Handle from the pivot and the hammer head across its end, turned to the arm.
    const head = at(pivot.x, pivot.y, Math.PI + arm, 12);
    litBar(g, pivot.x, pivot.y, Math.PI + arm, 0, 12, 1.1, 1.1, shade(c, -0.45));
    block(g, head.x, head.y, Math.PI / 2 + arm, 4.6, 2.8, 0.8, shade(c, -0.15));
    block(g, head.x - 0.4, head.y - 0.6, Math.PI / 2 + arm, 3.8, 1.6, 0.6, shade(c, 0.25));
    boss(g, pivot.x, pivot.y, 3, shade(c, -0.4));
    if (blow > 0) {
      halo(glow, x - 2, y - 3, 9, c, 0.3 * blow);
      for (let i = 0; i < 3 + level * 2; i++) {
        const a = -Math.PI / 2 + (hash01(t.id, i, Math.floor(clock / 1.4)) - 0.5) * 2.6,
          r = 4 + (1 - blow) * (8 + 6 * hash01(i, t.id));
        disc(g, x - 2 + Math.cos(a) * r, y - 3 + Math.sin(a) * r, 0.9, shade(c, 0.7), blow);
      }
    }
  },
  // A round strongroom door: its dial turns to and fro, the locking bolts gleam gold, one coin lamp per upgrade.
  vault: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      dial = Math.sin(clock * 0.9 + t.id) * 1.6;
    boss(g, x, y, 12.5, shade(PLATE, 0.05));
    ring(g, x, y, 12, 1.4, shade(c, -0.25), 0.9);
    // Locking bolts around the door.
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + Math.PI / 6;
      litBar(g, x, y, a, 9, 12.4, 1.2, 1.2, shade(c, -0.1), { shadow: false });
    }
    // Dial: graduated ring and a three-spoke handle.
    ring(g, x, y, 6.5, 1.2, DARK, 0.9);
    g.fillStyle(shade(c, 0.35));
    for (let i = 0; i < 12; i++) tick(g, x, y, dial + (i * Math.PI) / 6, 5.6, 7.2, 0.6);
    for (let i = 0; i < 3; i++) litBar(g, x, y, -dial * 1.3 + (i * TAU) / 3, 0, 6, 0.9, 0.7, shade(c, -0.3));
    dome(g, x, y, 2.6, c);
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, -Math.PI / 2 + (i - 1) * 0.45, 16);
      if (i < level + 1) {
        disc(g, p.x, p.y, 1.7, c);
        disc(glow, p.x, p.y, 3, c, 0.2);
      } else disc(g, p.x, p.y, 1.4, OUTLINE, 0.8);
    }
  },
  // An emitter dome under a shimmering hex bubble; the pips around it are the shield left this wave.
  shieldgen: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock } = ctx,
      c = d.color,
      amount = t.upgrades.reduce((a, id) => d.upgrades.find((u) => u.id === id)?.effects.attack?.amount ?? a, "amount" in d.attack ? d.attack.amount : 0),
      left = Math.max(0, amount - (t.barrier ?? 0)),
      share = amount > 0 ? left / amount : 0,
      shimmer = 0.5 + 0.5 * Math.sin(clock * 3 + t.id);
    // The bubble fades as the charge runs out.
    if (share > 0) {
      polygon(glow, x, y, 13, 6, c, clock * 0.2, (0.05 + 0.05 * shimmer) * share);
      hexLine(glow, x, y, 13, 1.4, c, (0.18 + 0.12 * shimmer) * share, clock * 0.2);
    }
    for (let i = 0; i < amount; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * TAU) / amount,
        p = at(x, y, a, 10.5);
      disc(g, p.x, p.y, 1.6, OUTLINE, 0.9);
      if (i < left) {
        disc(g, p.x, p.y, 1.1, shade(c, 0.4));
        disc(glow, p.x, p.y, 2.6, c, 0.25);
      }
    }
    dome(g, x, y, 6.5, shade(c, -0.15));
    disc(glow, x, y, 4, c, share > 0 ? 0.18 + 0.1 * shimmer : 0.05);
  },
  // A three-bladed shredder rotor; scrap chevrons orbit it the other way.
  recycler: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      spin = clock * (1.6 + 0.5 * level) + t.id;
    ring(g, x, y, 12.5, 1.6, OUTLINE, 0.7);
    for (let i = 0; i < 3; i++) {
      const a = -spin * 0.5 + (i * TAU) / 3,
        p = at(x, y, a, 12.5);
      polygon(g, p.x, p.y, 2.6, 3, c, a + Math.PI / 2, 0.9);
    }
    fins(g, x, y, [0, 1, 2].map((i) => spin + (i * TAU) / 3), 2, 10.5, 2.6, 1.2, shade(c, -0.25));
    boss(g, x, y, 4.5, shade(c, -0.45));
    disc(g, x, y, 2.4, c);
    disc(glow, x, y, 6, c, 0.12 + 0.04 * level);
  },
  // ── end g5 ──
};
/** Path motifs of Aura towers and specialized attack towers; `tier` (1–3) adds detail, `echo` repeats them in light. */
const MOTIFS: Record<PathMotif, (ctx: TurretContext, tier: number, time: number, echo?: number) => void> = {
  // Damage: pairs of blades turning slowly, each lit on the side that faces the light.
  blades: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    const blades = Array.from({ length: tier * 2 }, (_, i) => time * 0.5 + (i * TAU) / (tier * 2));
    fins(g, x, y, blades, 9, 18, 3.5, 0, c);
    if (!echo) return;
    glow.fillStyle(c, echo);
    for (const a of blades) quad(glow, x, y, Math.cos(a), Math.sin(a), 9, 18.5, -3.8, 3.8, 0, 0);
  },
  // Speed: spiral arms whirling faster per tier.
  vortex: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    const arms = tier + 1,
      inks = echo ? [glow, g] : [g];
    glow.lineStyle(4, c, echo);
    g.lineStyle(2, c, 0.85);
    for (const ink of inks) {
      ink.beginPath();
      for (let i = 0; i < arms; i++) {
        const start = time * (2 + tier) + (i * TAU) / arms;
        for (let k = 0; k < 8; k++) {
          const a = start + k * 0.17,
            r = 7 + k * 1.45;
          if (k) ink.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          else ink.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
      }
      ink.strokePath();
    }
  },
  // Range: rings pulsing outwards, fading at the plate edge.
  rings: ({ g, glow, x, y, color: c }, tier, time, echo = 0) => {
    for (let i = 0; i < tier; i++) {
      const phase = (time * 0.6 + i / tier) % 1,
        r = 9 + phase * 13;
      ring(g, x, y, r, 1.5, c, (1 - phase) * 0.85);
      if (echo) ring(glow, x, y, r, 3, c, echo * (1 - phase));
    }
  },
};
export interface TowerBadges {
  /** Level for attack towers, number of purchases for support towers. */
  markers: number;
  /** No upgrade left to buy. */
  maxed: boolean;
  boosted: boolean;
  /** Display colour, see `towerColor`. */
  color: number;
  path?: string;
}
/** Ink that drops every call: the still body of a baked tower is not drawn again, its light still is. */
const NO_INK = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : () => NO_INK) });
function turretContext(pen: Pen, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges): TurretContext {
  const p = badges.color,
    level = badges.markers,
    attack = definition.placement !== "path" && definition.targets.length > 0;
  return {
    g: pen.g,
    glow: pen.glow,
    x,
    y,
    tower,
    definition,
    clock,
    level,
    maxed: badges.maxed,
    color: p,
    path: badges.path,
    kick: Math.max(0, (tower.cooldown - 0.7) / 0.3),
    charge: 1 - tower.cooldown,
    tip: attack && level >= 6 ? p : attack && level >= 5 ? shade(definition.color, 0.35) : undefined,
    energy: attack && level >= 5 ? 0.15 : 0,
    peak: badges.maxed ? 0.42 : 0.6,
  };
}
/** The part of a tower that holds still on `g`: shadow, base plate, collar and the r14 ring (the base's light is live). */
function drawBody(ctx: TurretContext) {
  const { g, glow, x, y, definition, level, color: p } = ctx,
    // Traps lie flat on the path: no shadow, no collar and no turret rings.
    trap = definition.placement === "path",
    attack = !trap && definition.targets.length > 0;
  if (!trap) {
    oval(g, x + 3, y + 6, 22, 15.5, SHADOW, 0.22);
    oval(g, x + 3, y + 6, 18, 12, SHADOW, 0.3);
  }
  BASES[definition.visual.turret](ctx);
  // Level language: a collar from level 2, the r14 ring echoed in light from level 5.
  if (!trap) {
    if (level >= 2) {
      ring(g, x, y, 17, 2.2, DARK);
      arcBand(g, x, y, 17.3, 0.9, LIGHT - 0.9, LIGHT + 0.9, shade(p, 0.25), 0.85);
    }
    ring(g, x, y, 14, 1.5, p, 0.6);
    if (attack && level >= 5) ring(glow, x, y, 14, 2, p, 0.35);
  }
}
/** Everything that moves or changes on its own: the glint, motif, lamps, turret, level bars and the aura badge. */
function drawTop(ctx: TurretContext, badges: TowerBadges) {
  const { g, glow, x, y, tower, definition, clock, level, color: p } = ctx,
    trap = definition.placement === "path";
  if (badges.maxed) halo(glow, x, y, 26, p, 0.12 + 0.04 * Math.sin(clock * 2 + tower.id));
  // A glint sweeps the collar at level 8.
  if (!trap && level >= 8) arcBand(g, x, y, 17, 1.6, clock * 0.8 + tower.id, clock * 0.8 + tower.id + 0.5, shade(p, 0.8), 0.9);
  // Specialized attack towers: the path motif turns under the turret, one tier per level above 5, echoed in light.
  const motif = badges.path && definition.attack.kind !== "aura" ? definition.visual.paths?.[badges.path]?.motif : undefined;
  if (motif) {
    const tier = Math.min(3, Math.max(1, level - 5));
    MOTIFS[motif](ctx, tier, clock + tower.id, 0.06 + 0.06 * tier);
  }
  // One lamp from level 2; from level 4 four of them chase round the collar.
  if (!trap && level >= 4) {
    g.fillStyle(OUTLINE, 0.9);
    for (let i = 0; i < 4; i++) {
      const q = at(x, y, 0.75 * Math.PI + (i * Math.PI) / 2, 19);
      pip(g, q.x, q.y, 2.2);
    }
    for (let i = 0; i < 4; i++) {
      const q = at(x, y, 0.75 * Math.PI + (i * Math.PI) / 2, 19),
        on = 0.35 + 0.65 * Math.max(0, Math.sin(4 * clock - (i * Math.PI) / 2));
      g.fillStyle(shade(p, -0.7 * (1 - on)));
      pip(g, q.x, q.y, 1.4);
      if (on <= 0.5) continue;
      glow.fillStyle(p, 0.3 * on);
      pip(glow, q.x, q.y, 3.6);
    }
  } else if (!trap && level >= 2) {
    const q = at(x, y, 0.75 * Math.PI, 19);
    led(ctx, q.x, q.y, p, 1);
  }
  TURRETS[definition.visual.turret](ctx);
  // Up to 8 levels: narrower steps keep the row inside the cell.
  const step = level > 5 ? 5 : 6;
  g.fillStyle(p);
  for (let i = 0; i < level; i++) g.fillRect(x - (level * step - 2) / 2 + i * step, y + 20, step - 2, 3);
  if (badges.boosted) {
    disc(g, x + 19, y - 18, 6, 0x0c202a);
    loop(g, x + 19, y - 18, 5, 1.5, 0x78dfff);
    g.lineStyle(1.5, 0x78dfff);
    g.lineBetween(x + 16, y - 18, x + 22, y - 18);
    g.lineBetween(x + 19, y - 21, x + 19, y - 15);
  }
}
/** `baked`: the still body is already on screen as a texture (`stillBody`), so only its light is drawn here. */
export function drawTower(pen: Pen, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges, baked = false) {
  const ctx = turretContext(pen, x, y, tower, definition, clock, badges);
  drawBody(baked ? { ...ctx, g: NO_INK } : ctx);
  drawTop(ctx, badges);
}
/** Draws only the still body (on `g`, centred on `x`, `y`), for baking it into a texture. */
export function drawTowerBody(g: Ink, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
  drawBody(turretContext({ g, glow: NO_INK }, x, y, tower, definition, 0, badges));
}
/** Cache key of a still body: everything `drawBody` reads apart from time and the tower's own state. */
export const bodyKey = (tower: Tower, badges: TowerBadges) => `${tower.type}|${badges.markers}|${badges.color}|${badges.maxed ? 1 : 0}|${badges.path ?? ""}`;
const still = new Map<string, boolean>();
/** Every call `drawBody` makes on `g`, with its arguments as they were at the call. */
function record(tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges) {
  const log: string[] = [],
    ink: Ink = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : (...args: unknown[]) => (log.push(String(name), JSON.stringify(args)), ink)) });
  drawBody(turretContext({ g: ink, glow: NO_INK }, 0, 0, tower, definition, clock, badges));
  return log.join("\n");
}
/**
 * Whether a tower's body ink depends only on `bodyKey`, so it can be baked once and shared: it is drawn twice with
 * different time, id, cooldown and angle and must come out the same. Bases that animate their metal stay live.
 */
export function stillBody(tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
  const key = bodyKey(tower, badges);
  let known = still.get(key);
  if (known === undefined) {
    const a = record({ ...tower, id: 1, cooldown: 0, angle: 0 }, definition, 0, badges),
      b = record({ ...tower, id: 7, cooldown: 0.9, angle: 1.9 }, definition, 2.345, badges);
    known = a === b;
    still.set(key, known);
  }
  return known;
}
