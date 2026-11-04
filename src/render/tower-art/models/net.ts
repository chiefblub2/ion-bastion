import { halo } from "../../material";
import { disc, oval, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, drum, onGround, towardViewer } from "../tilt";
import { box, frame } from "../tilt-frame";
import { GUN, castShadow, depth, endAt, framer, muzzleAt, paint, part, rect, tubeAt } from "../tilt-parts";
import { bolts, chase, contact, frontArc, plinth } from "./kit-control-a";
import type { TiltedConcept as Concept } from "../tilted";

// Snare Net: the Net Thrower, two wide, short launch tubes raised on a turntable cradle with a crate of folded nets
// behind them; weights sit in the mouths once loaded.
const DROP = 5,
  PLINTH = 4,
  TABLE = 6,
  HB = 10.5,
  PITCH = 0.3,
  SIDES = [-4, 4] as const,
  RECOIL = 4,
  BORE = 2.9,
  reach = (l: number) => 15 + l;
const CHEEK = (q: number) => rect(-5, 4, q - 1, q + 1);
/** Rope coils lying on the plinth's front corners. */
const COILS = [
  [-12, 9],
  [12.5, 8.5],
] as const;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 19);
  plinth(g, x, y0, 10, 19, 0, PLINTH, 0);
  for (const [u, v] of COILS)
    onGround(g, x, y0, PLINTH + 1, () => {
      oval(g, u, v, 4, 3.4, shade(c, -0.6));
      oval(g, u, v, 3, 2.5, shade(c, -0.15));
      oval(g, u, v, 1.6, 1.3, shade(c, -0.6));
    });
  if (level >= 3) bolts(g, x, y0, 16.5, PLINTH + 1, 10, 0.3);
  if (level >= 6) frontArc(g, x, y0, 14.5, PLINTH + 1, 1, color, 0.9);
  drum(g, x, y0, 10.5, PLINTH + 1, TABLE, GUN.deep, GUN.side, 14);
}

/** The net crate, the cradle cheeks and the two launch tubes, back to front (cached per aim step and recoil). */
function turret({ g, x, y, tower, definition, level, kick, tip, color }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL,
    P = framer(x, y0, a),
    crate = frame(a, 0, TABLE);
  castShadow(g, x, y0, a, rect(-12, end, -7, 7), TABLE, 0.22);
  const parts: [number, () => void][] = [
    [
      depth(a, -9, 0),
      () => {
        box(g, x, y0, crate, -13, -5, -6.5, 6.5, 0, 7.5, shade(c, -0.55), shade(c, -0.45));
        // The folded net on the crate's lid: a cross-hatch in rope colour.
        const lid = TABLE + 7.6;
        g.lineStyle(0.6, shade(c, 0.15), 0.9);
        for (let k = -2; k <= 2; k++) {
          g.lineBetween(...P(-12, k * 2.6, lid), ...P(-6, k * 2.6, lid));
          g.lineBetween(...P(-11.5 + (k + 2) * 1.4, -5.6, lid), ...P(-11.5 + (k + 2) * 1.4, 5.6, lid));
        }
        if (level >= 5) box(g, x, y0, crate, -13.5, -4.5, -7.2, 7.2, 0, 1.6, GUN.side, GUN.top);
        // The crate's lamp socket from level 2, in the crate's own depth order (its light is live).
        if (level >= 2) {
          const [lx, ly] = P(-12, 0, lid + 0.2);
          disc(g, lx, ly, 1.3, OUTLINE);
          disc(g, lx, ly, 0.8, shade(color, 0.3));
        }
      },
    ],
    ...SIDES.map(
      (q) =>
        [
          depth(a, 0, q * 1.8),
          () => {
            part(g, x, y0, a, CHEEK(q * 1.85), TABLE, HB + 2.5, 0, GUN.side, GUN.top, GUN.metal);
          },
        ] as [number, () => void],
    ),
    ...SIDES.map(
      (q) =>
        [
          depth(a, 6, q),
          () => {
            tubeAt(g, x, y0, a, q, HB, back - 4, end - 2.5, BORE, GUN.top, 1, true, PITCH);
            tubeAt(g, x, y0, a, q, HB, end - 2.5, end, BORE + 0.5, tip ?? shade(c, -0.35), 1, true, PITCH);
            if (level >= 3) tubeAt(g, x, y0, a, q, HB, (end + back) / 2 - 0.5, (end + back) / 2 + 0.5, BORE + 0.4, shade(c, -0.5), 1, false, PITCH);
            if (towardViewer(a, PITCH) > 0.05) endAt(g, x, y0, a, q, HB, end, BORE - 0.6, 0x0b0d0e, PITCH);
          },
        ] as [number, () => void],
    ),
  ];
  paint(parts);
}

function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  chase(g, glow, x, y + DROP, 17, PLINTH + 0.6, 5, clock, color, level);
}

/** Weights waiting in the mouths once loaded, a smoke puff after a launch and the crate lamp's light. */
function above({ g, glow, x, y, tower, level, kick, charge, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL;
  for (const q of SIDES) {
    const [mx, my] = muzzleAt(x, y0, a, q, HB, end - 0.6, PITCH);
    if (charge > 0.85 && kick === 0 && towardViewer(a, PITCH) > 0.05) {
      disc(g, mx, my, 1.2, shade(c, -0.2));
      disc(g, mx - 0.3, my - 0.3, 0.5, shade(c, 0.5));
    }
    if (kick > 0) {
      disc(g, mx, my - 3 * (1 - kick), 2 + 3 * (1 - kick), 0x9aa3a6, 0.35 * kick);
      halo(glow, mx, my, 4 * (1 + kick), c, 0.25 * kick);
    }
  }
  // The crate lamp's light only: its socket is turret ink, so a tube in front of it hides the lamp.
  if (level >= 2) {
    const [lx, ly] = framer(x, y0, a)(-12, 0, TABLE + 7.8);
    disc(glow, lx, ly, 2.4, color, 0.35);
  }
}

export const concept: Concept = {
  tower: "net",
  name: "Net Thrower",
  idea: "Two wide, short launch tubes raised on a turntable cradle, a crate of folded nets behind them; weights sit in the mouths once loaded.",
  tilt: { drop: DROP, squash: 0.65, height: HB, pitch: PITCH, deck: PLINTH + 1 },
  reach,
  recoil: RECOIL,
  sides: SIDES,
  base,
  below,
  turret,
  above,
};
