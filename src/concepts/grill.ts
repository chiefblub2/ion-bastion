import { disc, shade } from "../render/shapes";
import { SQUASH, X, Y, onGround, quad } from "../render/tower-art/tilt";
import { part, rect } from "../render/tower-art/tilt-parts";
import { DROP, STEEL, armedLight, chasers, frame, lampSocket } from "./kit-traps-a";
import type { Concept } from "./types";

const S = 19,
  H = 2.4,
  TOP = H + 1,
  /** Bars run north-south, so the hot slots between them show along their whole length. */
  BARS = [-12, -6, 0, 6, 12],
  BAR = 1.4,
  SPAN = 13,
  FLOOR = TOP - 1.6;

/** Flame Grate: a sunken firebox under a heavy grate; the slots glow with the heat and embers drift up out of them. */
export const concept: Concept = {
  tower: "grill",
  name: "Firebox Grate",
  idea: "A heavy north-south grate over a sunken firebox in a steel frame: the slots between the bars glow and pulse, embers drift up, a strike flares.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level, color } = ctx,
      c = d.color,
      y0 = y + DROP;
    frame(ctx, S, H);
    // The firebox: a soot-dark recess under the bars.
    onGround(g, x, y0, FLOOR, () => {
      g.fillStyle(0x140b08);
      g.fillRect(-SPAN - 1, -SPAN - 1, 2 * SPAN + 2, 2 * SPAN + 2);
    });
    const wall = shade(c, -0.68),
      top = level >= 6 ? shade(color, -0.35) : shade(c, -0.45);
    for (const u of BARS) part(g, x, y0, 0, rect(u - BAR, u + BAR, -SPAN, SPAN), FLOOR, TOP + 0.6, 0, wall, top, shade(c, -0.1));
    // From L3 two cross straps hold the bars.
    if (level >= 3) for (const v of [-8, 8]) part(g, x, y0, 0, rect(-SPAN, SPAN, v - 0.9, v + 0.9), TOP + 0.6, TOP + 1.2, 0, STEEL.deep, STEEL.wall, STEEL.metal);
    lampSocket(ctx, S, TOP);
  },
  // Heat in the slots (the bars are baked over the firebox, so the glow is drawn only between them).
  below: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      y0 = y + DROP,
      heat = Math.min(1, 0.5 + 0.25 * Math.sin(clock * 5 + t.id) + 0.4 * kick);
    for (let i = 0; i < BARS.length - 1; i++) {
      const u0 = BARS[i] + BAR + 0.3,
        u1 = BARS[i + 1] - BAR - 0.3,
        flick = heat * (0.8 + 0.2 * Math.sin(clock * 7 + i * 1.7)),
        v0 = -SPAN + 0.5,
        v1 = SPAN - 0.5;
      quad(g, X(x, u0), Y(y0, v0, FLOOR), X(x, u1), Y(y0, v0, FLOOR), X(x, u1), Y(y0, v1, FLOOR), X(x, u0), Y(y0, v1, FLOOR), shade(c, -0.6 + 0.6 * flick));
      quad(glow, X(x, u0 - 0.5), Y(y0, v0, FLOOR), X(x, u1 + 0.5), Y(y0, v0, FLOOR), X(x, u1 + 0.5), Y(y0, v1, FLOOR), X(x, u0 - 0.5), Y(y0, v1, FLOOR), c, 0.12 + 0.16 * flick);
    }
    chasers(ctx, S, H);
  },
  turret: () => {},
  // Embers drifting up out of the slots; a strike throws a burst of them.
  above: (ctx) => {
    const { g, glow, x, y, tower: t, definition: d, clock, kick } = ctx,
      c = d.color,
      y0 = y + DROP;
    const embers = kick > 0 ? 6 : 3;
    for (let i = 0; i < embers; i++) {
      const phase = (clock * 0.8 + i / embers + t.id * 0.27) % 1,
        u = -9 + ((i * 7) % 18) + Math.sin(clock * 3 + i) * 1.5,
        v = -6 + ((i * 5) % 12),
        ex = X(x, u),
        ey = Y(y0, v, TOP + phase * 14);
      disc(g, ex, ey, 0.8, shade(c, 0.5), 1 - phase);
      disc(glow, ex, ey, 1.8, c, 0.3 * (1 - phase));
    }
    if (kick > 0) onGround(glow, x, y0, TOP, () => disc(glow, 0, 0, SPAN, c, 0.18 * kick));
    armedLight(ctx, S, TOP);
  },
};
