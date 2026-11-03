// Throwaway prototype (not part of the game): four Pulse tower models drawn in the 3/4 tilt "A" for comparison.
import Phaser from "phaser";
import { DEFAULT_CONTENT } from "../src/content";
import { OUTPOST } from "../src/content/maps";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "../src/core/upgrades";
import type { Tower, TowerId } from "../src/core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, facing, halo, plate, rivets, sunken } from "../src/render/material";
import { MOTIFS } from "../src/render/tower-art/motifs";
import { CELL, arcBand, disc, oval, px, ring, shade, type Ink, type Pen } from "../src/render/shapes";
import { drawTower } from "../src/render/towers";
import { drawGates, drawTerrain } from "../src/render/terrain";

const content = DEFAULT_CONTENT,
  params = new URLSearchParams(location.search),
  CLOCK = 0.6,
  SQ = 0.82,
  RISE = 0.55;

function built(type: TowerId, level: number | "max", path?: string, cooldown = 0, angle = -Math.PI / 4): Tower {
  const t: Tower = { id: 3, type, x: 0, y: 0, upgrades: [], cooldown, spent: 0, angle, kills: 0, owner: 0 };
  while (level === "max" || towerLevel(t, content) < level) {
    const next = upgradeOptions(t, Infinity, content).find((o) => o.status === "available" && (!o.definition!.path || o.definition!.path === path));
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  return t;
}
const badges = (t: Tower) => ({ markers: towerLevel(t, content), maxed: isFullyUpgraded(t, content), color: towerColor(t, content), path: towerPath(t, content), boosted: false });

// ---------------------------------------------------------------------------------------------------------------
// A tiny 3D kit: world (u, v, h) around the tower's ground centre, u east, v south, h up; orthographic 3/4 view.
// ---------------------------------------------------------------------------------------------------------------
const P = Array.from({ length: 64 }, () => ({ x: 0, y: 0 }));
interface V {
  g: Ink;
  glow: Ink;
  gx: number;
  gy: number;
}
const sx = (v: V, u: number) => v.gx + u,
  sy = (v: V, w: number, h: number) => v.gy + w * SQ - h * RISE;
function poly(g: Ink, pts: readonly (readonly [number, number])[], color: number, alpha = 1) {
  pts.forEach(([x, y], i) => ((P[i].x = x), (P[i].y = y)));
  g.fillStyle(color, alpha);
  g.fillPoints(P, true, false, pts.length);
}
function outline(g: Ink, pts: readonly (readonly [number, number])[], color: number, w: number, alpha = 1) {
  pts.forEach(([x, y], i) => ((P[i].x = x), (P[i].y = y)));
  g.lineStyle(w, color, alpha);
  g.strokePoints(P, true, true, pts.length);
}
/** Ground polygon in local axes turned by `a`: (along, across) → (u, v). */
const turn = (a: number, pts: readonly (readonly [number, number])[], du = 0, dv = 0) =>
  pts.map(([p, q]) => [du + p * Math.cos(a) - q * Math.sin(a), dv + p * Math.sin(a) + q * Math.cos(a)] as const);
/** Upright prism over a convex ground polygon from h0 to h1: the faces turned to the viewer, then the lit top. */
function prism(v: V, ground: readonly (readonly [number, number])[], h0: number, h1: number, color: number, top = shade(color, 0.12)) {
  const { g } = v,
    n = ground.length,
    cu = ground.reduce((s, p) => s + p[0], 0) / n,
    cv = ground.reduce((s, p) => s + p[1], 0) / n,
    sil: [number, number][] = [];
  // Silhouette outline: the top polygon plus the bottom one (convex hull is close enough at these sizes).
  for (const [u, w] of ground) sil.push([sx(v, u), sy(v, w, h1)]);
  const topPts = sil.slice();
  for (let i = 0; i < n; i++) {
    const [u0, w0] = ground[i],
      [u1, w1] = ground[(i + 1) % n];
    let nu = w1 - w0,
      nv = -(u1 - u0);
    if (nu * ((u0 + u1) / 2 - cu) + nv * ((w0 + w1) / 2 - cv) < 0) ((nu = -nu), (nv = -nv));
    if (nv <= 0.001) continue;
    const pts = [
      [sx(v, u0), sy(v, w0, h0)],
      [sx(v, u1), sy(v, w1, h0)],
      [sx(v, u1), sy(v, w1, h1)],
      [sx(v, u0), sy(v, w0, h1)],
    ] as const;
    poly(g, pts, OUTLINE, 0.9);
    const f = facing(Math.atan2(nv, nu)),
      face = shade(color, -0.2 + 0.32 * f);
    // Inset face so a dark seam stays between faces and round the bottom.
    const ins = pts.map(([x, y], j) => [x + (j === 0 || j === 3 ? 0.5 : -0.5), y + (j < 2 ? -0.7 : 0)] as const);
    poly(g, ins, face);
    // Lit bevel along the top edge.
    poly(g, [ins[3], ins[2], [ins[2][0], ins[2][1] + 1.1], [ins[3][0], ins[3][1] + 1.1]], shade(face, 0.3));
  }
  poly(g, topPts, top);
  outline(g, topPts, OUTLINE, 0.8, 0.85);
  // Light on the top's edges that face the light.
  for (let i = 0; i < n; i++) {
    const [u0, w0] = ground[i],
      [u1, w1] = ground[(i + 1) % n];
    let nu = w1 - w0,
      nv = -(u1 - u0);
    if (nu * ((u0 + u1) / 2 - cu) + nv * ((w0 + w1) / 2 - cv) < 0) ((nu = -nu), (nv = -nv));
    if (facing(Math.atan2(nv, nu)) < 0.4) continue;
    g.lineStyle(1, shade(top, 0.35), 0.9);
    g.lineBetween(topPts[i][0], topPts[i][1] + 0.6, topPts[(i + 1) % n][0], topPts[(i + 1) % n][1] + 0.6);
  }
}
/** Upright cylinder at ground (u, w) from h0 to h1. */
function cylinder(v: V, u: number, w: number, r: number, h0: number, h1: number, color: number, top = shade(color, 0.1)) {
  const { g } = v,
    n = 16,
    x = sx(v, u);
  oval(g, x, sy(v, w, h0), r + 0.7, r * SQ + 0.7, OUTLINE, 0.9);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI,
      t1 = ((i + 1) / n) * Math.PI,
      f = facing((t0 + t1) / 2),
      c = shade(color, -0.3 + 0.36 * Math.max(-0.5, f) + (i === n - 4 ? 0.16 : 0));
    poly(g, [
      [x + Math.cos(t0) * r, sy(v, w + Math.sin(t0) * r, h0)],
      [x + Math.cos(t1) * r, sy(v, w + Math.sin(t1) * r, h0)],
      [x + Math.cos(t1) * r, sy(v, w + Math.sin(t1) * r, h1)],
      [x + Math.cos(t0) * r, sy(v, w + Math.sin(t0) * r, h1)],
    ], c);
  }
  oval(g, x, sy(v, w, h1), r, r * SQ, top);
  arcBand(g, x, sy(v, w, h1), 0, 0, 0, 0, 0);
  ringFlat(g, x, sy(v, w, h1), r - 0.4, 0.9, shade(top, 0.3), LIGHT - 0.9, LIGHT + 0.9);
}
/** Partial ellipse band on a flat (squashed) circle. */
function ringFlat(g: Ink, x: number, y: number, r: number, w: number, color: number, a0 = 0, a1 = Math.PI * 2, alpha = 1) {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(1, SQ);
  arcBand(g, 0, 0, r, w, a0, a1, color, alpha);
  g.restore();
}
/** Draws `draw` on the ground plane at height h (squashed). */
function flat(ink: Ink, v: V, h: number, draw: () => void) {
  ink.save();
  ink.translateCanvas(v.gx, v.gy - h * RISE);
  ink.scaleCanvas(1, SQ);
  draw();
  ink.restore();
}
/** Screen point of a world point. */
const S = (v: V, u: number, w: number, h: number) => [sx(v, u), sy(v, w, h)] as const;
/** Horizontal tube along ground angle `a` at height h from distance d0 to d1 with radius r0 → r1, starting at (u, w). */
function tube(v: V, u: number, w: number, h: number, a: number, d0: number, d1: number, r0: number, r1: number, color: number, alpha = 1) {
  const { g } = v,
    ca = Math.cos(a),
    sa = Math.sin(a),
    [x0, y0] = S(v, u + ca * d0, w + sa * d0, h),
    [x1, y1] = S(v, u + ca * d1, w + sa * d1, h),
    dx = x1 - x0,
    dy = y1 - y0,
    len = Math.hypot(dx, dy) || 1,
    px = -dy / len,
    py = dx / len,
    // The side turned up (and to the light) catches the highlight.
    lit = px * -0.45 + py * -0.9 > 0 ? 1 : -1,
    // A tube seen along its axis looks as wide as tall; across, its vertical radius shrinks with the rise.
    k0 = r0,
    k1 = r1,
    q = (s0: number, s1: number) =>
      [
        [x0 + px * s0 * k0, y0 + py * s0 * k0],
        [x1 + px * s0 * k1, y1 + py * s0 * k1],
        [x1 + px * s1 * k1, y1 + py * s1 * k1],
        [x0 + px * s1 * k0, y0 + py * s1 * k0],
      ] as const;
  poly(g, q(-1.25, 1.25), OUTLINE, 0.85 * alpha);
  poly(g, q(-1, 1), color, alpha);
  poly(g, q(lit * 1, lit * 0.2), shade(color, 0.28), alpha);
  poly(g, q(lit * 0.75, lit * 0.45), shade(color, 0.6), 0.8 * alpha);
  poly(g, q(-lit * 1, -lit * 0.35), shade(color, -0.38), alpha);
}
/** Disc facing along ground angle `a` (a ring round a horizontal axis) at world centre (u, w, h). */
function disc3(v: V, u: number, w: number, h: number, a: number, r: number, color: number, alpha = 1, inner = 0) {
  const pts: [number, number][] = [],
    n = 18;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2,
      across = Math.cos(t) * r,
      up = Math.sin(t) * r;
    pts.push([sx(v, u - Math.sin(a) * across), sy(v, w + Math.cos(a) * across, h + up)]);
  }
  poly(v.g, pts, color, alpha);
  if (inner > 0) disc3(v, u, w, h, a, inner, OUTLINE, alpha);
}
/** Lit ring round a horizontal axis: outline, band, highlight. Returns nothing; for coils and muzzle brakes. */
function coil(v: V, u: number, w: number, h: number, a: number, r: number, color: number, thick = 1.6) {
  const ca = Math.cos(a),
    sa = Math.sin(a);
  // Drawn as a short fat tube, which reads as a ring band from every side.
  tube(v, u + ca * -thick / 2, w + sa * -thick / 2, h, a, 0, thick, r, r, color);
}

// ---------------------------------------------------------------------------------------------------------------
// Shared tower parts: plinth, lamps, ground shadow, level bars, path motif.
// ---------------------------------------------------------------------------------------------------------------
interface Look {
  v: V;
  t: Tower;
  level: number;
  p: number;
  c: number;
  maxed: boolean;
  path?: string;
  kick: number;
  charge: number;
  tip?: number;
  a: number;
  end: number;
}
function look(pen: Pen, x: number, y: number, t: Tower): Look {
  const b = badges(t),
    level = b.markers,
    kick = Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2;
  return {
    v: { g: pen.g, glow: pen.glow, gx: x, gy: y + 7 },
    t,
    level,
    p: b.color,
    c: content.towers.pulse.color,
    maxed: b.maxed,
    path: b.path,
    kick,
    charge: 1 - t.cooldown,
    tip: level >= 6 ? b.color : level >= 5 ? shade(content.towers.pulse.color, 0.35) : undefined,
    a: t.angle,
    end: -kick * 5 + 21 + level,
  };
}
const hex = (r: number, rot = 0) => Array.from({ length: 6 }, (_, i) => [Math.cos(rot + (i * Math.PI) / 3) * r, Math.sin(rot + (i * Math.PI) / 3) * r] as const);
const oct = (r: number) => Array.from({ length: 8 }, (_, i) => [Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * r, Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * r] as const);
/** Ground shadow of the whole tower, plus a barrel shadow at height `bh`. */
function groundShadow(L: Look, r: number, bh: number) {
  const { v, a, end } = L;
  flat(v.g, v, 0, () => {
    oval(v.g, 5, 6, r + 5, r + 2, SHADOW, 0.28);
    oval(v.g, 3, 3, r + 1, r - 1, SHADOW, 0.3);
    const o = bh * RISE * 1.3,
      ca = Math.cos(a),
      sa = Math.sin(a),
      w = 3;
    v.g.fillStyle(SHADOW, 0.2);
    const ox = o * 0.7,
      oy = (o * 0.7) / SQ;
    v.g.fillTriangle(ox + ca * 8 - sa * w, oy + sa * 8 + ca * w, ox + ca * end - sa * w, oy + sa * end + ca * w, ox + ca * end + sa * w, oy + sa * end - ca * w);
    v.g.fillTriangle(ox + ca * 8 - sa * w, oy + sa * 8 + ca * w, ox + ca * end + sa * w, oy + sa * end - ca * w, ox + ca * 8 + sa * w, oy + sa * 8 - ca * w);
  });
}
/** Hex or octagon plinth with its deck, collar and lamps on the front faces; returns the deck height. */
function plinth(L: Look, shape: "hex" | "oct", R: number, H: number) {
  const { v, level, p, c } = L,
    ground = shape === "hex" ? hex(R) : oct(R);
  prism(v, ground, 0, H, PLATE, PLATE);
  flat(v.g, v, H, () => {
    plate(v.g, 0, 0, shape === "hex" ? { n: 6, rot: 0 } : { n: 8, rot: Math.PI / 8 }, R, PLATE);
    sunken(v.g, 0, 0, shape === "hex" ? { n: 6, rot: 0 } : { n: 8, rot: Math.PI / 8 }, R - 5, DARK);
    rivets(v.g, 0, 0, R - 2.5, 3, Math.PI / 2, shade(c, -0.45));
    ring(v.g, 0, 0, R - 9, 1.3, p, 0.6);
  });
  if (level >= 5) flat(v.glow, v, H, () => ring(v.glow, 0, 0, R - 9, 2, p, 0.35));
  // Path motif on the deck.
  const d = content.towers.pulse,
    motif = L.path ? d.visual.paths?.[L.path]?.motif : undefined;
  if (motif) {
    const tier = Math.min(3, Math.max(1, level - 5));
    for (const ink of [v.g, v.glow]) {
      ink.save();
      ink.translateCanvas(v.gx, v.gy - H * RISE);
      ink.scaleCanvas(0.85, 0.85 * SQ);
    }
    MOTIFS[motif]({ g: v.g, glow: v.glow, x: 0, y: 0, tower: L.t, definition: d, clock: CLOCK, level, maxed: L.maxed, color: p, path: L.path, kick: L.kick, charge: L.charge, tip: L.tip, energy: 0.15, peak: 0.6 }, tier, CLOCK + L.t.id, 0.06 + 0.06 * tier);
    v.g.restore();
    v.glow.restore();
  }
  // Lamps on the front faces: one from L2, three chasing from L4.
  const n = ground.length,
    faces: number[] = [];
  for (let i = 0; i < n; i++) {
    const [u0, w0] = ground[i],
      [u1, w1] = ground[(i + 1) % n];
    if ((u0 + u1) / 2 === 0 && (w0 + w1) / 2 <= 0) continue;
    if ((w0 + w1) / 2 > R * 0.3) faces.push(i);
  }
  faces.sort((i, j) => Math.abs((ground[i][0] + ground[(i + 1) % n][0]) / 2) - Math.abs((ground[j][0] + ground[(j + 1) % n][0]) / 2));
  const lit = level >= 4 ? faces.slice(0, 3) : level >= 2 ? faces.slice(0, 1) : [];
  lit.forEach((i, k) => {
    const u = ((ground[i][0] + ground[(i + 1) % n][0]) / 2) * 0.98,
      w = ((ground[i][1] + ground[(i + 1) % n][1]) / 2) * 0.98,
      [lx, ly] = S(v, u, w, H * 0.5),
      on = level >= 4 ? 0.35 + 0.65 * Math.max(0, Math.sin(4 * CLOCK - k * 1.6)) : 1;
    disc(v.g, lx, ly, 1.9, OUTLINE, 0.9);
    disc(v.g, lx, ly, 1.2, shade(p, -0.7 * (1 - on)));
    if (on > 0.5) disc(v.glow, lx, ly, 3.6, p, 0.3 * on);
  });
  return H;
}
function levelBars(L: Look, R: number) {
  const { v, level, p } = L,
    step = level > 5 ? 5 : 6;
  v.g.fillStyle(p);
  for (let i = 0; i < level; i++) v.g.fillRect(v.gx - (level * step - 2) / 2 + i * step, v.gy + R * SQ + 3, step - 2, 3);
}
/** Turntable: a short cylinder with a trim band in the path colour from level 2. */
function turntable(L: Look, r: number, h0: number, h1: number) {
  const { v, level, p } = L;
  cylinder(v, 0, 0, r, h0, h1, shade(PLATE, 0.08));
  if (level >= 2) {
    const n = 12,
      hb = h0 + (h1 - h0) * 0.4;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI,
        t1 = ((i + 1) / n) * Math.PI;
      poly(v.g, [S(v, Math.cos(t0) * (r + 0.2), Math.sin(t0) * (r + 0.2), hb), S(v, Math.cos(t1) * (r + 0.2), Math.sin(t1) * (r + 0.2), hb), S(v, Math.cos(t1) * (r + 0.2), Math.sin(t1) * (r + 0.2), hb + 1.8), S(v, Math.cos(t0) * (r + 0.2), Math.sin(t0) * (r + 0.2), hb + 1.8)], shade(p, -0.3 + 0.35 * facing((t0 + t1) / 2)));
    }
  }
}
function muzzleFlash(L: Look, h: number, d: number) {
  const { v, a, kick, c } = L;
  if (kick <= 0) return;
  const [mx, my] = S(v, Math.cos(a) * d, Math.sin(a) * d, h);
  halo(v.glow, mx, my, 4 * (1.3 + kick), c, 0.3 * kick);
  disc(v.g, mx, my, 1.4 * (0.5 + kick), shade(c, 0.75));
}
function maxedHalo(L: Look, h: number) {
  if (L.maxed) halo(L.v.glow, L.v.gx, L.v.gy - h * RISE, 24, L.p, 0.12 + 0.04 * Math.sin(CLOCK * 2 + L.t.id));
}
/** Barrel with bands, a muzzle brake and the hot tip, from the pivot (0, 0, h) along `a`. */
function barrel(L: Look, h: number, from: number, r: number, color = L.c) {
  const { v, a, end, level, tip } = L,
    ca = Math.cos(a),
    sa = Math.sin(a);
  tube(v, 0, 0, h, a, from, end - 4, r, r * 0.92, color);
  if (level >= 3) for (const f of [0.5, 0.65]) coil(v, ca * (from + (end - 4 - from) * f), sa * (from + (end - 4 - from) * f), h, a, r + 0.25, shade(color, -0.45), 0.9);
  tube(v, 0, 0, h, a, end - 4, end, r + 0.9, r + 0.9, shade(color, -0.3));
  if (tip !== undefined) tube(v, 0, 0, h, a, end - 2, end, r + 0.9, r + 0.9, tip);
  const toward = sa;
  if (toward > 0.15) disc3(v, ca * end, sa * end, h, a, r + 0.9, shade(color, -0.55), 1, 1.4);
}

// ---------------------------------------------------------------------------------------------------------------
// The four models.
// ---------------------------------------------------------------------------------------------------------------
type Model = (pen: Pen, x: number, y: number, t: Tower) => void;

/** 1 · Dome (the current model lifted into the tilt): hex plinth, pedestal, dome head, barrel. */
const domeModel: Model = (pen, x, y, t) => {
  const L = look(pen, x, y, t),
    { v, a, c, charge } = L,
    H = 9,
    hc = H + 6 + 8;
  groundShadow(L, 21, hc);
  plinth(L, "hex", 21, H);
  turntable(L, 7.5, H, H + 6);
  const away = Math.sin(a) < 0;
  if (away) barrel(L, hc, 3, 3.3);
  const [hx, hy] = S(v, 0, 0, hc);
  dome(v.g, hx, hy, 9, c);
  const [bx, by] = S(v, -Math.cos(a) * 5.5, -Math.sin(a) * 5.5, hc + 1);
  disc(v.g, bx, by, 1.9, OUTLINE, 0.9);
  disc(v.g, bx, by, 1.1, shade(c, 0.45), 0.3 + 0.6 * charge);
  disc(v.glow, bx, by, 3, c, 0.25 + 0.35 * charge);
  if (!away) barrel(L, hc, 3, 3.3);
  maxedHalo(L, H);
  muzzleFlash(L, hc, L.end + 1);
  levelBars(L, 21);
};

/** 2 · Gimbal: a ball head held in a yoke on a turntable; a long precise barrel and a charge cell at the back. */
const gimbalModel: Model = (pen, x, y, t) => {
  const L = look(pen, x, y, t),
    { v, a, c, p, charge, level } = L,
    H = 8,
    top = H + 4,
    hc = top + 10,
    ca = Math.cos(a),
    sa = Math.sin(a),
    side = 9.5;
  groundShadow(L, 21, hc);
  plinth(L, "hex", 21, H);
  turntable(L, 13, H, top);
  // Arms on both sides across the aim; the far one first.
  const arms = [-1, 1].map((s) => ({ s, du: -sa * side * s, dv: ca * side * s })).sort((m, n) => m.dv - n.dv),
    arm = (m: { du: number; dv: number }) => {
      prism(v, turn(a, [[-4, -1.8], [4, -1.8], [4, 1.8], [-4, 1.8]], m.du, m.dv), top, hc + 2, shade(PLATE, 0.18));
      // Trunnion cap on the arm's outer face in the trim colour.
      const [tx, ty] = S(v, m.du * 1.08, m.dv * 1.08, hc);
      disc(v.g, tx, ty, 2.3, OUTLINE);
      disc(v.g, tx, ty, 1.5, level >= 2 ? p : shade(PLATE, 0.4));
    };
  arm(arms[0]);
  const away = sa < 0,
    cell = () => {
      tube(v, 0, 0, hc + 0.5, a, -12, -5, 2.6, 2.6, shade(PLATE, 0.1));
      tube(v, 0, 0, hc + 0.5, a, -11, -6, 1.8, 1.8, shade(c, 0.2), 0.4 + 0.6 * charge);
      const [gx, gy] = S(v, -ca * 8.5, -sa * 8.5, hc + 0.5);
      halo(v.glow, gx, gy, 6, c, 0.25 + 0.3 * charge);
    };
  if (away) barrel(L, hc, 4, 2.6);
  else cell();
  const [hx, hy] = S(v, 0, 0, hc);
  dome(v.g, hx, hy, 7, c);
  // Sight: a dark lens slot on the ball facing the aim.
  const [lx, ly] = S(v, ca * 3, sa * 3, hc + 3.5);
  disc(v.g, lx, ly, 1.6, OUTLINE);
  disc(v.glow, lx, ly, 2.2, c, 0.4);
  if (away) cell();
  else barrel(L, hc, 4, 2.6);
  arm(arms[1]);
  maxedHalo(L, H);
  muzzleFlash(L, hc, L.end + 1);
  levelBars(L, 21);
};

/** 3 · Sentry: an armoured wedge turret on a turntable, the barrel from a mantlet, a glowing charge slot on its roof. */
const sentryModel: Model = (pen, x, y, t) => {
  const L = look(pen, x, y, t),
    { v, a, c, p, charge, level } = L,
    H = 7,
    top = H + 3,
    roof = top + 9,
    bh = top + 5,
    ca = Math.cos(a),
    sa = Math.sin(a);
  groundShadow(L, 21, roof);
  plinth(L, "oct", 21, H);
  turntable(L, 12, H, top);
  const away = sa < 0,
    hull = shade(c, -0.42),
    gun = () => {
      prism(v, turn(a, [[9, -4], [13, -3.4], [13, 3.4], [9, 4]]), bh - 3.5, bh + 3.5, shade(PLATE, 0.15));
      barrel(L, bh, 12, 2.4);
    };
  if (away) gun();
  // Rear cooling fins, then the hull.
  for (const q of [-4, 0, 4]) prism(v, turn(a, [[-13, q - 0.7], [-9, q - 0.7], [-9, q + 0.7], [-13, q + 0.7]]), top + 1, roof - 2, shade(PLATE, -0.05));
  prism(v, turn(a, [[-10, -7], [4, -7], [10, -4], [10, 4], [4, 7], [-10, 7]]), top, roof, hull, shade(hull, 0.18));
  // Roof: a sunken charge slot along the axis and a sensor block.
  const slot = turn(a, [[-7, -1.6], [3, -1.6], [3, 1.6], [-7, 1.6]]).map(([u, w]) => S(v, u, w, roof));
  poly(v.g, slot, OUTLINE, 0.95);
  const fill = turn(a, [[-6.5, -0.9], [-6.5 + 9.5 * charge, -0.9], [-6.5 + 9.5 * charge, 0.9], [-6.5, 0.9]]).map(([u, w]) => S(v, u, w, roof));
  poly(v.g, fill, shade(c, 0.4), 0.9);
  poly(v.glow, slot, c, 0.15 + 0.35 * charge);
  prism(v, turn(a, [[-2, 3.5], [3, 3.5], [3, 6], [-2, 6]]), roof, roof + 2.5, shade(PLATE, 0.1));
  const [ex, ey] = S(v, ca * 3 - sa * 4.7, sa * 3 + ca * 4.7, roof + 1.3);
  disc(v.g, ex, ey, 1, level >= 2 ? p : c);
  disc(v.glow, ex, ey, 2.4, level >= 2 ? p : c, 0.4);
  // Armour stripe in the trim colour from level 6.
  if (level >= 6) {
    const stripe = turn(a, [[-10, -7], [-7, -7], [-7, 7], [-10, 7]]).map(([u, w]) => S(v, u, w, roof));
    poly(v.g, stripe, p, 0.85);
  }
  if (!away) gun();
  maxedHalo(L, H);
  muzzleFlash(L, bh, L.end + 1);
  levelBars(L, 21);
};

/** 4 · Accelerator: a capacitor body on a pylon, the shot driven through glowing coils that light up as it charges. */
const acceleratorModel: Model = (pen, x, y, t) => {
  const L = look(pen, x, y, t),
    { v, a, c, p, charge, level, end, tip } = L,
    H = 9,
    top = H + 3,
    hc = top + 10,
    ca = Math.cos(a),
    sa = Math.sin(a);
  groundShadow(L, 21, hc);
  plinth(L, "hex", 21, H);
  turntable(L, 9, H, top);
  // Pylon from the turntable up to the body.
  prism(v, turn(a, [[-4, -3], [3, -3], [3, 3], [-4, 3]]), top, hc - 3, shade(PLATE, 0.12));
  const away = sa < 0,
    rings = level >= 5 ? 4 : 3,
    rail = () => {
      // Twin rails, then the coils along them, each lighting as the charge passes it.
      for (const q of [-2, 2]) tube(v, -sa * q, ca * q, hc, a, 6, end - 1, 0.9, 0.9, shade(PLATE, 0.25));
      const span = end - 9;
      const order = Array.from({ length: rings }, (_, i) => i);
      if (!away) order.reverse();
      for (const i of order.reverse()) {
        const d = 8 + (span * i) / (rings - 1),
          on = Math.max(0, Math.min(1, charge * rings - i));
        coil(v, ca * d, sa * d, hc, a, 4.2 - i * 0.25, i === rings - 1 && tip !== undefined ? tip : shade(PLATE, 0.05), 1.8);
        const [rx, ry] = S(v, ca * d, sa * d, hc);
        if (on > 0.05) {
          halo(v.glow, rx, ry, 5.5, c, 0.3 * on);
          disc3(v, ca * d, sa * d, hc, a, 2.6 - i * 0.2, shade(c, 0.5), 0.8 * on);
        }
      }
    },
    body = () => {
      tube(v, 0, 0, hc, a, -10, 6, 5.2, 4.6, shade(PLATE, 0.15));
      // Window in the body showing the capacitor glow.
      tube(v, 0, 0, hc, a, -7, 2, 3.4, 3.2, shade(c, -0.1), 0.5 + 0.5 * charge);
      const [cx, cy] = S(v, -ca * 2.5, -sa * 2.5, hc);
      halo(v.glow, cx, cy, 9, c, 0.18 + 0.3 * charge);
      for (const d of [-8, 4]) coil(v, ca * d, sa * d, hc, a, 5.4, level >= 2 ? shade(p, -0.25) : shade(PLATE, -0.1), 1.2);
      if (sa > 0.15) disc3(v, ca * 6, sa * 6, hc, a, 4.6, shade(PLATE, -0.2), 1, 1.6);
      if (sa < -0.15) disc3(v, -ca * 10, -sa * 10, hc, a, 5.2, shade(PLATE, -0.05), 1, 0);
    };
  if (away) {
    rail();
    body();
  } else {
    body();
    rail();
  }
  maxedHalo(L, H);
  muzzleFlash(L, hc, end + 1);
  levelBars(L, 21);
};


/** 5 · Reference: stepped octagon plinth with lit panels, chrome column, a U-yoke with hub lights and a ribbed gun. */
function referenceModel(armour: boolean): Model {
  return (pen, x, y, t) => {
    const L = look(pen, x, y, t),
      { v, a, c, p, charge, level, tip } = L,
      metal = 0x2f393f,
      body = armour ? shade(c, -0.38) : 0x4a5961,
      chrome = 0x8d999f,
      light = level >= 2 ? p : c,
      on = 0.45 + 0.07 * level,
      ca = Math.cos(a),
      sa = Math.sin(a),
      T1 = 5,
      T2 = 8.5,
      yokeBase = 17,
      gunH = 28,
      end = L.end + 4;
    groundShadow(L, 22, gunH);
    // Tier 1: wide octagon; glowing panel outlines on the faces turned to the viewer.
    const o1 = oct(21.5);
    prism(v, o1, 0, T1, metal, shade(metal, 0.1));
    for (let i = 0; i < 8; i++) {
      const [u0, w0] = o1[i],
        [u1, w1] = o1[(i + 1) % 8];
      if ((w0 + w1) / 2 < 6) continue;
      const at = (f: number, h: number) => S(v, u0 + (u1 - u0) * f, w0 + (w1 - w0) * f, h),
        rect = [at(0.18, 1.3), at(0.82, 1.3), at(0.82, T1 - 1.2), at(0.18, T1 - 1.2)];
      outline(v.g, rect, shade(light, -0.1), 0.8, on);
      outline(v.glow, rect, light, 1.6, 0.25 * on);
    }
    // Vent grilles on the tier-1 deck at the diagonals.
    flat(v.g, v, T1, () => {
      for (let i = 0; i < 4; i++) {
        const q = Math.PI / 4 + (i * Math.PI) / 2,
          cx = Math.cos(q) * 18.5,
          cy = Math.sin(q) * 18.5;
        for (const k of [-1.6, 0, 1.6]) {
          v.g.fillStyle(OUTLINE, 0.9);
          v.g.fillRect(cx - 2.2 - Math.sin(q) * k, cy - 0.45 + Math.cos(q) * k, 4.4, 0.9);
        }
      }
    });
    // Tier 2 with an inset glowing octagon line, then the path motif.
    const o2 = oct(15);
    prism(v, o2, T1, T2, metal, shade(metal, 0.06));
    const inset = oct(12).map(([u, w]) => S(v, u, w, T2));
    outline(v.g, inset, light, 1, on);
    outline(v.glow, inset, light, 2.4, 0.3 * on);
    const d = content.towers.pulse,
      motif = L.path ? d.visual.paths?.[L.path]?.motif : undefined;
    if (motif) {
      const tier = Math.min(3, Math.max(1, level - 5));
      for (const ink of [v.g, v.glow]) {
        ink.save();
        ink.translateCanvas(v.gx, v.gy - T2 * RISE);
        ink.scaleCanvas(0.62, 0.62 * SQ);
      }
      MOTIFS[motif]({ g: v.g, glow: v.glow, x: 0, y: 0, tower: L.t, definition: d, clock: CLOCK, level, maxed: L.maxed, color: p, path: L.path, kick: L.kick, charge, tip, energy: 0.15, peak: 0.6 }, tier, CLOCK + L.t.id, 0.05 + 0.05 * tier);
      v.g.restore();
      v.glow.restore();
    }
    // Chrome collar and column.
    cylinder(v, 0, 0, 7.5, T2, T2 + 2, chrome, shade(chrome, 0.1));
    cylinder(v, 0, 0, 5, T2 + 2, T2 + 3.2, shade(chrome, -0.15));
    cylinder(v, 0, 0, 2.8, T2 + 3.2, yokeBase, chrome);
    // Yoke: a cross plate and two tall arms beside the gun.
    prism(v, turn(a, [[-4.5, -9.5], [4.5, -9.5], [4.5, 9.5], [-4.5, 9.5]]), yokeBase, yokeBase + 2, body);
    const arms = [-1, 1].map((s) => ({ s, dv: ca * 7.5 * s })).sort((m, n) => m.dv - n.dv),
      arm = (s: number) => {
        prism(v, turn(a, [[-5, 7.2 * s], [4, 7.2 * s], [3, 9.6 * s], [-5, 9.6 * s]].map(([q, r]) => [q, r] as const)), yokeBase + 2, gunH + 5, body);
        // Hub on the outer face and a light strip above it.
        const [hx, hy] = S(v, -sa * 9.9 * s, ca * 9.9 * s, gunH);
        disc(v.g, hx, hy, 2.6, OUTLINE);
        disc(v.g, hx, hy, 1.9, chrome);
        ring(v.g, hx, hy, 1.9, 0.7, light, on);
        disc(v.glow, hx, hy, 3.6, light, 0.22 * on);
        const [lx0, ly0] = S(v, -sa * 9.9 * s - ca * 1, ca * 9.9 * s - sa * 1, gunH + 2.8),
          [lx1, ly1] = S(v, -sa * 9.9 * s - ca * 1, ca * 9.9 * s - sa * 1, gunH + 4.6);
        v.g.lineStyle(0.9, light, on);
        v.g.lineBetween(lx0, ly0, lx1, ly1);
      };
    arm(arms[0].s);
    const away = sa < 0,
      gun = () => {
        const parts = () => {
          // Receiver: a box with ribs on its roof and charge dashes on its side.
          prism(v, turn(a, [[-11, -6], [9, -6], [9, 6], [-11, 6]]), gunH - 3.8, gunH + 3.8, body, shade(body, 0.12));
          for (const q of [-5, -3, -1, 1, 3, 5]) {
            const rib = turn(a, [[q - 0.4, -5.2], [q + 0.4, -5.2], [q + 0.4, 5.2], [q - 0.4, 5.2]]).map(([u, w]) => S(v, u, w, gunH + 3.8));
            poly(v.g, rib, OUTLINE, 0.7);
          }
          const side = ca >= 0 ? 1 : -1;
          void side;
          const vis = Math.cos(a) * 1 >= 0 ? 5.05 : -5.05,
            faceSide = ca >= 0 ? 6.05 : -6.05;
          void vis;
          for (let i = 0; i < 4; i++) {
            const dd = -6 + i * 2,
              lit = Math.max(0, Math.min(1, charge * 4 - i)),
              q = faceSide,
              p0 = S(v, ca * dd - sa * q, sa * dd + ca * q, gunH - 1.2),
              p1 = S(v, ca * dd - sa * q, sa * dd + ca * q, gunH + 1.4);
            v.g.lineStyle(1.1, lit > 0.05 ? shade(c, 0.3) : shade(light, -0.6), 0.6 + 0.4 * lit);
            v.g.lineBetween(p0[0], p0[1], p1[0], p1[1]);
            if (lit > 0.05) {
              v.glow.lineStyle(2.4, c, 0.35 * lit);
              v.glow.lineBetween(p0[0], p0[1], p1[0], p1[1]);
            }
          }
          // Front extension with ribs.
          prism(v, turn(a, [[9, -4], [16, -4], [16, 4], [9, 4]]), gunH - 2.6, gunH + 2.6, body, shade(body, 0.1));
          for (const q of [10.5, 12, 13.5, 15]) {
            const rib = turn(a, [[q - 0.3, -4.2], [q + 0.3, -4.2], [q + 0.3, 4.2], [q - 0.3, 4.2]]).map(([u, w]) => S(v, u, w, gunH + 2.6));
            poly(v.g, rib, OUTLINE, 0.75);
          }
        },
          bar = () => {
            tube(v, 0, 0, gunH, a, 16, end - 4, 1.7, 1.7, chrome);
            tube(v, 0, 0, gunH, a, end - 4, end, 2.3, 2.3, shade(chrome, -0.35));
            if (tip !== undefined) tube(v, 0, 0, gunH, a, end - 1.6, end, 2.3, 2.3, tip);
            if (sa > 0.15) disc3(v, ca * end, sa * end, gunH, a, 2.3, OUTLINE, 1, 0);
          };
        if (away) (bar(), parts());
        else (parts(), bar());
      };
    gun();
    arm(arms[1].s);
    maxedHalo(L, T2);
    muzzleFlash(L, gunH, end + 1);
    levelBars(L, 22);
  };
}

const MODELS: { name: string; note: string; draw: Model }[] = [
  { name: "1 · Dome", note: "today's model,\nlifted into the tilt", draw: domeModel },
  { name: "2 · Gimbal", note: "ball head in a yoke,\nlong precise barrel", draw: gimbalModel },
  { name: "3 · Sentry", note: "armoured wedge\nturret, charge slot", draw: sentryModel },
  { name: "4 · Accelerator", note: "capacitor + coils\nthat light up", draw: acceleratorModel },
  { name: "5a · Reference", note: "gunmetal + mint\nlight trims", draw: referenceModel(false) },
  { name: "5b · Reference", note: "mint armour\n(Pulse colour)", draw: referenceModel(true) },
];
const ROWS = (params.get("rows") ?? "0,1,2,3,4,5").split(",").map(Number).map((i) => MODELS[i]);
const current: Model = (pen, x, y, t) => drawTower(pen, x, y, t, content.towers[t.type], CLOCK, badges(t));

const ZOOM = 3,
  TILE = CELL + 14,
  GAP = 8,
  LABEL = 128,
  COLS = 9;
const font = (s: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${s}px`, color, resolution: ZOOM });

class Sheet extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    const paths = Object.keys(content.towers.pulse.visual.paths ?? {}),
      states: { label: string; t: () => Tower }[] = [
        { label: "L1", t: () => built("pulse", 1) },
        { label: "L1 firing", t: () => built("pulse", 1, undefined, 0.95) },
        { label: "L5", t: () => built("pulse", 5) },
        ...paths.map((p) => ({ label: `L8 ${content.towers.pulse.visual.paths![p].name ?? p}`, t: () => built("pulse", "max", p) })),
        { label: "aim N", t: () => built("pulse", 5, undefined, 0, -Math.PI / 2) },
        { label: "aim S", t: () => built("pulse", 5, undefined, 0, Math.PI / 2) },
        { label: "aim W", t: () => built("pulse", 5, undefined, 0, Math.PI) },
      ];
    this.add.text(GAP, 6, "Pulse tower models in tilt A (~35°)", font(10));
    ROWS.forEach((m, r) => {
      const y = 26 + r * (TILE + GAP);
      this.add.text(GAP, y + 12, m.name, font(9));
      this.add.text(GAP, y + 28, m.note, font(6.5, "#8fa7b6"));
      states.forEach((s, i) => {
        const x = LABEL + i * (TILE + GAP);
        this.tile(x, y, (pen, cx, cy) => m.draw(pen, cx, cy, s.t()));
        if (r === 0) this.add.text(x, 17, s.label, font(6, "#7f97a6"));
      });
    });
  }
  private tile(x: number, y: number, draw: (pen: Pen, cx: number, cy: number) => void) {
    const back = this.add.graphics(),
      g = this.add.graphics(),
      glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    back.fillStyle(0x223038);
    back.fillRect(x, y, TILE, TILE);
    back.lineStyle(0.5, 0x2e3e48, 1);
    back.strokeRect(x + (TILE - CELL) / 2, y + (TILE - CELL) / 2, CELL, CELL);
    draw({ g, glow }, x + TILE / 2, y + TILE / 2);
  }
}

class Board extends Phaser.Scene {
  create() {
    const map = OUTPOST,
      blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
      model = MODELS[Number(params.get("model") ?? 0)].draw;
    this.cameras.main.setOrigin(0, 0).setZoom(2);
    this.cameras.main.setScroll(300, 90);
    drawTerrain(this, map, (x, y) => blocked.has(`${x},${y}`));
    drawGates({ g: this.add.graphics(), glow: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD) }, map, 0, true, 0);
    const paths = Object.keys(content.towers.pulse.visual.paths ?? {});
    const placed: { x: number; y: number; t: Tower }[] = [
      { x: 6, y: 2, t: built("pulse", 1, undefined, 0, 0.6) },
      { x: 9, y: 4, t: built("pulse", "max", paths[0], 0, 2.2) },
      { x: 9, y: 5, t: built("pulse", "max", paths[1], 0, Math.PI / 2) },
      { x: 12, y: 4, t: built("pulse", "max", paths[2], 0, -2.4) },
      { x: 7, y: 7, t: built("blast", 3, undefined, 0, -1) },
      { x: 12, y: 6, t: built("pulse", 5, undefined, 0, Math.PI) },
      { x: 13, y: 6, t: built("pulse", 5, undefined, 0.95, 0) },
      { x: 13, y: 5, t: built("pulse", 3, undefined, 0, 1.2) },
      { x: 7, y: 4, t: built("frost", 3, undefined, 0, 0) },
    ];
    placed.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of placed) {
      const pen = { g: this.add.graphics(), glow: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD) };
      (p.t.type === "pulse" ? model : current)(pen, px(p.x), px(p.y), p.t);
    }
  }
}

const board = params.get("view") === "board";
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "proto",
  width: board ? 700 * 2 : (LABEL + COLS * (TILE + GAP)) * ZOOM,
  height: board ? 360 * 2 : (26 + ROWS.length * (TILE + GAP) + 4) * ZOOM,
  backgroundColor: "#1b2530",
  banner: false,
  audio: { noAudio: true },
  scene: board ? Board : Sheet,
  callbacks: { postBoot: () => ((window as unknown as { __ready: boolean }).__ready = true) },
});
void flat;
