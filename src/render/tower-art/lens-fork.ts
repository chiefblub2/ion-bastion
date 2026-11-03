/**
 * Lens Fork: Focus's look in the 3/4 tilt (see `tilt.ts`, projection in `TILTS.lens`). A stepped diamond plinth with a
 * bearing post and lens studs (`base`, baked per level and trim colour), the heat ring round the post and the studs'
 * chasing light (`below`), a fork yoke holding a short optics housing with a big pink lens (`turret`, cached per aim
 * angle), and the lens core, its halo, the charge along the trim and the lamp's light (`above`). The beam leaves the
 * lens centre, so `MUZZLES.lens.reach` ends there.
 */
import { halo } from "../material";
import { arcBand, disc, oval, ring, shade } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, X, Y, block, drum, endFace, fillPoints, onGround, point, towardViewer, tube, turn } from "./tilt";
import { MUZZLES, TILTS } from "../muzzles";
import type { TiltedArt } from "./tilted";
import type { Ink } from "../shapes";

const TILT = TILTS.lens!,
  DROP = TILT.drop,
  HB = TILT.height,
  reach = MUZZLES.lens!.reach;
/**
 * A filled circle through the kit's exact-length corners (`fillPoints`), for the cached turret: the shared `disc`
 * hands Phaser its whole scratch buffer, so a recording of the turret (`stillTurret`) would pick up stale corners.
 */
function dot(g: Ink, cx: number, cy: number, r: number, color: number, n = 10) {
  for (let i = 0; i < n; i++) point(i, cx + Math.cos((i * 2 * Math.PI) / n) * r, cy + Math.sin((i * 2 * Math.PI) / n) * r);
  fillPoints(g, n, color);
}
/** Plinth: lower and upper diamond radius and their heights; the bearing post; the yoke. */
const R0 = 21,
  R1 = 14,
  H0 = 3.5,
  H1 = 6.5,
  POST = 9,
  BAR0 = POST,
  BAR1 = POST + 3.2,
  ARM_TOP = HB + 4.2;
/** Housing radius and its back end; the lens rim grows a little with the level. */
const BODY = 5.4,
  BACK = -10;
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
const CROSSBAR = [-5, -12, 4, -12, 5.5, -10, 5.5, 10, 4, 12, -5, 12, -6.5, 10, -6.5, -10];
const arm = (q: number) => [-4, q - 1.8, 3.4, q - 1.8, 4.4, q, 3.4, q + 1.8, -4, q + 1.8];
const ARMS = [arm(-9.6), arm(9.6)];
/** Level 5: shield plates on the outside of the arms. */
const SHIELDS = [
  [-4.6, 11.4, 4, 11.4, 4, 12.8, -4.6, 12.8],
  [-4.6, -12.8, 4, -12.8, 4, -11.4, -4.6, -11.4],
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
  drum(g, x, y0, 6, H1 + 1, POST, CASING, shade(CASING, 0.3), 10);
  // Corner studs of the lower step: dim pink glass (lit live).
  for (const [u, v] of [[R0 - 3, 0], [0, R0 - 3], [-(R0 - 3), 0]]) {
    const sx = X(x, u),
      sy = Y(y0, v, H0 + 1);
    disc(g, sx, sy, 1.5, OUTLINE);
    disc(g, sx, sy, 1, shade(c, -0.55));
  }
}

function turret({ g, x, y, tower, definition, level, tip, color }: TurretContext) {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP,
    c = definition.color,
    lens = reach(level),
    trim = level >= 6 ? color : shade(c, -0.35),
    rim = 7 + 0.2 * Math.min(level, 5),
    toward = towardViewer(a);
  // The yoke's shadow on the upper step.
  turn(CROSSBAR, a, FOOT);
  onGround(g, x, y0, H1 + 1, () => {
    for (let i = 0; i < 8; i++) point(i, FOOT[2 * i] + 4.5, FOOT[2 * i + 1] + 6);
    fillPoints(g, 8, 0x050b10, 0.3);
  });
  const part = (shape: readonly number[], h0: number, h1: number, wall: number, top: number, bevel = 0) => {
      const n = turn(shape, a, FOOT);
      if (bevel) turn(shape, a, INSET, 0.8);
      block(g, x, y0, FOOT, bevel ? INSET : FOOT, n, h0, h1, bevel, wall, top, METAL);
    },
    crossbar = () => {
      part(CROSSBAR, BAR0, BAR1, WALL, TOP, 0.8);
      // A lamp on the crossbar's back from level 2 (its light is live), covered by the housing where they overlap.
      if (level >= 2) {
        const bx = X(x, -ca * 3.2),
          by = Y(y0, -sa * 3.2, BAR1 + 0.8);
        dot(g, bx, by, 1.1, OUTLINE);
        dot(g, bx, by, 0.7, shade(color, 0.2), 8);
      }
    },
    yokeArm = (shape: readonly number[]) => {
      part(shape, BAR1, ARM_TOP, shade(WALL, 0.05), TOP);
      // Trunnion cap on the outside of the arm at the pivot.
      const q = shape[1] > 0 ? 11.6 : -11.6,
        cx = X(x, -sa * q),
        cy = Y(y0, ca * q, HB);
      dot(g, cx, cy, 2.8, OUTLINE, 12);
      dot(g, cx, cy, 2.2, shade(METAL, -0.25), 12);
      dot(g, cx, cy, 1.1, shade(c, -0.5), 8);
      if (level >= 3) dot(g, cx - 0.6, cy - 0.6, 0.6, METAL, 6);
    },
    shield = (shape: readonly number[]) => part(shape, BAR1 + 1, ARM_TOP - 1, shade(WALL, 0.12), shade(TOP, 0.1)),
    housing = () => {
      const back = BACK;
      // A cooling shroud at the back (fins), the main optics barrel, then the trim stripe on top.
      tube(g, x, y0, a, HB, back, lens - 3.5, BODY, CASING);
      for (let d = back + 1; d < back + 7; d += 2) tube(g, x, y0, a, HB, d, d + 0.9, BODY + 1.1, shade(CASING, 0.12), 1, false);
      tube(g, x, y0, a, HB, back + 7.6, back + 8.6, BODY + 0.5, DEEP, 1, false);
      tube(g, x, y0, a, HB + BODY - 0.6, back + 9, lens - 4.5, 0.8, trim, 1, false);
      if (level >= 3) tube(g, x, y0, a, HB, lens - 6, lens - 5, BODY + 0.4, shade(c, -0.55), 1, false);
      if (toward < -0.05) {
        endFace(g, x, y0, a, HB, back, BODY + 1.1, shade(CASING, -0.2));
        endFace(g, x, y0, a, HB, back, BODY - 1.5, DEEP);
        endFace(g, x, y0, a, HB, back, 1.6, shade(c, -0.4));
      }
    },
    lensCell = () => {
      // The lens hood: a short wide ring at the front, then the glass when it faces the viewer.
      tube(g, x, y0, a, HB, lens - 3.5, lens - 2.2, rim - 0.4, shade(CASING, -0.2), 1, false);
      tube(g, x, y0, a, HB, lens - 3, lens, rim, shade(c, -0.3));
      tube(g, x, y0, a, HB, lens - 3, lens - 2.3, rim + 0.3, shade(c, -0.65), 1, false);
      tube(g, x, y0, a, HB, lens - 0.7, lens, rim, tip ?? shade(c, -0.45), 1, false);
      if (toward > 0.05) {
        endFace(g, x, y0, a, HB, lens, rim, shade(c, -0.7));
        endFace(g, x, y0, a, HB, lens, rim - 1, shade(c, -0.15));
        endFace(g, x, y0, a, HB, lens, rim - 2.4, shade(c, 0.15));
      }
    };
  const parts: [number, () => void][] = [
    [-50, crossbar],
    [9.6 * ca, () => yokeArm(ARMS[1])],
    [-9.6 * ca, () => yokeArm(ARMS[0])],
    [-3 * sa + 0.01, housing],
    [lens * sa + 0.02, lensCell],
  ];
  if (level >= 5) for (const s of SHIELDS) parts.push([(s[1] > 0 ? 12 : -12) * ca + 0.01, () => shield(s)]);
  parts.sort((p, q) => p[0] - q[0]);
  for (const [, draw] of parts) draw();
}

/** Live, under the turret: the heat ring round the post filling with the focus charge, and the corner studs' light. */
function below({ g, glow, x, y, tower, definition, level, clock, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    heat = Math.min(1, (tower.focus?.stacks ?? 0) / 10);
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
}

/** Live, over the turret: the hot core on the lens (it is the turret's front), its halo, the charge along the trim, the lamp's light. */
function above({ g, glow, x, y, tower, definition, level, kick, energy, color, peak }: TurretContext) {
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
  if (level >= 2) disc(glow, X(x, -ca * 3.2), Y(y0, -sa * 3.2, BAR1 + 0.8), 2.2, color, 0.35);
  if (toward > 0.05) disc(g, lx - 0.9, ly - 0.9, 1.4 + 1.6 * lit, shade(c, 0.5 + 0.3 * lit));
  halo(glow, lx, ly, 7 + 4 * lit, c, Math.min(peak, 0.15 + 0.35 * lit + energy));
  glow.lineStyle(2, c, Math.min(0.45, 0.08 + 0.3 * heat + energy));
  glow.lineBetween(X(x, ca * (BACK + 9)), Y(y0, sa * (BACK + 9), HB + BODY - 0.6), X(x, ca * (lens - 4.5)), Y(y0, sa * (lens - 4.5), HB + BODY - 0.6));
}

/** Focus's Lens Fork in the four parts of a tilted tower (`tilted.ts`). */
export const lensFork: TiltedArt = { base, below, turret, above };
