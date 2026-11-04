import { halo } from "../../material";
import { disc, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, drum, tube } from "../tilt";
import { SX, SY, frame, plane, project, rod } from "../tilt-frame";
import { GUN, castShadow, framer, part, rect } from "../tilt-parts";
import { bolts, chase, contact, frontArc } from "./kit-control-a";
import type { TiltedConcept as Concept } from "../tilted";

// Mesmer: the Hypno Dish, a large disc leaning back in a fork so its face looks up toward the target from every side;
// the face is a spiral turning round an eye, and a short emitter prong reaches from the eye to the target.
const DROP = 6,
  PLINTH = 3.5,
  POST = 8,
  HB = 14,
  /** How far the disc's face is turned up from looking straight at the target. */
  LEAN = 1.32,
  DISC_R = 12,
  RECOIL = 1,
  reach = (l: number) => 15 + l;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 18);
  drum(g, x, y0, 18, 0, PLINTH, GUN.deep, GUN.side, 20);
  // A violet inlay along the plinth's top.
  frontArc(g, x, y0, 14.5, PLINTH, 1.2, shade(c, -0.35), 0.9, -0.4, Math.PI + 0.4);
  if (level >= 3) bolts(g, x, y0, 16.3, PLINTH, 10, 0);
  if (level >= 6) frontArc(g, x, y0, 11.5, PLINTH, 1, color, 0.9);
  drum(g, x, y0, 4.5, PLINTH, POST, GUN.side, GUN.top, 12);
}

/** The fork, its rear brace and the leaning disc with its rim (cached per aim step); the spiral on the face is live. */
function turret({ g, x, y, tower, definition, level }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    f = frame(a, LEAN, HB),
    P = framer(x, y0, a);
  castShadow(g, x, y0, a, rect(-5, 4, -DISC_R, DISC_R), PLINTH, 0.22);
  // A crossbar on the post, two arms to the disc's sides, and a brace from the back.
  part(g, x, y0, a, rect(-1.5, 1.5, -13.2, 13.2), POST, POST + 1.6, 0, GUN.side, GUN.top, GUN.metal);
  const [bu, bv] = [Math.cos(a) * -6, Math.sin(a) * -6];
  rod(g, x, y0, bu * 0.3, bv * 0.3, POST + 1.6, bu, bv, HB + 2, 1.6, GUN.side);
  for (const q of [-13.2, 13.2]) {
    const u = -Math.sin(a) * q,
      v = Math.cos(a) * q;
    rod(g, x, y0, u, v, POST + 1.6, u, v, HB, 2, GUN.top);
  }
  // The disc: the rim, a steel back lip, the dark face.
  plane(g, x, y0, f, -0.6, DISC_R + 1, OUTLINE, 0.95);
  plane(g, x, y0, f, -0.3, DISC_R + 0.4, level >= 5 ? shade(c, -0.45) : GUN.side);
  plane(g, x, y0, f, 0, DISC_R - 0.8, 0x10061c);
  // Hub caps where the arms hold the disc.
  for (const q of [-13.2, 13.2]) {
    const [hx, hy] = P(0, q, HB);
    disc(g, hx, hy, 1.7, OUTLINE);
    disc(g, hx - 0.3, hy - 0.3, 1.1, level >= 6 ? shade(c, 0.1) : GUN.metal);
  }
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 16.5, PLINTH, 6, clock, color, level);
}

/** The spiral turning faster with the charge round a glowing eye, the prong from the eye to the target, a pulse on a shot. */
function above({ g, glow, x, y, tower, level, kick, charge, clock, definition, tip, energy }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    f = frame(a, LEAN, HB),
    end = reach(level) - kick * RECOIL,
    arms = level >= 3 ? 3 : 2,
    spin = clock * (1.5 + 4 * charge);
  for (let k = 0; k < arms; k++) {
    let px = 0,
      py = 0;
    for (let i = 0; i <= 14; i++) {
      const s = i / 14,
        t = spin + (k * Math.PI * 2) / arms + s * 4.2,
        r = 1.6 + s * (DISC_R - 2.4);
      project(x, y0, f, 0.2, Math.cos(t) * r, Math.sin(t) * r, 0);
      if (i > 0) {
        g.lineStyle(0.9 + 1.4 * s, shade(c, -0.1 + 0.3 * s), 1);
        g.lineBetween(px, py, SX[0], SY[0]);
        glow.lineStyle(2.4, c, 0.08 + 0.15 * charge);
        glow.lineBetween(px, py, SX[0], SY[0]);
      }
      px = SX[0];
      py = SY[0];
    }
  }
  project(x, y0, f, 0.3, 0, 0, 0);
  const ex = SX[0],
    ey = SY[0];
  disc(g, ex, ey, 2.2, 0xf3e9ff);
  disc(g, ex, ey, 1.1, 0x1a0b26);
  halo(glow, ex, ey, 5 + 3 * charge, c, 0.2 + 0.25 * charge + energy);
  // The prong: level, from the eye to the target.
  tube(g, x, y0, a, HB, 1, end - 1.6, 1.1, GUN.top);
  tube(g, x, y0, a, HB, end - 1.6, end, 1.7, tip ?? shade(c, -0.2));
  const [mx, my] = framer(x, y0, a)(end, 0, HB);
  disc(glow, mx, my, 1.8 + charge, c, 0.2 + 0.3 * charge);
  if (kick > 0) halo(glow, ex, ey, DISC_R * (1 + 0.6 * (1 - kick)), c, 0.25 * kick);
}

export const concept: Concept = {
  tower: "mesmer",
  name: "Hypno Dish",
  idea: "A large disc leaning back in a fork, its face looking up toward the target; a spiral turns ever faster round an eye, a short prong points at the target.",
  tilt: { drop: DROP, squash: 0.65, height: HB, deck: PLINTH },
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
