import type { Point } from "../core/types";
import { disc, hash01, type Ink, lightning, oval, type Pen, shade } from "./shapes";
import { halo } from "./material";
import { blend } from "./ground";
import { SQUASH, X, Y, block, drum } from "./tower-art/tilt";
import { rod } from "./tower-art/tilt-frame";

// The entry and the reactor in the towers' 3/4 tilt. The entry is a warp breach: a raised platform round a dark
// hollow with three pylons leaning in over it, open on the side the path leaves by. The reactor is a power core: a
// hexagonal plinth, a banded glass cylinder, three coolant pylons wired to it and an emitter on top. `drawGateBases`
// is their still body, baked with the terrain; `drawGateLife` is their animation on the ambient layer (vortex,
// lightning between the pylons, the core's pulse, a turning hologram ring, the alarm).

export const DANGER = 0xff647c;
/** Pylons of the breach, in degrees off the direction the path leaves by (the exit side stays open). */
const PYLONS = [70, 180, 290].map((d) => (d * Math.PI) / 180);
const BREACH = { rim: 24, hole: 16, deck: 5, pylon: 34 } as const;
const CORE = { plinth: 7, glass0: 12, glass1: 36, cap: 40, spike: 50, ring: 60, radius: 12, pylon: 26, reach: 19 } as const;
const STEEL = { deep: 0x1e262c, side: 0x34404a, top: 0x4c5a64, light: 0x7a8a94 } as const;

/** Ground point of a gate on the cell centre (x, y): a little low, so its height reads into the cell above. */
const ground = (p: Point) => ({ gx: p.x, gy: p.y + 6 });
/** Where a breach pylon stands and where its emitter tip floats, for a path leaving at `heading`. */
function pylon(gx: number, gy: number, heading: number, a: number) {
  const t = heading + a;
  return {
    foot: { u: Math.cos(t) * (BREACH.rim - 3), v: Math.sin(t) * (BREACH.rim - 3) },
    tip: { u: Math.cos(t) * (BREACH.hole - 2), v: Math.sin(t) * (BREACH.hole - 2) },
    tipScreen: { x: X(gx, Math.cos(t) * (BREACH.hole - 2)), y: Y(gy, Math.sin(t) * (BREACH.hole - 2), BREACH.pylon) },
    depth: Math.sin(t),
  };
}
const hexagon = (r: number) => {
  const f = new Float64Array(12);
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + Math.PI / 6;
    f[2 * i] = Math.cos(t) * r;
    f[2 * i + 1] = Math.sin(t) * r;
  }
  return f;
};
const PLINTH = hexagon(26),
  PLINTH_TOP = hexagon(21);
/** Where a coolant pylon of the core stands (ground offset) and its lamp sits on screen. */
function coolant(gx: number, gy: number, i: number) {
  const t = -Math.PI / 2 + (i * Math.PI * 2) / 3 + Math.PI / 3,
    u = Math.cos(t) * CORE.reach,
    v = Math.sin(t) * CORE.reach;
  return { u, v, lamp: { x: X(gx, u), y: Y(gy, v, CORE.pylon + 2) }, depth: Math.sin(t) };
}

/** The breach's still body: shadow, platform, the dark hollow, hazard chevrons on the deck and the three pylons. */
function breachBase(g: Ink, start: Point, heading: number, color: number) {
  const { gx, gy } = ground(start),
    pylons = PYLONS.map((a) => pylon(gx, gy, heading, a)).sort((p, q) => p.depth - q.depth),
    stand = (p: (typeof pylons)[number]) => {
      rod(g, gx, gy, p.foot.u, p.foot.v, BREACH.deck, p.tip.u, p.tip.v, BREACH.pylon - 3, 4.4, STEEL.side);
      rod(g, gx, gy, p.foot.u * 1.02, p.foot.v * 1.02, BREACH.deck, p.foot.u * 1.02, p.foot.v * 1.02, BREACH.deck + 7, 4.6, STEEL.deep);
      drum(g, p.tipScreen.x, Y(gy, p.tip.v, 0), 3.8, BREACH.pylon - 4, BREACH.pylon + 2, STEEL.deep, STEEL.top, 8);
    };
  for (const k of [0.4, 0.8]) oval(g, gx + 5 * k, gy + 3 * k, BREACH.rim + 4, (BREACH.rim + 4) * SQUASH, 0x000000, 0.18);
  drum(g, gx, gy, BREACH.rim, 0, BREACH.deck, STEEL.side, STEEL.top, 18);
  // Hazard chevrons round the deck, pointing out along the path.
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2,
      r0 = BREACH.hole + 2,
      r1 = BREACH.rim - 1.5;
    g.fillStyle(i % 2 ? 0x1a1e22 : shade(color, -0.15), 0.9);
    g.fillPoints(
      [
        { x: X(gx, Math.cos(t) * r0), y: Y(gy, Math.sin(t) * r0, BREACH.deck) },
        { x: X(gx, Math.cos(t + 0.26) * r0), y: Y(gy, Math.sin(t + 0.26) * r0, BREACH.deck) },
        { x: X(gx, Math.cos(t + 0.26) * r1), y: Y(gy, Math.sin(t + 0.26) * r1, BREACH.deck) },
        { x: X(gx, Math.cos(t) * r1), y: Y(gy, Math.sin(t) * r1, BREACH.deck) },
      ],
      true,
    );
  }
  // The hollow: a lip, then darkness falling away inside.
  oval(g, gx, Y(gy, 0, BREACH.deck), BREACH.hole + 1.6, (BREACH.hole + 1.6) * SQUASH, STEEL.light);
  for (let k = 0; k < 4; k++) {
    const r = BREACH.hole - k * 2.6;
    oval(g, gx + k * 0.4, Y(gy, 0, BREACH.deck) + k * 0.8, r, r * SQUASH, blend(0x0a0d10, 0x020304, k / 3));
  }
  // An arrow on the open side, showing where the enemies leave.
  const ax = Math.cos(heading),
    ay = Math.sin(heading),
    tip = { x: X(gx, ax * (BREACH.rim + 7)), y: Y(gy, ay * (BREACH.rim + 7), 0.5) },
    side = (s: number) => ({ x: X(gx, ax * (BREACH.rim + 1) - ay * s * 5), y: Y(gy, ay * (BREACH.rim + 1) + ax * s * 5, 0.5) });
  g.fillStyle(color, 0.85);
  g.fillTriangle(tip.x, tip.y, side(1).x, side(1).y, side(-1).x, side(-1).y);
  for (const p of pylons) if (p.depth < 0) stand(p);
  for (const p of pylons) if (p.depth >= 0) stand(p);
}
/** The core's still body: shadow, hexagonal plinth, coolant pylons wired in, the banded glass cylinder, cap and spike. */
function coreBase(g: Ink, end: Point, accent: number) {
  const { gx, gy } = ground(end),
    pylons = [0, 1, 2].map((i) => coolant(gx, gy, i)).sort((p, q) => p.depth - q.depth),
    stand = (p: (typeof pylons)[number]) => {
      rod(g, gx, gy, p.u, p.v, CORE.pylon - 6, p.u * 0.45, p.v * 0.45, CORE.pylon - 2, 2, STEEL.light);
      drum(g, X(gx, p.u), Y(gy, p.v, 0), 4, CORE.plinth, CORE.pylon, STEEL.side, STEEL.top, 10);
      drum(g, X(gx, p.u), Y(gy, p.v, 0), 4.8, CORE.pylon, CORE.pylon + 2.5, STEEL.deep, STEEL.light, 10);
    };
  for (const k of [0.4, 0.8]) oval(g, gx + 10 * k, gy + 6 * k, 30, 30 * SQUASH, 0x000000, 0.18);
  block(g, gx, gy, PLINTH, PLINTH_TOP, 6, 0, CORE.plinth - 2, 2, STEEL.side, STEEL.top, STEEL.light);
  for (const p of pylons) if (p.depth < 0) stand(p);
  drum(g, gx, gy, CORE.radius + 2, CORE.plinth, CORE.glass0, STEEL.deep, STEEL.top, 14);
  drum(g, gx, gy, CORE.radius, CORE.glass0, CORE.glass1, shade(accent, -0.72), shade(accent, -0.5), 14);
  for (const h of [CORE.glass0, (CORE.glass0 + CORE.glass1) / 2, CORE.glass1]) drum(g, gx, gy, CORE.radius + 1.2, h - 1, h + 1, STEEL.side, STEEL.top, 14);
  drum(g, gx, gy, CORE.radius - 1, CORE.glass1 + 1, CORE.cap, STEEL.side, STEEL.top, 12);
  rod(g, gx, gy, 0, 0, CORE.cap, 0, 0, CORE.spike, 1.8, STEEL.light);
  for (const p of pylons) if (p.depth >= 0) stand(p);
}
/** The still bodies of the entry breach and (with a reactor) the power core, for the baked terrain. */
export function drawGateBases(g: Ink, path: readonly Point[], loop: boolean, accent: number) {
  const start = path[0],
    heading = Math.atan2(path[1].y - start.y, path[1].x - start.x);
  breachBase(g, start, heading, loop ? accent : 0xf0cf87);
  if (!loop) coreBase(g, path[path.length - 1], accent);
}

/** A spiral arm of the vortex laid flat in the breach's hollow. */
function arm(g: Ink, gx: number, gy: number, a: number, color: number, alpha: number) {
  const pts: { x: number; y: number }[] = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10,
      r = BREACH.hole * (1 - t * 0.85),
      ang = a + t * 2.4;
    pts.push({ x: gx + Math.cos(ang) * r, y: gy + Math.sin(ang) * r * SQUASH });
  }
  g.lineStyle(2.2, color, alpha);
  g.strokePoints(pts, false);
}
/**
 * The live part of the gates, drawn every frame on the ambient layer: the breach's vortex, its light column and the
 * lightning crawling between the pylon tips; the core's pulse behind its glass, plasma bands rising, the coolant
 * lamps blinking in turn and a hologram ring turning over the spike. `alarm` (0 to 1) turns the core red and quickens
 * it (a ring map has no core, so its breach takes the alarm). `still` (reduced motion) freezes it.
 */
export function drawGateLife({ g, glow }: Pen, path: readonly Point[], loop: boolean, accent: number, clock: number, still: boolean, alarm: number, lit: number) {
  const t = still ? 0 : clock,
    danger = Math.max(0, Math.min(1, alarm)),
    start = path[0],
    heading = Math.atan2(path[1].y - start.y, path[1].x - start.x),
    portal = loop ? (danger > 0 ? blend(accent, DANGER, danger) : accent) : 0xf0cf87,
    { gx, gy } = ground(start),
    hy = Y(gy, 0, BREACH.deck);
  // Vortex: three arms turning in the hollow, a hot core and a faint column of light.
  for (let i = 0; i < 3; i++) {
    const a = -t * 1.8 + (i * Math.PI * 2) / 3;
    arm(glow, gx, hy, a, portal, 0.28 * lit);
    arm(g, gx, hy, a + 0.3, portal, 0.35);
  }
  disc(glow, gx, hy, 5, portal, (0.25 + 0.08 * Math.sin(t * 3)) * lit);
  glow.fillStyle(portal, 0.06 * lit);
  glow.fillPoints([{ x: gx - BREACH.hole * 0.7, y: hy }, { x: gx + BREACH.hole * 0.7, y: hy }, { x: gx + 3, y: hy - 46 }, { x: gx - 3, y: hy - 46 }], true);
  const tips = PYLONS.map((a) => pylon(gx, gy, heading, a).tipScreen);
  for (const tip of tips) {
    halo(glow, tip.x, tip.y, 7, portal, (0.2 + 0.08 * Math.sin(t * 5 + tip.x)) * lit);
    disc(g, tip.x, tip.y, 1.6, 0xfff4dc);
  }
  if (!still) {
    const beat = Math.floor(t * 9),
      i = beat % 3;
    if (hash01(beat, start.x) < 0.7) lightning({ g, glow }, tips[i].x, tips[i].y, tips[(i + 1) % 3].x, tips[(i + 1) % 3].y, portal, 0.7 * lit, beat, false);
  }
  if (loop) return;
  // Core: the glow behind the glass beats, bands of plasma rise, the coolant lamps chase, a hologram ring turns.
  const end = path[path.length - 1],
    c = ground(end),
    color = danger > 0 ? blend(accent, DANGER, danger) : accent,
    speed = 1 + danger * 1.5,
    beat = 0.5 + 0.5 * Math.sin(t * 2.2 * speed),
    left = X(c.gx, -CORE.radius + 1.6),
    right = X(c.gx, CORE.radius - 1.6),
    top = Y(c.gy, CORE.radius * 0.6, CORE.glass1 - 1.5),
    bottom = Y(c.gy, CORE.radius * 0.6, CORE.glass0 + 1.5);
  g.fillStyle(color, 0.45 + 0.3 * beat);
  g.fillRect(left, top, right - left, bottom - top);
  for (let k = 0; k < 3; k++) {
    const f = (t * 0.6 * speed + k / 3) % 1,
      y = bottom - (bottom - top) * f;
    g.fillStyle(0xffffff, 0.35 * Math.sin(Math.PI * f));
    g.fillRect(left, y - 1, right - left, 2);
  }
  g.fillStyle(0xffffff, 0.75);
  g.fillRect(c.gx - 1.2, top, 2.4, bottom - top);
  halo(glow, c.gx, (top + bottom) / 2, 26 + 6 * danger, color, (0.14 + 0.12 * beat + 0.12 * danger) * lit);
  for (let i = 0; i < 3; i++) {
    const p = coolant(c.gx, c.gy, i),
      on = Math.floor(t * 3 * speed) % 3 === i ? 1 : 0.25;
    disc(glow, p.lamp.x, p.lamp.y, 5, color, 0.3 * on * lit);
    disc(g, p.lamp.x, p.lamp.y, 1.4, on > 0.5 ? 0xffffff : shade(color, -0.4));
  }
  // Hologram ring over the spike: a dashed ellipse turning, brightest on its front.
  const ry = Y(c.gy, 0, CORE.ring);
  for (let k = 0; k < 12; k++) {
    const a0 = t * 0.9 * speed + (k / 12) * Math.PI * 2,
      a1 = a0 + 0.3,
      front = 0.5 + 0.5 * Math.sin((a0 + a1) / 2);
    glow.lineStyle(1.8, color, (0.12 + 0.3 * front) * lit);
    glow.lineBetween(c.gx + Math.cos(a0) * 15, ry + Math.sin(a0) * 15 * SQUASH, c.gx + Math.cos(a1) * 15, ry + Math.sin(a1) * 15 * SQUASH);
  }
  disc(g, c.gx, Y(c.gy, 0, CORE.spike), 1.6, 0xffffff, 0.6 + 0.4 * beat);
  if (danger > 0) {
    halo(glow, c.gx, Y(c.gy, 0, CORE.spike), 12, DANGER, 0.3 * danger * (0.5 + 0.5 * Math.sin(t * 8)) * lit);
    oval(g, c.gx, c.gy, 32 + 3 * beat, (32 + 3 * beat) * SQUASH, DANGER, 0.12 * danger);
  }
}
