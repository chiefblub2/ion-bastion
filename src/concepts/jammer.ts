import { halo } from "../render/material";
import { arcBand, disc, hash01, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, onGround } from "../render/tower-art/tilt";
import { rod } from "../render/tower-art/tilt-frame";
import { GUN } from "../render/tower-art/tilt-parts";
import { chase, contact, frontArc, plinth } from "./kit-control-a";
import type { Concept } from "./types";

// Jammer: the Interference Crown, a squat, wide emitter drum on a square plinth with a low dome, crowned by spiky
// antenna prongs that splay outward from its rim, each tipped with a pink emitter bead. Warped interference rings
// ripple out from the crown and glitch pixels flicker round it. No mast: it reads wide and low, unlike the Detector.
const DROP = 5,
  PLINTH = 4,
  BODY_R = 12.5,
  BODY_TOP = 10,
  DOME = 13,
  /** Prong roots on the rim, tips splayed outward and up. */
  ROOT_R = 10.5,
  TIP_R = 16.5,
  TIP_H = 18.5;
const prongs = (level: number) => {
  const n = level >= 3 ? 8 : 6;
  return Array.from({ length: n }, (_, i) => (i * Math.PI * 2) / n + Math.PI / n);
};

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 19);
  plinth(g, x, y0, 4, 19.5, 0, PLINTH, Math.PI / 4);
  // Hazard corners in the tower's pink on the plinth's top.
  onGround(g, x, y0, PLINTH + 0.6, () => {
    for (const s of [-1, 1]) for (const t of [-1, 1]) disc(g, s * 11.5, t * 11.5, 1.6, shade(c, -0.45));
  });
  if (level >= 5) drum(g, x, y0, BODY_R + 1.6, PLINTH, PLINTH + 2.4, shade(c, -0.6), shade(c, -0.35), 20);
  if (level >= 6) frontArc(g, x, y0, 15.5, PLINTH + 0.6, 1, color, 0.9, 0.3, Math.PI - 0.3);
}

/** The emitter drum with its vent ring and dome, and the crown of prongs (radial: one picture per recoil step). */
function turret({ g, x, y, definition, level }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    tips = prongs(level),
    prong = (t: number) => {
      const u0 = Math.cos(t) * ROOT_R,
        v0 = Math.sin(t) * ROOT_R,
        u1 = Math.cos(t) * TIP_R,
        v1 = Math.sin(t) * TIP_R;
      rod(g, x, y0, u0, v0, BODY_TOP - 0.5, u1, v1, TIP_H, 1.5, GUN.top);
      // Two barbs on each prong, so the crown reads spiky.
      const mu = (u0 + u1) / 2,
        mv = (v0 + v1) / 2,
        mh = (BODY_TOP + TIP_H) / 2;
      rod(g, x, y0, mu, mv, mh, mu + Math.cos(t) * 2.4, mv + Math.sin(t) * 2.4, mh - 1.6, 0.8, GUN.metal);
      const bx = X(x, u1),
        by = Y(y0, v1, TIP_H);
      disc(g, bx, by, 1.9, OUTLINE);
      disc(g, bx, by, 1.4, shade(c, -0.25));
    };
  // Prongs at the back first, then the body, then the front ones.
  for (const t of tips) if (Math.sin(t) < 0) prong(t);
  drum(g, x, y0, BODY_R, PLINTH, BODY_TOP, GUN.side, GUN.top, 22);
  // A dark vent ring round the drum's waist and pink slots in it.
  frontArc(g, x, y0, BODY_R + 0.1, (PLINTH + BODY_TOP) / 2, 2.2, GUN.deep, 1, 0.1, Math.PI - 0.1);
  for (let i = 0; i < 5; i++) {
    const t = 0.35 + ((Math.PI - 0.7) * i) / 4;
    disc(g, X(x, Math.cos(t) * (BODY_R + 0.2)), Y(y0, Math.sin(t) * (BODY_R + 0.2), (PLINTH + BODY_TOP) / 2), 0.8, shade(c, -0.4));
  }
  // The low dome with an emitter cup on top.
  drum(g, x, y0, 8.5, BODY_TOP, BODY_TOP + 1.6, GUN.top, shade(GUN.top, 0.1), 18);
  drum(g, x, y0, 5.5, BODY_TOP + 1.6, DOME, shade(c, -0.55), shade(c, -0.3), 14);
  onGround(g, x, y0, DOME, () => disc(g, 0, 0, 3, shade(c, -0.1)));
  for (const t of tips) if (Math.sin(t) >= 0) prong(t);
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 15, PLINTH + 0.5, 5, clock, color, level);
}

/**
 * The prong beads pulsing in turn, warped interference rings rippling out from the crown, glitch pixels round it, the
 * cup's glow and a burst on a disruption.
 */
function above({ g, glow, x, y, level, kick, charge, clock, color, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    tips = prongs(level);
  tips.forEach((t, i) => {
    const on = 0.35 + 0.65 * Math.max(0, Math.sin(6 * clock - i * 1.3)) * (0.5 + 0.5 * charge),
      bx = X(x, Math.cos(t) * TIP_R),
      by = Y(y0, Math.sin(t) * TIP_R, TIP_H);
    disc(glow, bx, by, 2.6, c, 0.3 * on);
    if (on > 0.6) disc(g, bx - 0.3, by - 0.3, 0.6, shade(c, 0.6));
  });
  halo(glow, X(x, 0), Y(y0, 0, DOME), 5 + 3 * charge, c, 0.15 + 0.2 * charge + energy);
  // Warped rings: broken arcs whose radius wobbles, rippling outward at crown height.
  for (let k = 0; k < 2; k++) {
    const t = (clock * 0.8 + k / 2) % 1,
      r = 8 + 14 * t;
    onGround(glow, x, y0, TIP_H - 3, () => {
      for (let s = 0; s < 10; s++) {
        if (hash01(s, k, Math.floor(clock * 8)) > 0.7) continue;
        const a0 = (s * Math.PI) / 5,
          wobble = (hash01(s, k, 3) - 0.5) * 2.4;
        arcBand(glow, 0, 0, r + wobble, 1.1, a0, a0 + Math.PI / 6, c, (0.14 + 0.2 * charge) * (1 - t));
      }
    });
  }
  const step = Math.floor(clock * 10);
  for (let i = 0; i < 5 + (level >= 4 ? 3 : 0); i++) {
    if (hash01(i, step, 5) > 0.55) continue;
    const u = (hash01(i, step, 1) - 0.5) * 34,
      h = 6 + hash01(i, step, 2) * 16;
    g.fillStyle(hash01(i, step, 3) > 0.5 ? c : 0xffffff, 0.7).fillRect(X(x, u), Y(y0, 0, h), 1.6, 1.2);
  }
  if (level >= 2) disc(glow, X(x, 0), Y(y0, 0, DOME), 2, color, 0.35 + 0.25 * Math.sin(clock * 5));
  if (kick > 0) onGround(glow, x, y0, TIP_H - 3, () => arcBand(glow, 0, 0, 6 + 20 * (1 - kick), 2.4, 0, Math.PI * 2, 0xffffff, 0.35 * kick));
}

export const concept: Concept = {
  tower: "jammer",
  name: "Interference Crown",
  idea: "A squat, wide emitter drum on a square plinth crowned by splayed spiky antenna prongs with pink beads; warped interference rings ripple out, glitch pixels flicker.",
  tilt: { drop: DROP, squash: 0.65, height: DOME, deck: PLINTH + 0.6, emit: DOME },
  base,
  below,
  turret,
  above,
};
