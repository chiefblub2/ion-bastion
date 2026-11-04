import { halo } from "../../material";
import { arcBand, disc, oval, ring, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, X, Y, drum, onGround } from "../tilt";
import { rod } from "../tilt-frame";
import { GUN, lampInk, lampLight } from "../tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { TiltedConcept as Concept } from "../tilted";

// Cyclone: the Vortex Funnel. An octagonal plinth with intake vents carries an upright funnel tower that widens toward
// its open mouth, braced by three struts; a vortex swirls in its throat and wind spirals rise up round the funnel and
// out of it, the gust that drags flyers down. It stands tall and narrow at the foot, unlike the Recycler's low hopper.
// It never aims; the gust leaves from the mouth.
const DROP = 6,
  R = 19,
  PLINTH = 4,
  /** Funnel rings from the foot up: radius at each step, widening toward the mouth. */
  RINGS = [
    [PLINTH, 4.4],
    [8.5, 5.2],
    [12.5, 6.6],
    [16.5, 8.4],
    [20, 10.4],
  ] as const,
  MOUTH = 23,
  MOUTH_R = 11.5,
  THROAT = 9.6;
const PLINTH_SHAPE = ngon(8, R, Math.PI / 8);
/** Intake vents on the plinth's three front faces (centre angle of each face). */
const VENTS = [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
/** Struts from the plinth to the funnel's waist. */
const STRUTS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];

function base({ g, x, y, level, color }: TurretContext) {
  const y0 = y + DROP;
  contact(g, x, y0, R);
  slab(g, x, y0, PLINTH_SHAPE, 0, PLINTH, 1, GUN.side, GUN.top, GUN.metal);
  for (const t of VENTS) {
    const cx = Math.cos(t) * R * 0.93,
      cy = Math.sin(t) * R * 0.93,
      tx = -Math.sin(t),
      ty = Math.cos(t);
    g.lineStyle(0.9, GUN.deep, 1);
    for (const s of [-3, 0, 3]) g.lineBetween(X(x, cx + tx * s), Y(y0, cy + ty * s, 0.8), X(x, cx + tx * s), Y(y0, cy + ty * s, PLINTH - 0.6));
  }
  // The dark intake ring round the funnel's foot.
  onGround(g, x, y0, PLINTH + 0.5, () => {
    disc(g, 0, 0, 6.6, GUN.deep);
    ring(g, 0, 0, 5.8, 0.8, OUTLINE, 0.9);
  });
  if (level >= 3)
    onGround(g, x, y0, PLINTH + 1, () => {
      for (let i = 0; i < 8; i++) {
        const t = (i * Math.PI) / 4 + Math.PI / 8;
        disc(g, Math.cos(t) * 16, Math.sin(t) * 16, 0.9, OUTLINE);
        disc(g, Math.cos(t) * 16 - 0.3, Math.sin(t) * 16 - 0.3, 0.4, GUN.metal);
      }
    });
  if (level >= 4) onGround(g, x, y0, PLINTH + 1, () => ring(g, 0, 0, 13.6, 0.8, shade(color, -0.3), 0.9));
}

/** Nothing live under the funnel: its seam lights sit on the funnel itself (`above`). */
function below() {}

/** The braced funnel: stacked rings widening upward, bands in the tower's colour, the open mouth and its hub. Ink only. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  // Struts behind the funnel first.
  const strut = (t: number) => rod(g, x, y0, Math.cos(t) * 15, Math.sin(t) * 15, PLINTH, Math.cos(t) * 6.6, Math.sin(t) * 6.6, 13, 1.4, GUN.top);
  for (const t of STRUTS) if (Math.sin(t) < 0) strut(t);
  // The funnel: each ring a short drum, the wider one above covering the narrower one's top.
  for (let i = 0; i < RINGS.length; i++) {
    const [h0, r] = RINGS[i],
      h1 = i + 1 < RINGS.length ? RINGS[i + 1][0] : MOUTH,
      band = i % 2 === 1;
    drum(g, x, y0, r, h0, h1, band ? shade(c, -0.35) : GUN.side, band ? shade(c, -0.15) : GUN.top, 18);
  }
  // Level 5: armour hoops round the funnel.
  if (level >= 5) for (const [h, r] of [[10, 5.9], [17.5, 9.2]] as const) drum(g, x, y0, r + 0.6, h, h + 1.2, GUN.deep, GUN.side, 18);
  for (const t of STRUTS) if (Math.sin(t) >= 0) strut(t);
  // The mouth: a lit lip round a dark throat, two struts across it and the hub.
  onGround(g, x, y0, MOUTH, () => {
    oval(g, 0, 0, MOUTH_R + 0.7, MOUTH_R + 0.7, OUTLINE);
    oval(g, 0, 0, MOUTH_R, MOUTH_R, shade(c, 0.15));
    oval(g, 0, 0, THROAT, THROAT, GUN.deep);
    arcBand(g, 0, 0, MOUTH_R - 0.4, 0.8, Math.PI + 0.3, 2 * Math.PI - 0.3, shade(c, 0.55), 0.85);
  });
  if (level >= 2) lampInk(g, X(x, -MOUTH_R + 1.5), Y(y0, 4, MOUTH - 4), color);
}

/**
 * The fan in the mouth, spinning faster as the gust charges and blurring right after it, wind spirals rising round the
 * funnel and out of its mouth, lights chasing up the front seam from level 4, the lamp's light.
 */
function above({ g, glow, x, y, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    spin = -(clock * (3 + 8 * charge) + kick * 3);
  if (level >= 2) lampLight(glow, X(x, -MOUTH_R + 1.5), Y(y0, 4, MOUTH - 4), color);
  if (level >= 4)
    RINGS.forEach(([h, r], i) => {
      const on = Math.max(0, Math.sin(5 * clock - i * 0.9)),
        lx = X(x, 0),
        ly = Y(y0, r + 0.2, h + 1.5);
      disc(g, lx, ly, 0.8, shade(color, -0.55 + 0.75 * on));
      if (on > 0.4) disc(glow, lx, ly, 2.4, color, 0.3 * on);
    });
  // The vortex in the throat: spiral arms of air wound toward the dark eye, faster with the charge, a solid swirl
  // right after a gust.
  onGround(g, x, y0, MOUTH - 0.4, () => {
    const arms = level >= 3 ? 4 : 3;
    for (let i = 0; i < arms; i++) {
      const b = spin + (i * 2 * Math.PI) / arms;
      for (let k = 0; k < 6; k++) {
        const t0 = k / 6,
          t1 = (k + 1) / 6,
          r0 = THROAT * (1 - t0 * 0.8),
          r1 = THROAT * (1 - t1 * 0.8),
          a0 = b + t0 * 2.4,
          a1 = b + t1 * 2.4;
        g.lineStyle(2.2 - 1.4 * t0, shade(c, 0.1 + 0.4 * t0), 0.55 + 0.35 * kick);
        g.lineBetween(Math.cos(a0) * r0, Math.sin(a0) * r0, Math.cos(a1) * r1, Math.sin(a1) * r1);
      }
    }
    disc(g, 0, 0, 2.2, 0x020608);
  });
  onGround(glow, x, y0, MOUTH - 0.4, () => disc(glow, 0, 0, THROAT - 1, c, 0.08 + 0.15 * charge + energy));
  // Wind spirals: arcs climbing the funnel as they wind round it, then leaving the mouth, in ink and in light.
  const streaks = 3 + Math.round(2 * charge),
    speed = 0.5 + 0.8 * charge;
  for (let k = 0; k < streaks; k++) {
    const t = (clock * speed + k / streaks) % 1,
      h = PLINTH + 3 + t * (MOUTH + 7 - PLINTH),
      r = 5.5 + t * 10,
      a0 = clock * 3 + k * 2.1 + t * 6,
      fade = 1 - t * 0.6;
    onGround(g, x, y0, h, () => arcBand(g, 0, 0, r, 0.9, a0, a0 + 1.2, shade(c, 0.55), 0.55 * fade));
    onGround(glow, x, y0, h, () => arcBand(glow, 0, 0, r, 2.4, a0, a0 + 1.2, c, (0.18 + 0.22 * charge + energy) * fade));
  }
  if (kick > 0) halo(glow, x, Y(y0, 0, MOUTH + 3), 13 * (1 + kick), c, 0.3 * kick);
}

export const concept: Concept = {
  tower: "cyclone",
  name: "Vortex Funnel",
  idea: "An upright funnel tower widening to an open mouth, braced by three struts on a vented plinth; a vortex swirls in its throat and wind spirals rise round it and out.",
  tilt: { drop: DROP, squash: 0.65, height: 0, deck: PLINTH + 0.6, emit: MOUTH },
  base,
  below,
  turret,
  above,
};
