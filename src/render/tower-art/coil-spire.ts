import type { Sheet, TiltedArt } from "./tilted";
/**
 * Tesla concept, the Coil Spire: a stepped twelve-sided plinth ringed by insulator bells (still), a pylon carrying a
 * copper-wound coil with a grading torus and a top ball (the turret: still too, a radial tower never aims), and live
 * charge in the bells, arcs crawling over the coil and the ball flashing white on a discharge. Chains leave the torus.
 */
import { LIGHT, facing, halo } from "../material";
import { arcBand, disc, hash01, oval, ring, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { OUTLINE, SQUASH, X, Y, block, drum, onGround } from "./tilt";

const DROP = 6;
/** Plinth tiers, pylon, coil, torus and ball heights. */
const LOW = 2.6,
  HIGH = 4.8,
  PYLON = 9,
  COIL_TOP = 27,
  TORUS = 29.5,
  BALL = 33.5;
const STEEL = 0x3d474d,
  STEEL_TOP = 0x5a676d,
  DEEP = 0x1c2429,
  METAL = 0x8e9ea2,
  COPPER = 0xb8743a;

/** Regular n-gon footprint (u, v pairs, clockwise on the screen), rotated by `rot`. */
function ngon(n: number, r: number, rot = 0) {
  const f = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    f[2 * i] = Math.cos(a) * r;
    f[2 * i + 1] = Math.sin(a) * r;
  }
  return f;
}
const LOWER = ngon(12, 21, Math.PI / 12),
  LOWER_IN = ngon(12, 20, Math.PI / 12),
  UPPER = ngon(12, 13.5, Math.PI / 12),
  UPPER_IN = ngon(12, 12, Math.PI / 12);
/** Insulator bells on the lower tier, at 30° + k·60° so none hides straight behind or in front of the pylon. */
const BELLS = [0, 1, 2, 3, 4, 5].map((i) => Math.PI / 6 + (i * Math.PI) / 3);
const BELL_R = 17.3;
/** Buttresses on the pylon from level 5, on the diagonals. */
const BUTTRESS = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

/** Points of an ellipse arc on the plane at height h (front half: t from 0 to π). */
const PTS = Array.from({ length: 16 }, () => ({ x: 0, y: 0 }));
function frontArc(g: Ink, x: number, y0: number, r: number, h: number, width: number, color: number, alpha = 1) {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const t = 0.15 + ((Math.PI - 0.3) * i) / (n - 1);
    PTS[i].x = X(x, Math.cos(t) * r);
    PTS[i].y = Y(y0, Math.sin(t) * r, h);
  }
  g.lineStyle(width, color, alpha);
  g.strokePoints(PTS, false, false, n);
}

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, 26, 22, 0x050b10, 0.2);
    oval(g, 2, 3, 22, 21, 0x050b10, 0.36);
  });
  block(g, x, y0, LOWER, LOWER_IN, 12, 0, LOW, 0.8, STEEL, STEEL_TOP, METAL);
  // From level 6 the lower tier's rim carries the path colour; below, a dark groove.
  onGround(g, x, y0, LOW + 0.8, () => ring(g, 0, 0, 19.3, 0.9, level >= 6 ? shade(color, -0.1) : DEEP, 0.9));
  // Level 3: bolts between the bells.
  if (level >= 3)
    for (const b of BELLS) {
      const t = b + Math.PI / 6,
        bx = X(x, Math.cos(t) * 18.6),
        by = Y(y0, Math.sin(t) * 18.6, LOW + 0.8);
      disc(g, bx, by, 0.9, DEEP);
      disc(g, bx - 0.3, by - 0.3, 0.45, METAL);
    }
  // Insulator bells: back ones first, then the upper tier, then the front ones over its foot.
  const bell = (t: number) => {
    const bx = Math.cos(t) * BELL_R,
      bv = Math.sin(t) * BELL_R,
      sx = X(x, bx);
    for (const [h0, h1, r] of [
      [LOW + 0.8, LOW + 2.6, 2.6],
      [LOW + 2.6, LOW + 4, 1.9],
      [LOW + 4, LOW + 5.6, 2.4],
    ]) {
      oval(g, sx, Y(y0, bv, h0), r + 0.5, r * SQUASH + 0.5, OUTLINE, 0.9);
      g.fillStyle(shade(c, -0.62));
      g.fillRect(sx - r, Y(y0, bv, h1), 2 * r, h1 - h0);
      oval(g, sx, Y(y0, bv, h0), r, r * SQUASH, shade(c, -0.62));
      oval(g, sx, Y(y0, bv, h1), r, r * SQUASH, shade(c, -0.35));
    }
    // Glass cap; its glow is live.
    disc(g, sx, Y(y0, bv, LOW + 5.9), 1.2, shade(c, -0.2));
  };
  for (const t of BELLS) if (Math.sin(t) < 0) bell(t);
  block(g, x, y0, UPPER, UPPER_IN, 12, LOW, HIGH, 1, STEEL, shade(STEEL_TOP, 0.05), METAL);
  for (const t of BELLS) if (Math.sin(t) >= 0) bell(t);
}

/** The still spire (no aim): pylon, buttresses, the wound coil, the grading ring from level 3, the torus and the ball. */
function turret({ g, x, y, level, color, definition, kick }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  drum(g, x, y0, 7.5, HIGH, PYLON, STEEL, STEEL_TOP, 12);
  if (level >= 5)
    for (const t of BUTTRESS) {
      if (Math.sin(t) < 0) continue;
      const u = Math.cos(t),
        v = Math.sin(t);
      g.fillStyle(OUTLINE, 0.9);
      g.fillTriangle(X(x, u * 12.8), Y(y0, v * 12.8, HIGH), X(x, u * 6), Y(y0, v * 6, HIGH), X(x, u * 4.8), Y(y0, v * 4.8, PYLON + 7));
      g.fillStyle(shade(STEEL, 0.25 * facing(t)));
      g.fillTriangle(X(x, u * 12), Y(y0, v * 12, HIGH + 0.3), X(x, u * 6.2), Y(y0, v * 6.2, HIGH + 0.3), X(x, u * 5), Y(y0, v * 5, PYLON + 6.2));
    }
  // Coil former and its copper winding: bands across the front, lit and shaded in turn.
  drum(g, x, y0, 4.6, PYLON, COIL_TOP, shade(COPPER, -0.35), shade(COPPER, -0.1), 10);
  for (let h = PYLON + 1.2, i = 0; h < COIL_TOP - 0.6; h += 1.5, i++) frontArc(g, x, y0, 4.7, h, 0.8, i % 2 ? shade(COPPER, -0.45) : shade(COPPER, 0.25), 0.95);
  // Grading ring halfway up from level 3 (the flat coil's third ring).
  if (level >= 3) {
    drum(g, x, y0, 7, 18.6, 20, METAL, shade(METAL, 0.2), 12);
    onGround(g, x, y0, 20, () => disc(g, 0, 0, 4.9, shade(COPPER, -0.1)));
  }
  // Torus: a short drum for its outer wall, a lit rounded top, the dark hole the coil rises into.
  drum(g, x, y0, 9.5, TORUS - 2, TORUS + 1.2, shade(STEEL, 0.15), shade(STEEL, 0.3), 16);
  onGround(g, x, y0, TORUS + 1.2, () => {
    ring(g, 0, 0, 7.4, 3.6, shade(STEEL, 0.35));
    arcBand(g, 0, 0, 8, 1.3, LIGHT - 1.1, LIGHT + 1.1, METAL, 0.9);
    // Trim inlay on the torus from level 6.
    if (level >= 6) ring(g, 0, 0, 7.4, 0.8, color, 0.95);
    disc(g, 0, 0, 5.4, DEEP);
  });
  // Ball on a short stem over the hole: white-hot right after a discharge.
  drum(g, x, y0, 1.6, TORUS, BALL - 2, METAL, METAL, 6);
  const by = Y(y0, 0, BALL);
  disc(g, x, by, 3.9, OUTLINE);
  disc(g, x, by, 3.3, shade(c, -0.35 + 0.95 * kick));
  disc(g, x - 0.9, by - 0.9, 1.6, shade(c, 0.35 + 0.6 * kick));
}

function live({ g, glow, x, y, tower, level, color, definition, clock, charge, kick, energy, peak }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    stored = Math.min(1, 0.2 + 0.8 * charge);
  // Bell caps hold the stored charge; from level 4 a brighter light chases round them.
  BELLS.forEach((t, i) => {
    const chase = level >= 4 ? 0.5 * Math.max(0, Math.sin(4 * clock - i * 1.05)) : 0,
      on = Math.min(1, stored * 0.7 + chase),
      bx = X(x, Math.cos(t) * BELL_R),
      by = Y(y0, Math.sin(t) * BELL_R, LOW + 5.9);
    disc(g, bx, by, 0.8, shade(c, -0.4 + 0.7 * on));
    disc(glow, bx, by, 2.6, c, 0.12 + 0.25 * on);
  });
  // Level 2: a lamp on the front of the upper tier.
  if (level >= 2) {
    const lx = X(x, 0),
      ly = Y(y0, 13.5, HIGH - 1.4);
    disc(g, lx, ly, 1.3, OUTLINE);
    disc(g, lx, ly, 0.85, shade(color, 0.2));
    disc(glow, lx, ly, 2.5, color, 0.35);
  }
  // The torus and ball glow with the charge.
  const by = Y(y0, 0, BALL);
  onGround(glow, x, y0, TORUS + 1, () => ring(glow, 0, 0, 7.6, 2.4, c, Math.min(peak, 0.08 + 0.22 * charge + energy)));
  halo(glow, x, by, 5.5, c, Math.min(peak, 0.12 + 0.3 * charge + energy));
  // Arcs crawl over the coil once charged (one past 50 %, two past 85 %), and jump from the ball to the torus.
  const seed = Math.floor(clock * 20) + tower.id * 7,
    arcs = charge > 0.85 ? 2 : charge > 0.5 ? 1 : 0;
  for (let i = 0; i < arcs; i++) {
    const t = 0.3 + hash01(seed, i) * (Math.PI - 0.6),
      h0 = PYLON + 2 + hash01(seed, i + 5) * 10,
      pts = [0, 1, 2, 3].map((k) => {
        const h = h0 + k * 2.4,
          j = (hash01(seed, i * 4 + k + 9) - 0.5) * 2.4;
        return { x: X(x, Math.cos(t) * 5 + j), y: Y(y0, Math.sin(t) * 5, h) };
      });
    glow.lineStyle(1.2, shade(c, 0.5), 0.5);
    glow.strokePoints(pts, false, false, 4);
    // A spark from the ball to a point on the torus rim.
    const r = hash01(seed, i + 3) * Math.PI * 2,
      ex = X(x, Math.cos(r) * 9),
      ey = Y(y0, Math.sin(r) * 9, TORUS + 1),
      mx = (x + ex) / 2 + (hash01(seed, i + 7) - 0.5) * 3,
      my = (by + ey) / 2 - 1.5;
    glow.lineStyle(1.1, shade(c, 0.6), 0.45);
    glow.lineBetween(x, by, mx, my);
    glow.lineBetween(mx, my, ex, ey);
  }
  // Discharge: a white ring spreading from the torus.
  if (kick > 0) {
    onGround(glow, x, y0, TORUS, () => ring(glow, 0, 0, 10 + (1 - kick) * 9, 2, shade(c, 0.6), 0.4 * kick));
    disc(g, x, by, 1.6 * kick, 0xffffff);
  }
}

const sheet: Sheet = {
  tower: "tesla",
  name: "Coil Spire",
  idea: "Stepped 12-sided plinth with six insulator bells, a copper-wound coil, grading torus and top ball; arcs crawl over the coil.",
  tilt: { drop: DROP, squash: SQUASH, height: TORUS, deck: HIGH },
  emit: BALL,
  base,
  turret,
  live,
};
/** CoilSpire in the four parts of a tilted tower (`tilted.ts`). */
export const coilSpire: TiltedArt = { base: sheet.base, below: sheet.below ?? (() => {}), turret: sheet.turret, above: sheet.live };
