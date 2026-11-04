import { disc, oval, shade } from "../../shapes";
import { OUTLINE, SQUASH, X, Y, drum, onGround } from "../tilt";
import { DROP, STEEL, armedLight, chasers, frame, lampSocket, well } from "./kit-traps-a";
import type { TiltedConcept as Concept } from "../tilted";

const S = 16,
  H = 2,
  TOP = H + 1,
  COIL = 7.2,
  PLATE = 5.6;

/** Height of the launch plate: low and loaded at rest, thrown up on a strike. */
const plateAt = (kick: number) => TOP + 2.8 + 4.2 * kick;

/** Spring: a coiled spring in a square socket under a round launch plate that kicks up and flings enemies back. */
export const concept: Concept = {
  tower: "spring",
  name: "Coil Launcher",
  idea: "A heavy green coil spring in a square steel socket under a round launch plate; loaded low at rest, the plate kicks up on a strike.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: TOP },
  base: (ctx) => {
    const { g, x, y } = ctx,
      y0 = y + DROP;
    frame(ctx, S, H);
    well(g, x, y0, TOP, PLATE + 0.8, (PLATE + 0.8) * SQUASH, STEEL.deep);
    lampSocket(ctx, S, TOP);
  },
  below: (ctx) => chasers(ctx, S, H),
  // The coil from the well's floor to the plate (back strands first, then the lit front ones), then the plate.
  turret: (ctx) => {
    const { g, x, y, definition: d, level, kick, color } = ctx,
      c = d.color,
      y0 = y + DROP,
      top = plateAt(kick),
      floor = TOP - 1.2,
      turns = 4,
      step = (top - floor) / turns;
    for (const front of [false, true]) {
      g.lineStyle(front ? 1.5 : 1.3, front ? shade(c, 0.25) : shade(c, -0.5), 1);
      for (let i = 0; i < turns; i++) {
        const h0 = floor + i * step;
        // Each turn: the back half rises from right to left, the front half from left to right.
        const a = front ? [X(x, -COIL), Y(y0, 0, h0 + step / 2), X(x, COIL), Y(y0, 0, h0 + step)] : [X(x, COIL), Y(y0, 0, h0), X(x, -COIL), Y(y0, 0, h0 + step / 2)];
        const mx = (a[0] + a[2]) / 2,
          my = (a[1] + a[3]) / 2 + (front ? COIL * SQUASH : -COIL * SQUASH);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        for (let k = 1; k <= 6; k++) {
          const t = k / 6,
            bx = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * a[2],
            by = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * a[3];
          g.lineTo(bx, by);
        }
        g.strokePath();
      }
    }
    drum(g, x, y0, PLATE, top, top + 1.2, level >= 6 ? shade(color, -0.3) : shade(c, -0.35), shade(c, -0.05), 14);
    onGround(g, x, y0, top + 1.2, () => {
      oval(g, 0, 0, PLATE - 2, PLATE - 2, OUTLINE, 0.35);
      for (let i = 0; i < (level >= 3 ? 4 : 2); i++) {
        const a = Math.PI / 4 + (i * Math.PI * 2) / (level >= 3 ? 4 : 2);
        disc(g, Math.cos(a) * (PLATE - 1.6), Math.sin(a) * (PLATE - 1.6), 0.7, STEEL.metal);
      }
    });
  },
  above: (ctx) => {
    const { glow, x, y, definition: d, kick } = ctx,
      y0 = y + DROP;
    if (kick > 0) onGround(glow, x, y0, plateAt(kick) + 1.2, () => disc(glow, 0, 0, PLATE + 3, d.color, 0.22 * kick));
    armedLight(ctx, S, TOP);
  },
};
