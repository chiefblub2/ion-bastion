import { disc, hash01, type Ink, oval, shade } from "../shapes";
import { OUTLINE, SQUASH, X, Y, block, drum } from "../tower-art/tilt";
import { box, frame, rod } from "../tower-art/tilt-frame";
import type { Random } from "./kit";

// The props of the Deep Sea (`abyss.ts`), the dark floor of an ocean trench, drawn in the towers' 3/4 tilt: branching
// coral with glowing tips, hydrothermal vent chimneys, giant clams, tube worm thickets and kelp; a sunken shipwreck and
// a black smoker mound as landmarks. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into
// a plain record; its bioluminescence, vent glow and bubbles live in the theme's ambient.

/** Shadows on the seabed are faint: light comes from far above through water. */
export const SHADE = 0x00040a;
export const SUN = { x: 0.35, y: 0.2 } as const;
export const GLOW = 0x3df2e0;
export const VENT = 0xff9a4a;
const ROCK = { wall: 0x16222e, top: 0x24384a } as const;
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.26) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
const RF = new Float64Array(16),
  RI = new Float64Array(16);
/** A lumpy seabed rock of six corners. */
export function rock(g: Ink, x: number, y: number, r: number, h: number, seed: number, wall: number = ROCK.wall, top: number = ROCK.top) {
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + hash01(seed) * 2,
      k = 0.75 + hash01(seed, i) * 0.25;
    RF[2 * i] = Math.cos(t) * r * k;
    RF[2 * i + 1] = Math.sin(t) * r * k;
    RI[2 * i] = RF[2 * i] * 0.62;
    RI[2 * i + 1] = RF[2 * i + 1] * 0.62;
  }
  block(g, x, y, RF, RI, 6, 0, h * 0.6, h * 0.4, wall, top, shade(top, 0.25));
}

// ── Coral ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Branch { a: number; h: number; spread: number }
export interface Coral { color: number; tip: number; branches: Branch[]; rock: number }
const CORALS = [[0x1f5a6e, 0xff7aa8], [0x5a2a5e, 0xffb04a], [0x2a5a4a, 0x7af8ea], [0x6a3a3a, 0xff9ad8]] as const;
export function coralOf(rand: Random): Coral {
  const [color, tip] = CORALS[Math.floor(rand() * CORALS.length)];
  return {
    color,
    tip,
    branches: Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, i) => ({ a: (i / 5) * Math.PI * 2 + rand(), h: 16 + rand() * 14, spread: 6 + rand() * 6 })),
    rock: Math.floor(rand() * 1e6),
  };
}
/** The coral's glowing tips (ground u, v, height), for the ambient. */
export function coralTips(c: Coral) {
  return c.branches.map((b) => ({ u: Math.cos(b.a) * b.spread, v: Math.sin(b.a) * b.spread * 0.8, h: b.h }));
}
/** Branching coral on a rock: thick limbs forking up from a knot, each ending in a glowing polyp tip. */
export function drawCoral(g: Ink, gx: number, gy: number, c: Coral) {
  rock(g, gx, gy, 9, 6, c.rock);
  const order = coralTips(c)
    .map((t, i) => ({ ...t, i }))
    .sort((p, q) => p.v - q.v);
  for (const t of order) {
    const mu = t.u * 0.45,
      mv = t.v * 0.45,
      mh = 5 + t.h * 0.45;
    rod(g, gx, gy, 0, 0, 5, mu, mv, mh, 3.6, c.color);
    rod(g, gx, gy, mu, mv, mh, t.u, t.v, t.h, 2.4, shade(c.color, 0.1));
    // A side twig off each limb.
    rod(g, gx, gy, mu, mv, mh, mu * 1.6 - t.v * 0.25, mv * 1.6 + t.u * 0.25, mh + 6, 1.4, shade(c.color, 0.15));
    disc(g, X(gx, t.u), Y(gy, t.v, t.h), 2.6, OUTLINE, 0.8);
    disc(g, X(gx, t.u), Y(gy, t.v, t.h), 2.1, c.tip);
    disc(g, X(gx, t.u) - 0.7, Y(gy, t.v, t.h) - 0.7, 0.8, 0xffffff, 0.7);
  }
}
export function coralShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 12, 20);
}

// ── Vent chimney ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Vent { u: number; v: number; h: number; r: number }
export function ventsOf(rand: Random): Vent[] {
  const n = rand() < 0.5 ? 1 : 2,
    spots = n === 1 ? [[0, -2]] : [[-7, -5], [8, 4]];
  return spots.map(([u, v], i) => ({ u, v, h: (i ? 16 : 24) + rand() * 8, r: (i ? 5 : 6.5) + rand() * 1.5 })).sort((p, q) => p.v - q.v);
}
/** Where the vents' mouths glow (screen offsets from the ground point). */
export const ventMouths = (list: readonly Vent[]) => list.map((v) => ({ x: v.u, y: Y(v.v * SQUASH, 0, v.h), r: v.r }));
/** Hydrothermal chimneys: lumpy mineral stacks narrowing to a glowing mouth, crusted with sulphide streaks. */
export function drawVents(g: Ink, gx: number, gy: number, list: readonly Vent[]) {
  for (const v of list) {
    const x = gx + v.u,
      y = gy + v.v * SQUASH,
      steps = 6;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps,
        t1 = (i + 1) / steps,
        r = v.r * (1.4 - 0.75 * t0) + (hash01(v.u, i) - 0.5) * 1.2;
      drum(g, x, y, r, v.h * t0, v.h * t1 + 0.5, shade(0x1e2a36, -0.08 * (i % 2)), shade(0x2a3a4a, 0.04 * i), 12);
    }
    for (let i = 0; i < 3; i++) {
      const a = 0.4 + i * 0.9,
        r = v.r * 1.1;
      g.lineStyle(1.4, 0x8a4a1a, 0.8);
      g.lineBetween(X(x, Math.cos(a) * r), Y(y, Math.sin(a) * r, v.h * 0.15), X(x, Math.cos(a) * r * 0.8), Y(y, Math.sin(a) * r * 0.8, v.h * 0.6));
    }
    const my = Y(y, 0, v.h);
    oval(g, x, my, v.r * 0.7, v.r * 0.7 * SQUASH, 0x1a0c06);
    oval(g, x, my + 0.4, v.r * 0.45, v.r * 0.45 * SQUASH, VENT);
    oval(g, x, my + 0.6, v.r * 0.22, v.r * 0.22 * SQUASH, 0xffe0a0);
  }
}
export function ventsShadow(g: Ink, gx: number, gy: number, list: readonly Vent[]) {
  for (const v of list) roundShadow(g, gx + v.u, gy + v.v * SQUASH, v.r * 1.5, v.h);
}

// ── Giant clam ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Clam { a: number; pearl: boolean; rocks: number }
export const clamOf = (rand: Random): Clam => ({ a: (rand() - 0.5) * 0.8, pearl: rand() < 0.5, rocks: Math.floor(rand() * 1e6) });
/** Where the clam's mantle glows (screen offset from its ground point). */
export const clamGlow = (c: Clam) => ({ x: Math.sin(c.a) * 2, y: -4 });
/** A giant clam half open: the ribbed upper shell tipped up behind, a glowing blue mantle (a pearl on some), the lower shell in front. */
export function drawClam(g: Ink, gx: number, gy: number, c: Clam) {
  rock(g, gx - 13, gy - 6, 5, 4, c.rocks);
  const cx = gx + Math.sin(c.a) * 2,
    lip = gy - 4,
    arc = (rx: number, ry: number, y: number, a0: number, a1: number) =>
      Array.from({ length: 15 }, (_, i) => {
        const t = a0 + ((a1 - a0) * i) / 14;
        return { x: cx + Math.cos(t) * rx, y: y + Math.sin(t) * ry };
      }),
    ribs = (from: { x: number; y: number }, pts: { x: number; y: number }[], color: number) => {
      g.lineStyle(0.8, color, 0.9);
      for (let i = 2; i < pts.length - 1; i += 2) g.lineBetween(from.x, from.y, pts[i].x, pts[i].y);
    };
  const upper = arc(14, 13, lip, Math.PI, Math.PI * 2);
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints(arc(14.8, 13.8, lip, Math.PI, Math.PI * 2), true);
  g.fillStyle(0x6a7a8a);
  g.fillPoints(upper, true);
  ribs({ x: cx, y: lip }, upper, 0x4a5a6a);
  oval(g, cx, lip, 12.5, 4.2, 0x1a5a8a);
  oval(g, cx, lip, 9.5, 3, 0x3ab8e0);
  if (c.pearl) disc(g, cx + 1.5, lip - 0.6, 2, 0xf0f4f8);
  const lower = arc(14, 7, lip, 0, Math.PI);
  g.fillStyle(OUTLINE, 0.9);
  g.fillPoints(arc(14.8, 7.8, lip, 0, Math.PI), true);
  g.fillStyle(0x8a9aa8);
  g.fillPoints(lower, true);
  ribs({ x: cx, y: lip - 3 }, lower, 0x5a6a7a);
}
export function clamShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 15, 8);
}

// ── Tube worms ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Worm { u: number; v: number; h: number }
export function wormsOf(rand: Random): Worm[] {
  return Array.from({ length: 7 + Math.floor(rand() * 5) }, () => {
    const a = rand() * Math.PI * 2,
      d = rand() * 11;
    return { u: Math.cos(a) * d, v: Math.sin(a) * d * 0.8, h: 10 + rand() * 14 };
  }).sort((p, q) => p.v - q.v);
}
/** A thicket of giant tube worms: white chitin tubes rising from a mineral crust, each with a red plume at the top. */
export function drawWorms(g: Ink, gx: number, gy: number, list: readonly Worm[]) {
  oval(g, gx, gy + 1, 15, 8, 0x2a3a3a, 0.95);
  for (const w of list) {
    const x = gx + w.u,
      y = gy + w.v * SQUASH;
    drum(g, x, y, 1.5, 0, w.h, 0xc8ccc0, 0xe8ece0, 8);
    for (let k = 0; k < 3; k++) {
      const t = (k / 3) * Math.PI * 2;
      disc(g, x + Math.cos(t) * 1.5, Y(y, Math.sin(t) * 1.2, w.h + 1.2), 1.4, 0xd83a3a);
    }
    disc(g, x, Y(y, 0, w.h + 1.8), 1.2, 0xff6a5a);
  }
}
export function wormsShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy, 14, 16);
}

// ── Kelp ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Kelp { u: number; v: number; h: number; lean: number }
export function kelpOf(rand: Random): Kelp[] {
  return Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({ u: (rand() - 0.5) * 22, v: (rand() - 0.5) * 14, h: 26 + rand() * 18, lean: (rand() - 0.5) * 8 })).sort((p, q) => p.v - q.v);
}
/** Kelp stalks rising from a holdfast on a rock, broad blades along them, a gas bladder at each blade's root. */
export function drawKelp(g: Ink, gx: number, gy: number, list: readonly Kelp[]) {
  rock(g, gx, gy + 2, 7, 4, list.length * 31);
  for (const k of list) {
    const x = gx + k.u,
      y = gy + k.v * SQUASH,
      pts = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return { x: x + Math.sin(t * 3 + k.u) * 3 + k.lean * t, y: y - k.h * t };
      });
    g.lineStyle(2.4, OUTLINE, 0.6);
    g.strokePoints(pts, false);
    g.lineStyle(1.6, 0x4a6a2a);
    g.strokePoints(pts, false);
    for (let i = 1; i < 6; i++) {
      const p = pts[i],
        s = i % 2 ? 1 : -1;
      g.fillStyle(i % 2 ? 0x5a7a2a : 0x4a6a24, 0.95);
      g.fillTriangle(p.x, p.y, p.x + s * 7, p.y - 3, p.x + s * 2, p.y - 6);
      disc(g, p.x, p.y, 1, 0x8a8a3a);
    }
  }
}
export function kelpShadow(g: Ink, gx: number, gy: number) {
  roundShadow(g, gx, gy + 2, 12, 12);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the shipwreck's lantern still glows (ground u, v, height at full size). */
export const WRECK = { lantern: { u: -20, v: -6, h: 44 } } as const;
const HULL = 0x4a3a2c;
/** A point on the hull profile at t ∈ [0, 1] from stern to bow: its deck line and its keel (screen offsets). */
function hullAt(t: number) {
  const x = -40 + 80 * t,
    sheer = -24 - 6 * t * t,
    keel = -2 - 10 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (t < 0.9 ? 1 : 0.4) + (t > 0.85 ? (t - 0.85) * 60 : 0);
  return { x, deck: sheer, keel: Math.min(keel, sheer + 26) };
}
/**
 * A sunken shipwreck settled upright in the silt: a wooden hull in profile with a raised bow, planking, a row of
 * portholes, broken open amidships so its ribs show, the deck seen from above, a snapped mast leaning aft with torn
 * rigging and a lantern still hanging on it, coral grown over the bow and silt banked along its keel.
 */
export function drawWreck(g: Ink) {
  const n = 16,
    pts = Array.from({ length: n + 1 }, (_, i) => hullAt(i / n)),
    gap = (t: number) => t > 0.42 && t < 0.58,
    deckDepth = 10;
  // The deck seen from above: the sheer line raised back by the hull's beam.
  g.fillStyle(0x2a2018);
  g.fillPoints([...pts.map((p) => ({ x: p.x, y: p.deck })), ...pts.map((p, i) => ({ x: p.x + 2, y: p.deck - deckDepth * Math.sin(Math.PI * Math.min(1, (i / n) * 1.05)) * 0.9 })).reverse()], true);
  g.lineStyle(0.7, 0x3a2e22, 0.9);
  for (let k = 1; k < 4; k++) g.strokePoints(pts.map((p, i) => ({ x: p.x + 0.5 * k, y: p.deck - (deckDepth * k / 4) * Math.sin(Math.PI * Math.min(1, (i / n) * 1.05)) * 0.9 })), false);
  // The hull side, in two halves either side of the break.
  for (const half of [pts.filter((_, i) => i / n <= 0.42), pts.filter((_, i) => i / n >= 0.58)]) {
    g.fillStyle(0x0a0806, 0.9);
    g.fillPoints([...half.map((p) => ({ x: p.x, y: p.deck - 0.8 })), ...half.map((p) => ({ x: p.x, y: p.keel + 0.8 })).reverse()], true);
    g.fillStyle(HULL);
    g.fillPoints([...half.map((p) => ({ x: p.x, y: p.deck })), ...half.map((p) => ({ x: p.x, y: p.keel })).reverse()], true);
    g.lineStyle(0.7, 0x2a2018, 0.9);
    for (let k = 1; k < 5; k++) g.strokePoints(half.map((p) => ({ x: p.x, y: p.deck + (p.keel - p.deck) * (k / 5) })), false);
    g.lineStyle(1.4, shade(HULL, 0.25), 0.9);
    g.strokePoints(half.map((p) => ({ x: p.x, y: p.deck + 0.6 })), false);
  }
  // The break: dark inside and the ribs standing across it.
  const l = hullAt(0.42),
    r = hullAt(0.58);
  g.fillStyle(0x0a0e12);
  g.fillPoints([{ x: l.x, y: l.deck + 2 }, { x: r.x, y: r.deck + 4 }, { x: r.x, y: r.keel }, { x: l.x, y: l.keel }], true);
  for (let i = 0; i < 4; i++) {
    const p = hullAt(0.44 + i * 0.04);
    g.lineStyle(1.8, 0x5a4632);
    g.lineBetween(p.x, p.keel, p.x + 1, p.deck + 2 + (i % 2) * 5);
  }
  // Portholes on both halves.
  for (const t of [0.12, 0.22, 0.32, 0.66, 0.76]) {
    const p = hullAt(t);
    disc(g, p.x, p.deck + 5, 1.8, 0x14100c);
    disc(g, p.x, p.deck + 5, 1.1, 0x0a1218);
  }
  // Silt banked along the keel.
  oval(g, -6, -2, 46, 6, 0x0e2a3a, 0.95);
  oval(g, -8, -3, 36, 3, 0x1a3a48, 0.9);
  // The snapped mast leaning aft, a spar and torn rigging, the lantern on its line.
  rod(g, 0, 0, -6, -8, 24, -20, -8, 52, 2.6, 0x5a4632);
  rod(g, 0, 0, -30, -8, 44, -10, -8, 48, 1.6, 0x5a4632);
  g.lineStyle(0.6, 0x8a8a7a, 0.6);
  g.lineBetween(X(0, -30), Y(0, -8, 44), X(0, -38), Y(0, 0, 22));
  g.lineBetween(X(0, -10), Y(0, -8, 48), X(0, 8), Y(0, 0, 26));
  rod(g, 0, 0, WRECK.lantern.u, WRECK.lantern.v, 47, WRECK.lantern.u, WRECK.lantern.v, WRECK.lantern.h, 0.6, 0x3a3a3a);
  box(g, 0, 0, frame(0, 0, WRECK.lantern.h - 4, WRECK.lantern.u, WRECK.lantern.v), -1.6, 1.6, -1.6, 1.6, 0, 4, 0x2a2a20);
  // Coral grown over the bow.
  const bow = hullAt(0.92);
  for (let i = 0; i < 4; i++) {
    const x = bow.x - 8 + i * 4,
      y = bow.deck + 2,
      h = 8 + (i % 2) * 5;
    g.lineStyle(1.8, 0x5a2a5e);
    g.lineBetween(x, y, x + (i - 1.5), y - h);
    disc(g, x + (i - 1.5), y - h, 1.8, 0xffb04a);
  }
}
export function wreckShadow(g: Ink) {
  oval(g, 8, 4, 46, 14, SHADE, 0.24);
}
/** The black smoker's chimneys (ground u, v, height at full size). */
export const SMOKERS = [{ u: -6, v: -6, h: 62 }, { u: 14, v: 2, h: 44 }, { u: -20, v: 6, h: 34 }] as const;
/**
 * A black smoker mound: a broad heap of sulphide rock crowned by three tall chimneys with glowing mouths (their black
 * plumes rise in the ambient), crusted with yellow and rust mineral, white crabs and tube worms at its foot.
 */
export function drawSmoker(g: Ink) {
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6,
      t1 = (i + 1) / 6;
    drum(g, 0, 0, 38 - 22 * t0 + (i % 2) * 1.5, 18 * t0, 18 * t1 + 0.6, shade(0x1a2430, -0.06 * (i % 2)), 0x2a3644, 18);
  }
  for (const s of [...SMOKERS].sort((p, q) => p.v - q.v)) {
    const x = s.u,
      y = s.v * SQUASH;
    for (let i = 0; i < 8; i++) {
      const t0 = i / 8,
        t1 = (i + 1) / 8,
        r = 7.5 - 4 * t0 + (hash01(s.u, i) - 0.5) * 1.6;
      drum(g, x, y, r, 14 + (s.h - 14) * t0, 14 + (s.h - 14) * t1 + 0.5, shade(0x1e2a36, -0.08 * (i % 2)), 0x2e3e4e, 12);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle(i % 2 ? 0xc8a03a : 0x8a4a1a, 0.85);
      g.fillRect(x - 4 + i * 2.4, Y(y, 4, 18 + i * (s.h - 20) * 0.2), 2, 3);
    }
    const my = Y(y, 0, s.h);
    oval(g, x, my, 3.6, 2.2, 0x1a0c06);
    oval(g, x, my + 0.4, 2.4, 1.4, VENT);
    oval(g, x, my + 0.5, 1.1, 0.7, 0xffe0a0);
  }
  // Tube worms and pale crabs around the foot.
  for (let i = 0; i < 9; i++) {
    const t = Math.PI * (0.1 + 0.8 * (i / 8)),
      x = Math.cos(t) * 30,
      v = Math.sin(t) * 18;
    drum(g, x, Y(0, v, 0), 1.2, 0, 7 + (i % 3) * 3, 0xc8ccc0, 0xe8ece0, 6);
    disc(g, x, Y(0, v, 8 + (i % 3) * 3), 1.4, 0xd83a3a);
  }
  for (const [u, v] of [[-26, 14], [20, 16]]) {
    oval(g, X(0, u), Y(0, v, 1.4), 2.6, 1.6, 0xe8e0d0);
    g.lineStyle(0.6, 0xe8e0d0);
    g.lineBetween(X(0, u) - 3.6, Y(0, v, 0.6), X(0, u) + 3.6, Y(0, v, 0.6));
  }
}
export function smokerShadow(g: Ink) {
  oval(g, 8, 6, 44, 22, SHADE, 0.2);
}
