import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import { lamp } from "../render/tower-art/tilt-parts";
import { box, frame, plane, rod } from "../render/tower-art/tilt-frame";
import { SQUASH, onGround } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, ngon, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Tracker: a surveyor's tripod over a round foot pad; its laser head sweeps the field and paints a marker dot. */
const DROP = 5,
  FOOT_H = 3,
  APEX = 17,
  HEAD = 20;
const PAD = ngon(10, 9, Math.PI / 10);
/** Tripod feet: back leg first. */
const LEGS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const RED = 0xff5f6d,
  OUTLINE_RED = 0x2a0d12;

export const concept: Concept = {
  tower: "tracker",
  name: "Survey Tripod",
  idea: "A surveyor's tripod over a round foot pad; its laser head sweeps the field and paints a marker dot on the ground.",
  tilt: { drop: DROP, squash: SQUASH, height: HEAD, deck: FOOT_H },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP;
    contact(g, x, y0, 16, 14);
    // Three feet with spikes, the back leg drawn first, the foot pad, then the front legs.
    const leg = (a: number) => {
      const u = Math.cos(a) * 17,
        v = Math.sin(a) * 17;
      drumAt(g, x, y0, u, v, 2.2, 0, 1.6, STEEL.deep, STEEL.side, 8);
      rod(g, x, y0, u, v, 1.4, Math.cos(a) * 3, Math.sin(a) * 3, APEX, 2.8, STEEL.top);
      if (level >= 3) rod(g, x, y0, u * 0.55, v * 0.55, 8, u * 0.6, v * 0.6, 7.2, 3, RED);
    };
    leg(LEGS[0]);
    slab(g, x, y0, PAD, 0, FOOT_H, 1, STEEL.side, STEEL.top);
    leg(LEGS[1]);
    leg(LEGS[2]);
    // The head's bearing housing.
    drumAt(g, x, y0, 0, 0, 3.8, APEX - 1, APEX + 1.5, STEEL.deep, STEEL.side, 10);
    if (level >= 4) drumAt(g, x, y0, 0, 0, 4, APEX - 0.6, APEX + 0.2, color, shade(color, 0.2), 10);
  },
  below: () => {},
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0),
      a = clock * 0.9 + tower.id,
      f = frame(a, 0.12, HEAD);
    // The laser head: a small box turning with the sweep, the lens on its front.
    const front = box(g, x, y0, f, -5, 5, -3.2, 3.2, -2.6, 2.6, STEEL.side, STEEL.top);
    box(g, x, y0, f, -3, 3, -1.6, 1.6, 2.6, 4, shade(RED, -0.45), shade(RED, -0.2));
    if (front) {
      plane(g, x, y0, f, 5.1, 2.2, OUTLINE_RED);
      plane(g, x, y0, f, 5.2, 1.5, shade(RED, 0.25));
    }
    // The beam to a marker dot sweeping round the field.
    const r = 22,
      [tx, ty] = P(Math.cos(a) * r, Math.sin(a) * r, 0),
      [lx, ly] = P(Math.cos(a) * 5 * Math.cos(0.12), Math.sin(a) * 5 * Math.cos(0.12), HEAD + 5 * Math.sin(0.12));
    glow.lineStyle(1.1, RED, 0.3);
    glow.lineBetween(lx, ly, tx, ty);
    onGround(glow, tx, ty, 0, () => disc(glow, 0, 0, 3.2, RED, 0.5));
    halo(glow, lx, ly, 4, RED, 0.3);
    if (level >= 2) lamp(g, glow, ...P(0, 0, APEX + 2.6), color, 0.5 + 0.5 * Math.max(0, Math.sin(clock * 5)));
  },
};
