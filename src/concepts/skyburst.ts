import { facing, halo } from "../render/material";
import { disc, oval, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "../render/tower-art/tilt";
import type { Concept } from "./types";

// --- Local 3D helpers for pitched parts (batch B; candidates for the shared tilt kit). ------------------------------
/**
 * A frame along a pitched axis: `d` along the barrel (ground angle `a`, elevation `pitch`), `e` across it (level), `n`
 * square to both, pointing up. The origin is (pu, pv, ph) in tower ground coordinates (u east, v south, h up).
 */
export interface Frame {
  du: number; dv: number; dh: number;
  eu: number; ev: number;
  nu: number; nv: number; nh: number;
  pu: number; pv: number; ph: number;
}
export function frame(a: number, pitch: number, ph: number, pu = 0, pv = 0): Frame {
  const ca = Math.cos(a),
    sa = Math.sin(a),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  return { du: ca * cp, dv: sa * cp, dh: sp, eu: -sa, ev: ca, nu: -ca * sp, nv: -sa * sp, nh: cp, pu, pv, ph };
}
/** Screen point of frame coordinates (p along, q across, z up). */
export const SX = new Float64Array(16),
  SY = new Float64Array(16);
export function project(x: number, y0: number, f: Frame, p: number, q: number, z: number, i: number) {
  SX[i] = X(x, f.pu + p * f.du + q * f.eu + z * f.nu);
  SY[i] = Y(y0, f.pv + p * f.dv + q * f.ev + z * f.nv, f.ph + p * f.dh + z * f.nh);
}
/** Direction towards the viewer of the board's oblique projection (as in `towardViewer`). */
const WV = Math.sqrt(1 - SQUASH * SQUASH),
  WH = SQUASH;
/** How much a world direction faces the viewer: > 0 visible. */
export const seen = (nv: number, nh: number) => nv * WV + nh * WH;
/** Brightness of a face with world normal (u, v, h): light from the upper left and above, −1…1. */
export function lit(u: number, v: number, h: number) {
  const flat = Math.sqrt(u * u + v * v);
  return 0.55 * h + (flat > 0.01 ? 0.75 * flat * facing(Math.atan2(v, u)) : 0);
}
const FACES = [
  // corner indices (p bit 4, q bit 2, z bit 1) and the face normal as [d, e, n] signs
  [4, 6, 7, 5, 1, 0, 0],
  [0, 1, 3, 2, -1, 0, 0],
  [2, 3, 7, 6, 0, 1, 0],
  [0, 4, 5, 1, 0, -1, 0],
  [1, 5, 7, 3, 0, 0, 1],
  [0, 2, 6, 4, 0, 0, -1],
];
/** Convex hull (screen) of the first `n` projected points into the scratch polygon, grown by `grow` px; returns its size. */
function hull(n: number, grow: number) {
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => SX[a] - SX[b] || SY[a] - SY[b]),
    cross = (o: number, a: number, b: number) => (SX[a] - SX[o]) * (SY[b] - SY[o]) - (SY[a] - SY[o]) * (SX[b] - SX[o]),
    out: number[] = [];
  for (const pass of [idx, [...idx].reverse()]) {
    const start = out.length;
    for (const i of pass) {
      while (out.length >= start + 2 && cross(out[out.length - 2], out[out.length - 1], i) <= 0) out.pop();
      out.push(i);
    }
    out.pop();
  }
  let cx = 0,
    cy = 0;
  for (const i of out) {
    cx += SX[i] / out.length;
    cy += SY[i] / out.length;
  }
  out.forEach((i, k) => {
    const dx = SX[i] - cx,
      dy = SY[i] - cy,
      l = Math.sqrt(dx * dx + dy * dy) || 1;
    point(k, SX[i] + (dx / l) * grow, SY[i] + (dy / l) * grow);
  });
  return out.length;
}
/**
 * A box in frame coordinates (p0…p1 along, q0…q1 across, z0…z1 up): a dark outline round its silhouette, then every
 * face turned to the viewer, lit by its normal. Returns whether the front face (+p) is visible.
 */
export function box(g: Ink, x: number, y0: number, f: Frame, p0: number, p1: number, q0: number, q1: number, z0: number, z1: number, color: number, front = color) {
  for (let i = 0; i < 8; i++) project(x, y0, f, i & 4 ? p1 : p0, i & 2 ? q1 : q0, i & 1 ? z1 : z0, i);
  fillPoints(g, hull(8, 0.7), OUTLINE, 0.9);
  let shown = false;
  for (const [a, b, c, d, sd, se, sn] of FACES) {
    const nu = sd * f.du + se * f.eu + sn * f.nu,
      nv = sd * f.dv + se * f.ev + sn * f.nv,
      nh = sd * f.dh + sn * f.nh;
    if (seen(nv, nh) <= 0.01) continue;
    if (sd > 0) shown = true;
    quad(g, SX[a], SY[a], SX[b], SY[b], SX[c], SY[c], SX[d], SY[d], shade(sd > 0 ? front : color, -0.25 + 0.42 * lit(nu, nv, nh)));
  }
  return shown;
}
/** A disc in the frame's (e, n) plane at `p` along the axis (a dish, a flange), radius r, `n` corners. */
export function plane(g: Ink, x: number, y0: number, f: Frame, p: number, r: number, color: number, alpha = 1, rz = r, n = 16) {
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    project(x, y0, f, p, Math.cos(t) * r, Math.sin(t) * rz, 0);
    point(i, SX[0], SY[0]);
  }
  fillPoints(g, n, color, alpha);
}
/** A straight rod between two points in tower ground coordinates (u, v, h), w px wide: outline, body, lit edge. */
export function rod(g: Ink, x: number, y0: number, u0: number, v0: number, h0: number, u1: number, v1: number, h1: number, w: number, color: number) {
  const ax = X(x, u0),
    ay = Y(y0, v0, h0),
    bx = X(x, u1),
    by = Y(y0, v1, h1);
  g.lineStyle(w + 1.4, OUTLINE, 0.9);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(w, color, 1);
  g.lineBetween(ax, ay, bx, by);
  g.lineStyle(Math.max(0.5, w * 0.35), shade(color, 0.35), 0.9);
  g.lineBetween(ax - 0.3, ay - 0.4, bx - 0.3, by - 0.4);
}

// --- Skyburst: a four-tube rocket rack on an elevating cradle. --------------------------------------------------------
const TILT = { drop: 5, squash: SQUASH, height: 13, pitch: 0.5, deck: 6 },
  SIDES = [-5.4, -1.8, 1.8, 5.4] as const,
  reach = (l: number) => 15 + l,
  RECOIL = 3;
const GUN = 0x3b4549,
  GUN_TOP = 0x56646a,
  METAL = 0x8a9a9c,
  DEEP = 0x1f272b;
/** The plinth: a chamfered square, flat sides to the viewer. */
const PLINTH = [-19, -12, -12, -19, 12, -19, 19, -12, 19, 12, 12, 19, -12, 19, -19, 12];
const PLINTH_H = 4.5,
  BEVEL = 1.5,
  DECK = PLINTH_H + BEVEL;
/** Cradle cheeks either side of the pod. */
const CHEEK = (s: number) => (s > 0 ? [-4.5, 8, 3.5, 8, 3.5, 10, -4.5, 10] : [-4.5, -10, 3.5, -10, 3.5, -8, -4.5, -8]);
/** Lights in the plinth's front faces (ground u, v at mid height), chasing from level 4. */
const FRONT_LIGHTS = [
  [-15.5, 15.5],
  [-5, 19],
  [5, 19],
  [15.5, 15.5],
];

export const concept: Concept = {
  tower: "skyburst",
  name: "Skyburst Rack",
  idea: "Four-tube rocket rack raised at 30° on a cradle over a chamfered plinth; noses return per reload quarter, radar spins at the back.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  sides: SIDES,
  base: ({ g, x, y, level, definition, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color;
    onGround(g, x, y0, 0, () => {
      oval(g, 5, 7, 25, 21, 0x050b10, 0.2);
      oval(g, 1.5, 2.5, 20, 18, 0x050b10, 0.35);
    });
    const n = turn(PLINTH, 0, FOOT);
    turn(PLINTH, 0, INSET, 0.9);
    block(g, x, y0, FOOT, INSET, n, 0, PLINTH_H, BEVEL, GUN, GUN_TOP, METAL);
    // Hazard stripe along the front lip in the tower colour, and the light sockets in the front faces.
    for (const [u, v] of FRONT_LIGHTS) {
      const lx = X(x, u),
        ly = Y(y0, v, PLINTH_H / 2);
      quad(g, lx - 1.6, ly - 1.1, lx + 1.6, ly - 1.1, lx + 1.6, ly + 1.1, lx - 1.6, ly + 1.1, DEEP);
      if (level < 4) quad(g, lx - 0.9, ly - 0.5, lx + 0.9, ly - 0.5, lx + 0.9, ly + 0.5, lx - 0.9, ly + 0.5, shade(color, level >= 2 ? -0.3 : -0.55));
    }
    onGround(g, x, y0, DECK, () => {
      // Corner studs, from level 3 with a second ring of bolts; an inlay in the trim colour from level 4.
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        disc(g, sx * 13, sy * 13, 2, shade(c, -0.55));
        disc(g, sx * 13 - 0.5, sy * 13 - 0.5, 0.8, shade(c, 0.1));
      }
      if (level >= 3)
        for (let i = 0; i < 8; i++) {
          const t = (i * Math.PI) / 4 + Math.PI / 8;
          disc(g, Math.cos(t) * 11.5, Math.sin(t) * 11.5, 0.8, DEEP);
        }
      if (level >= 4) {
        g.lineStyle(0.9, shade(color, -0.2), 0.95);
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          g.lineBetween(INSET[2 * i] * 0.88, INSET[2 * i + 1] * 0.88, INSET[2 * j] * 0.88, INSET[2 * j + 1] * 0.88);
        }
      }
    });
    // The turntable the cradle stands on.
    drum(g, x, y0, 9, DECK, DECK + 1.8, DEEP, shade(DEEP, 0.15), 14);
    // Level 5: armour skirts on the two front corners.
    if (level >= 5)
      for (const s of [-1, 1]) {
        const skirt = s < 0 ? [-19.6, 12, -12, 19.6, -10.5, 19.6, -18.1, 12] : [12, 19.6, 19.6, 12, 18.1, 12, 10.5, 19.6];
        // Footprints must run clockwise: these are thin slabs hugging the chamfer.
        const m = turn(skirt, 0, FOOT);
        block(g, x, y0, FOOT, FOOT, m, 0.5, PLINTH_H - 0.5, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.2));
      }
  },
  turret: ({ g, x, y, tower, definition, level, kick, tip, color }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      pitch = TILT.pitch,
      HB = TILT.height,
      end = reach(level) - kick * RECOIL,
      back = -kick * RECOIL,
      ca = Math.cos(a),
      sa = Math.sin(a),
      f = frame(a, pitch, HB),
      podFront = end - 3.5,
      toward = towardViewer(a, pitch) > 0.02;
    // Shadow of the pod on the deck.
    onGround(g, x, y0, DECK + 1.8, () => {
      const s = turn([-8, -8, podFront * 0.85, -8, podFront * 0.85, 8, -8, 8], a, FOOT);
      for (let i = 0; i < s; i++) point(i, FOOT[2 * i] + 5, FOOT[2 * i + 1] + 7);
      fillPoints(g, s, 0x050b10, 0.25);
    });
    const cheek = (s: number) => {
        const n = turn(CHEEK(s), a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, DECK + 1.8, HB + 2.5, 0.6, GUN, GUN_TOP, METAL);
        // Trunnion hub on the outer face.
        const hx = X(x, -sa * s * 10.2),
          hy = Y(y0, ca * s * 10.2, HB);
        if (ca * s > -0.2) {
          disc(g, hx, hy, 2.2, OUTLINE);
          disc(g, hx, hy, 1.6, METAL);
          disc(g, hx - 0.3, hy - 0.3, 0.6, 0xd4dcdc);
        }
      },
      tubes = () => {
        for (const s of SIDES) {
          const tx = x - sa * s,
            ty = y0 + ca * s * SQUASH;
          tube(g, tx, ty, a, HB, podFront - 1, end, 1.7, shade(c, -0.15), 1, true, pitch);
          if (tip !== undefined) tube(g, tx, ty, a, HB, end - 1, end, 1.7, tip, 1, false, pitch);
          if (toward) endFace(g, tx, ty, a, HB, end, 1.15, OUTLINE, pitch);
        }
      },
      pod = () => {
        box(g, x, y0, f, -7 + back, podFront, -7.6, 7.6, -3.2, 3.2, shade(c, -0.55), shade(c, -0.45));
        // Tube channels along the top, and a warning band at the front from level 3.
        g.lineStyle(0.8, DEEP, 0.9);
        for (const s of SIDES) {
          project(x, y0, f, -5.5 + back, s, 3.25, 0);
          project(x, y0, f, podFront - 0.8, s, 3.25, 1);
          g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
        }
        if (level >= 3) {
          project(x, y0, f, podFront - 2.6, -7.6, 3.25, 0);
          project(x, y0, f, podFront - 1.4, -7.6, 3.25, 1);
          project(x, y0, f, podFront - 1.4, 7.6, 3.25, 2);
          project(x, y0, f, podFront - 2.6, 7.6, 3.25, 3);
          quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], shade(c, 0.15), 0.85);
        }
        // Level 6+: a trim stripe along the pod's spine in the path colour.
        if (level >= 6) {
          project(x, y0, f, -6.5 + back, -0.7, 3.3, 0);
          project(x, y0, f, podFront - 3.2, -0.7, 3.3, 1);
          project(x, y0, f, podFront - 3.2, 0.7, 3.3, 2);
          project(x, y0, f, -6.5 + back, 0.7, 3.3, 3);
          quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color);
        }
        // Level 5: armour plates on the flanks.
        if (level >= 5)
          for (const s of [-1, 1]) if (ca * s > -0.2) box(g, x, y0, f, -4 + back, podFront - 3, s * 7.6, s * 8.6, -2.6, 2.6, shade(c, -0.35));
        // Radar mast at the back of the pod (its dish is live).
        project(x, y0, f, -5 + back, 0, 3.2, 0);
        rod(g, SX[0], SY[0], 0, 0, 0, 0, 0, 3.5, 1.2, METAL);
      };
    const near = ca > 0 ? 1 : -1;
    cheek(-near);
    if (toward) {
      pod();
      tubes();
    } else {
      tubes();
      pod();
    }
    cheek(near);
  },
  live: ({ g, glow, x, y, tower, definition, level, kick, charge, clock, color, energy }) => {
    const a = tower.angle,
      y0 = y + TILT.drop,
      c = definition.color,
      pitch = TILT.pitch,
      HB = TILT.height,
      end = reach(level) - kick * RECOIL,
      back = -kick * RECOIL,
      ca = Math.cos(a),
      sa = Math.sin(a),
      f = frame(a, pitch, HB),
      toward = towardViewer(a, pitch) > 0.02;
    // Warhead noses return one per quarter of the reload.
    SIDES.forEach((s, i) => {
      if (!toward || charge < 0.25 * (i + 1)) return;
      endFace(g, x - sa * s, y0 + ca * s * SQUASH, a, HB, end - 0.3, 0.8, shade(c, 0.45), pitch);
    });
    // Search radar spinning on its mast.
    project(x, y0, f, -5 + back, 0, 3.2, 0);
    const rx = SX[0],
      ry = SY[0] - 3.5,
      spin = clock * 3 + tower.id;
    oval(g, rx, ry, 3.4, 1.2 + 1.6 * Math.abs(Math.cos(spin)), OUTLINE, 1, Math.sin(spin) * 0.4);
    oval(g, rx, ry, 2.8, 0.8 + 1.4 * Math.abs(Math.cos(spin)), shade(c, 0.1), 1, Math.sin(spin) * 0.4);
    // Level 2: a lamp at the back corner of the pod.
    if (level >= 2) {
      project(x, y0, f, -6.4 + back, ca > 0 ? 6.4 : -6.4, 3.3, 1);
      disc(g, SX[1], SY[1], 1.3, OUTLINE);
      disc(g, SX[1], SY[1], 0.8, shade(color, 0.2));
      disc(glow, SX[1], SY[1], 2.6, color, 0.35);
    }
    // Level 4: lights in the plinth's front faces chase round.
    if (level >= 4)
      FRONT_LIGHTS.forEach(([u, v], i) => {
        const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.2)),
          lx = X(x, u),
          ly = Y(y0, v, PLINTH_H / 2);
        quad(g, lx - 0.9, ly - 0.5, lx + 0.9, ly - 0.5, lx + 0.9, ly + 0.5, lx - 0.9, ly + 0.5, shade(color, -0.6 + 0.7 * on));
        if (on > 0.5) disc(glow, lx, ly, 2.4, color, 0.25 * on);
      });
    // Heat in the tubes right after a salvo; a glow on the mouths from level 5.
    for (const s of SIDES) {
      project(x, y0, { ...f, pu: -sa * s, pv: ca * s }, end, 0, 0, 2);
      if (kick > 0) halo(glow, SX[2], SY[2], 3.5 * (1 + kick), c, 0.25 * kick);
      if (energy > 0) disc(glow, SX[2], SY[2], 1.8, c, energy);
    }
  },
};
