/**
 * Hex Sentinel: a visual experiment for a new Pulse tower look in a slight 3/4 tilt, drawn with plain Phaser Graphics.
 * Demo only (`/gallery.html?sentinel`, `src/sentinel-demo.ts`): the game's Pulse still draws with `turrets-attack.ts`.
 *
 * World axes around the tower's ground centre: u east, v south, h up; a point lands on the screen at
 * (x + u, y0 + v × SQUASH − h). The still foundation (`drawSentinelBase`) depends only on the level, so it bakes like
 * any tower body; its light (`drawSentinelLight`), the turret (`drawSentinelTurret`) and the flash are live.
 */
import { LIGHT, facing, halo, plate, sunken } from "../material";
import { MUZZLES } from "../muzzles";
import { arcBand, disc, oval, ring, shade, type Ink, type Pen } from "../shapes";

/** Shape and palette of the Hex Sentinel. */
export const SENTINEL = {
  /** Hex radius of the foundation, its extrusion and the vertical squash of the ground plane. */
  radius: 21,
  extrusion: 7,
  squash: 0.65,
  /** The ground centre sits this far below the cell centre, so base and turret together centre in the cell. */
  drop: 5,
  /** Height of the barrel axis (the pivot of aim and recoil). */
  barrelHeight: 15,
  deep: 0x14282f,
  side: 0x25434a,
  armor: 0x46636a,
  metal: 0x76918f,
  energy: 0x93f5b8,
  casing: 0x34474e,
} as const;
const { radius: R, extrusion: H, squash: SQ, drop: DROP, barrelHeight: HB } = SENTINEL;
const DEEP = SENTINEL.deep,
  SIDE = SENTINEL.side,
  ARMOR = SENTINEL.armor,
  METAL = SENTINEL.metal,
  ENERGY = SENTINEL.energy,
  CASING = SENTINEL.casing,
  OUTLINE = 0x081217;

/** What the live parts read: aim, charge (0–1, 1 = ready), recoil kick (1 right after a shot), level and time. */
export interface SentinelPose {
  angle: number;
  charge: number;
  kick: number;
  level: number;
  clock: number;
}

// Scratch buffers, reused by every call, so a frame allocates nothing.
const PTS = Array.from({ length: 24 }, () => ({ x: 0, y: 0 }));
const FOOT = new Float64Array(32),
  INSET = new Float64Array(32);
function fillPts(g: Ink, n: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillPoints(PTS, true, false, n);
}
function quad(g: Ink, x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillTriangle(x0, y0, x1, y1, x2, y2);
  g.fillTriangle(x0, y0, x2, y2, x3, y3);
}
const X = (x: number, u: number) => x + u,
  Y = (y0: number, v: number, h: number) => y0 + v * SQ - h;

/** Turns a footprint (along, across pairs) by `a` into `out` (u, v pairs), scaled by `k` about the centre. */
function turn(src: readonly number[], a: number, out: Float64Array, k = 1, along = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  for (let i = 0; i < src.length; i += 2) {
    const p = (src[i] - along) * k + along,
      q = src[i + 1] * k;
    out[i] = p * c - q * s;
    out[i + 1] = p * s + q * c;
  }
  return src.length / 2;
}
/** Outward normal angle of edge i of a convex footprint whose corners run clockwise on the screen. */
function normalOf(f: Float64Array, n: number, i: number) {
  const j = (i + 1) % n;
  return Math.atan2(-(f[2 * j] - f[2 * i]), f[2 * j + 1] - f[2 * i + 1]);
}
/**
 * Armoured block over a convex footprint (clockwise): walls from h0 to h1 on the sides turned to the viewer, a chamfer
 * up to an inset top at h1 + `bevel`, and the lit top. Walls darken the further they face from the light.
 */
function block(g: Ink, x: number, y0: number, f: Float64Array, inset: Float64Array, n: number, h0: number, h1: number, bevel: number, wall: number, top: number) {
  // Dark silhouette first, so a seam stays between the faces and round the bottom.
  for (let i = 0; i < n; i++) {
    PTS[i].x = X(x, f[2 * i]);
    PTS[i].y = Y(y0, f[2 * i + 1], h1);
  }
  fillPts(g, n, OUTLINE, 0.9);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = normalOf(f, n, i);
    if (Math.sin(a) <= 0.02) continue;
    const u0 = X(x, f[2 * i]),
      u1 = X(x, f[2 * j]),
      lit = facing(a),
      face = shade(wall, 0.3 * lit),
      b0 = Y(y0, f[2 * i + 1], h0),
      b1 = Y(y0, f[2 * j + 1], h0),
      t0 = Y(y0, f[2 * i + 1], h1),
      t1 = Y(y0, f[2 * j + 1], h1);
    quad(g, u0 - 0.5, b0 + 0.6, u1 + 0.5, b1 + 0.6, u1 + 0.5, t1, u0 - 0.5, t0, OUTLINE, 0.9);
    quad(g, u0, b0, u1, b1, u1, t1, u0, t0, face);
    // Seam at mid height and a lit lip along the top edge.
    g.lineStyle(0.6, shade(face, -0.45), 0.9);
    g.lineBetween(u0, (b0 + t0) / 2 + 0.6, u1, (b1 + t1) / 2 + 0.6);
    quad(g, u0, t0, u1, t1, u1, t1 + 0.9, u0, t0 + 0.9, shade(face, 0.28));
  }
  // Chamfer faces between the wall tops and the inset top; north-facing ones fall under the top.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = normalOf(f, n, i),
      lit = facing(a);
    quad(
      g,
      X(x, f[2 * i]), Y(y0, f[2 * i + 1], h1),
      X(x, f[2 * j]), Y(y0, f[2 * j + 1], h1),
      X(x, inset[2 * j]), Y(y0, inset[2 * j + 1], h1 + bevel),
      X(x, inset[2 * i]), Y(y0, inset[2 * i + 1], h1 + bevel),
      shade(top, -0.12 + 0.32 * lit),
    );
  }
  for (let i = 0; i < n; i++) {
    PTS[i].x = X(x, inset[2 * i]);
    PTS[i].y = Y(y0, inset[2 * i + 1], h1 + bevel);
  }
  fillPts(g, n, top);
  // Metallic glint on the top edges that face the light.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (facing(normalOf(inset, n, i)) < 0.45) continue;
    g.lineStyle(0.8, METAL, 0.9);
    g.lineBetween(PTS[i].x, PTS[i].y + 0.4, PTS[j].x, PTS[j].y + 0.4);
  }
}
/**
 * Horizontal tube along ground angle `a` at height h, from distance d0 to d1 off the pivot, radius r: dark outline,
 * body, a highlight on the side turned up and to the light, a shaded underside.
 */
function tube(g: Ink, x: number, y0: number, a: number, h: number, d0: number, d1: number, r: number, color: number, alpha = 1) {
  const c = Math.cos(a),
    s = Math.sin(a),
    x0 = X(x, c * d0),
    ys = Y(y0, s * d0, h),
    x1 = X(x, c * d1),
    y1 = Y(y0, s * d1, h),
    len = Math.sqrt((x1 - x0) ** 2 + (y1 - ys) ** 2) || 1,
    px = -(y1 - ys) / len,
    py = (x1 - x0) / len,
    up = px * Math.cos(LIGHT) * 0.5 + py * -1 > 0 ? 1 : -1,
    band = (s0: number, s1: number, col: number, al: number) =>
      quad(g, x0 + px * s0, ys + py * s0, x1 + px * s0, y1 + py * s0, x1 + px * s1, y1 + py * s1, x0 + px * s1, ys + py * s1, col, al);
  band(-r - 0.8, r + 0.8, OUTLINE, 0.85 * alpha);
  band(-r, r, color, alpha);
  band(up * r, up * r * 0.15, shade(color, 0.25), alpha);
  band(up * r * 0.75, up * r * 0.45, shade(color, 0.55), 0.8 * alpha);
  band(-up * r, -up * r * 0.35, shade(color, -0.4), alpha);
  return up;
}
/** Disc facing along ground angle `a` (a barrel's end face), centre `d` along the aim at height h. */
function endFace(g: Ink, x: number, y0: number, a: number, h: number, d: number, r: number, color: number, alpha = 1) {
  const c = Math.cos(a),
    s = Math.sin(a),
    n = 14;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2,
      across = Math.cos(t) * r;
    PTS[i].x = X(x, c * d - s * across);
    PTS[i].y = Y(y0, s * d + c * across, h + Math.sin(t) * r);
  }
  fillPts(g, n, color, alpha);
}
/** Calls `draw` with `ink` mapped onto the ground plane at height h around (x, y0). */
function onGround(ink: Ink, x: number, y0: number, h: number, draw: () => void) {
  ink.save();
  ink.translateCanvas(x, y0 - h);
  ink.scaleCanvas(1, SQ);
  draw();
  ink.restore();
}

// --- Footprints (along, across), clockwise on the screen with v pointing down. ---------------------------------------
/** The foundation: corners at 0°, 60°, …, so a flat face looks at the viewer. */
const HEX = Array.from({ length: 12 }, (_, i) => (i % 2 ? Math.sin : Math.cos)((Math.floor(i / 2) * Math.PI) / 3) * R);
/** The armoured shell: a stretched octagon, blunt at the back, angled at the front. */
const SHELL = [-12, -5.6, -8, -9.6, 6, -9.6, 11.5, -5.6, 11.5, 5.6, 6, 9.6, -8, 9.6, -12, 5.6];
/** The reinforced cannon housing in front of the shell, narrowing towards the barrel. */
const HOUSING = [9, -4.5, 15, -3.6, 15, 3.6, 9, 4.5];
/** Heat fins at the back from level 5. */
const FINS = [-5, 0, 5].map((q) => [-15.5, q - 0.8, -11.5, q - 0.8, -11.5, q + 0.8, -15.5, q + 0.8]);
const SHELL_BASE = H + 2.6,
  SHELL_TOP = H + 9.6,
  SHELL_BEVEL = 2.4,
  HOUSING_BASE = HB - 2.8,
  HOUSING_TOP = HB + 2.6;
/** Distance of the muzzle from the pivot and the recoil, from the shared muzzle table. */
const reach = (level: number, kick: number) => MUZZLES.barrel!.reach(level) - kick * MUZZLES.barrel!.recoil;

/** Screen point of the muzzle for a tower whose cell centre is (x, y). */
export function sentinelMuzzle(x: number, y: number, angle: number, level: number, kick = 0) {
  const d = reach(level, kick);
  return { x: X(x, Math.cos(angle) * d), y: Y(y + DROP, Math.sin(angle) * d, HB) };
}

/**
 * The still foundation on `g` (cacheable per level): contact shadow, the extruded hex with seams, energy slots and
 * bevels, the deck with its recessed bearing and the fixed bearing collar.
 */
export function drawSentinelBase(g: Ink, x: number, y: number, level: number) {
  const y0 = y + DROP;
  // Contact shadow: a tight dark core under the block and a soft spread to the lower right.
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, R + 6, R + 2, 0x050b10, 0.22);
    oval(g, 2, 3, R + 1.5, R, 0x050b10, 0.35);
  });
  // Extruded walls: the three faces turned to the viewer, darker the further they face from the light.
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6,
      a = (i * Math.PI) / 3 + Math.PI / 6;
    if (Math.sin(a) <= 0.02) continue;
    const u0 = X(x, HEX[2 * i]),
      u1 = X(x, HEX[2 * j]),
      b0 = Y(y0, HEX[2 * i + 1], 0),
      b1 = Y(y0, HEX[2 * j + 1], 0),
      t0 = Y(y0, HEX[2 * i + 1], H),
      t1 = Y(y0, HEX[2 * j + 1], H),
      lit = facing(a),
      face = shade(SIDE, 0.28 * lit),
      at = (f: number, h: number) => [u0 + (u1 - u0) * f, b0 + (b1 - b0) * f - h] as const;
    quad(g, u0 - 0.7, b0 + 1, u1 + 0.7, b1 + 1, u1 + 0.7, t1, u0 - 0.7, t0, OUTLINE, 0.95);
    quad(g, u0, b0, u1, b1, u1, t1, u0, t0, face);
    // Dark foot along the ground and a lit lip under the deck edge.
    quad(g, u0, b0 - 1.2, u1, b1 - 1.2, u1, b1, u0, b0, shade(face, -0.45));
    quad(g, u0, t0, u1, t1, u1, t1 + 1, u0, t0 + 1, shade(face, 0.32));
    // Panel seams: two upright joints and a recessed line.
    g.lineStyle(0.7, DEEP, 0.9);
    for (const f of [0.2, 0.8]) {
      const [sx, sy] = at(f, 1.2),
        [, ty] = at(f, H - 1.2);
      g.lineBetween(sx, sy, sx, ty);
    }
    // Energy slot in the middle panel: a dark socket and its dim glass (the light itself is live).
    const [ax, ay] = at(0.32, 3),
      [bx, by] = at(0.68, 3);
    quad(g, ax, ay - 1.3, bx, by - 1.3, bx, by + 1.3, ax, ay + 1.3, DEEP);
    quad(g, ax + 0.6, ay - 0.6, bx - 0.6, by - 0.6, bx - 0.6, by + 0.6, ax + 0.6, ay + 0.6, shade(ENERGY, -0.45));
    if (level >= 3) {
      g.fillStyle(shade(METAL, -0.2));
      for (const f of [0.1, 0.9]) {
        const [rx, ry] = at(f, H / 2);
        g.fillRect(rx - 0.7, ry - 0.7, 1.4, 1.4);
      }
    }
  }
  // Corner edges between the walls catch a sliver of light on the left.
  g.lineStyle(0.8, shade(SIDE, 0.45), 0.8);
  g.lineBetween(X(x, HEX[4]), Y(y0, HEX[5], 0.6), X(x, HEX[4]), Y(y0, HEX[5], H - 0.4));
  // The deck: a bevelled hex plate, the bearing recess, seams and bolts.
  onGround(g, x, y0, H, () => {
    plate(g, 0, 0, { n: 6, rot: 0 }, R, ARMOR);
    g.lineStyle(0.7, DEEP, 0.55);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.lineBetween(Math.cos(a) * 13.5, Math.sin(a) * 13.5, Math.cos(a) * (R - 2.2), Math.sin(a) * (R - 2.2));
    }
    sunken(g, 0, 0, "disc", 12.4, DEEP);
    // Energy ring groove under the turret; its glass is dim here, the charge lights it live.
    ring(g, 0, 0, 10, 2.2, OUTLINE, 0.9);
    ring(g, 0, 0, 10, 1.1, shade(ENERGY, -0.42));
    const bolts = level >= 3 ? 6 : 3;
    for (let i = 0; i < bolts; i++) {
      const a = Math.PI / 6 + (i * Math.PI * 2) / bolts,
        bx = Math.cos(a) * 16.5,
        by = Math.sin(a) * 16.5;
      disc(g, bx, by, 1.5, shade(ARMOR, -0.45));
      disc(g, bx - 0.4, by - 0.4, 0.7, METAL, 0.9);
    }
  });
  // Bearing collar standing in the recess: a short dark drum.
  const cx = x,
    top = H + 2.6;
  oval(g, cx, Y(y0, 0, H), 8.3, 8.3 * SQ, OUTLINE, 0.95);
  for (let i = 0; i < 12; i++) {
    const t0 = (i / 12) * Math.PI,
      t1 = ((i + 1) / 12) * Math.PI;
    quad(
      g,
      X(cx, Math.cos(t0) * 7.6), Y(y0, Math.sin(t0) * 7.6, H),
      X(cx, Math.cos(t1) * 7.6), Y(y0, Math.sin(t1) * 7.6, H),
      X(cx, Math.cos(t1) * 7.6), Y(y0, Math.sin(t1) * 7.6, top),
      X(cx, Math.cos(t0) * 7.6), Y(y0, Math.sin(t0) * 7.6, top),
      shade(CASING, -0.2 + 0.35 * facing((t0 + t1) / 2)),
    );
  }
  oval(g, cx, Y(y0, 0, top), 7.6, 7.6 * SQ, shade(CASING, 0.1));
  onGround(g, cx, y0, top, () => arcBand(g, 0, 0, 7.1, 0.9, LIGHT - 0.9, LIGHT + 0.9, METAL, 0.8));
}

/** Light of the foundation on an additive layer under the turret: the energy ring and the wall slots, by charge. */
export function drawSentinelLight(glow: Ink, x: number, y: number, pose: SentinelPose) {
  const y0 = y + DROP,
    k = 0.25 + 0.75 * pose.charge,
    boost = pose.level >= 5 ? 1.2 : 1;
  onGround(glow, x, y0, H, () => {
    ring(glow, 0, 0, 10, 1.2, ENERGY, Math.min(0.7, 0.35 * k * boost + 0.1));
    ring(glow, 0, 0, 10, 4, ENERGY, 0.12 * k * boost);
  });
  for (let i = 0; i < 3; i++) {
    const j = i + 1,
      u0 = HEX[2 * i],
      v0 = HEX[2 * i + 1],
      u1 = HEX[2 * j],
      v1 = HEX[2 * j + 1],
      // The slots light one after another as the charge builds.
      on = Math.max(0, Math.min(1, pose.charge * 3 - (2 - i))) * 0.6 + 0.25;
    glow.lineStyle(2.6, ENERGY, 0.22 * on * boost);
    glow.lineBetween(X(x, u0 + (u1 - u0) * 0.33), Y(y0, v0 + (v1 - v0) * 0.33, 3), X(x, u0 + (u1 - u0) * 0.67), Y(y0, v0 + (v1 - v0) * 0.67, 3));
    glow.lineStyle(1, shade(ENERGY, 0.3), 0.6 * on);
    glow.lineBetween(X(x, u0 + (u1 - u0) * 0.34), Y(y0, v0 + (v1 - v0) * 0.34, 3), X(x, u0 + (u1 - u0) * 0.66), Y(y0, v0 + (v1 - v0) * 0.66, 3));
  }
}

/** The live weapon assembly: its cast shadow, the turning bearing teeth, shell, cannon housing and barrel. */
export function drawSentinelTurret({ g, glow }: Pen, x: number, y: number, pose: SentinelPose) {
  const { angle: a, charge, kick, level } = pose,
    y0 = y + DROP,
    c = Math.cos(a),
    s = Math.sin(a),
    end = reach(level, kick),
    away = s < 0;
  // Shadow of the shell on the deck, cast to the lower right.
  turn(SHELL, a, FOOT);
  onGround(g, x, y0, H, () => {
    for (let i = 0; i < 8; i++) {
      PTS[i].x = FOOT[2 * i] + 4.5;
      PTS[i].y = FOOT[2 * i + 1] + 6;
    }
    fillPts(g, 8, 0x050b10, 0.3);
  });
  // Bearing teeth on the collar's front, turning with the aim.
  g.fillStyle(shade(METAL, -0.25), 0.9);
  for (let i = 0; i < 8; i++) {
    const t = a + (i * Math.PI) / 4,
      st = Math.sin(t);
    if (st <= 0.15) continue;
    const tx = X(x, Math.cos(t) * 7.7),
      ty = Y(y0, st * 7.7, H + 1.3);
    g.fillRect(tx - 0.5, ty - 1, 1, 2);
  }
  const barrel = () => {
      const from = 14.5 - kick * MUZZLES.barrel!.recoil;
      tube(g, x, y0, a, HB, from, end - 3.6, 2.3, CASING);
      // Energy channel along the barrel's top, brighter as the shot charges.
      tube(g, x, y0, a, HB + 1.1, from + 1, end - 4.4, 0.65, shade(ENERGY, -0.35 + 0.45 * charge));
      const tip = level >= 5 ? shade(ENERGY, 0.2) : shade(CASING, -0.15);
      tube(g, x, y0, a, HB, end - 3.6, end, 3.1, shade(CASING, -0.1));
      tube(g, x, y0, a, HB, end - 1.4, end, 3.1, tip);
      // Brake slots.
      tube(g, x, y0, a, HB, end - 2.7, end - 2.1, 3.2, OUTLINE, 0.7);
      if (s > 0.12) {
        endFace(g, x, y0, a, HB, end, 3.1, shade(CASING, -0.45));
        endFace(g, x, y0, a, HB, end, 1.4, shade(ENERGY, -0.1 + 0.4 * charge));
      }
      // Channel and muzzle light.
      const m0x = X(x, c * (from + 1)),
        m0y = Y(y0, s * (from + 1), HB + 1.1),
        m1x = X(x, c * (end - 4.4)),
        m1y = Y(y0, s * (end - 4.4), HB + 1.1);
      glow.lineStyle(2.2, ENERGY, 0.12 + 0.3 * charge);
      glow.lineBetween(m0x, m0y, m1x, m1y);
      const mx = X(x, c * end),
        my = Y(y0, s * end, HB);
      disc(glow, mx, my, 2.6, ENERGY, 0.15 + 0.35 * charge);
    },
    housing = () => {
      const n = turn(HOUSING, a, FOOT);
      turn(HOUSING, a, INSET, 0.85, 12);
      block(g, x, y0, FOOT, INSET, n, HOUSING_BASE, HOUSING_TOP - 0.8, 0.8, shade(SIDE, 0.05), shade(ARMOR, 0.05));
    },
    fins = () => {
      if (level < 5) return;
      for (const fin of FINS) {
        const n = turn(fin, a, FOOT);
        turn(fin, a, INSET, 0.9, -13.5);
        block(g, x, y0, FOOT, INSET, n, SHELL_BASE + 0.8, SHELL_TOP - 1, 0.4, SIDE, ARMOR);
      }
    },
    shell = () => {
      const n = turn(SHELL, a, FOOT);
      turn(SHELL, a, INSET, 0.8, -0.25);
      block(g, x, y0, FOOT, INSET, n, SHELL_BASE, SHELL_TOP, SHELL_BEVEL, SIDE, shade(ARMOR, 0.08));
      const ht = SHELL_TOP + SHELL_BEVEL,
        P = (p: number, q: number, h = ht) => [X(x, p * c - q * s), Y(y0, p * s + q * c, h)] as const;
      // Top panel: a seam across and the recessed energy channel along the axis.
      const [s0x, s0y] = P(-3, -6.8),
        [s1x, s1y] = P(-3, 6.8);
      g.lineStyle(0.7, DEEP, 0.85);
      g.lineBetween(s0x, s0y, s1x, s1y);
      const [a0x, a0y] = P(-7.5, -1.6),
        [a1x, a1y] = P(6.5, -1.6),
        [a2x, a2y] = P(6.5, 1.6),
        [a3x, a3y] = P(-7.5, 1.6);
      quad(g, a0x, a0y, a1x, a1y, a2x, a2y, a3x, a3y, DEEP);
      const fill = -7 + 13 * charge,
        [f0x, f0y] = P(-7, -0.8),
        [f1x, f1y] = P(fill, -0.8),
        [f2x, f2y] = P(fill, 0.8),
        [f3x, f3y] = P(-7, 0.8);
      if (charge > 0.02) quad(g, f0x, f0y, f1x, f1y, f2x, f2y, f3x, f3y, shade(ENERGY, -0.1 + 0.3 * charge));
      glow.lineStyle(2.4, ENERGY, 0.1 + 0.35 * charge);
      glow.lineBetween((f0x + f3x) / 2, (f0y + f3y) / 2, (f1x + f2x) / 2, (f1y + f2y) / 2);
      // Indicator lamps at the back corners: one at level 1, two from level 3.
      for (const q of level >= 3 ? [-5.6, 5.6] : [5.6]) {
        const [lx, ly] = P(-8.6, q);
        disc(g, lx, ly, 1.3, OUTLINE);
        disc(g, lx, ly, 0.8, shade(ENERGY, 0.2));
        disc(glow, lx, ly, 2.4, ENERGY, 0.35);
      }
      // Level 3: bolt heads on the front corners of the top.
      if (level >= 3)
        for (const q of [-5.2, 5.2]) {
          const [bx, by] = P(4.2, q);
          disc(g, bx, by, 0.9, shade(ARMOR, -0.45));
          disc(g, bx - 0.3, by - 0.3, 0.4, METAL);
        }
    };
  if (away) {
    barrel();
    housing();
    shell();
    fins();
  } else {
    fins();
    shell();
    housing();
    barrel();
  }
  if (level >= 5) halo(glow, X(x, 0), Y(y0, 0, SHELL_TOP + SHELL_BEVEL), 14, ENERGY, 0.05);
}

/** Muzzle flash at the projected muzzle, `age` seconds after a shot (gone after 0.3 s); the tower's own glow is live. */
export function drawSentinelFlash({ g, glow }: Pen, x: number, y: number, pose: SentinelPose, age: number) {
  if (age < 0 || age > 0.3) return;
  const m = sentinelMuzzle(x, y, pose.angle, pose.level, pose.kick),
    // The screen direction of the barrel.
    dx = Math.cos(pose.angle),
    dy = Math.sin(pose.angle) * SQ,
    len = Math.sqrt(dx * dx + dy * dy) || 1,
    co = dx / len,
    si = dy / len,
    k = age / 0.08;
  if (k < 1) {
    const l = 4 + 9 * (1 - k) * (0.5 + 0.5 * len);
    glow.fillStyle(shade(ENERGY, 0.3), 0.55 * (1 - k));
    glow.fillTriangle(m.x - si * 2.2, m.y + co * 2.2, m.x + si * 2.2, m.y - co * 2.2, m.x + co * l, m.y + si * l);
    disc(g, m.x + co, m.y + si, 3 * (1 - k) + 0.5, 0xffffff, 1 - k);
  }
  halo(glow, m.x, m.y, 7, ENERGY, 0.3 * Math.max(0, 1 - age / 0.3));
}

/** Whole tower in one call, unbaked: base and turret on `g`, light on `under` (below the turret) and `glow`. */
export function drawHexSentinel(pen: Pen, under: Ink, x: number, y: number, pose: SentinelPose) {
  drawSentinelBase(pen.g, x, y, pose.level);
  drawSentinelLight(under, x, y, pose);
  drawSentinelTurret(pen, x, y, pose);
}

/** Debug overlay: footprint outlines, the pivot, the projected muzzle (green) and the game's flat muzzle point (red). */
export function drawSentinelGuides(g: Ink, x: number, y: number, pose: SentinelPose, flatMuzzle: { x: number; y: number }) {
  const y0 = y + DROP,
    line = (f: Float64Array | readonly number[], n: number, h: number, color: number) => {
      for (let i = 0; i < n; i++) {
        PTS[i].x = X(x, f[2 * i]);
        PTS[i].y = Y(y0, f[2 * i + 1], h);
      }
      g.lineStyle(0.6, color, 0.9);
      g.strokePoints(PTS, true, true, n);
    };
  line(HEX, 6, 0, 0xffd166);
  line(HEX, 6, H, 0xffd166);
  const n = turn(SHELL, pose.angle, FOOT);
  line(FOOT, n, SHELL_BASE, 0x66d9ff);
  line(FOOT, n, SHELL_TOP, 0x66d9ff);
  const px = X(x, 0),
    py = Y(y0, 0, HB);
  g.lineStyle(0.7, 0xffffff, 0.9);
  g.lineBetween(px - 3, py, px + 3, py);
  g.lineBetween(px, py - 3, px, py + 3);
  g.lineBetween(px, py, px, Y(y0, 0, 0));
  const m = sentinelMuzzle(x, y, pose.angle, pose.level, pose.kick);
  g.lineStyle(0.8, 0x9bff8a, 1);
  g.strokeRect(m.x - 2, m.y - 2, 4, 4);
  g.lineStyle(0.8, 0xff5c5c, 1);
  g.lineBetween(flatMuzzle.x - 2, flatMuzzle.y - 2, flatMuzzle.x + 2, flatMuzzle.y + 2);
  g.lineBetween(flatMuzzle.x - 2, flatMuzzle.y + 2, flatMuzzle.x + 2, flatMuzzle.y - 2);
}
