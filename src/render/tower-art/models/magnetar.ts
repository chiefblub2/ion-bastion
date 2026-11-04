import { halo } from "../../material";
import { disc, ring, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, X, Y, drum, onGround } from "../tilt";
import { GUN, lampInk, lampLight } from "../tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { TiltedConcept as Concept } from "../tilted";

// Magnetar: the Pole Spire. A round dais with a copper coil in its middle; a tall horseshoe magnet stands on it, its two
// wound pole arms on a steel yoke, the poles' tips bright (one red, one in the tower's blue). Field lines arc between
// the tips as the pulse charges and a ring snaps away on a pulse. It never aims.
const TILT = { drop: 6, squash: 0.65, height: 0, deck: 4.4, emit: 26 },
  DROP = TILT.drop;
const R = 18,
  DAIS = 3.4,
  DECK = 4.4,
  YOKE0 = 8,
  YOKE1 = 11,
  POLE = 7.2,
  ARM_R = 2.5,
  TIP0 = 24,
  TIP1 = 26.5;
const COPPER = 0xb4703a,
  NORTH = 0xd8443c;
const DAIS_SHAPE = ngon(12, R, Math.PI / 12);
const YOKE = [-POLE - 2.6, -2.6, POLE + 2.6, -2.6, POLE + 2.6, 2.6, -POLE - 2.6, 2.6];
/** Lights round the dais rim (from level 4 they chase). */
const RIM = Array.from({ length: 6 }, (_, i) => Math.PI / 12 + (i * Math.PI) / 6);

function base({ g, x, y, level, color }: TurretContext) {
  const y0 = y + DROP;
  contact(g, x, y0, R);
  slab(g, x, y0, DAIS_SHAPE, 0, DAIS, 1, GUN.side, GUN.top, GUN.metal);
  // The coil in the middle: copper windings under a steel cap.
  drum(g, x, y0, 6.2, DECK, YOKE0, COPPER, shade(COPPER, 0.2), 14);
  for (const h of [DECK + 1, DECK + 2.2, DECK + 3.4]) onGround(g, x, y0, h, () => {
    g.lineStyle(0.6, shade(COPPER, -0.45), 0.9);
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * Math.PI;
      if (i === 0) g.moveTo(Math.cos(t) * 6.3, Math.sin(t) * 6.3);
      else g.lineTo(Math.cos(t) * 6.3, Math.sin(t) * 6.3);
    }
    g.strokePath();
  });
  onGround(g, x, y0, DECK, () => {
    for (const t of RIM) {
      if (Math.sin(t) < 0) continue;
      disc(g, Math.cos(t) * 15.3, Math.sin(t) * 15.3, 1.3, OUTLINE);
      disc(g, Math.cos(t) * 15.3, Math.sin(t) * 15.3, 0.8, shade(color, -0.55));
    }
    if (level >= 3)
      for (let i = 0; i < 6; i++) {
        const t = (i * Math.PI) / 3;
        disc(g, Math.cos(t) * 11.5, Math.sin(t) * 11.5, 0.9, OUTLINE);
        disc(g, Math.cos(t) * 11.5 - 0.3, Math.sin(t) * 11.5 - 0.3, 0.4, GUN.metal);
      }
  });
}

/** From level 4 the rim lights chase round (the magnet covers none of them, they sit on the front half). */
function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP;
  RIM.forEach((t, i) => {
    if (Math.sin(t) < 0) return;
    const on = Math.max(0, Math.sin(4 * clock - i));
    onGround(g, x, y0, DECK, () => disc(g, Math.cos(t) * 15.3, Math.sin(t) * 15.3, 0.8, shade(color, -0.55 + 0.75 * on)));
    if (on > 0.4) onGround(glow, x, y0, DECK, () => disc(glow, Math.cos(t) * 15.3, Math.sin(t) * 15.3, 2.6, color, 0.3 * on));
  });
}

/** One pole arm at ground point u: a wound steel column and its tip. */
function arm(g: TurretContext["g"], x: number, y0: number, u: number, tip: number, level: number, trim: number) {
  const ax = X(x, u);
  drum(g, ax, y0, ARM_R, YOKE1, TIP0, GUN.side, GUN.top, 10);
  // Copper windings: more turns with the level.
  const turns = 3 + Math.min(3, level - 1);
  for (let i = 0; i < turns; i++) {
    const h = YOKE1 + 1.5 + i * ((TIP0 - YOKE1 - 3) / turns);
    drum(g, ax, y0, ARM_R + 0.5, h, h + 1.3, COPPER, shade(COPPER, 0.25), 10);
  }
  drum(g, ax, y0, ARM_R + 0.4, TIP0, TIP1, tip, shade(tip, 0.35), 10);
  if (level >= 6) drum(g, ax, y0, ARM_R + 0.6, TIP0 - 1.2, TIP0, trim, shade(trim, 0.3), 10);
}

/** The yoke and both pole arms (it never aims: the magnet stands east-west). Ink only. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  slab(g, x, y0, YOKE, YOKE0, YOKE1, 1, GUN.side, GUN.top, GUN.metal, 0, 0.8);
  if (level >= 5) slab(g, x, y0, [-4, 2.6, 4, 2.6, 4, 3.8, -4, 3.8], YOKE0 - 1, YOKE1 - 0.5, 0, shade(c, -0.5), shade(c, -0.2), shade(c, 0.3));
  if (level >= 2) lampInk(g, X(x, 0), Y(y0, 0, YOKE1 + 1.4), color);
  arm(g, x, y0, -POLE, NORTH, level, color);
  arm(g, x, y0, POLE, shade(c, 0.2), level, color);
}

/** Field lines between the tips, more and brighter as the pulse charges; a ring snapping away on a pulse. */
function above({ g, glow, x, y, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    lx = X(x, -POLE),
    rx = X(x, POLE),
    ty = Y(y0, 0, TIP1);
  if (level >= 2) lampLight(glow, X(x, 0), Y(y0, 0, YOKE1 + 1.4), color);
  disc(glow, lx, ty, 3.2, NORTH, 0.2 + 0.25 * charge);
  disc(glow, rx, ty, 3.2, c, 0.2 + 0.25 * charge);
  const lines = 1 + Math.round(charge * 3);
  for (let k = 0; k < lines; k++) {
    const lift = 4 + k * 3 + Math.sin(clock * 6 + k) * 0.8,
      alpha = (0.15 + 0.25 * charge + energy) * (1 - k * 0.15);
    for (const ink of [glow, g]) {
      ink.lineStyle(ink === glow ? 2.6 : 0.7, ink === glow ? c : shade(c, 0.6), ink === glow ? alpha : Math.min(1, alpha * 2));
      ink.beginPath();
      for (let i = 0; i <= 12; i++) {
        const s = i / 12,
          px = lx + (rx - lx) * s,
          py = ty - Math.sin(s * Math.PI) * lift;
        if (i === 0) ink.moveTo(px, py);
        else ink.lineTo(px, py);
      }
      ink.strokePath();
    }
  }
  if (kick > 0) {
    const r = 10 + 16 * (1 - kick);
    onGround(glow, x, y0, TIP0, () => ring(glow, 0, 0, r, 2.4, c, 0.4 * kick));
    halo(glow, X(x, 0), ty - 3, 9, c, 0.3 * kick);
  }
}

export const concept: Concept = {
  tower: "magnetar",
  name: "Pole Spire",
  idea: "A tall horseshoe magnet on a coil dais: two copper-wound pole arms on a steel yoke, field lines arcing between the bright tips as the pulse charges.",
  tilt: TILT,
  base,
  below,
  turret,
  above,
};
