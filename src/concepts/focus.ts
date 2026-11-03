/**
 * Focus concept, "Lens Fork": a stepped diamond plinth with a bearing post (still), a fork yoke holding a short
 * optics housing with a big pink lens at its front (turret), and the lens charge, heat ring and lamps (live). The beam
 * leaves the lens centre, so `reach` ends there.
 */
import { halo } from "../render/material";
import { arcBand, disc, oval, ring, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "../render/tower-art/tilt";
import type { Concept } from "./types";

const DROP = 5,
  HB = 15,
  reach = (l: number) => 9 + 0.4 * l;
/** Plinth: lower and upper diamond radius and their heights; the bearing post; the yoke. */
const R0 = 21,
  R1 = 14,
  H0 = 3.5,
  H1 = 6.5,
  POST = 9,
  BAR0 = POST,
  BAR1 = POST + 2.6,
  ARM_TOP = HB + 2.8;
/** Cool gunmetal, its top, the metallic highlight and the dark interior. */
const WALL = 0x2f3640,
  TOP = 0x4b5563,
  METAL = 0x8f9cab,
  DEEP = 0x161b22,
  CASING = 0x2a3038;

const diamond = (r: number) => [r, 0, 0, r, -r, 0, 0, -r];
/** Corners of the diamonds clockwise on the screen (east, south, west, north). */
const LOW = diamond(R0),
  HIGH = diamond(R1);
const CROSSBAR = [-3, -8.6, 3, -8.6, 3, 8.6, -3, 8.6];
const arm = (q: number) => [-2.4, q - 1.1, 2.4, q - 1.1, 2.4, q + 1.1, -2.4, q + 1.1];
const ARMS = [arm(-7.5), arm(7.5)];
/** Level 5: shield plates on the outside of the arms. */
const SHIELDS = [
  [-3.4, 8.6, 3.4, 8.6, 3.4, 9.6, -3.4, 9.6],
  [-3.4, -9.6, 3.4, -9.6, 3.4, -8.6, -3.4, -8.6],
];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, R0 + 5, R0, 0x050b10, 0.22);
    oval(g, 2, 3, R0, R0 - 3, 0x050b10, 0.35);
  });
  let n = turn(LOW, 0, FOOT);
  turn(LOW, 0, INSET, 0.88);
  block(g, x, y0, FOOT, INSET, n, 0, H0, 1, WALL, TOP, METAL);
  // Pink inlay along the lower step's front edges, a lens-like stud on each corner.
  onGround(g, x, y0, H0 + 1, () => {
    g.lineStyle(0.8, level >= 4 ? shade(color, -0.2) : shade(c, -0.5), 0.9);
    const k = 0.78;
    g.lineBetween(R0 * k, 0, 0, R0 * k);
    g.lineBetween(0, R0 * k, -R0 * k, 0);
    g.lineBetween(-R0 * k, 0, 0, -R0 * k);
    g.lineBetween(0, -R0 * k, R0 * k, 0);
  });
  n = turn(HIGH, 0, FOOT);
  turn(HIGH, 0, INSET, 0.85);
  block(g, x, y0, FOOT, INSET, n, H0 + 1, H1, 1, shade(WALL, 0.05), shade(TOP, 0.05), METAL);
  // Bolts on the top step from level 3, and the bearing post.
  onGround(g, x, y0, H1 + 1, () => {
    const bolts = level >= 3 ? 4 : 2;
    for (let i = 0; i < bolts; i++) {
      const a = (i * Math.PI * 2) / bolts + Math.PI / 4,
        bx = Math.cos(a) * 7.5,
        by = Math.sin(a) * 7.5;
      disc(g, bx, by, 1.2, shade(WALL, -0.4));
      disc(g, bx - 0.3, by - 0.3, 0.55, METAL, 0.9);
    }
  });
  drum(g, x, y0, 4.6, H1 + 1, POST, CASING, shade(CASING, 0.3), 10);
  // Corner studs of the lower step: dim pink glass (lit live).
  for (const [u, v] of [[R0 - 3, 0], [0, R0 - 3], [-(R0 - 3), 0]]) {
    const sx = X(x, u),
      sy = Y(y0, v, H0 + 1);
    disc(g, sx, sy, 1.5, OUTLINE);
    disc(g, sx, sy, 1, shade(c, -0.55));
  }
}

function turret({ g, x, y, tower, definition, level, kick, tip, color }: TurretContext) {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP,
    c = definition.color,
    lens = reach(level),
    trim = level >= 6 ? color : shade(c, -0.35),
    rim = 5 + 0.15 * Math.min(level, 5),
    toward = towardViewer(a);
  // The yoke's shadow on the upper step.
  turn(CROSSBAR, a, FOOT);
  onGround(g, x, y0, H1 + 1, () => {
    for (let i = 0; i < 4; i++) point(i, FOOT[2 * i] + 3.5, FOOT[2 * i + 1] + 4.5);
    fillPoints(g, 4, 0x050b10, 0.3);
  });
  const part = (shape: readonly number[], h0: number, h1: number, wall: number, top: number, bevel = 0) => {
      const n = turn(shape, a, FOOT);
      if (bevel) turn(shape, a, INSET, 0.8);
      block(g, x, y0, FOOT, bevel ? INSET : FOOT, n, h0, h1, bevel, wall, top, METAL);
    },
    crossbar = () => part(CROSSBAR, BAR0, BAR1, WALL, TOP, 0.8),
    yokeArm = (shape: readonly number[]) => {
      part(shape, BAR1, ARM_TOP, shade(WALL, 0.05), TOP);
      // Trunnion cap on the outside of the arm at the pivot.
      const q = shape[1] > 0 ? 8.8 : -8.8,
        cx = X(x, -sa * q),
        cy = Y(y0, ca * q, HB);
      disc(g, cx, cy, 1.8, OUTLINE);
      disc(g, cx, cy, 1.3, shade(METAL, -0.25));
      if (level >= 3) disc(g, cx - 0.4, cy - 0.4, 0.5, METAL);
    },
    shield = (shape: readonly number[]) => part(shape, BAR1 + 1, ARM_TOP - 1, shade(WALL, 0.12), shade(TOP, 0.1)),
    housing = () => {
      const back = -7;
      tube(g, x, y0, a, HB, back, lens - 2.2, 3.4, CASING);
      // Trim stripe and focusing rings along the housing.
      tube(g, x, y0, a, HB + 1.9, back + 1.5, lens - 3.5, 0.6, trim, 1, false);
      for (const d of [back + 1, lens - 3.2]) tube(g, x, y0, a, HB, d - 0.5, d + 0.5, 3.7, DEEP, 1, false);
      if (toward < -0.05) {
        endFace(g, x, y0, a, HB, back, 3.4, shade(CASING, -0.25));
        endFace(g, x, y0, a, HB, back, 1.6, DEEP);
      }
    },
    lensCell = () => {
      // The lens hood: a short wide ring at the front, then the glass when it faces the viewer.
      tube(g, x, y0, a, HB, lens - 2.2, lens, rim, shade(c, -0.6));
      tube(g, x, y0, a, HB, lens - 0.7, lens, rim, tip ?? shade(c, -0.45), 1, false);
      if (toward > 0.05) {
        endFace(g, x, y0, a, HB, lens, rim, shade(c, -0.7));
        endFace(g, x, y0, a, HB, lens, rim - 1, shade(c, -0.15));
        endFace(g, x, y0, a, HB, lens, rim - 2.4, shade(c, 0.15));
      }
    };
  const parts: [number, () => void][] = [
    [-50, crossbar],
    [7.5 * ca, () => yokeArm(ARMS[1])],
    [-7.5 * ca, () => yokeArm(ARMS[0])],
    [-2 * sa + 0.01, housing],
    [lens * sa + 0.02, lensCell],
  ];
  if (level >= 5) for (const s of SHIELDS) parts.push([(s[1] > 0 ? 9.2 : -9.2) * ca + 0.01, () => shield(s)]);
  parts.sort((p, q) => p[0] - q[0]);
  for (const [, draw] of parts) draw();
  void kick;
}

function live({ g, glow, x, y, tower, definition, level, kick, energy, clock, color, peak }: TurretContext) {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP,
    c = definition.color,
    heat = Math.min(1, (tower.focus?.stacks ?? 0) / 10),
    lit = Math.max(heat, kick),
    lens = reach(level),
    toward = towardViewer(a),
    lx = X(x, ca * lens),
    ly = Y(y0, sa * lens, HB);
  // Heat ring round the post on the upper step: fills with the focus charge.
  onGround(g, x, y0, H1 + 1, () => {
    ring(g, 0, 0, 10.5, 1.2, DEEP, 0.9);
    if (heat > 0) arcBand(g, 0, 0, 10.5, 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * heat, c);
  });
  onGround(glow, x, y0, H1 + 1, () => {
    if (heat > 0) arcBand(glow, 0, 0, 10.5, 2.6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * heat, c, 0.2 + 0.2 * heat);
  });
  // Corner studs: from level 4 a light chases round them.
  [[R0 - 3, 0], [0, R0 - 3], [-(R0 - 3), 0]].forEach(([u, v], i) => {
    const on = level >= 4 ? 0.25 + 0.75 * Math.max(0, Math.sin(4 * clock - i * 1.4)) : 0.35 + 0.4 * heat;
    const sx = X(x, u),
      sy = Y(y0, v, H0 + 1);
    disc(g, sx, sy, 0.8, shade(color, -0.5 + 0.6 * on));
    if (on > 0.4) disc(glow, sx, sy, 2.4, color, 0.3 * on);
  });
  // Lamp on the crossbar's back from level 2.
  if (level >= 2) {
    const bx = X(x, -ca * 3.2),
      by = Y(y0, -sa * 3.2, BAR1 + 0.8);
    disc(g, bx, by, 1.1, OUTLINE);
    disc(g, bx, by, 0.7, shade(color, 0.2));
    disc(glow, bx, by, 2.2, color, 0.35);
  }
  // The lens: a hot core on the glass when it faces the viewer, light round it either way.
  if (toward > 0.05) disc(g, lx - 0.6, ly - 0.6, 0.9 + 1.2 * lit, shade(c, 0.5 + 0.3 * lit));
  halo(glow, lx, ly, 5 + 3 * lit, c, Math.min(peak, 0.15 + 0.35 * lit + energy));
  // Charge running along the housing's trim stripe.
  glow.lineStyle(2, c, Math.min(0.45, 0.08 + 0.3 * heat + energy));
  glow.lineBetween(X(x, ca * -5.5), Y(y0, sa * -5.5, HB + 1.9), X(x, ca * (lens - 3.5)), Y(y0, sa * (lens - 3.5), HB + 1.9));
  void quad;
}

/** Focus: a lens on a fork mount. */
export const concept = {
  tower: "focus",
  name: "Lens Fork",
  idea: "Stepped diamond plinth with a bearing post; a fork yoke holds a short optics housing with a big pink lens. Heat ring and lens glow follow the focus charge.",
  tilt: { drop: DROP, squash: SQUASH, height: HB, deck: H1 + 1 },
  reach,
  recoil: 0,
  base,
  turret,
  live,
} satisfies Concept;
