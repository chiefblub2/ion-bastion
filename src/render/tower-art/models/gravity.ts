import { LIGHT, halo } from "../../material";
import { arcBand, disc, ring, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { X, Y } from "../tilt";
import { GUN, part, rect } from "../tilt-parts";
import { OUTLINE } from "../tilt";
import { bolts, chase, contact, frontArc, plinth } from "./kit-control-a";
import type { TiltedConcept as Concept } from "../tilted";

// Gravitron: the Graviton Gate, an upright ring held between two pylons over a steel plinth, a small black core hanging
// in its middle; rings collapse into the core and masses orbit it. The ring is thick, faced in the tower's blue with
// lit steel rims, so the gate reads at a glance instead of as a dark blob.
const DROP = 6,
  PLINTH = 3.5,
  CENTRE = 17,
  RING_R = 11.5,
  RING_W = 4.6,
  PYLON_TOP = 18;
const PYLONS = [rect(-16.5, -12.5, -3, 3), rect(12.5, 16.5, -3, 3)];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 20);
  plinth(g, x, y0, 8, 20, 0, PLINTH, Math.PI / 8, GUN.side, GUN.top, GUN.metal);
  // A sunken well under the gate, lined in the tower's blue.
  frontArc(g, x, y0, 9, PLINTH + 0.9, 1.2, shade(c, -0.35), 0.9, 0, Math.PI);
  if (level >= 3) bolts(g, x, y0, 17.4, PLINTH + 0.9, 8, Math.PI / 8);
  if (level >= 6) frontArc(g, x, y0, 15.4, PLINTH + 0.9, 1.1, color, 0.9);
  // The two pylons (along u: they never turn), with armour plates from level 5.
  for (const p of PYLONS) {
    part(g, x, y0, 0, p, PLINTH, PYLON_TOP, 1, shade(GUN.top, 0.08), shade(GUN.metal, 0.05), shade(GUN.metal, 0.4));
    // A blue stripe down each pylon's front face.
    g.fillStyle(shade(c, -0.15), 0.95).fillRect(X(x, (p[0] + p[2]) / 2) - 0.7, Y(y0, 3, PYLON_TOP - 2), 1.4, PYLON_TOP - PLINTH - 4);
    if (level >= 5) part(g, x, y0, 0, [p[0] - 0.8, 3, p[2] + 0.8, 3, p[2] + 0.8, 4.2, p[0] - 0.8, 4.2], PLINTH + 2, PYLON_TOP - 3, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.2));
    // A lamp socket on each pylon top from level 2.
    if (level >= 2) {
      const lx = X(x, (p[0] + p[2]) / 2),
        ly = Y(y0, 0, PYLON_TOP + 1.2);
      disc(g, lx, ly, 1.2, OUTLINE);
      disc(g, lx, ly, 0.75, shade(color, 0.2));
    }
  }
}

/** The gate ring facing the viewer, its clamps and the dark core (radial: one picture per recoil step). */
function turret({ g, x, y, definition, level, kick }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    cx = X(x, 0),
    cy = Y(y0, 0, CENTRE + kick * 1.2);
  ring(g, cx, cy, RING_R, RING_W + 1.6, OUTLINE, 0.95);
  // The ring's face in the tower's blue between two lit steel rims.
  ring(g, cx, cy, RING_R, RING_W, shade(c, -0.3));
  ring(g, cx, cy, RING_R + RING_W / 2 - 0.8, 1.4, GUN.metal);
  ring(g, cx, cy, RING_R - RING_W / 2 + 0.7, 1.2, GUN.top);
  arcBand(g, cx, cy, RING_R + RING_W / 2 - 0.6, 1.1, LIGHT - 1.2, LIGHT + 1.2, shade(GUN.metal, 0.55), 0.95);
  arcBand(g, cx, cy, RING_R, 1.2, LIGHT - 0.9, LIGHT + 0.9, shade(c, 0.25), 0.9);
  arcBand(g, cx, cy, RING_R + RING_W / 2 - 0.8, 1.2, LIGHT + Math.PI - 1, LIGHT + Math.PI + 1, GUN.deep, 0.8);
  // Field segments on the ring's face from level 3.
  if (level >= 3)
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4 + Math.PI / 8;
      arcBand(g, cx, cy, RING_R, 1.6, t - 0.12, t + 0.12, shade(c, 0.35), 0.9);
    }
  // Clamps where the pylons hold the ring.
  for (const s of [-1, 1]) {
    const px = cx + s * (RING_R + 0.8);
    g.fillStyle(OUTLINE, 0.9).fillRect(px - 2.6, cy - 3.4, 5.2, 6.8);
    g.fillStyle(GUN.metal, 1).fillRect(px - 2, cy - 2.8, 4, 5.6);
    g.fillStyle(shade(GUN.metal, 0.4), 1).fillRect(px - 2, cy - 2.8, 4, 1);
  }
  // The core: a black sphere with a faint rim.
  disc(g, cx, cy, 3.1, OUTLINE);
  disc(g, cx, cy, 2.5, 0x05070f);
  arcBand(g, cx, cy, 2.6, 0.7, LIGHT - 0.8, LIGHT + 0.8, shade(c, 0.2), 0.9);
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 18, PLINTH + 0.4, 6, clock, color, level);
}

/** Rings collapsing into the core while charging, two masses orbiting it, the core's lensing glow and the pull's flash. */
function above({ g, glow, x, y, level, kick, charge, clock, color, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    cx = X(x, 0),
    cy = Y(y0, 0, CENTRE + kick * 1.2);
  for (let i = 0; i < 3; i++) {
    const t = (clock * 0.6 * (1 + charge) + i / 3) % 1,
      r = RING_R - 2 - (RING_R - 5) * t;
    ring(glow, cx, cy, r, 0.8 + 1.4 * t, c, (0.1 + 0.25 * charge) * (1 - t * 0.5));
  }
  halo(glow, cx, cy, 8, c, 0.12 + 0.2 * charge + energy);
  // The ring's face hums in the tower's blue.
  ring(glow, cx, cy, RING_R, RING_W + 1, c, 0.12 + 0.12 * charge + energy);
  const masses = level >= 3 ? 3 : 2;
  for (let i = 0; i < masses; i++) {
    const t = clock * 2.2 + (i * Math.PI * 2) / masses,
      mx = cx + Math.cos(t) * 7.5,
      my = cy + Math.sin(t) * 2.6,
      front = Math.sin(t) > 0;
    if (front) {
      disc(g, mx, my, 1.4, shade(c, 0.4));
      disc(glow, mx, my, 2.6, c, 0.35);
    } else disc(glow, mx, my, 1.6, c, 0.25);
  }
  // The pylon lamps' light (their sockets are in the base).
  if (level >= 2) for (const s of [-1, 1]) disc(glow, X(x, s * 14.5), Y(y0, 0, PYLON_TOP + 1.2), 2.4, color, 0.35 + 0.2 * Math.sin(clock * 3 + s));
  if (kick > 0) ring(glow, cx, cy, 4 + 14 * (1 - kick), 2.4, 0xffffff, 0.35 * kick);
}

export const concept: Concept = {
  tower: "gravity",
  name: "Graviton Gate",
  idea: "A thick blue-faced ring with lit steel rims held upright between two pylons over a steel plinth, a small black core in it; rings collapse into the core, masses orbit it.",
  tilt: { drop: DROP, squash: 0.65, height: CENTRE, deck: PLINTH + 0.9, emit: CENTRE },
  base,
  below,
  turret,
  above,
};
