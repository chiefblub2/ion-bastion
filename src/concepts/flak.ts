import { facing, halo } from "../render/material";
import { disc, oval, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube } from "../render/tower-art/tilt";
import type { Concept } from "./types";

// --- Batch A helpers (shared by flak, shrapnel, executioner, lance; candidates for the tilt kit). -------------------
/** Gunmetal palette shared by batch A: deep shadow, side metal, top metal, metallic highlight. */
export const GUN = { deep: 0x172227, side: 0x34434a, top: 0x52646b, metal: 0x8b9da1 } as const;
export const SHADOW_INK = 0x050b10;
/** Rectangle footprint (along p0..p1, across q0..q1), clockwise on the screen like the kit's shapes. */
export const rect = (p0: number, p1: number, q0: number, q1: number) => [p0, q0, p1, q0, p1, q1, p0, q1];
/** Turns `src` by `a` into `out` scaled by `k` about its own centroid (the kit's `turn` scales about the axis only). */
export function turnAbout(src: readonly number[], a: number, out: Float64Array, k = 1) {
  const n = src.length / 2,
    c = Math.cos(a),
    s = Math.sin(a);
  let pc = 0,
    qc = 0;
  for (let i = 0; i < n; i++) {
    pc += src[2 * i] / n;
    qc += src[2 * i + 1] / n;
  }
  for (let i = 0; i < n; i++) {
    const p = pc + (src[2 * i] - pc) * k,
      q = qc + (src[2 * i + 1] - qc) * k;
    out[2 * i] = p * c - q * s;
    out[2 * i + 1] = p * s + q * c;
  }
  return n;
}
/** An armoured block over a footprint turned by `a`; with `bevel` its top is inset by `k` about the footprint's centre. */
export function part(g: Ink, x: number, y0: number, a: number, shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number, glint: number, k = 0.8) {
  const n = turnAbout(shape, a, FOOT);
  turnAbout(shape, a, INSET, bevel >= 1 ? k : 1);
  block(g, x, y0, FOOT, INSET, n, h0, h1, bevel, wall, top, glint);
}
/** Screen point of (along p, across q, height h) on a turret aimed at `a`. */
export const framer = (x: number, y0: number, a: number) => {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (p: number, q: number, h: number) => [X(x, p * c - q * s), Y(y0, p * s + q * c, h)] as const;
};
/** Ground depth (towards the viewer) of a turret point: the painter's key. */
export const depth = (a: number, p: number, q: number) => p * Math.sin(a) + q * Math.cos(a);
/** Draws the parts back to front by their depth. */
export function paint(parts: [number, () => void][]) {
  parts.sort((l, r) => l[0] - r[0]);
  for (const [, draw] of parts) draw();
}
/** The kit's `tube` with the pivot shifted `q` across the aim (parallel barrels). */
export function tubeAt(g: Ink, x: number, y0: number, a: number, q: number, h: number, d0: number, d1: number, r: number, color: number, alpha = 1, detail = true, pitch = 0) {
  tube(g, x - Math.sin(a) * q, y0 + Math.cos(a) * q * SQUASH, a, h, d0, d1, r, color, alpha, detail, pitch);
}
export function endAt(g: Ink, x: number, y0: number, a: number, q: number, h: number, d: number, r: number, color: number, pitch = 0) {
  endFace(g, x - Math.sin(a) * q, y0 + Math.cos(a) * q * SQUASH, a, h, d, r, color, pitch);
}
/** Screen point `d` along a barrel shifted `q` across the aim, pitched by `pitch` off a pivot at height h. */
export function muzzleAt(x: number, y0: number, a: number, q: number, h: number, d: number, pitch = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    g = d * Math.cos(pitch);
  return [X(x, c * g - s * q), Y(y0, s * g + c * q, h + d * Math.sin(pitch))] as const;
}
/** A turret footprint's shadow cast to the lower right onto the plane at height h. */
export function castShadow(g: Ink, x: number, y0: number, a: number, shape: readonly number[], h: number, alpha = 0.25) {
  const n = turnAbout(shape, a, FOOT);
  onGround(g, x, y0, h, () => {
    for (let i = 0; i < n; i++) point(i, FOOT[2 * i] + 5, FOOT[2 * i + 1] + 7);
    fillPoints(g, n, SHADOW_INK, alpha);
  });
}
/** A small lamp: dark socket, lit glass and its light. */
export function lamp(g: Ink, glow: Ink, lx: number, ly: number, color: number, on = 1) {
  disc(g, lx, ly, 1.35, OUTLINE);
  disc(g, lx, ly, 0.85, shade(color, -0.5 + 0.7 * on));
  if (on > 0.3) disc(glow, lx, ly, 2.6, color, 0.35 * on);
}

// --- Flak: the Skyguard, twin AA guns on a yoke over a cross-braced plinth. ------------------------------------------
const TILT = { drop: 5, squash: SQUASH, height: 14, pitch: 0.42, deck: 6 },
  DROP = TILT.drop,
  HB = TILT.height,
  PITCH = TILT.pitch,
  SIDES = [-4, 4] as const,
  RECOIL = 4,
  reach = (l: number) => 20 + l;
/** Plinth: an octagon with long chamfers; outriggers reach out on the four axes. */
const PLINTH = [-14, -9, -9, -14, 9, -14, 14, -9, 14, 9, 9, 14, -9, 14, -14, 9];
const PLINTH_TOP = 4.5,
  DECK = 6;
const RIGGER = rect(10, 19, -2.4, 2.4),
  PAD = rect(17.5, 22, -3.8, 3.8);
/** The axes the outriggers point along, back to front. */
const AXES = [-Math.PI / 2, Math.PI, 0, Math.PI / 2];
/** Front wall slots of the plinth (fraction along the south, south-east and south-west faces). */
const SLOTS = [
  [9, 14, -9, 14],
  [14, 9, 9, 14],
  [-9, 14, -14, 9],
] as const;
const YOKE = rect(-7, 7, -8.5, 8.5),
  BOX = rect(-13.5, -6, -5, 5),
  CHEEK = [rect(-4, 4, 6, 8.5), rect(-4, 4, -8.5, -6)],
  PLATES = [rect(-3, 3, 8.5, 9.6), rect(-3, 3, -9.6, -8.5)];
const YOKE_TOP = 10.5,
  BOX_TOP = 16,
  CHEEK_TOP = 18;

function flakBase({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, 26, 22, SHADOW_INK, 0.2);
    oval(g, 1.5, 2.5, 17, 16, SHADOW_INK, 0.36);
  });
  for (const t of AXES) {
    part(g, x, y0, t, RIGGER, 0, 2.6, 0, GUN.side, GUN.top, GUN.metal);
    part(g, x, y0, t, PAD, 0, 3.4, 1, GUN.side, GUN.top, GUN.metal);
    const [bx, by] = framer(x, y0, t)(19.75, 0, 4.4);
    disc(g, bx, by, 1.3, GUN.deep);
    if (level >= 3) disc(g, bx - 0.4, by - 0.4, 0.6, GUN.metal);
  }
  // The plinth with the dark sockets of its wall slots, then the turntable.
  part(g, x, y0, 0, PLINTH, 0, PLINTH_TOP, 1.5, GUN.side, shade(GUN.top, -0.08), GUN.metal, 0.86);
  for (const [u0, v0, u1, v1] of SLOTS) {
    const ax = X(x, u0 + (u1 - u0) * 0.25),
      ay = Y(y0, v0 + (v1 - v0) * 0.25, 2.2),
      bx = X(x, u0 + (u1 - u0) * 0.75),
      by = Y(y0, v0 + (v1 - v0) * 0.75, 2.2);
    quad(g, ax, ay - 1, bx, by - 1, bx, by + 1, ax, ay + 1, GUN.deep);
  }
  // Pink hazard chevrons on the deck corners, a trim inlay from level 4.
  onGround(g, x, y0, DECK, () => {
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      g.fillStyle(shade(c, -0.25), 0.9);
      g.fillTriangle(sx * 11.5, sy * 7, sx * 7, sy * 11.5, sx * 10.5, sy * 10.5);
    }
    if (level >= 4) {
      g.lineStyle(0.8, shade(color, -0.2), 0.9);
      g.strokeRect(-10.5, -10.5, 21, 21);
    }
  });
  drum(g, x, y0, 10, DECK, DECK + 2.2, GUN.deep, shade(GUN.deep, 0.18), 14);
}

function flakTurret(ctx: TurretContext) {
  const { g, x, y, tower, definition, level, kick, tip, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    back = -kick * RECOIL,
    end = reach(level) + back;
  castShadow(g, x, y0, a, rect(-13.5, 7, -8.5, 8.5), DECK + 2.2, 0.22);
  part(g, x, y0, a, YOKE, DECK + 2.2, YOKE_TOP, 0.8, GUN.side, GUN.top, GUN.metal);
  const parts: [number, () => void][] = [
    [
      depth(a, -9.75, 0),
      () => {
        part(g, x, y0, a, BOX, YOKE_TOP, BOX_TOP - 1, 1, shade(c, -0.55), shade(c, -0.25), shade(c, 0.3));
        // Belt slot on the box roof and, from level 6, a trim stripe in the path colour.
        const s = [P(-12, -1.2, BOX_TOP), P(-7, -1.2, BOX_TOP), P(-7, 1.2, BOX_TOP), P(-12, 1.2, BOX_TOP)];
        quad(g, ...s[0], ...s[1], ...s[2], ...s[3], shade(c, -0.75));
        if (level >= 6) {
          const t = [P(-12.5, -3.6, BOX_TOP), P(-6.8, -3.6, BOX_TOP), P(-6.8, -2.6, BOX_TOP), P(-12.5, -2.6, BOX_TOP)];
          quad(g, ...t[0], ...t[1], ...t[2], ...t[3], color);
        }
        if (level >= 3)
          for (const q of [-3.8, 3.8]) {
            const [bx, by] = P(-12.6, q, BOX_TOP);
            disc(g, bx, by, 0.8, OUTLINE);
          }
      },
    ],
  ];
  CHEEK.forEach((cheek, i) => {
    const q = i === 0 ? 7.25 : -7.25;
    parts.push([
      depth(a, 0, q),
      () => {
        if (level >= 5) part(g, x, y0, a, PLATES[i], YOKE_TOP + 0.5, CHEEK_TOP - 1.5, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.3));
        part(g, x, y0, a, cheek, YOKE_TOP, CHEEK_TOP, 0.6, GUN.side, GUN.top, GUN.metal);
        // Trunnion pin on the outer face.
        const [tx, ty] = P(0, i === 0 ? 8.7 : -8.7, HB);
        disc(g, tx, ty, 2, GUN.deep);
        disc(g, tx - 0.4, ty - 0.4, 0.9, level >= 6 ? color : GUN.metal);
      },
    ]);
  });
  for (const q of SIDES) {
    const mid = (end * 0.5) * Math.cos(PITCH);
    parts.push([
      depth(a, mid, q),
      () => {
        tubeAt(g, x, y0, a, q, HB, -3 + back, 8 + back, 2.7, GUN.side, 1, true, PITCH);
        if (level >= 3) tubeAt(g, x, y0, a, q, HB, 5 + back, 6.4 + back, 2.8, shade(c, -0.2), 1, false, PITCH);
        tubeAt(g, x, y0, a, q, HB, 8 + back, end - 3, 1.6, shade(GUN.top, 0.1), 1, true, PITCH);
        tubeAt(g, x, y0, a, q, HB, end - 3, end, 2.2, shade(GUN.side, -0.1), 1, true, PITCH);
        if (tip !== undefined) tubeAt(g, x, y0, a, q, HB, end - 1, end, 2.2, tip, 1, false, PITCH);
        if (towardViewer(a, PITCH) > 0.05) {
          endAt(g, x, y0, a, q, HB, end, 2.2, shade(GUN.side, -0.4), PITCH);
          endAt(g, x, y0, a, q, HB, end, 1.1, OUTLINE, PITCH);
        }
      },
    ]);
  }
  paint(parts);
}

function flakLive(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, kick, charge, energy, clock, color } = ctx,
    a = tower.angle,
    c = definition.color,
    y0 = y + DROP,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  // Plinth slots: steady and dim, from level 4 a light chases across them.
  SLOTS.forEach(([u0, v0, u1, v1], i) => {
    const on = level >= 4 ? 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.4)) : 0.35,
      ax = X(x, u0 + (u1 - u0) * 0.3),
      ay = Y(y0, v0 + (v1 - v0) * 0.3, 2.2),
      bx = X(x, u0 + (u1 - u0) * 0.7),
      by = Y(y0, v0 + (v1 - v0) * 0.7, 2.2);
    g.lineStyle(1, shade(color, -0.6 + 0.7 * on), 1);
    g.lineBetween(ax, ay, bx, by);
    if (on > 0.5) {
      glow.lineStyle(2.4, color, 0.22 * on);
      glow.lineBetween(ax, ay, bx, by);
    }
  });
  // The ammo box's lamp (one from level 2) and the rounds in the belt slot, filling as the guns reload.
  if (level >= 2) {
    const [lx, ly] = P(-12.6, Math.cos(a) > 0 ? 3.6 : -3.6, BOX_TOP + 0.2);
    lamp(g, glow, lx, ly, color);
  }
  const rounds = Math.round(charge * 4);
  for (let i = 0; i < 4; i++) {
    const [rx, ry] = P(-11.4 + i * 1.3, 0, BOX_TOP + 0.3);
    disc(g, rx, ry, 0.55, i < rounds ? 0xd9b25e : shade(c, -0.7));
  }
  // Hot muzzles right after a burst, a steady glow from level 5.
  for (const q of SIDES) {
    const [mx, my] = muzzleAt(x, y0, a, q, HB, end, PITCH);
    if (kick > 0) halo(glow, mx, my, 4.5 * (1 + kick), c, 0.3 * kick);
    if (energy > 0) disc(glow, mx, my, 2.4, c, energy);
  }
  void facing;
}

export const concept: Concept = {
  tower: "flak",
  name: "Skyguard",
  idea: "Twin AA guns on a yoke, pitched high; ammo box behind, belt rounds refill with the charge. Plinth with outriggers on the axes.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  sides: SIDES,
  base: flakBase,
  turret: flakTurret,
  live: flakLive,
};
