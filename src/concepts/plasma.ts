import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { drum, endFace, towardViewer, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, depth, framer, paint, part, rect } from "../render/tower-art/tilt-parts";
import { bolts, chase, contact, frontArc } from "./kit-control-a";
import type { Concept } from "./types";

// Plasma: the Plasma Caster, a fat bulbous breech with a glass canister on its back and a short coil-ringed bore, held in
// a yoke over a two-tier round plinth with a coolant ring between the tiers.
const DROP = 5,
  LOW = 3,
  HIGH = 6,
  HB = 11,
  PITCH = 0.25,
  RECOIL = 6,
  reach = (l: number) => 14 + l;
const YOKE = (q: number) => rect(-3, 3, q - 1.3, q + 1.3);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 19);
  drum(g, x, y0, 19, 0, LOW, GUN.deep, GUN.side, 20);
  frontArc(g, x, y0, 15.5, LOW + 0.2, 2, shade(c, -0.45), 1);
  drum(g, x, y0, 13.5, LOW, HIGH, GUN.side, GUN.top, 18);
  if (level >= 3) bolts(g, x, y0, 17.4, LOW, 10, 0.2);
  if (level >= 6) frontArc(g, x, y0, 12, HIGH, 1, color, 0.9);
}

/** The yoke, the bulbous breech with its canister and the coil-ringed bore, back to front (cached per aim step and recoil). */
function turret({ g, x, y, tower, definition, level, kick, tip }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL,
    P = framer(x, y0, a);
  castShadow(g, x, y0, a, rect(-10, end, -6, 6), HIGH, 0.22);
  const breech = () => {
      tube(g, x, y0, a, HB, back - 9, back + 3, 5.4, GUN.side, 1, true, PITCH);
      if (level >= 5) tube(g, x, y0, a, HB, back - 6, back - 4, 5.8, shade(c, -0.5), 1, false, PITCH);
      // The canister on the breech's back: steel cap and glass (its glow is live).
      const [cx, cy] = P(back - 3.5, 0, HB + 5.2 + Math.sin(PITCH) * (back - 3.5));
      drum(g, cx, cy, 2.6, 0, 4.4, shade(c, -0.6), shade(c, -0.4), 10);
      drum(g, cx, cy, 2.9, 4.4, 5.4, GUN.top, GUN.metal, 10);
    },
    bore = () => {
      tube(g, x, y0, a, HB, back + 3, end - 2, 3.1, GUN.top, 1, true, PITCH);
      const coils = level >= 4 ? 3 : 2;
      for (let i = 0; i < coils; i++) {
        const d = back + 5 + i * ((end - back - 8) / Math.max(1, coils - 1));
        tube(g, x, y0, a, HB, d - 0.6, d + 0.6, 3.6, shade(c, -0.35), 1, false, PITCH);
      }
      tube(g, x, y0, a, HB, end - 2, end, 3.7, tip ?? shade(c, -0.5), 1, true, PITCH);
      if (towardViewer(a, PITCH) > 0.05) endFace(g, x, y0, a, HB, end, 2.6, 0x061218, PITCH);
    };
  paint([
    [depth(a, 0, -6.5), () => part(g, x, y0, a, YOKE(-6.5), HIGH, HB + 1.5, 0, GUN.side, GUN.top, GUN.metal)],
    [depth(a, 0, 6.5), () => part(g, x, y0, a, YOKE(6.5), HIGH, HB + 1.5, 0, GUN.side, GUN.top, GUN.metal)],
    [depth(a, -3, 0), breech],
    [depth(a, (end + 3) / 2, 0), bore],
  ]);
}

function below({ g, glow, x, y, level, clock, color, charge, definition }: TurretContext) {
  const y0 = y + DROP;
  // The coolant ring between the tiers brightens with the charge.
  frontArc(glow, x, y0, 15.5, LOW + 0.2, 3, definition.color, 0.1 + 0.2 * charge);
  chase(g, glow, x, y0, 18, LOW, 6, clock, color, level);
}

/** The canister glowing as the plasma builds, light running along the coils and the bore spilling light after a shot. */
function above({ g, glow, x, y, tower, level, kick, charge, clock, definition, energy }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL,
    P = framer(x, y0, a),
    [cx, cy] = P(back - 3.5, 0, HB + 5.2 + Math.sin(PITCH) * (back - 3.5) + 2.2);
  disc(glow, cx, cy, 2.4 + charge, c, 0.2 + 0.35 * charge + energy);
  if (charge > 0.6) disc(g, cx, cy, 1 + charge * 0.6, shade(c, 0.55));
  const coils = level >= 4 ? 3 : 2,
    lit = Math.floor((clock * 6) % coils);
  for (let i = 0; i < coils; i++) {
    const d = back + 5 + i * ((end - back - 8) / Math.max(1, coils - 1)),
      [lx, ly] = P(d * Math.cos(PITCH), 0, HB + 3.4 + d * Math.sin(PITCH));
    disc(glow, lx, ly, 1.8, c, i === lit ? 0.4 * charge + 0.1 : 0.08);
  }
  const [mx, my] = P(end * Math.cos(PITCH), 0, HB + end * Math.sin(PITCH));
  if (kick > 0) halo(glow, mx, my, 6 * (1 + kick), c, 0.35 * kick);
}

export const concept: Concept = {
  tower: "plasma",
  name: "Plasma Caster",
  idea: "Fat bulbous breech with a glass canister on its back and a short coil-ringed bore in a yoke; the canister glows as the plasma builds.",
  tilt: { drop: DROP, squash: 0.65, height: HB, pitch: PITCH, deck: HIGH },
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
