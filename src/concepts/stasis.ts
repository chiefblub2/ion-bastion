import { halo } from "../render/material";
import { arcBand, disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { X, Y, block, drum, onGround } from "../render/tower-art/tilt";
import { rod } from "../render/tower-art/tilt-frame";
import { GUN } from "../render/tower-art/tilt-parts";
import { bolts, chase, contact, frontArc, ngon } from "./kit-control-a";
import type { Concept } from "./types";

// Stasis: the Stasis Gyre, a hexagonal glass core on a round dais, three arms holding emitter nodes around it; a field
// ring between the nodes freezes what passes.
const DROP = 6,
  DAIS = 3.5,
  CORE_TOP = 17,
  ARM_H = 12.5,
  REACH = 13.5,
  EMIT = 13;
/** The three arms, never hiding one straight behind the core. */
const ARMS = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
const CORE = ngon(6, 5.5, 0),
  CORE_IN = ngon(6, 4.6, 0);

function base({ g, x, y, level, color }: TurretContext) {
  const y0 = y + DROP;
  contact(g, x, y0, 19);
  drum(g, x, y0, 18.5, 0, DAIS, GUN.side, GUN.top, 20);
  // A dark groove and three sockets where the arms stand.
  onGround(g, x, y0, DAIS, () => {
    disc(g, 0, 0, 10, GUN.deep, 0.9);
    for (const t of ARMS) disc(g, Math.cos(t) * REACH, Math.sin(t) * REACH, 3.2, GUN.deep);
  });
  if (level >= 3) bolts(g, x, y0, 16, DAIS, 12, 0.26);
  if (level >= 6) frontArc(g, x, y0, 17.2, DAIS, 1.1, color, 0.9);
}
/** The glass core: a hex column of dark teal glass, steel ribs from level 5. */
function core(g: TurretContext["g"], x: number, y0: number, c: number, level: number) {
  block(g, x, y0, CORE, CORE_IN, 6, DAIS, CORE_TOP, 0.8, shade(c, -0.62), shade(c, -0.4), shade(c, 0.2));
  if (level >= 5) for (const h of [7, 12]) frontArc(g, x, y0, 5.8, h, 1.4, GUN.metal, 0.9, 0.5, Math.PI - 0.5);
}

/** The three arms with their emitter nodes and the core between them, back to front (radial: no aim). */
function turret({ g, x, y, definition, level }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    order = [...ARMS].sort((a, b) => Math.sin(a) - Math.sin(b));
  let cored = false;
  for (const t of order) {
    if (!cored && Math.sin(t) > 0) {
      core(g, x, y0, c, level);
      cored = true;
    }
    const u = Math.cos(t),
      v = Math.sin(t);
    // Strut from the dais up to the node, and a brace back to the core.
    rod(g, x, y0, u * REACH, v * REACH, DAIS, u * REACH, v * REACH, ARM_H - 1.5, 2.2, GUN.side);
    rod(g, x, y0, u * 5, v * 5, ARM_H + 2, u * REACH, v * REACH, ARM_H, 1.6, GUN.top);
    // Emitter node: a short drum with a glass cap.
    drum(g, X(x, u * REACH), Y(y0, v * REACH, 0), 2.6, ARM_H - 1.5, ARM_H + 1.2, GUN.side, shade(c, -0.3), 8);
    if (level >= 3) disc(g, X(x, u * REACH), Y(y0, v * REACH, ARM_H + 1.3), 0.8, shade(c, 0.1));
  }
  if (!cored) core(g, x, y0, c, level);
}

/** Chasing lamps round the dais. */
function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 17.4, DAIS + 0.3, 6, clock, color, level);
}

/** The nodes' glow, the field ring between them filling with the charge, the core's dial and a freeze flash. */
function above({ g, glow, x, y, level, charge, kick, clock, color, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(glow, x, y0, ARM_H, () => {
    arcBand(glow, 0, 0, REACH, 2.6, -Math.PI, -Math.PI + 2 * Math.PI * charge, c, 0.12 + 0.2 * charge + energy);
  });
  for (const t of ARMS) {
    const nx = X(x, Math.cos(t) * REACH),
      ny = Y(y0, Math.sin(t) * REACH, ARM_H + 1.3);
    disc(glow, nx, ny, 2.4 + 1.2 * charge, c, 0.25 + 0.3 * charge);
  }
  // The core's dial on its top: a hand sweeping round with the charge, a level lamp beside it.
  const hx = X(x, 0),
    hy = Y(y0, 0, CORE_TOP + 0.8),
    t = -Math.PI / 2 + charge * Math.PI * 2;
  g.lineStyle(1.2, shade(c, 0.35), 1);
  g.lineBetween(hx, hy, hx + Math.cos(t) * 3.6, hy + Math.sin(t) * 3.6 * 0.65);
  halo(glow, hx, hy - 2, 6 + 2 * Math.sin(clock * 3), c, 0.15 + 0.15 * charge);
  if (level >= 2) disc(glow, X(x, 3.2), Y(y0, 2, CORE_TOP + 0.8), 1.8, color, 0.4);
  if (kick > 0) onGround(glow, x, y0, ARM_H, () => arcBand(glow, 0, 0, REACH + 8 * (1 - kick), 2, 0, Math.PI * 2, 0xffffff, 0.3 * kick));
}

export const concept: Concept = {
  tower: "stasis",
  name: "Stasis Gyre",
  idea: "Hex glass core on a round dais, three struts with emitter nodes around it; a field ring between the nodes fills with the charge and flashes on a stun.",
  tilt: { drop: DROP, squash: 0.65, height: EMIT, deck: DAIS, emit: EMIT },
  base,
  below,
  turret,
  above,
};
