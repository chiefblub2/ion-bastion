import { arcBand, disc, oval, shade, strokeOval } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, SQUASH, onGround, tube } from "../tilt";
import { DROP, IRON, at, box2, chase, readyLight, readySocket, slab, trapTilt, trim } from "./kit-traps-b";
import type { TiltedConcept as Concept } from "../tilted";

/** The drum lying on its side at the back right: its axis runs east-west at height R, from u0 to u1. */
const DRUM = { u0: 2, u1: 16, v: -13, r: 4.2 },
  CRADLE = [box2(4, 6.5, -17, -9), box2(11.5, 14, -17, -9)];

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  // The spill soaked into the bed: dark stains, then the glossy pool and its splashes.
  onGround(g, x, y0, 0, () => {
    oval(g, 0.5, 2, 19, 13, shade(c, -0.82), 0.85, 0.15);
    oval(g, -12, 9, 5.5, 3.6, shade(c, -0.78), 0.8, -0.3);
    oval(g, 13, 8, 4, 2.6, shade(c, -0.78), 0.8, 0.5);
    oval(g, -0.5, 2.5, 16, 10.5, shade(c, -0.62), 0.95, 0.15);
    oval(g, -1, 2, 14, 9, shade(c, -0.45), 0.92, 0.15);
    if (level >= 5) {
      g.lineStyle(0.9, shade(color, -0.15), 0.8);
      strokeOval(g, 0.5, 2, 37, 25);
    }
  });
  // A cradle of two chocks and the drum lying in it, its bung towards the pool.
  for (const s of CRADLE) slab(g, x, y0, s, 0, 2.2, 0, IRON.wall, IRON.top, IRON.metal, 1);
  // The axis' ground point is (0, DRUM.v): the kit's tube runs east from it at height r.
  const py = y0 + DRUM.v * SQUASH;
  tube(g, x, py, 0, DRUM.r, DRUM.u0, DRUM.u1, DRUM.r, shade(c, -0.3));
  // Two rolling hoops round the drum, a hazard band from level 3 and the dark bung on its west end.
  for (const u of [5.6, 12.6]) tube(g, x, py, 0, DRUM.r, u - 0.5, u + 0.5, DRUM.r + 0.3, shade(c, -0.55), 1, false);
  if (level >= 3) tube(g, x, py, 0, DRUM.r, 8.6, 9.6, DRUM.r + 0.1, 0xd9b43a, 1, false);
  const [bx, by] = at(x, y0, DRUM.u0 + 1.2, DRUM.v, DRUM.r * 2 - 0.4);
  disc(g, bx, by, 1.1, OUTLINE);
  if (level >= 2) readySocket(g, x, y0, 15.5, -9.4, 2.4, c);
}
/** From level 4 lights chase along the cradle's front. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, [[6.5, -9.2] as const, [12.5, -9.2] as const], 1.4);
}
/**
 * The pool's slow rainbow sheen and highlight, the drip from the drum's bung, and fresh oil rippling out after it
 * coats an enemy (`kick`).
 */
function above(ctx: TurretContext) {
  const { g, x, y, tower, definition, level, clock, kick } = ctx,
    y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0.2, () => {
    for (const [i, hue] of [0xff7ad9, 0x7affd4, 0xffe27a].entries()) {
      const a = clock * 0.35 + tower.id + i * 2.1;
      arcBand(g, -1, 2, 5 + i * 2.4, 1.1, a, a + 1.4, hue, 0.2);
    }
    oval(g, -6, -2, 4.5, 1.6, 0xffffff, 0.3, -0.3);
    if (kick > 0) {
      g.lineStyle(1.2, shade(trim(ctx), 0.4), 0.7 * kick);
      strokeOval(g, -1, 2, 2 * (4 + 10 * (1 - kick)), 2 * (3 + 7 * (1 - kick)));
    }
  });
  const drip = (clock * 1.3 + tower.id * 0.3) % 1,
    [bx, by] = at(x, y0, DRUM.u0 + 1.2, DRUM.v, DRUM.r * 2 - 0.4);
  disc(g, bx - 1.5, by + 1 + drip * 7, 1, shade(c, -0.2), 1 - drip);
  if (level >= 2) readyLight(ctx, x, y0, 15.5, -9.4, 2.4);
}

export const concept: Concept = {
  tower: "oil",
  name: "Spill Drum",
  idea: "A glossy purple spill soaked into the path bed with a rainbow sheen, fed by a hooped drum lying in a cradle at the back that drips into it.",
  tilt: trapTilt(0.2),
  base,
  below,
  turret: () => {},
  above,
};
