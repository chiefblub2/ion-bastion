import { halo } from "../../material";
import { disc, hash01, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { X, Y, block, drum } from "../tilt";
import { GUN, rect, turnAbout } from "../tilt-parts";
import { FOOT, INSET } from "../tilt";
import { bolts, chase, contact, frontArc, plinth, prism } from "./kit-control-a";
import type { TiltedConcept as Concept } from "../tilted";

// Cryo: the Cryo Condenser, a squat coolant drum on an octagonal plinth, a cluster of ice crystals growing from its lid.
const DROP = 6,
  PLINTH = 4,
  DRUM_TOP = 10.5,
  EMIT = 27;
/** The crystals on the lid: ground offset, radius, column top above the lid and cap height; tallest at the back. */
const CRYSTALS = [
  [-1.5, -3, 2.6, 11, 5],
  [4.2, -0.6, 2, 7, 3.6],
  [-4.4, 1.6, 1.8, 5, 3.2],
  [1.4, 3.4, 1.6, 3.4, 2.8],
] as const;
const PLATES = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    ice = shade(c, 0.45);
  contact(g, x, y0, 20);
  plinth(g, x, y0, 8, 19.5, 0, PLINTH, Math.PI / 8);
  // Frost rime along the plinth's front edge.
  frontArc(g, x, y0, 17.6, PLINTH + 1, 1.6, shade(ice, 0.2), 0.55, 0.3, Math.PI - 0.3);
  if (level >= 3) bolts(g, x, y0, 15.8, PLINTH + 1, 8, Math.PI / 8);
  if (level >= 5)
    for (const t of PLATES) {
      const n = turnAbout(rect(14.5, 18.5, -3.4, 3.4), t, FOOT);
      turnAbout(rect(14.5, 18.5, -3.4, 3.4), t, INSET, 0.8);
      if (Math.sin(t) > -0.2) block(g, x, y0, FOOT, INSET, n, PLINTH, PLINTH + 1.6, 0.6, shade(c, -0.55), shade(c, -0.25), shade(c, 0.3));
    }
  if (level >= 6) frontArc(g, x, y0, 13.2, PLINTH + 1, 1, color, 0.9, 0.2, Math.PI - 0.2);
  // The condenser drum with two coolant bands and a frosted lid.
  drum(g, x, y0, 11, PLINTH + 1, DRUM_TOP, GUN.side, shade(ice, -0.25), 14);
  frontArc(g, x, y0, 11.05, 6.7, 1.3, shade(c, -0.35));
  frontArc(g, x, y0, 11.05, 9, 1.3, shade(c, -0.35));
  // Lamp socket on the drum's front (its light is live).
  if (level >= 2) {
    disc(g, X(x, -6), Y(y0, 9.2, 8), 1.3, GUN.deep);
    disc(g, X(x, -6), Y(y0, 9.2, 8), 0.8, shade(color, -0.1));
  }
}

/** The crystal cluster on the lid, back to front (a radial tower: no aim, one picture per recoil step). */
function turret({ g, x, y, definition, level }: TurretContext) {
  const y0 = y + DROP,
    ice = shade(definition.color, 0.25),
    grow = level >= 5 ? 1.15 : level >= 3 ? 1.07 : 1;
  for (const [u, v, r, h, tip] of CRYSTALS) prism(g, x, y0, u, v, r * grow, DRUM_TOP - 0.5, DRUM_TOP + h * grow, tip * grow, ice);
}

/** Chasing lamps on the plinth and the drum lamp's light, under the crystals. */
function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  const y0 = y + DROP;
  chase(g, glow, x, y0, 17, PLINTH + 0.6, 5, clock, color, level);
  if (level >= 2) disc(glow, X(x, -6), Y(y0, 9.2, 8), 2.4, color, 0.35);
}

/** The crystals' cold light growing with the charge, snow motes drifting up, and a mist burst after a shot. */
function above({ glow, g, x, y, charge, kick, clock, definition, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    tx = X(x, -1.5),
    ty = Y(y0, -3, EMIT);
  halo(glow, tx, ty + 6, 9 + 4 * charge, c, 0.12 + 0.18 * charge + energy);
  disc(glow, tx, ty, 2 + 1.5 * charge, 0xffffff, 0.2 + 0.15 * charge);
  for (let i = 0; i < 5; i++) {
    const t = (clock * 0.35 + i / 5) % 1,
      u = (hash01(i, 3, 7) - 0.5) * 18,
      v = (hash01(i, 9, 2) - 0.5) * 10;
    disc(glow, X(x, u + Math.sin(clock + i) * 1.5), Y(y0, v, DRUM_TOP + 4 + 20 * t), 0.9, shade(c, 0.5), 0.35 * (1 - t));
  }
  if (kick > 0)
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2,
        spread = 1 - kick;
      disc(g, X(x, Math.cos(t) * (12 + 6 * spread)), Y(y0, Math.sin(t) * (12 + 6 * spread), PLINTH + 2 + 3 * spread), 2 + 2.5 * spread, shade(c, 0.6), 0.35 * kick);
    }
}

export const concept: Concept = {
  tower: "frost",
  name: "Cryo Condenser",
  idea: "Squat coolant drum on an octagonal plinth; a cluster of ice crystals grows from its lid and glows with the charge; mist bursts on a shot.",
  tilt: { drop: DROP, squash: 0.65, height: EMIT, deck: PLINTH + 1, emit: EMIT },
  base,
  below,
  turret,
  above,
};
