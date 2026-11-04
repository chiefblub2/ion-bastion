import { halo } from "../../material";
import { disc, ring, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, X, Y, drum, endFace, onGround, towardViewer, tube } from "../tilt";
import { GUN, castShadow, depth, framer, lampInk, lampLight, paint, part, rect } from "../tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { TiltedConcept as Concept } from "../tilted";

// Shrink Ray: the Cone Projector. A stepped round pedestal; on it turns a retro ray gun: a finned power cell at the back
// and a stepped cone of rings narrowing to a lens. Pulses of light run down the rings as it charges.
const TILT = { drop: 5, squash: 0.65, height: 13, deck: 6.2 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 1,
  reach = (l: number) => 17 + l;
const R = 17,
  STEP0 = 3,
  STEP1 = 6,
  CELL_TOP = 17;
/** The cone's rings: (from, to, radius) along the barrel. */
const CONE: readonly [number, number, number][] = [
  [0, 4.5, 4.8],
  [4.5, 8.5, 3.9],
  [8.5, 12, 3],
];
const CELL_SHAPE = [-11, -4.6, -1, -4.6, 0.5, -3, 0.5, 3, -1, 4.6, -11, 4.6];
const FINS = [rect(-10.5, -4.5, 4.6, 7.2), rect(-10.5, -4.5, -7.2, -4.6)];
const STEP_SHAPE = ngon(14, R, Math.PI / 14),
  UPPER = ngon(14, 12, Math.PI / 14);
const RINGS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, R);
  slab(g, x, y0, STEP_SHAPE, 0, STEP0, 0.8, GUN.side, GUN.top, GUN.metal);
  slab(g, x, y0, UPPER, STEP0, STEP1, 0.8, GUN.side, shade(GUN.top, 0.05), GUN.metal);
  onGround(g, x, y0, STEP0 + 0.8, () => {
    // Emitter studs round the lower step, dim neon.
    for (const t of RINGS) {
      disc(g, Math.cos(t) * 14.6, Math.sin(t) * 14.6, 1.2, OUTLINE);
      disc(g, Math.cos(t) * 14.6, Math.sin(t) * 14.6, 0.7, shade(c, -0.6));
    }
    if (level >= 4) ring(g, 0, 0, 16.2, 0.7, shade(color, -0.3), 0.9);
  });
  if (level >= 3)
    onGround(g, x, y0, STEP1 + 0.8, () => {
      for (let i = 0; i < 4; i++) {
        const t = (i * Math.PI) / 2 + Math.PI / 4;
        disc(g, Math.cos(t) * 9.5, Math.sin(t) * 9.5, 0.9, OUTLINE);
        disc(g, Math.cos(t) * 9.5 - 0.3, Math.sin(t) * 9.5 - 0.3, 0.4, GUN.metal);
      }
    });
  drum(g, x, y0, 5.5, STEP1, STEP1 + 1.5, GUN.deep, shade(GUN.side, 0.15), 12);
}

/** From level 4 the studs of the lower step pulse outward in turn (the gun may swing over the far ones). */
function below({ g, glow, x, y, level, clock, definition }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP,
    c = definition.color;
  RINGS.forEach((t, i) => {
    const on = Math.max(0, Math.sin(4 * clock - i * 0.8));
    if (on < 0.3) return;
    onGround(g, x, y0, STEP0 + 0.8, () => disc(g, Math.cos(t) * 14.6, Math.sin(t) * 14.6, 0.7, shade(c, -0.6 + 0.8 * on)));
    onGround(glow, x, y0, STEP0 + 0.8, () => disc(glow, Math.cos(t) * 14.6, Math.sin(t) * 14.6, 2.4, c, 0.3 * on));
  });
}

/** The finned power cell, the stepped cone and the lens rod, back to front. Ink only. */
function turret({ g, x, y, tower, level, kick, tip, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    toward = towardViewer(a) > 0.05;
  castShadow(g, x, y0, a, CELL_SHAPE, STEP1, 0.28);
  const cell = () => {
      part(g, x, y0, a, CELL_SHAPE, STEP1 + 1.5, CELL_TOP, 1.2, GUN.side, GUN.top, GUN.metal);
      // A neon window down the cell's roof.
      const roof = CELL_TOP + 1.2,
        w = [P(-9, -1, roof), P(-2.5, -1, roof), P(-2.5, 1, roof), P(-9, 1, roof)];
      g.fillStyle(GUN.deep);
      g.fillTriangle(...w[0], ...w[1], ...w[2]);
      g.fillTriangle(...w[0], ...w[2], ...w[3]);
      if (level >= 5) for (const fin of FINS) part(g, x, y0, a, fin, STEP1 + 3, CELL_TOP - 1, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.3));
      if (level >= 2) lampInk(g, ...P(-10, Math.cos(a) > 0 ? 3 : -3, CELL_TOP + 1.4), color);
    },
    cone = () => {
      // Rings from the widest at the cell to the narrowest, each with a dark collar; then the lens rod.
      const rings = toward ? CONE : [...CONE].reverse();
      for (const [d0, d1, r] of rings) {
        tube(g, x, y0, a, HB, d0, d1, r, shade(c, -0.55));
        tube(g, x, y0, a, HB, d1 - 1, d1, r + 0.4, GUN.side, 1, false);
        if (level >= 6) tube(g, x, y0, a, HB, d1 - 0.5, d1, r + 0.45, color, 1, false);
        if (toward) endFace(g, x, y0, a, HB, d1, r * 0.75, GUN.deep);
      }
      tube(g, x, y0, a, HB, 12, end - 1.5, 1.2, GUN.metal, 1, false);
      tube(g, x, y0, a, HB, end - 1.5, end, 2.2, tip ?? GUN.side);
      if (toward) endFace(g, x, y0, a, HB, end, 1.8, shade(c, -0.3));
    };
  paint([
    [depth(a, -6, 0), cell],
    [depth(a, 6, 0), cone],
  ]);
}

/** Pulses of light running down the cone's rings toward the lens as it charges, the lens glow, the lamp's light. */
function above({ glow, x, y, tower, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  if (level >= 2) lampLight(glow, ...P(-10, Math.cos(a) > 0 ? 3 : -3, CELL_TOP + 1.4), color);
  const [wx0, wy0] = P(-9, 0, CELL_TOP + 1.2),
    [wx1, wy1] = P(-9 + 6.5 * charge, 0, CELL_TOP + 1.2);
  glow.lineStyle(2, c, 0.3 + 0.3 * charge);
  glow.lineBetween(wx0, wy0, wx1, wy1);
  for (let k = 0; k < 3; k++) {
    const s = (clock * (1 + 2 * charge) + k / 3) % 1,
      [px, py] = P(1 + s * 11, 0, HB),
      r = 4.8 - s * 2.4;
    onGround(glow, px, py, 0, () => ring(glow, 0, 0, r, 1.4, c, (0.1 + 0.3 * charge) * (1 - s * 0.5)), 1);
  }
  const [lx, ly] = P(end, 0, HB);
  disc(glow, lx, ly, 2.6, c, 0.2 + 0.35 * charge + energy);
  if (kick > 0) halo(glow, lx, ly, 6 * (1 + kick), c, 0.3 * kick);
}

export const concept: Concept = {
  tower: "shrink",
  name: "Cone Projector",
  idea: "A retro ray gun on a stepped pedestal: a finned power cell and a stepped cone of rings narrowing to a lens; pulses of light run down the rings as it charges.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
