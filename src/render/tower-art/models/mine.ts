import { halo } from "../../material";
import { arcBand, disc, oval, ring, shade } from "../../shapes";
import { OUTLINE, SQUASH, X, Y, drum, onGround } from "../tilt";
import { DROP, STEEL, armedLight, chasers, frame, lampSocket, well } from "./kit-traps-a";
import type { TiltedConcept as Concept } from "../tilted";

/** Frame half size and height, the mine's body heights. */
const S = 16,
  H = 2.4,
  TOP = H + 1,
  BODY = 2.8;

/** Mine: a squat orange charge sunk in a steel frame; the fuse ring closes with the reload, the fuse blinks when armed. */
export const concept: Concept = {
  tower: "mine",
  name: "Pressure Charge",
  idea: "A squat orange charge sunk into a steel frame on the path; a ring of fuse lights closes as it re-arms and the fuse blinks once armed.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level } = ctx,
      c = d.color,
      y0 = y + DROP;
    frame(ctx, S, H);
    well(g, x, y0, TOP, 10.6, 10.6 * SQUASH, STEEL.deep);
    // The charge: a short drum rising a little out of its well, with four detonator studs on its cap.
    drum(g, x, y0, 8.6, TOP - 1, TOP + BODY, shade(c, -0.35), shade(c, -0.12), 16);
    onGround(g, x, y0, TOP + BODY, () => {
      ring(g, 0, 0, 6.2, 1.4, OUTLINE, 0.7);
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        disc(g, Math.cos(a) * 6.8, Math.sin(a) * 6.8, 1.2, shade(c, -0.6));
      }
      disc(g, 0, 0, 2, OUTLINE);
      if (level >= 3) oval(g, -2.6, -2.8, 2.2, 1, shade(c, 0.2), 0.5);
    });
    lampSocket(ctx, S, TOP);
  },
  below: (ctx) => chasers(ctx, S, H),
  turret: () => {},
  above: (ctx) => {
    const { g, glow, x, y, definition: d, clock, charge, kick, color } = ctx,
      c = d.color,
      y0 = y + DROP,
      cap = TOP + BODY;
    // The fuse ring closes as the mine re-arms.
    onGround(g, x, y0, cap, () => arcBand(g, 0, 0, 6.2, 1.1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge, shade(c, 0.15), 0.95));
    if (charge >= 1) {
      onGround(glow, x, y0, cap, () => ring(glow, 0, 0, 6.2, 2.6, color, 0.2));
      const blink = 0.5 + 0.5 * Math.sin(clock * 6);
      disc(g, x, Y(y0, 0, cap), 1.2, shade(0xffffff, -0.3 * (1 - blink)));
      disc(glow, x, Y(y0, 0, cap), 2.8, c, 0.3 * blink);
    }
    // Right after it blew: a hot flash over the charge.
    if (kick > 0) halo(glow, X(x, 0), Y(y0, 0, cap + 2), 10 * (0.6 + kick), c, 0.3 * kick);
    armedLight(ctx, S, TOP);
  },
};
