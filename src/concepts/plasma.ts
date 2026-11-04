import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { drum, endFace, towardViewer, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, depth, framer, paint, part, rect } from "../render/tower-art/tilt-parts";
import { bolts, chase, contact, frontArc } from "./kit-control-a";
import type { Concept } from "./types";

// Plasma: the Plasma Caster, a fat bulbous breech with a big glass canister on its back and a heavy coil-ringed bore,
// held in a wide yoke over a two-tier round plinth with a coolant ring between the tiers.
const DROP = 5,
  LOW = 3,
  HIGH = 6,
  HB = 12.5,
  PITCH = 0.25,
  RECOIL = 6,
  reach = (l: number) => 16 + l;
const YOKE = (q: number) => rect(-4, 4, q - 1.8, q + 1.8);
/** The yoke arms sit outside the breech. */
const ARM = 9.2;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 21);
  drum(g, x, y0, 21, 0, LOW, GUN.deep, GUN.side, 22);
  frontArc(g, x, y0, 17.5, LOW + 0.2, 2.2, shade(c, -0.45), 1);
  drum(g, x, y0, 15, LOW, HIGH, GUN.side, GUN.top, 20);
  if (level >= 3) bolts(g, x, y0, 19.4, LOW, 12, 0.2);
  if (level >= 6) frontArc(g, x, y0, 13.5, HIGH, 1.1, color, 0.9);
}

/** The yoke, the bulbous breech with its canister and the coil-ringed bore, back to front (cached per aim step and recoil). */
function turret({ g, x, y, tower, definition, level, kick, tip }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL,
    P = framer(x, y0, a);
  castShadow(g, x, y0, a, rect(-12, end, -9, 9), HIGH, 0.22);
  const breech = () => {
      tube(g, x, y0, a, HB, back - 11, back + 4, 7.2, GUN.side, 1, true, PITCH);
      // A band in the tower's colour round the breech's belly, armour rings from level 5.
      tube(g, x, y0, a, HB, back - 2.2, back - 0.8, 7.5, shade(c, -0.35), 1, false, PITCH);
      if (level >= 5) for (const d of [-8, -5]) tube(g, x, y0, a, HB, back + d - 0.8, back + d + 0.8, 7.6, shade(c, -0.55), 1, false, PITCH);
      // The canister on the breech's back: steel cap and glass (its glow is live).
      const [cx, cy] = P(back - 4, 0, HB + 6.2 + Math.sin(PITCH) * (back - 4));
      drum(g, cx, cy, 4, 0, 5.4, shade(c, -0.6), shade(c, -0.4), 12);
      drum(g, cx, cy, 4.4, 5.4, 6.8, GUN.top, GUN.metal, 12);
    },
    bore = () => {
      tube(g, x, y0, a, HB, back + 4, end - 2.5, 4.4, GUN.top, 1, true, PITCH);
      const coils = level >= 4 ? 3 : 2;
      for (let i = 0; i < coils; i++) {
        const d = back + 6.5 + i * ((end - back - 10) / Math.max(1, coils - 1));
        tube(g, x, y0, a, HB, d - 0.9, d + 0.9, 5.1, shade(c, -0.35), 1, false, PITCH);
      }
      tube(g, x, y0, a, HB, end - 2.5, end, 5, tip ?? shade(c, -0.5), 1, true, PITCH);
      if (towardViewer(a, PITCH) > 0.05) endFace(g, x, y0, a, HB, end, 3.6, 0x061218, PITCH);
    };
  paint([
    [depth(a, 0, -ARM), () => part(g, x, y0, a, YOKE(-ARM), HIGH, HB + 2, 0, GUN.side, GUN.top, GUN.metal)],
    [depth(a, 0, ARM), () => part(g, x, y0, a, YOKE(ARM), HIGH, HB + 2, 0, GUN.side, GUN.top, GUN.metal)],
    [depth(a, -3, 0), breech],
    [depth(a, (end + 4) / 2, 0), bore],
  ]);
}

function below({ g, glow, x, y, level, clock, color, charge, definition }: TurretContext) {
  const y0 = y + DROP;
  // The coolant ring between the tiers brightens with the charge.
  frontArc(glow, x, y0, 17.5, LOW + 0.2, 3, definition.color, 0.1 + 0.2 * charge);
  chase(g, glow, x, y0, 20, LOW, 6, clock, color, level);
}

/** The canister glowing as the plasma builds, light running along the coils and the bore spilling light after a shot. */
function above({ g, glow, x, y, tower, level, kick, charge, clock, definition, energy }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL,
    P = framer(x, y0, a),
    [cx, cy] = P(back - 4, 0, HB + 6.2 + Math.sin(PITCH) * (back - 4) + 2.7);
  disc(glow, cx, cy, 3.4 + 1.4 * charge, c, 0.2 + 0.35 * charge + energy);
  if (charge > 0.6) disc(g, cx, cy, 1.4 + charge * 0.9, shade(c, 0.55));
  const coils = level >= 4 ? 3 : 2,
    lit = Math.floor((clock * 6) % coils);
  for (let i = 0; i < coils; i++) {
    const d = back + 6.5 + i * ((end - back - 10) / Math.max(1, coils - 1)),
      [lx, ly] = P(d * Math.cos(PITCH), 0, HB + 4.8 + d * Math.sin(PITCH));
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
