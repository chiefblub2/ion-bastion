import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, SQUASH, X, Y, drum, fillPoints, onGround, point } from "../render/tower-art/tilt";
import { part, rect } from "../render/tower-art/tilt-parts";
import { DROP, STEEL, armedLight, chasers, frame, lampSocket } from "./kit-traps-a";
import type { Concept } from "./types";

const S = 19,
  H = 2,
  TOP = H + 1,
  /** Jaw radius (outer), its width and the teeth. */
  JR = 14,
  JW = 2.6,
  TEETH = 5,
  SEG = 10;

/**
 * One jaw (`side` -1 north, 1 south): a half ring hinged on the east-west axis, lying flat when open and swung up by
 * `fold` (0–1, a quarter turn) when it snaps shut; teeth along its inner edge point at the axis.
 */
function jaw(ctx: TurretContext, side: number, fold: number) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP,
    th = (fold * Math.PI) / 2,
    ct = Math.cos(th),
    st = Math.sin(th),
    at = (r: number, phi: number, lift = 0, up = 0) => {
      // `up`: out of the jaw's plane along its normal (straight up when open, toward the axis when shut).
      const w = r * Math.sin(phi);
      return [X(x, r * Math.cos(phi)), Y(y0, side * w * ct - side * up * st, TOP + 0.6 + w * st + lift + up * ct)] as const;
    };
  // The band, outer arc then inner arc back.
  for (let i = 0; i <= SEG; i++) point(i, ...at(JR, (i / SEG) * Math.PI));
  for (let i = 0; i <= SEG; i++) point(SEG + 1 + i, ...at(JR - JW, ((SEG - i) / SEG) * Math.PI));
  fillPoints(g, 2 * SEG + 2, OUTLINE, 0.9);
  for (let i = 0; i <= SEG; i++) point(i, ...at(JR - 0.3, (i / SEG) * Math.PI, 0.5));
  for (let i = 0; i <= SEG; i++) point(SEG + 1 + i, ...at(JR - JW + 0.3, ((SEG - i) / SEG) * Math.PI, 0.5));
  fillPoints(g, 2 * SEG + 2, level >= 6 ? shade(color, -0.2) : shade(c, side < 0 ? 0.2 : -0.1));
  // Teeth: a lit and a shaded half each, standing out of the jaw's inner edge (up when open, inward when shut).
  for (let k = 0; k < TEETH; k++) {
    const phi = ((k + 0.5) / TEETH) * Math.PI,
      base0 = at(JR - JW * 0.5, phi - 0.2, 0.5),
      base1 = at(JR - JW * 0.5, phi + 0.2, 0.5),
      tip = at(JR - JW * 0.6, phi, 0.5, 4.2),
      mid = at(JR - JW * 0.5, phi, 0.5);
    g.fillStyle(shade(c, 0.45));
    g.fillTriangle(base0[0], base0[1], mid[0], mid[1], tip[0], tip[1]);
    g.fillStyle(shade(c, -0.4));
    g.fillTriangle(mid[0], mid[1], base1[0], base1[1], tip[0], tip[1]);
  }
}

/** Bear Trap: a steel-jawed trap on a plate; open flat at rest, the two jaws swing up and bite on a strike. */
export const concept: Concept = {
  tower: "snare",
  name: "Iron Jaws",
  idea: "Two toothed half-ring jaws lie open flat around a pressure pan on a steel plate, with coil springs at the hinges; on a strike they swing up and bite.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y, definition: d, level } = ctx,
      c = d.color,
      y0 = y + DROP;
    frame(ctx, S, H);
    // Hinge blocks with coil springs at both ends of the axis.
    for (const u of [-1, 1]) {
      part(g, x, y0, 0, rect(u * (JR + 1) - 2.2, u * (JR + 1) + 2.2, -2.6, 2.6), TOP - 0.5, TOP + 1.8, 0, STEEL.wall, STEEL.top, STEEL.metal);
      onGround(g, x, y0, TOP + 1.8, () => {
        g.lineStyle(0.8, shade(c, -0.3), 1);
        for (let k = -1; k <= 1; k++) g.lineBetween(u * (JR + 1) - 1.6, k * 1.4, u * (JR + 1) + 1.6, k * 1.4 + 0.6);
      });
    }
    // The pressure pan in the middle.
    drum(g, x, y0, 5.6, TOP - 0.3, TOP + 0.7, STEEL.wall, shade(c, -0.2), 12);
    onGround(g, x, y0, TOP + 0.7, () => {
      disc(g, 0, 0, 1.4, OUTLINE);
      if (level >= 3) for (const a of [0, Math.PI]) disc(g, Math.cos(a) * 3, 0, 0.6, STEEL.metal);
    });
    lampSocket(ctx, S, TOP);
  },
  below: (ctx) => chasers(ctx, S, H),
  // Open at rest; a strike swings both jaws up (the back one first, so the front one covers it).
  turret: (ctx) => {
    const fold = ctx.kick;
    jaw(ctx, -1, fold);
    jaw(ctx, 1, fold);
  },
  above: (ctx) => armedLight(ctx, S, TOP),
};
