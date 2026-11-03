import { disc, oval, shade } from "../render/shapes";
import { SQUASH, X, Y, onGround } from "../render/tower-art/tilt";
import type { TurretContext } from "../render/tower-art/kit";
import { DROP, STEEL, armedLight, chasers, frame, lampSocket } from "./kit-traps-a";
import type { Concept } from "./types";

const S = 19,
  H = 2,
  TOP = H + 1,
  STEP = 11;
/** Spike positions on the plate, back rows first; from L5 four more between them. */
const GRID = [-1, 0, 1].flatMap((j) => [-1, 0, 1].map((i) => [i * STEP, j * STEP] as const));
const EXTRA = [-0.5, 0.5].flatMap((j) => [-0.5, 0.5].map((i) => [i * STEP, j * STEP] as const));
const spots = (level: number) => (level >= 5 ? [...GRID, ...EXTRA].sort((a, b) => a[1] - b[1]) : GRID);

/** One four-sided spike standing on the plate: left face lit, front face mid, right face in shade. */
function spike(ctx: TurretContext, u: number, v: number, h: number, w: number) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP,
    ax = X(x, u),
    ay = Y(y0, v, TOP + h),
    bl = [X(x, u - w), Y(y0, v + w, TOP)] as const,
    br = [X(x, u + w), Y(y0, v + w, TOP)] as const,
    fl = [X(x, u - w), Y(y0, v - w, TOP)] as const,
    fr = [X(x, u + w), Y(y0, v - w, TOP)] as const;
  g.fillStyle(shade(c, 0.3));
  g.fillTriangle(ax, ay, fl[0], fl[1], bl[0], bl[1]);
  g.fillStyle(shade(c, -0.55));
  g.fillTriangle(ax, ay, fr[0], fr[1], br[0], br[1]);
  g.fillStyle(shade(c, -0.15));
  g.fillTriangle(ax, ay, bl[0], bl[1], br[0], br[1]);
  // Path tiers: the tips in the path colour.
  if (level >= 6) disc(g, ax, ay + 0.6, 0.7, color);
}

/** Caltrops: a grated steel plate whose nine spikes stab up out of their holes on every strike. */
export const concept: Concept = {
  tower: "spikes",
  name: "Spike Bed",
  idea: "A grated steel plate on the path with nine steel spikes (thirteen from L5) that sit just proud of their holes and stab up on each strike.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, level } = ctx,
      y0 = y + DROP;
    frame(ctx, S, H);
    // A hole under every spike, darker on its far lip.
    onGround(g, x, y0, TOP, () => {
      for (const [u, v] of spots(level)) {
        oval(g, u, v, 3.6, 3.6, STEEL.deep);
        oval(g, u + 0.4, v + 0.5, 2.8, 2.8, 0x0b1216);
      }
    });
    lampSocket(ctx, S, TOP);
  },
  below: (ctx) => chasers(ctx, S, H),
  // At rest the spikes show a short point; a strike drives them up to their full length.
  turret: (ctx) => {
    const h = 2.2 + 3.6 * ctx.kick;
    for (const [u, v] of spots(ctx.level)) spike(ctx, u, v, h, 2.5);
  },
  above: (ctx) => armedLight(ctx, S, TOP),
};
